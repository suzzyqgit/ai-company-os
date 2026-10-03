# Video Rendering Engine

Status: experimental feature-branch implementation. This is a renderer, not a
creative decision system or a finished Pilot #001 video.

Given an already-decided timeline JSON, the engine validates its fixed vertical
format and renders an MP4. It does not select source material, write narration,
decide timing, check media rights, or publish. The output format is
1080 x 1920, 30 fps, H.264 video and AAC audio. The split ratio is authored in
Timeline JSON through video.top_ratio (strictly between 0 and 1). The current
reference sample uses 50:50; this is not an engine constant.
Keeping the timeline, inputs, font, dependency versions, and local
FFmpeg version fixed makes repeat renders reproducible in the same environment;
cross-version byte-identical MP4 output is not promised.

## Requirements

- Python 3.11 or newer
- MoviePy 2.2.1 and the scene-detection dependencies below (see requirements.txt)
- Local ffmpeg and ffprobe executables on PATH; neither is vendored into this repository
- A TrueType/OpenType font file when subtitles are used

Install the Python dependencies in an isolated environment outside the repository, or use an
existing compatible environment. For example:

```bash
python3.11 -m venv /tmp/ai-company-os-video-venv
/tmp/ai-company-os-video-venv/bin/pip install -r scripts/video/requirements.txt
ffmpeg -version
ffprobe -version
```

The renderer explicitly selects the local ffmpeg binary before importing
MoviePy, including when imageio-ffmpeg is present transitively.

## Timeline

See timeline_schema.json and examples/pilot-001.sample.json. The sample is
structural only: its media and font paths are placeholders, and it is not a
Pilot #001 render. Paths are relative to the timeline JSON. The main fields
are project, output, video, segments, subtitles, voice, bgm, and sound_effects.
Segments must cover video.duration without gaps or overlaps. Each segment
places top_media above presenter; video clips can be trimmed and explicitly
looped. Top media can also be a still image.

Each clip can specify focus_x and focus_y from 0 to 1. For cover, this
normalized source point is placed at the crop center, clamped at source edges.
Both values default to 0.5 only when omitted. For contain, the whole source
is centered and focus has no cropping effect. The engine does not choose
Presenter framing or infer a person's position.

An authored max_static_top_seconds limit is required. Still-image segments
longer than that limit are rejected; full asset validation also inspects
longer top-video segments for sustained frozen frames. This is a technical
preflight, not a creative approval.

Subtitles support explicit newlines and width-based wrapping, with a maximum
of two lines. A third line is rejected in preflight. Each line is centered,
and substring emphasis keeps its color across line breaks. The supplied
font controls glyph coverage and measured layout.

subtitle_x specifies the horizontal center (default 540). subtitle_y is
the block's top edge by default; subtitle_anchor: "center" makes it the
vertical center instead. The current reference sample uses (540, 960).
subtitle_margin_x (default 40) and subtitle_margin_y (default 0) define canvas
safe margins. Preflight checks the full subtitle width and measured block
height, including two lines, strokes, and line_spacing (default 12).
Font-dependent wrapping and vertical overflow checks require --require-assets
and always run before rendering.

Voice, BGM, and
sound effects are gain-adjusted and mixed; a silent AAC track is emitted when
no audio inputs are supplied. Output is created as a temporary MP4 and
atomically moved into place after a successful render. Existing output is
preserved unless --overwrite is supplied.

## Commands

```bash
npm run video:test
npm run video:validate
/tmp/ai-company-os-video-venv/bin/python -B -m unittest discover -s scripts/video -p 'test_*.py'
python3 -B scripts/video/render.py --timeline path/to/timeline.json --validate-only --require-assets
python3 -B scripts/video/render.py --timeline path/to/timeline.json
```

video:validate checks the placeholder sample's structure only. Actual render
always checks asset existence, source duration and media streams, subtitle
timing, geometry, fixed output spec, and excessive static upper media.
Set the active Python interpreter to the MoviePy environment for render.
Renderer structural unit tests run without MoviePy. video:test also includes
scene tests, which require the pinned scene dependencies. Renderer integration
tests are skipped unless MoviePy and both local FFmpeg tools are available. The integration
test generates disposable fixtures and verifies codecs, duration, layout,
presenter loop, silent AAC, audio mixing, and repeated-output SHA-256 equality.

