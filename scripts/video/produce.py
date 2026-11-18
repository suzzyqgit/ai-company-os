#!/usr/bin/env python3
"""Compile authored production inputs into the existing renderer's timeline."""
from __future__ import annotations

import argparse
import copy
import json
import math
import os
import tempfile
from fractions import Fraction
from pathlib import Path

from jsonschema import Draft202012Validator

import render


class PreflightError(ValueError):
    def __init__(self, errors):
        self.errors = errors
        super().__init__("\n".join(errors))


def schema():
    data = json.loads(Path(__file__).with_name("production_schema.json").read_text())
    timeline = json.loads(Path(__file__).with_name("timeline_schema.json").read_text())
    data["$defs"]["style"] = timeline["properties"]["style"]
    return data


def media_duration(path, kind):
    if not path.is_file():
        raise PreflightError([f"missing asset: {path}"])
    info = render._probe(path)
    streams = [s for s in info.get("streams", []) if s.get("codec_type") == kind]
    if len(streams) != 1:
        raise PreflightError([f"{path}: expected exactly one {kind} stream"])
    raw = streams[0].get("duration", info.get("format", {}).get("duration"))
    try:
        duration = float(raw)
    except (TypeError, ValueError):
        raise PreflightError([f"{path}: duration unavailable"]) from None
    if not math.isfinite(duration) or duration <= 0:
        raise PreflightError([f"{path}: duration must be finite and positive"])
    if float(streams[0].get("start_time", 0)) != 0:
        raise PreflightError([f"{path}: non-zero stream start time is unsupported"])
    return duration


def coverage(events, duration):
    errors, cursor = [], 0.0
    for event in sorted(events, key=lambda e: e["start"]):
        start, end = event["start"], event["end"]
        if start >= end:
            errors.append(f"upper media invalid interval [{start}, {end})")
        if start > cursor:
            errors.append(f"upper media coverage gap [{cursor:g}, {start:g})")
        elif start < cursor:
            errors.append(f"upper media overlap [{start:g}, {min(cursor, end):g})")
        if end > duration:
            errors.append(f"upper media end {end:g} exceeds narration {duration:g}")
        cursor = max(cursor, end)
    if cursor < duration:
        errors.append(f"upper media coverage gap [{cursor:g}, {duration:g})")
    return errors


def presenter_plan(assets, order, duration):
    if len(set(order)) != len(order):
        raise PreflightError(["presenter.order must contain unique IDs; rotation repeats automatically"])
    if any(key not in assets for key in order):
        raise PreflightError(["presenter.order contains an unknown asset ID"])
    plan, cursor, index = [], 0.0, 0
    while cursor < duration:
        key = order[index % len(order)]
        asset = assets[key]
        end = min(duration, cursor + asset["out"] - asset["in"])
        plan.append({"id": key, "start": cursor, "end": end, "clip": asset})
        cursor, index = end, index + 1
        if index > 10000:
            raise PreflightError(["presenter plan exceeds 10000 clips; use longer source ranges"])
    return plan


def slice_clip(spec, offset, span):
    result = {k: spec[k] for k in ("path", "fit", "focus_x", "focus_y") if k in spec}
    if Path(spec["path"]).suffix.lower() not in render.IMAGE_EXTENSIONS:
        result.update({"in": spec.get("in", 0) + offset,
                       "out": spec.get("in", 0) + offset + span, "loop": False})
    return result


