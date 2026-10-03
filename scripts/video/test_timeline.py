import copy
import hashlib
import importlib.util
import json
import shutil
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("render.py")
spec = importlib.util.spec_from_file_location("video_render", MODULE_PATH)
video_render = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(video_render)


def timeline():
    return {
        "version": "1.0",
        "project": "test",
        "output": {"path": "out.mp4"},
        "video": {
            "width": 1080, "height": 1920, "fps": 30, "top_ratio": 0.46,
            "duration": 8, "max_static_top_seconds": 5,
        },
        "segments": [
            {"start": 0, "end": 4, "top_media": {"path": "a.mp4"},
             "presenter": {"path": "p.mp4", "loop": True}},
            {"start": 4, "end": 8, "top_media": {"path": "b.mp4"},
             "presenter": {"path": "p.mp4", "loop": True}},
        ],
        "subtitles": [{"start": 0, "end": 2, "text": "Hello world", "emphasis": "world"}],
        "style": {"font": "font.ttf"},
        "voice": {"path": "voice.wav"},
        "bgm": {"path": "bgm.wav", "loop": True},
        "sound_effects": [{"path": "effect.wav", "start": 1}],
    }


class TimelineValidationTests(unittest.TestCase):
    def assert_rejected(self, data, reason):
        self.assertTrue(any(reason in error for error in video_render.validate_timeline(data)),
                        video_render.validate_timeline(data))

    def test_valid_structure(self):
        self.assertEqual(video_render.validate_timeline(timeline()), [])

    def test_fixed_output_specification(self):
        for field, value in (("width", 720), ("height", 1280), ("fps", 24), ("top_ratio", 0.5)):
            data = timeline()
            data["video"][field] = value
            self.assert_rejected(data, "video." + field)

    def test_invalid_time_and_gap(self):
        data = timeline()
        data["segments"][0]["end"] = 0
        self.assert_rejected(data, "start < end")
        data = timeline()
        data["segments"][1]["start"] = 3
        self.assert_rejected(data, "gap or overlap")

    def test_output_duration(self):
        data = timeline()
        data["segments"][1]["end"] = 9
        self.assert_rejected(data, "exceeds video.duration")

    def test_static_image_limit(self):
        data = timeline()
        data["segments"][1]["top_media"]["path"] = "still.png"
        data["segments"][1]["end"] = 10
        data["video"]["duration"] = 10
        self.assert_rejected(data, "max_static_top_seconds")

    def test_subtitle_range_overlap_and_emphasis(self):
        data = timeline()
        data["subtitles"].append({"start": 1, "end": 3, "text": "Another"})
        self.assert_rejected(data, "overlaps")
        data = timeline()
        data["subtitles"][0]["end"] = 9
        self.assert_rejected(data, "exceeds video.duration")
        data = timeline()
        data["subtitles"][0]["emphasis"] = "absent"
        self.assert_rejected(data, "emphasis")

    def test_missing_assets(self):
        data = timeline()
        errors = video_render.validate_timeline(data, base_dir=Path("/no/such/directory"), require_assets=True)
        self.assertTrue(any("missing asset" in error for error in errors))

    def test_output_cannot_replace_input(self):
        data = timeline()
        data["output"]["path"] = "a.mp4"
        self.assert_rejected(data, "must not overwrite")

    def test_bad_types_and_nonfinite_numbers(self):
        data = timeline()
        data["video"]["duration"] = float("nan")
        self.assert_rejected(data, "duration")
        data = timeline()
        data["segments"][0]["start"] = True
        self.assert_rejected(data, "start < end")

    def test_unsupported_presenter(self):
        data = timeline()
        data["segments"][0]["presenter"]["path"] = "portrait.png"
        self.assert_rejected(data, "unsupported media extension")

    def test_asset_duration_and_freeze_preflight(self):
        data = timeline()
        data["video"]["max_static_top_seconds"] = 3
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for name in ("a.mp4", "b.mp4", "p.mp4", "voice.wav", "bgm.wav", "effect.wav", "font.ttf"):
                (base / name).touch()
            info = {"format": {"duration": "8"}, "streams": [{"codec_type": "video"}, {"codec_type": "audio"}]}
            with patch.object(video_render, "_probe", return_value=info), patch.object(video_render, "_frozen", return_value=True):
                errors = video_render.validate_timeline(data, base_dir=base, require_assets=True)
            self.assertTrue(any("frozen interval" in error for error in errors))

    def test_schema_and_example_structure(self):
        schema = json.loads(MODULE_PATH.with_name("timeline_schema.json").read_text())
        example = json.loads((MODULE_PATH.parent / "examples/pilot-001.sample.json").read_text())
        self.assertEqual(schema["properties"]["video"]["properties"]["width"]["const"], 1080)
        self.assertEqual(video_render.validate_timeline(example), [])

    def test_no_mutation_of_input(self):
        data = timeline()
        original = copy.deepcopy(data)
        video_render.validate_timeline(data)
        self.assertEqual(data, original)

    def test_unknown_fields_and_malformed_style_fail_closed(self):
        data = timeline()
        data["output"]["codec"] = "vp9"
        self.assert_rejected(data, "output.codec")
        for field in ("subtitle_width", "subtitle_y", "font_size", "stroke_width"):
            data = timeline()
            data["style"][field] = "invalid"
            self.assert_rejected(data, "style." + field)

    def test_consecutive_identical_stills_cannot_evade_static_limit(self):
        data = timeline()
        for segment in data["segments"]:
            segment["top_media"]["path"] = "same.png"
        self.assert_rejected(data, "max_static_top_seconds")

    def test_subtitle_y_zero_is_valid(self):
        data = timeline()
        data["style"]["subtitle_y"] = 0
        self.assertEqual(video_render.validate_timeline(data), [])

    @unittest.skipUnless(shutil.which("ffmpeg"), "local ffmpeg unavailable")
    def test_static_video_detection_at_end_of_clip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "still.mp4"
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                 "-i", "color=c=red:size=64x64:rate=30", "-t", "1", str(path)],
                check=True,
            )
            self.assertTrue(video_render._frozen(path, 0.4, 0, 1))


