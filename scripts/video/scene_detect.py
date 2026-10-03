"""Pixel-based cut detection only; no content ranking or editing decisions."""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction
from pathlib import Path

DEFAULT_THRESHOLD = 27.0


class SceneDetectionError(ValueError):
    pass


def validate_threshold(value):
    if isinstance(value, bool):
        raise SceneDetectionError("threshold must be finite and satisfy 0 < threshold <= 255")
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise SceneDetectionError("invalid threshold") from error
    if not math.isfinite(number) or not 0 < number <= 255:
        raise SceneDetectionError("threshold must be finite and satisfy 0 < threshold <= 255")
    return number


def _run(command, **kwargs):
    try:
        return subprocess.run(command, check=True, capture_output=True, text=True, **kwargs)
    except (OSError, subprocess.SubprocessError) as error:
        detail = getattr(error, "stderr", None) or str(error)
        raise SceneDetectionError(detail.strip()) from error


def probe_source(path):
    path = Path(path).resolve()
    if not path.is_file():
        raise SceneDetectionError(f"input file missing: {path}")
    if not shutil.which("ffprobe"):
        raise SceneDetectionError("local ffprobe executable required")
    try:
        info = json.loads(_run([
            "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)
        ], timeout=30).stdout)
        streams = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
        if not streams:
            raise SceneDetectionError("input has no video stream")
        if len(streams) != 1 or streams[0].get("disposition", {}).get("attached_pic"):
            raise SceneDetectionError("multiple video streams are unsupported")
        stream = streams[0]
        duration = float(stream.get("duration", info.get("format", {}).get("duration", "nan")))
        if not math.isfinite(duration) or duration <= 0:
            raise SceneDetectionError("video duration unavailable or invalid")
        fps = Fraction(stream["avg_frame_rate"])
        if fps <= 0 or fps != Fraction(stream["r_frame_rate"]):
            raise SceneDetectionError("a constant, positive video frame rate is required; VFR unsupported")
        start = float(stream.get("start_time", 0))
        if not math.isfinite(start) or abs(start) > 1e-6:
            raise SceneDetectionError("non-zero video start time unsupported")
        source = {
            "path": str(path), "duration": duration, "fps": float(fps),
            "width": int(stream["width"]), "height": int(stream["height"]),
            "codec": stream["codec_name"],
        }
        if min(source["width"], source["height"]) <= 0 or not source["codec"]:
            raise SceneDetectionError("invalid video metadata")
        return source
    except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
        if isinstance(error, SceneDetectionError):
            raise
        raise SceneDetectionError(f"video metadata unavailable: {error}") from error


def validate_document(data):
    try:
        from jsonschema import Draft202012Validator
    except ImportError as error:
        raise SceneDetectionError("install scripts/video/requirements.txt (jsonschema required)") from error
    schema = json.loads(Path(__file__).with_name("scene_schema.json").read_text())
    errors = [error.message for error in Draft202012Validator(schema).iter_errors(data)]
    if errors:
        raise SceneDetectionError("scene JSON schema: " + "; ".join(errors))
    source = data["source"]
    numbers = [source["duration"], source["fps"]]
    numbers += [s[key] for s in data["scenes"] for key in ("start", "end", "duration")]
    if not all(math.isfinite(n) for n in numbers):
        raise SceneDetectionError("scene JSON contains nonfinite numbers")
    previous = 0.0
    for index, scene in enumerate(data["scenes"], 1):
        if (scene["index"] != index or abs(scene["start"] - previous) > 1e-6
                or scene["end"] <= scene["start"]
                or abs(scene["duration"] - (scene["end"] - scene["start"])) > 1e-6):
            raise SceneDetectionError("scenes must be positive, contiguous, ordered intervals")
        previous = scene["end"]
    if abs(previous - source["duration"]) > 1 / source["fps"] + 1e-6:
        raise SceneDetectionError("scenes must cover source duration within one frame")
    if "detection" in data:
        validate_threshold(data["detection"]["threshold"])
    return data