## Limitations

Subtitles that need more than two lines require shorter cues or an authored
style adjustment. Timing is quantized to 30 fps and durations may differ by up to
one frame. Static-video detection is an FFmpeg pixel-change heuristic, not a
semantic scene-change assessment. Long timelines and high asset counts have
not yet been load-tested. MoviePy 2.2.1 may emit upstream reader ResourceWarning
messages for completed FFmpeg processes even when render tests pass.

The engine does not generate AI narration, create subtitles, select emphasis,
verify licenses, or make TikTok-specific creative changes.

## Scene Detection (Phase 1)

scene_detect.py is an independent upstream utility. It uses PySceneDetect's
ContentDetector to find pixel-based fast cuts/hard scene changes and produces
scene_schema.json-compatible JSON. It does not rank scenes, infer meaning,
transcribe speech, generate subtitles, select B-roll, create a Timeline, or
render Pilot #001. The existing renderer is unchanged.

Pinned dependencies in requirements.txt:

- scenedetect-headless 0.7.1: PySceneDetect's headless distribution
- opencv-python-headless 4.11.0.86: required OpenCV video decoding/HSV pixel analysis
- numpy 2.4.6: numerical array dependency used by OpenCV/PySceneDetect and MoviePy
- jsonschema 4.25.1: local Draft 2020-12 JSON validation (no network schema retrieval)

Only one OpenCV/PySceneDetect package variant should be installed per environment.
No ML model, speech recognition, external API, or AI selection dependency is added.
OpenCV 4.11.0.86 is pinned to the MP4-decoding build verified on the local Mac;
do not upgrade it without rerunning the real-video integration tests.
Detection uses the OpenCV wheel's decoder; probe/export use the local ffprobe/ffmpeg
executables on PATH. No FFmpeg binary is committed or vendored by this feature.

```bash
python3 -B scripts/video/scene_detect.py --input /path/to/source.mp4 --output /path/to/scenes.json --threshold 27
python3 -B scripts/video/scene_detect.py --input /path/to/source.mp4 --output /path/to/scenes.json --export-scenes /path/to/clips
npm run video:scene:test
npm run video:scene:validate
```

Use the isolated environment's Python (or activate it before npm commands).
Threshold is configurable: 0 < threshold <= 255, default 27. This is a technical
default, not a creative rule. Lower values are more sensitive. All frames are
analyzed, with a one-frame minimum scene length; rapid changes are not suppressed
by a hidden duration rule. Detection can mistake flashes/camera movement for cuts
or miss subtle cuts. Fades/dissolves and semantic scene boundaries are not promised.

Results record source path, video duration, width/height, fps, codec, detector
version/settings, and one-based index/start/end/duration per scene. End times are
exclusive and quantized to source frames, not the renderer's 30 fps. No detected
cut means one scene covering the video. No creative selection is made.
The example JSON is a synthetic three-color fixture result, not a real content claim.

This first version accepts one zero-origin constant-frame-rate video stream.
Audio-only, missing/invalid duration, invalid threshold, ambiguous multiple video
streams, non-zero-origin streams, and detected VFR metadata are rejected. VFR is
not supported; nominal frame-rate metadata alone cannot certify every timestamp.
Truncated decode/coverage mismatch fails before JSON/export publication.

--export-scenes is opt-in. FFmpeg writes scene-001.mp4, scene-002.mp4, etc., with
frame-accurate H.264 (CRF 18) / optional AAC (192 kbps) re-encoding. Stream copy
is intentionally not used: detected cuts need not coincide with keyframes.
Exports retain source resolution/rate and do not replace the source. Detection
without this flag produces only JSON. Source audio is not analyzed.

Existing JSON/clip destinations, input aliases (including symlinks/hard links),
and overwrites are rejected. Each completed output is atomically published with
no replacement. Export encoding finishes in staging before any clip publication;
multi-file publication is not a global transaction (a late filesystem failure can
leave completed clips, but never overwrite an existing file). Use a fresh output
directory when retrying. Input files are never written.

Scene tests require the pinned dependencies plus local FFmpeg tools; missing
dependencies fail rather than silently skipping integration coverage. Fixtures
are generated in temporary directories. Tests cover boundaries, no-cut footage,
metadata/schema, errors, source/alias protection, and optional real MP4 exports.
