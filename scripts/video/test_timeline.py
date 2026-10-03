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
        for field, value in (("width", 720), ("height", 1280), ("fps", 24)):
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

    def test_split_ratio_is_authored(self):
        for ratio in (0.50, 0.46, 0.25, 0.75):
            data = timeline()
            data["video"]["top_ratio"] = ratio
            self.assertEqual(video_render.validate_timeline(data), [])

    def test_invalid_split_ratios(self):
        for ratio in (0, -0.1, 1, 1.1, float("nan"), True):
            data = timeline()
            data["video"]["top_ratio"] = ratio
            self.assert_rejected(data, "video.top_ratio")

    def test_focus_validation_for_both_lanes(self):
        for lane in ("top_media", "presenter"):
            for axis in ("focus_x", "focus_y"):
                for value in (0, 0.5, 1):
                    data = timeline()
                    data["segments"][0][lane][axis] = value
                    self.assertEqual(video_render.validate_timeline(data), [])
                for value in (-0.1, 1.1, float("nan"), "0.5", True):
                    data = timeline()
                    data["segments"][0][lane][axis] = value
                    self.assert_rejected(data, axis)

    def test_three_explicit_lines_are_rejected_without_assets(self):
        data = timeline()
        data["subtitles"][0]["text"] = "Hello\nworld\nthird"
        self.assert_rejected(data, "two subtitle lines")

    def test_center_subtitle_reference_sample(self):
        data = json.loads((MODULE_PATH.parent / "examples/pilot-001.sample.json").read_text())
        self.assertEqual(data["video"]["top_ratio"], 0.50)
        self.assertEqual((data["style"]["subtitle_x"], data["style"]["subtitle_y"]), (540, 960))
        self.assertEqual(data["style"]["subtitle_anchor"], "center")
        self.assertEqual(video_render.validate_timeline(data), [])

    def test_horizontal_safe_margin_preflight(self):
        data = timeline()
        data["style"]["subtitle_margin_x"] = 60
        self.assert_rejected(data, "horizontal bounds")

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