def build_timeline(data, manifest_path):
    errors = [f"{'.'.join(map(str, e.absolute_path)) or 'manifest'}: {e.message}"
              for e in Draft202012Validator(schema()).iter_errors(data)]
    # JSON permits NaN in Python by default; forbid it anywhere in the manifest.
    try:
        json.dumps(data, allow_nan=False)
    except ValueError:
        errors.append("manifest contains non-finite numbers")
    if errors:
        raise PreflightError(errors)
    base = manifest_path.resolve().parent
    resolve = lambda raw: (base / raw).resolve()
    narration = resolve(data["narration"])
    duration = media_duration(narration, "audio")
    warnings = []
    if duration <= 60:
        warnings.append(f"narration is {duration:g}s; production target is strictly greater than 60s")
    if abs(duration - data["target_duration"]) > 1 / 30:
        warnings.append(f"target_duration {data['target_duration']:g}s differs from narration {duration:g}s; narration wins")
    upper = copy.deepcopy(sorted(data["upper_media"], key=lambda e: e["start"]))
    errors.extend(coverage(upper, duration))
    for event in upper:
        event["path"] = str(resolve(event["path"]))
        path = Path(event["path"])
        if not path.is_file():
            errors.append(f"missing asset: {path}")
        elif path.suffix.lower() in render.IMAGE_EXTENSIONS:
            if "in" in event or "out" in event:
                errors.append(f"still image cannot have in/out: {path}")
        else:
            available = media_duration(path, "video")
            clip_in = event.get("in", 0)
            clip_out = event.get("out", available)
            if clip_out > available or clip_out - clip_in < event["end"] - event["start"]:
                errors.append(f"upper asset has insufficient duration: {path}")
        if event["end"] - event["start"] > data["max_static_top_seconds"]:
            if path.suffix.lower() in render.IMAGE_EXTENSIONS:
                errors.append(f"upper image exceeds max_static_top_seconds: {path}")
            elif path.is_file() and render._frozen(path, data["max_static_top_seconds"], event.get("in", 0), event["end"] - event["start"]):
                errors.append(f"upper video has excessive frozen interval: {path}")
    assets = {}
    for entry in data["presenter"]["assets"]:
        key = entry["id"]
        if key in assets:
            errors.append(f"duplicate presenter ID: {key}")
        spec = copy.deepcopy(entry)
        spec["path"] = str(resolve(spec["path"]))
        available = media_duration(Path(spec["path"]), "video")
        spec.setdefault("in", 0)
        spec.setdefault("out", available)
        spec["fit"] = "cover"
        if not 0 <= spec["in"] < spec["out"] <= available:
            errors.append(f"presenter {key}: invalid source range")
        if any(a["path"] == spec["path"] for a in assets.values()):
            errors.append("duplicate presenter source paths; use one ID per source")
        assets[key] = spec
    if errors:
        raise PreflightError(errors)
    order = data["presenter"].get("order", list(assets))
    plan = presenter_plan(assets, order, duration)
    if len(order) == 1 and len(plan) > 1:
        warnings.append("only one presenter supplied: consecutive reuse is unavoidable")
    boundaries = sorted({0.0, duration} | {e[k] for e in upper + plan for k in ("start", "end")})
    segments, u, p = [], 0, 0
    for start, end in zip(boundaries, boundaries[1:]):
        while upper[u]["end"] <= start:
            u += 1
        while plan[p]["end"] <= start:
            p += 1
        segments.append({"start": start, "end": end,
                         "top_media": slice_clip(upper[u], start - upper[u]["start"], end - start),
                         "presenter": slice_clip(plan[p]["clip"], start - plan[p]["start"], end - start)})
    style = {"font_size": 64, "subtitle_x": 540, "subtitle_y": 900,
             "subtitle_anchor": "center", "subtitle_width": 980, "subtitle_margin_x": 40,
             "subtitle_margin_y": 40, "line_spacing": 12, "text_color": "white",
             "stroke_color": "black", "stroke_width": 4, "emphasis_color": "#ffff66"}
    style.update(data.get("caption_style", {}))
    if "font" in style:
        style["font"] = str(resolve(style["font"]))
    raw_output = base / data["output"]
    if raw_output.exists() or raw_output.is_symlink():
        raise PreflightError([f"output overwrite prohibited: {raw_output}"])
    output = resolve(data["output"])
    timeline = {"version": "1.0", "project": data["project"], "output": {"path": str(output)},
                "video": {"width": 1080, "height": 1920, "fps": 30,
                          "top_ratio": data["canvas"].get("top_ratio", 0.5), "duration": duration,
                          "max_static_top_seconds": data["max_static_top_seconds"]},
                "segments": segments, "style": style,
                "subtitles": [{"start": c["start"], "end": c["end"], "text": c["caption_text"],
                               "emphasis": c.get("emphasis", [])} for c in data["captions"]],
                "voice": {"path": str(narration)}, "bgm": None, "sound_effects": []}
    errors = render.validate_timeline(timeline, base_dir=base, require_assets=True)
    # Renderer tolerates sub-millisecond drift; production event ranges are strict.
    for c in data["captions"]:
        if c["end"] > duration:
            errors.append("caption exceeds narration duration")
    if style["text_color"] != "white" or style["stroke_color"] != "black" or style["stroke_width"] < 1:
        errors.append("production captions require white text and a black outline")
    if errors:
        raise PreflightError(errors)
    destinations = [output, output.parent / "resolved_timeline.json", output.parent / "validation_report.json"]
    if len(set(destinations)) != 3:
        raise PreflightError(["output and report paths must be distinct"])
    for path in destinations:
        if path.exists() or path.is_symlink():
            raise PreflightError([f"output overwrite prohibited: {path}"])
    report = {"preflight": "PASS", "warnings": warnings, "render": "NOT RUN",
              "duration": duration, "presenter_clips_used": [{k: e[k] for k in ("id", "start", "end")} for e in plan],
              "presenter_assets": list(assets.values()),
              "upper_assets_used": upper, "caption_event_count": len(data["captions"])}
    return timeline, report


