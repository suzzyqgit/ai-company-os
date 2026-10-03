# Video Rendering Engine

Status: experimental feature-branch implementation. This is a renderer, not a
creative decision system or a finished Pilot #001 video.

Given an already-decided timeline JSON, the engine validates its fixed vertical
format and renders an MP4. It does not select source material, write narration,
decide timing, check media rights, or publish. The output format is fixed:
1080 x 1920, 30 fps, upper media 46%, lower presenter 54%, H.264 video and
AAC audio. Keeping the timeline, inputs, font, dependency versions, and local
FFmpeg version fixed makes repeat renders reproducible in the same environment;
cross-version byte-identical MP4 output is not promised.

## Requirements

- Python 3.11 or newer
- MoviePy 2.2.1 (see requirements.txt)
- Local ffmpeg and ffprobe executables on PATH; neither is vendored into this repository
- A TrueType/OpenType font file when subtitles are used

Install MoviePy in an isolated environment outside the repository, or use an
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

An authored max_static_top_seconds limit is required. Still-image segments
longer than that limit are rejected; full asset validation also inspects
longer top-video segments for sustained frozen frames. This is a technical
preflight, not a creative approval.

Subtitle emphasis is a text substring within the cue and receives the
emphasis color. The supplied font controls glyph coverage. Voice, BGM, and
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
The unit suite runs without MoviePy. Its render integration test is skipped
unless MoviePy and both local FFmpeg tools are available. The integration
test generates disposable fixtures and verifies codecs, duration, layout,
presenter loop, silent AAC, audio mixing, and repeated-output SHA-256 equality.

## Limitations

The current subtitle renderer uses one line per cue; split long text into
shorter cues. Timing is quantized to 30 fps and durations may differ by up to
one frame. Static-video detection is an FFmpeg pixel-change heuristic, not a
semantic scene-change assessment. Long timelines and high asset counts have
not yet been load-tested. MoviePy 2.2.1 may emit upstream reader ResourceWarning
messages for completed FFmpeg processes even when render tests pass.

The engine does not generate AI narration, create subtitles, select emphasis,
verify licenses, or make TikTok-specific creative changes.