@unittest.skipUnless(importlib.util.find_spec("PIL"), "subtitle layout tests require Pillow")
class SubtitleLayoutTests(unittest.TestCase):
    def setUp(self):
        from PIL import ImageFont
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.font = ImageFont.load_default(size=48)
        self.font_path = self.base / "fixture-font.ttf"
        self.font_path.write_bytes(self.font.path.getvalue())
        self.style = {
            "font": str(self.font_path), "font_size": 48, "subtitle_width": 800,
            "subtitle_x": 540, "subtitle_y": 960, "subtitle_anchor": "center",
            "subtitle_margin_x": 40, "subtitle_margin_y": 40,
        }

    def test_two_lines_center_align_and_emphasis(self):
        import numpy as np
        cue = {"text": "First\nSecond line", "emphasis": "First"}
        image = video_render._subtitle_image(cue, self.style, self.base)
        pixels = np.asarray(image)
        rows = np.where(pixels[:, :, 3].max(axis=1) > 0)[0]
        groups = np.split(rows, np.where(np.diff(rows) > 1)[0] + 1)
        self.assertEqual(len(groups), 2)
        for group in groups:
            xs = np.where(pixels[group, :, 3] > 0)[1]
            self.assertAlmostEqual((xs.min() + xs.max()) / 2, image.width / 2, delta=3)
        self.assertTrue(np.any(np.all(pixels[:, :, :3] == (255, 255, 102), axis=2)))
        left, top = video_render._subtitle_position(self.style, image.width, image.height)
        self.assertAlmostEqual(left + image.width / 2, 540, delta=0.5)
        self.assertAlmostEqual(top + image.height / 2, 960, delta=0.5)

    def test_width_wrap_preserves_emphasis_on_both_lines(self):
        import math
        import numpy as np
        text = "Alpha Beta Gamma Delta"
        style = dict(self.style, subtitle_width=math.ceil(max(self.font.getlength("Alpha Beta"), self.font.getlength("Gamma Delta"))) + 24)
        cue = {"text": text, "emphasis": "Beta Gamma"}
        image = video_render._subtitle_image(cue, style, self.base)
        pixels = np.asarray(image)
        accent = np.all(pixels[:, :, :3] == (255, 255, 102), axis=2) & (pixels[:, :, 3] > 0)
        rows = np.where(accent.max(axis=1))[0]
        self.assertEqual(len(np.split(rows, np.where(np.diff(rows) > 1)[0] + 1)), 2)

    def test_wrapping_to_three_lines_rejected(self):
        with self.assertRaisesRegex(ValueError, "two lines"):
            video_render._subtitle_image(
                {"text": "Alpha Beta Gamma Delta Epsilon Zeta Eta Theta"},
                dict(self.style, subtitle_width=250), self.base,
            )

    def test_wrap_keeps_full_line_when_next_character_is_space(self):
        from PIL import Image, ImageDraw
        text = "Hello world Hello world"
        box = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox(
            (0, 0), "Hello world", font=self.font, stroke_width=4,
        )
        lines = video_render._subtitle_lines(text, self.font, box[2] - box[0], 4)
        self.assertEqual([text[start:end] for start, end in lines], ["Hello world", "Hello world"])

    def test_three_explicit_lines_rejected(self):
        with self.assertRaisesRegex(ValueError, "two lines"):
            video_render._subtitle_image({"text": "One\nTwo\nThree"}, self.style, self.base)

    def test_two_line_top_and_bottom_overflow_preflight(self):
        data = timeline()
        data["voice"], data["bgm"], data["sound_effects"] = None, None, []
        data["subtitles"] = [{"start": 0, "end": 2, "text": "First\nSecond"}]
        data["style"] = self.style
        for name in ("a.mp4", "b.mp4", "p.mp4"):
            (self.base / name).touch()
        info = {"format": {"duration": "8"}, "streams": [{"codec_type": "video"}]}
        with patch.object(video_render, "_probe", return_value=info):
            self.assertEqual(video_render.validate_timeline(data, base_dir=self.base, require_assets=True), [])
            for y, anchor in ((1900, "top"), (10, "center")):
                data["style"] = dict(self.style, subtitle_y=y, subtitle_anchor=anchor)
                errors = video_render.validate_timeline(data, base_dir=self.base, require_assets=True)
                self.assertTrue(any("vertical bounds" in error for error in errors), errors)


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
                split = round(1920 * data["video"]["top_ratio"])
                self.assertGreater(int(frame[split - 8, 500, 0]), 200)
                self.assertGreater(int(frame[split + 8, 500, 2]), 200)
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

    def test_real_mp4_authored_focus_and_two_line_center_subtitle(self):
        import numpy as np
        from PIL import Image, ImageFont

        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            font = ImageFont.load_default(size=48)
            (base / "font.ttf").write_bytes(font.path.getvalue())
            top = Image.new("RGB", (64, 128), "green")
            top.paste("cyan", (0, 64, 64, 128))
            top.save(base / "top.png")
            presenter = Image.new("RGB", (128, 64), "red")
            presenter.paste("blue", (64, 0, 128, 64))
            presenter.save(base / "presenter.png")
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-loop", "1",
                 "-i", str(base / "presenter.png"), "-t", "0.1", "-r", "30",
                 "-pix_fmt", "yuv420p", str(base / "presenter.mp4")], check=True,
            )
            data = {
                "version": "1.0", "project": "focus-subtitle-test", "output": {"path": "focus-left.mp4"},
                "video": {"width": 1080, "height": 1920, "fps": 30, "top_ratio": 0.50,
                          "duration": 0.2, "max_static_top_seconds": 1},
                "segments": [{"start": 0, "end": 0.2,
                              "top_media": {"path": "top.png", "focus_y": 0},
                              "presenter": {"path": "presenter.mp4", "loop": True, "focus_x": 0}}],
                "subtitles": [{"start": 0, "end": 0.2, "text": "First line\nSecond line", "emphasis": "First"}],
                "style": {"font": "font.ttf", "font_size": 48, "subtitle_width": 800,
                          "subtitle_x": 540, "subtitle_y": 960, "subtitle_anchor": "center"},
            }
            output = video_render.render_timeline(data, base / "timeline.json")
            from moviepy import VideoFileClip
            with VideoFileClip(str(output), audio=False) as clip:
                first = clip.get_frame(0.15).copy()
            self.assertGreater(int(first[950, 10, 1]), 100)
            self.assertGreater(int(first[970, 10, 0]), 200)
            self.assertGreater(int(first[1600, 500, 0]), 200)
            block = first[850:1070, 100:980]
            accent = (block[:, :, 0] > 200) & (block[:, :, 1] > 200) & (block[:, :, 2] < 150)
            self.assertGreater(int(accent.sum()), 50)
            data["output"]["path"] = "focus-right.mp4"
            data["segments"][0]["top_media"]["focus_y"] = 1
            data["segments"][0]["presenter"]["focus_x"] = 1
            output = video_render.render_timeline(data, base / "timeline.json")
            with VideoFileClip(str(output), audio=False) as clip:
                second = clip.get_frame(0.15)
            self.assertGreater(int(second[50, 500, 2]), 200)
            self.assertLess(int(first[50, 500, 2]), 50)
            self.assertGreater(int(second[1600, 500, 2]), 200)
            self.assertLess(int(second[1600, 500, 0]), 50)
            self.assertFalse(np.array_equal(first, second))


if __name__ == "__main__":
    unittest.main()