@unittest.skipUnless(
    importlib.util.find_spec("moviepy") and shutil.which("ffmpeg") and shutil.which("ffprobe"),
    "render integration requires MoviePy and local ffmpeg/ffprobe",
)
class RenderIntegrationTests(unittest.TestCase):
    def test_real_mp4_loop_layout_silent_aac_and_audio_mix(self):
        from PIL import Image

        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            Image.new("RGB", (64, 64), "red").save(base / "top.png")
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
                 "-i", "color=c=blue:size=64x64:rate=30", "-t", "0.1",
                 str(base / "presenter.mp4")], check=True,
            )
            data = {
                "version": "1.0", "project": "isolated-render-test",
                "output": {"path": "silent.mp4"},
                "video": {"width": 1080, "height": 1920, "fps": 30, "top_ratio": 0.46,
                          "duration": 0.2, "max_static_top_seconds": 1},
                "segments": [{"start": 0, "end": 0.2, "top_media": {"path": "top.png"},
                              "presenter": {"path": "presenter.mp4", "loop": True}}],
            }
            output = video_render.render_timeline(data, base / "timeline.json")
            first_hash = hashlib.sha256(output.read_bytes()).hexdigest()
            info = video_render._probe(output)
            self.assertAlmostEqual(video_render._duration(info), 0.2, places=2)
            self.assertEqual({s["codec_name"] for s in info["streams"]}, {"h264", "aac"})
            self.assertEqual(info["streams"][0]["r_frame_rate"], "30/1")
            from moviepy import VideoFileClip
            with VideoFileClip(str(output)) as clip:
                frame = clip.get_frame(0.15)
                self.assertGreater(int(frame[50, 500, 0]), 200)
                self.assertGreater(int(frame[1900, 500, 2]), 200)
            with self.assertRaises(FileExistsError):
                video_render.render_timeline(data, base / "timeline.json")
            video_render.render_timeline(data, base / "timeline.json", overwrite=True)
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), first_hash)

            for name, frames in (("voice.wav", 8820), ("bgm.wav", 4410), ("effect.wav", 2205)):
                with wave.open(str(base / name), "wb") as audio:
                    audio.setnchannels(1)
                    audio.setsampwidth(2)
                    audio.setframerate(44100)
                    audio.writeframes(b"\x01\x00" * frames)
            data["output"]["path"] = "mixed.mp4"
            data["voice"] = {"path": "voice.wav", "gain_db": -3}
            data["bgm"] = {"path": "bgm.wav", "gain_db": -18, "loop": True}
            data["sound_effects"] = [{"path": "effect.wav", "start": 0.1, "gain_db": -6}]
            mixed = video_render.render_timeline(data, base / "timeline.json")
            self.assertAlmostEqual(video_render._duration(video_render._probe(mixed)), 0.2, places=2)


if __name__ == "__main__":
    unittest.main()
