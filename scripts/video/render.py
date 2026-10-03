#!/usr/bin/env python3
"""Validate a fixed-format timeline and render it with local FFmpeg and MoviePy."""
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from contextlib import ExitStack
from pathlib import Path
from typing import Any

WIDTH, HEIGHT, FPS = 1080, 1920, 30
TOP_RATIO = 0.46
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm"}
EPSILON = 1e-3


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _path(base: Path, raw: str) -> Path:
    path = Path(raw)
    return path if path.is_absolute() else (base / path).resolve()


def _unknown(value: dict[str, Any], allowed: set[str], label: str, errors: list[str]) -> None:
    for key in sorted(value.keys() - allowed):
        errors.append(f"{label}.{key} is not supported")


def _probe(path: Path) -> dict[str, Any]:
    binary = shutil.which("ffprobe")
    if not binary:
        raise RuntimeError("ffprobe is required on PATH")
    process = subprocess.run(
        [binary, "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)],
        capture_output=True, text=True, check=False,
    )
    if process.returncode:
        raise ValueError(f"ffprobe failed for {path}: {process.stderr.strip()}")
    return json.loads(process.stdout)


def _duration(info: dict[str, Any]) -> float:
    value = info.get("format", {}).get("duration")
    if value is None:
        raise ValueError("media duration is unavailable")
    return float(value)


def _has_stream(info: dict[str, Any], kind: str) -> bool:
    return any(stream.get("codec_type") == kind for stream in info.get("streams", []))


def _frozen(path: Path, seconds: float, clip_in: float, span: float) -> bool:
    binary = shutil.which("ffmpeg")
    if not binary:
        raise RuntimeError("ffmpeg is required on PATH")
    result = subprocess.run(
        [binary, "-hide_banner", "-nostdin", "-ss", str(clip_in), "-t", str(span),
         "-i", str(path), "-vf", f"freezedetect=n=-50dB:d={seconds}", "-an", "-f", "null", "-"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise ValueError(f"freeze inspection failed for {path}: {result.stderr[-300:]}")
    return "lavfi.freezedetect.freeze_start:" in result.stderr


def validate_timeline(data: Any, *, base_dir: Path | None = None, require_assets: bool = False) -> list[str]:
    errors: list[str] = []
    if not isinstance(data, dict):
        return ["timeline must be an object"]
    base = base_dir or Path.cwd()
    _unknown(data, {"version", "project", "output", "video", "segments", "subtitles",
                    "voice", "bgm", "sound_effects", "style"}, "timeline", errors)
    if data.get("version") != "1.0":
        errors.append("version must be 1.0")
    if not isinstance(data.get("project"), str) or not data["project"].strip():
        errors.append("project must be a non-empty string")
    video = data.get("video")
    if not isinstance(video, dict):
        return errors + ["video must be an object"]
    _unknown(video, {"width", "height", "fps", "top_ratio", "duration",
                     "max_static_top_seconds", "background"}, "video", errors)
    for key, expected in (("width", WIDTH), ("height", HEIGHT), ("fps", FPS)):
        if type(video.get(key)) is not int or video[key] != expected:
            errors.append(f"video.{key} must be {expected}")
    if not _number(video.get("top_ratio")) or not math.isclose(video["top_ratio"], TOP_RATIO, abs_tol=1e-9):
        errors.append("video.top_ratio must be 0.46")
    duration = video.get("duration")
    if not _number(duration) or duration <= 0:
        errors.append("video.duration must be positive")
        duration = None
    static_limit = video.get("max_static_top_seconds")
    if not _number(static_limit) or static_limit <= 0:
        errors.append("video.max_static_top_seconds must be positive")
        static_limit = None
    if video.get("background", "black") not in ("black", "white"):
        errors.append("video.background must be black or white")
    output = data.get("output")
    if not isinstance(output, dict) or not isinstance(output.get("path"), str) or not output["path"].strip() or Path(output["path"]).suffix.lower() != ".mp4":
        errors.append("output.path must name an MP4 file")
        output_path = None
    else:
        _unknown(output, {"path"}, "output", errors)
        output_path = _path(base, output["path"])

    segments = data.get("segments")
    if not isinstance(segments, list) or not segments:
        return errors + ["segments must be a non-empty array"]
    last_end = 0.0
    asset_paths: set[Path] = set()
    still_path: Path | None = None
    still_span = 0.0
    for index, segment in enumerate(segments):
        prefix = f"segments[{index}]"
        if not isinstance(segment, dict):
            errors.append(f"{prefix} must be an object")
            continue
        _unknown(segment, {"start", "end", "top_media", "presenter"}, prefix, errors)
        start, end = segment.get("start"), segment.get("end")
        if not _number(start) or not _number(end) or start < 0 or start >= end:
            errors.append(f"{prefix} requires 0 <= start < end")
            continue
        if not math.isclose(start, last_end, abs_tol=EPSILON):
            errors.append(f"{prefix} has a timeline gap or overlap")
        last_end = end
        if duration is not None and end > duration + EPSILON:
            errors.append(f"{prefix} exceeds video.duration")
        for lane in ("top_media", "presenter"):
            spec = segment.get(lane)
            if not isinstance(spec, dict) or not isinstance(spec.get("path"), str) or not spec["path"].strip():
                errors.append(f"{prefix}.{lane}.path is required")
                continue
            _unknown(spec, {"path", "in", "out", "loop", "fit"}, f"{prefix}.{lane}", errors)
            path = _path(base, spec["path"])
            asset_paths.add(path)
            extension = path.suffix.lower()
            if extension not in (VIDEO_EXTENSIONS | IMAGE_EXTENSIONS if lane == "top_media" else VIDEO_EXTENSIONS):
                errors.append(f"{prefix}.{lane} has unsupported media extension")
            if extension in IMAGE_EXTENSIONS and ("in" in spec or "out" in spec or spec.get("loop", False)):
                errors.append(f"{prefix}.{lane} cannot trim or loop a still image")
            clip_in, clip_out = spec.get("in", 0), spec.get("out")
            if not _number(clip_in) or clip_in < 0 or (clip_out is not None and (not _number(clip_out) or clip_out <= clip_in)):
                errors.append(f"{prefix}.{lane} has invalid in/out range")
                continue
            if type(spec.get("loop", False)) is not bool or spec.get("fit", "cover") not in ("cover", "contain"):
                errors.append(f"{prefix}.{lane} has invalid loop/fit")
            span = end - start
            if lane == "top_media":
                if extension in IMAGE_EXTENSIONS:
                    still_span = still_span + span if path == still_path else span
                    still_path = path
                    if static_limit is not None and still_span > static_limit + EPSILON:
                        errors.append(f"{prefix}.top_media exceeds max_static_top_seconds")
                else:
                    still_path, still_span = None, 0.0
            if require_assets:
                if not path.is_file():
                    errors.append(f"missing asset: {path}")
                    continue
                if extension in VIDEO_EXTENSIONS:
                    try:
                        info = _probe(path)
                        if not _has_stream(info, "video"):
                            errors.append(f"{prefix}.{lane} has no video stream")
                        available = _duration(info)
                        if clip_in >= available or (clip_out is not None and clip_out > available + EPSILON):
                            errors.append(f"{prefix}.{lane} exceeds source duration")
                        usable = (clip_out if clip_out is not None else available) - clip_in
                        if usable < span - EPSILON and not spec.get("loop", False):
                            errors.append(f"{prefix}.{lane} is too short without loop")
                        if lane == "top_media" and static_limit is not None and span > static_limit + EPSILON and _frozen(path, static_limit, clip_in, span):
                            errors.append(f"{prefix}.top_media contains an excessive frozen interval")
                    except (ValueError, RuntimeError) as exc:
                        errors.append(str(exc))

    if duration is not None and not math.isclose(last_end, duration, abs_tol=EPSILON):
        errors.append("segments must cover video.duration exactly")
    subtitles = data.get("subtitles", [])
    if not isinstance(subtitles, list):
        errors.append("subtitles must be an array")
        subtitles = []
    previous_end = 0.0
    for index, cue in enumerate(subtitles):
        prefix = f"subtitles[{index}]"
        if not isinstance(cue, dict):
            errors.append(f"{prefix} must be an object")
            continue
        _unknown(cue, {"start", "end", "text", "emphasis"}, prefix, errors)
        start, end, content = cue.get("start"), cue.get("end"), cue.get("text")
        if not _number(start) or not _number(end) or start < 0 or start >= end:
            errors.append(f"{prefix} requires 0 <= start < end")
            continue
        if start < previous_end - EPSILON:
            errors.append(f"{prefix} overlaps the previous subtitle")
        previous_end = end
        if duration is not None and end > duration + EPSILON:
            errors.append(f"{prefix} exceeds video.duration")
        if not isinstance(content, str) or not content.strip():
            errors.append(f"{prefix}.text must be non-empty")
        emphasis = cue.get("emphasis")
        if emphasis is not None and (not isinstance(emphasis, str) or not emphasis or not isinstance(content, str) or emphasis not in content):
            errors.append(f"{prefix}.emphasis must occur in text")

    style = data.get("style", {})
    if not isinstance(style, dict):
        errors.append("style must be an object")
        style = {}
    _unknown(style, {"font", "font_size", "subtitle_y", "subtitle_width", "text_color",
                     "emphasis_color", "stroke_color", "stroke_width"}, "style", errors)
    if subtitles:
        font = style.get("font")
        if not isinstance(font, str) or not font:
            errors.append("style.font is required for subtitles")
        elif require_assets and not _path(base, font).is_file():
            errors.append(f"missing asset: {_path(base, font)}")
    for key, minimum, maximum in (("font_size", 1, HEIGHT), ("subtitle_y", 0, HEIGHT - 1),
                                   ("subtitle_width", 1, WIDTH), ("stroke_width", 0, HEIGHT)):
        if key in style and (type(style[key]) is not int or not minimum <= style[key] <= maximum):
            errors.append(f"style.{key} must be an integer from {minimum} to {maximum}")
    for key in ("text_color", "emphasis_color", "stroke_color"):
        if key in style and not isinstance(style[key], str):
            errors.append(f"style.{key} must be a color string")
    if _number(style.get("subtitle_y", 1380)) and _number(style.get("font_size", 58)) and style.get("subtitle_y", 1380) + style.get("font_size", 58) * 3 > HEIGHT:
        errors.append("subtitle style extends beyond canvas")

    for key, multiple in (("voice", False), ("bgm", False), ("sound_effects", True)):
        value = data.get(key, [] if multiple else None)
        specs = value if multiple else ([] if value is None else [value])
        if not isinstance(specs, list):
            errors.append(f"{key} must be an array")
            continue
        for index, spec in enumerate(specs):
            prefix = f"{key}[{index}]" if multiple else key
            if not isinstance(spec, dict) or not isinstance(spec.get("path"), str) or not spec["path"].strip():
                errors.append(f"{prefix}.path is required")
                continue
            _unknown(spec, {"path", "start", "gain_db", "loop"}, prefix, errors)
            path = _path(base, spec["path"])
            asset_paths.add(path)
            start = spec.get("start", 0)
            gain = spec.get("gain_db", 0)
            if not _number(start) or start < 0 or (duration is not None and start >= duration):
                errors.append(f"{prefix}.start is outside video.duration")
            if not _number(gain):
                errors.append(f"{prefix}.gain_db must be finite")
            if type(spec.get("loop", False)) is not bool:
                errors.append(f"{prefix}.loop must be boolean")
            if require_assets:
                if not path.is_file():
                    errors.append(f"missing asset: {path}")
                else:
                    try:
                        info = _probe(path)
                        if not _has_stream(info, "audio"):
                            errors.append(f"{prefix} has no audio stream")
                        elif _number(start) and duration is not None and not spec.get("loop", False) and _duration(info) + start > duration + EPSILON:
                            errors.append(f"{prefix} exceeds video.duration")
                    except (ValueError, RuntimeError) as exc:
                        errors.append(str(exc))
    if output_path in asset_paths:
        errors.append("output.path must not overwrite an input asset")
    if require_assets and subtitles and not errors:
        try:
            for cue in subtitles:
                _subtitle_image(cue, style, base)
        except (OSError, ValueError) as exc:
            errors.append(f"subtitle preflight failed: {exc}")
    return errors


def _fit(clip: Any, width: int, height: int, fit: str, color: tuple[int, int, int]) -> Any:
    from moviepy import ColorClip, CompositeVideoClip
    factor = min(width / clip.w, height / clip.h) if fit == "contain" else max(width / clip.w, height / clip.h)
    resized = clip.resized(factor)
    if fit == "cover":
        return resized.cropped(x_center=resized.w / 2, y_center=resized.h / 2, width=width, height=height)
    return CompositeVideoClip([ColorClip((width, height), color=color, duration=clip.duration), resized.with_position("center")], size=(width, height))


def _media(spec: dict[str, Any], base: Path, span: float, width: int, height: int,
           color: tuple[int, int, int], resources: ExitStack) -> Any:
    from moviepy import ImageClip, VideoFileClip, vfx
    path = _path(base, spec["path"])
    if path.suffix.lower() in IMAGE_EXTENSIONS:
        clip = ImageClip(str(path)).with_duration(span)
    else:
        clip = VideoFileClip(str(path), audio=False)
        resources.callback(clip.close)
        clip_in = spec.get("in", 0)
        clip_out = spec.get("out", clip.duration)
        clip = clip.subclipped(clip_in, clip_out)
        if clip.duration < span - EPSILON:
            clip = clip.with_effects([vfx.Loop(duration=span)])
        else:
            clip = clip.subclipped(0, span)
    return _fit(clip, width, height, spec.get("fit", "cover"), color).with_duration(span)


def _subtitle_image(cue: dict[str, Any], style: dict[str, Any], base: Path) -> Any:
    from PIL import Image, ImageColor, ImageDraw, ImageFont

    font = ImageFont.truetype(str(_path(base, style["font"])), style.get("font_size", 58))
    text, emphasis = cue["text"], cue.get("emphasis")
    width = style.get("subtitle_width", 980)
    stroke = style.get("stroke_width", 4)
    image = Image.new("RGBA", (width, style.get("font_size", 58) * 3), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if draw.textbbox((0, 0), text, font=font, stroke_width=stroke)[2] > width:
        raise ValueError("subtitle exceeds subtitle_width; split the cue or reduce font_size")
    x = (width - draw.textlength(text, font=font)) / 2
    y = style.get("font_size", 58) // 2
    normal = ImageColor.getrgb(style.get("text_color", "white"))
    accent = ImageColor.getrgb(style.get("emphasis_color", "#ffff66"))
    outline = ImageColor.getrgb(style.get("stroke_color", "black"))
    parts = [text] if not emphasis else [text[:text.index(emphasis)], emphasis, text[text.index(emphasis) + len(emphasis):]]
    for index, part in enumerate(parts):
        draw.text((x, y), part, font=font, fill=accent if emphasis and index == 1 else normal,
                  stroke_width=stroke, stroke_fill=outline)
        x += draw.textlength(part, font=font)
    return image


def _subtitle(cue: dict[str, Any], style: dict[str, Any], base: Path) -> Any:
    import numpy as np
    from moviepy import ImageClip
    image = _subtitle_image(cue, style, base)
    width = image.width
    clip = ImageClip(np.asarray(image), transparent=True).with_duration(cue["end"] - cue["start"])
    return clip.with_start(cue["start"]).with_position(((WIDTH - width) // 2, style.get("subtitle_y", 1380)))


def _audio(spec: dict[str, Any], base: Path, remaining: float, resources: ExitStack) -> Any:
    from moviepy import AudioFileClip, afx
    clip = AudioFileClip(str(_path(base, spec["path"])))
    resources.callback(clip.close)
    if clip.duration < 1:
        import numpy as np
        from moviepy.audio.AudioClip import AudioArrayClip
        # MoviePy's file reader cannot safely vector-read short, delayed effects.
        chunks = list(clip.iter_chunks(chunksize=max(1, clip.reader.buffersize // 4), fps=clip.fps))
        clip = AudioArrayClip(np.concatenate(chunks), fps=clip.fps)
    if spec.get("loop", False) and clip.duration < remaining:
        clip = clip.with_effects([afx.AudioLoop(duration=remaining)])
    clip = clip.subclipped(0, min(clip.duration, remaining))
    return clip.with_effects([afx.MultiplyVolume(10 ** (spec.get("gain_db", 0) / 20))]).with_start(spec.get("start", 0))


def render_timeline(data: dict[str, Any], timeline_path: Path, *, overwrite: bool = False) -> Path:
    binary = shutil.which("ffmpeg")
    if not binary or not shutil.which("ffprobe"):
        raise RuntimeError("local ffmpeg and ffprobe binaries are required on PATH")
    os.environ["IMAGEIO_FFMPEG_EXE"] = binary
    os.environ["FFMPEG_BINARY"] = binary
    from moviepy import AudioClip, ColorClip, CompositeAudioClip, CompositeVideoClip

    base = timeline_path.parent
    errors = validate_timeline(data, base_dir=base, require_assets=True)
    if errors:
        raise ValueError("\n".join(errors))
    output = _path(base, data["output"]["path"])
    if output.exists() and not overwrite:
        raise FileExistsError(f"output exists: {output}; use --overwrite")
    output.parent.mkdir(parents=True, exist_ok=True)
    duration = data["video"]["duration"]
    top_height = round(HEIGHT * TOP_RATIO)
    color = (0, 0, 0) if data["video"].get("background", "black") == "black" else (255, 255, 255)
    with ExitStack() as resources, tempfile.TemporaryDirectory(dir=output.parent, prefix=".video-render-") as directory:
        temporary = Path(directory) / "render.mp4"
        layers: list[Any] = [ColorClip((WIDTH, HEIGHT), color=color, duration=duration)]
        for segment in data["segments"]:
            span = segment["end"] - segment["start"]
            top = _media(segment["top_media"], base, span, WIDTH, top_height, color, resources)
            presenter = _media(segment["presenter"], base, span, WIDTH, HEIGHT - top_height, color, resources)
            layers.append(top.with_start(segment["start"]).with_position((0, 0)))
            layers.append(presenter.with_start(segment["start"]).with_position((0, top_height)))
        for cue in data.get("subtitles", []):
            layers.append(_subtitle(cue, data.get("style", {}), base))
        composite = CompositeVideoClip(layers, size=(WIDTH, HEIGHT)).with_duration(duration)
        audio_layers = []
        for key in ("voice", "bgm"):
            if data.get(key):
                spec = data[key]
                audio_layers.append(_audio(spec, base, duration - spec.get("start", 0), resources))
        for spec in data.get("sound_effects", []):
            audio_layers.append(_audio(spec, base, duration - spec.get("start", 0), resources))
        if not audio_layers:
            import numpy as np
            audio_layers.append(AudioClip(
                lambda t: np.zeros((len(t), 2)) if isinstance(t, np.ndarray) else np.zeros(2),
                duration=duration, fps=44100,
            ))
        composite = composite.with_audio(CompositeAudioClip(audio_layers).with_duration(duration))
        resources.callback(composite.close)
        composite.write_videofile(
            str(temporary), fps=FPS, codec="libx264", audio_codec="aac",
            audio_fps=44100, threads=2, preset="medium", logger=None,
            temp_audiofile=str(Path(directory) / "audio.m4a"), ffmpeg_params=["-pix_fmt", "yuv420p"],
        )
        info = _probe(temporary)
        streams = info.get("streams", [])
        if not any(s.get("codec_name") == "h264" and s.get("width") == WIDTH and s.get("height") == HEIGHT and s.get("r_frame_rate") == "30/1" for s in streams) or not any(s.get("codec_name") == "aac" for s in streams):
            raise ValueError("encoded output does not match H.264/AAC 1080x1920 30fps specification")
        if abs(_duration(info) - duration) > 1 / FPS + EPSILON:
            raise ValueError("encoded output duration differs by more than one frame")
        os.replace(temporary, output)
    return output


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeline", type=Path, required=True)
    parser.add_argument("--validate-only", action="store_true")
    parser.add_argument("--require-assets", action="store_true")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args(argv)
    try:
        timeline_path = args.timeline.resolve()
        data = json.loads(timeline_path.read_text(encoding="utf-8"))
        if args.validate_only:
            errors = validate_timeline(data, base_dir=timeline_path.parent, require_assets=args.require_assets)
            if errors:
                print("\n".join(errors), file=sys.stderr)
                return 2
            print("Timeline validation: PASS" + (" (assets checked)" if args.require_assets else " (structure only)"))
            return 0
        print(f"Rendered: {render_timeline(data, timeline_path, overwrite=args.overwrite)}")
        return 0
    except (OSError, ValueError, RuntimeError, ImportError) as exc:
        print(f"Video engine error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