def verify_output(path, expected_duration):
    info = render._probe(path)
    video = [s for s in info.get("streams", []) if s.get("codec_type") == "video"]
    audio = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
    if len(video) != 1 or len(audio) != 1:
        raise ValueError("final output must have one video and one audio stream")
    v, a = video[0], audio[0]
    duration = render._duration(info)
    if (v.get("codec_name"), a.get("codec_name"), v.get("width"), v.get("height"),
            Fraction(v.get("avg_frame_rate", "0"))) != ("h264", "aac", 1080, 1920, 30):
        raise ValueError("final output specification mismatch")
    if not math.isfinite(duration) or abs(duration - expected_duration) > 1 / 30 + .001:
        raise ValueError("final output duration mismatch")
    for stream in (v, a):
        if abs(float(stream.get("duration", 0)) - expected_duration) > 1 / 30 + .001:
            raise ValueError("final audio/video duration mismatch")
    return {"duration": duration, "width": v["width"], "height": v["height"], "fps": 30,
            "video_codec": v["codec_name"], "audio_codec": a["codec_name"]}


def produce(manifest_path, validate_only=False):
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    timeline, report = build_timeline(data, manifest_path)
    if validate_only:
        return report
    output = Path(timeline["output"]["path"])
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".production-", dir=output.parent) as directory:
        stage = Path(directory)
        staged_timeline = copy.deepcopy(timeline)
        staged_timeline["output"]["path"] = str(stage / "final.mp4")
        result = render.render_timeline(staged_timeline, stage / "timeline.json")
        report["output"] = verify_output(result, timeline["video"]["duration"])
        report["render"] = "PASS"
        for name, content in (("resolved_timeline.json", timeline), ("validation_report.json", report)):
            (stage / name).write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        # No-replace publication, including races with other producers. MP4 is last.
        for name, destination in (("resolved_timeline.json", output.parent / "resolved_timeline.json"),
                                  ("validation_report.json", output.parent / "validation_report.json"),
                                  ("final.mp4", output)):
            os.link(stage / name, destination)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args(argv)
    try:
        print(json.dumps(produce(args.manifest, args.validate_only), ensure_ascii=False, indent=2))
        return 0
    except (ValueError, OSError, RuntimeError) as exc:
        print(json.dumps({"preflight_or_render": "FAIL", "errors": getattr(exc, "errors", [str(exc)])}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