def detect_scenes(path, threshold=DEFAULT_THRESHOLD):
    threshold = validate_threshold(threshold)
    source = probe_source(path)
    try:
        import scenedetect
        from scenedetect import ContentDetector, SceneManager, open_video
    except ImportError as error:
        raise SceneDetectionError("install scripts/video/requirements.txt (PySceneDetect/OpenCV required)") from error
    try:
        video = open_video(source["path"], frame_rate=source["fps"], backend="opencv")
        manager = SceneManager()
        # One-frame minimum avoids silently suppressing rapid, authored cuts.
        manager.add_detector(ContentDetector(threshold=threshold, min_scene_len=1))
        decoded = manager.detect_scenes(video=video, show_progress=False)
        intervals = manager.get_scene_list(start_in_scene=True)
    except Exception as error:
        raise SceneDetectionError(f"PySceneDetect failed: {error}") from error
    if not intervals or abs(decoded / source["fps"] - source["duration"]) > 1 / source["fps"] + 1e-6:
        raise SceneDetectionError("decoded video coverage differs from probed duration")
    scenes = []
    for index, (start, end) in enumerate(intervals, 1):
        scenes.append({
            "index": index, "start": start.seconds, "end": end.seconds,
            "duration": end.seconds - start.seconds,
        })
    return validate_document({
        "version": "1.0", "source": source, "scenes": scenes,
        "detection": {"method": "ContentDetector", "threshold": threshold,
                      "min_scene_len_frames": 1, "pyscenedetect_version": scenedetect.__version__},
    })


def _output_available(path, source):
    path = Path(path)
    if path.resolve() == source or (path.exists() and os.path.samefile(path, source)):
        raise SceneDetectionError("output must not overwrite input")
    if path.exists() or path.is_symlink():
        raise SceneDetectionError(f"output already exists (no overwrite): {path}")


def _publish(path, staged):
    # Same-filesystem hard link atomically publishes without replacing an existing path.
    try:
        os.link(staged, path)
    except FileExistsError as error:
        raise SceneDetectionError(f"output already exists (no overwrite): {path}") from error


def process_video(input_path, output_path, threshold=DEFAULT_THRESHOLD, export_dir=None):
    threshold = validate_threshold(threshold)
    source = Path(input_path).resolve()
    if not source.is_file():
        raise SceneDetectionError(f"input file missing: {source}")
    output = Path(output_path).absolute()
    _output_available(output, source)
    if output.suffix.lower() != ".json":
        raise SceneDetectionError("output path must end in .json")
    if export_dir is not None and not shutil.which("ffmpeg"):
        raise SceneDetectionError("local ffmpeg executable required for scene export")
    data = detect_scenes(source, threshold)
    exports = []
    if export_dir is not None:
        directory = Path(export_dir).absolute()
        if directory.exists() and not directory.is_dir():
            raise SceneDetectionError("export-scenes path must be a directory")
        exports = [directory / f"scene-{s['index']:03d}.mp4" for s in data["scenes"]]
        for path in exports:
            _output_available(path, source)
        directory.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".scene-export-", dir=directory) as staging:
            staged = []
            for scene, destination in zip(data["scenes"], exports):
                path = Path(staging) / destination.name
                _run([
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n",
                    "-ss", str(scene["start"]), "-i", str(source), "-t", str(scene["duration"]),
                    "-map", "0:v:0", "-map", "0:a:0?", "-sn", "-dn",
                    "-c:v", "libx264", "-crf", "18", "-preset", "medium",
                    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(path),
                ])
                metadata = probe_source(path)
                if abs(metadata["duration"] - scene["duration"]) > 1 / data["source"]["fps"] + 1e-6:
                    raise SceneDetectionError("exported scene duration mismatch")
                staged.append(path)
            for path, destination in zip(staged, exports):
                _publish(destination, path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent) as temporary:
        json.dump(data, temporary, indent=2, allow_nan=False)
        temporary.write("\n")
        temporary.flush()
        _publish(output, temporary.name)
    return data


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    parser.add_argument("--export-scenes", type=Path)
    parser.add_argument("--validate-json", type=Path, help="validate existing scene JSON only; no detection/writes")
    args = parser.parse_args(argv)
    try:
        if args.validate_json:
            if args.input or args.output or args.export_scenes:
                parser.error("--validate-json cannot be combined with detection paths")
            validate_document(json.loads(args.validate_json.read_text()))
            print("Scene JSON validation: PASS")
        else:
            if args.input is None or args.output is None:
                parser.error("--input and --output are required")
            data = process_video(args.input, args.output, args.threshold, args.export_scenes)
            print(f"Detected {len(data['scenes'])} scene(s); JSON: {args.output}")
    except (SceneDetectionError, OSError, json.JSONDecodeError) as error:
        print(f"Scene detection error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
