import copy
import hashlib
import json
import subprocess
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

import produce
import render


def fixtures(root, duration=61):
    from PIL import Image
    root.mkdir(parents=True, exist_ok=True)
    with wave.open(str(root / "narration.wav"), "wb") as audio:
        audio.setparams((1, 2, 44100, 0, "NONE", "not compressed"))
        # A local tone fixture is not narration or synthetic approval evidence.
        import numpy as np
        samples = np.arange(round(duration * 44100)) / 44100
        audio.writeframes((np.sin(samples * 2 * np.pi * 330) * 3000).astype("<i2").tobytes())
    Image.new("RGB", (320, 180), (200, 40, 30)).save(root / "upper.png")
    for name, color in (("p1.mp4", "blue"), ("p2.mp4", "green"), ("upper.mp4", "yellow")):
        subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-f", "lavfi", "-i",
                        f"color=c={color}:s=160x160:r=30", "-f", "lavfi", "-i", "sine=frequency=1000",
                        "-t", "1.2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
                        str(root / name)], check=True)
    font = next((p for p in [Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
                             Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")] if p.is_file()), None)
    if font is None:
        raise RuntimeError("test requires Arial or DejaVu Sans")
    return {"version": "0.1", "project": "synthetic-production-test", "narration": "narration.wav",
            "output": "output/final.mp4", "target_duration": duration,
            "canvas": {"width": 1080, "height": 1920, "fps": 30, "video_codec": "h264", "audio_codec": "aac"},
            "max_static_top_seconds": 120,
            "upper_media": [{"path": "upper.mp4", "start": 0, "end": 1},
                            {"path": "upper.png", "start": 1, "end": duration}],
            "presenter": {"assets": [{"id": "1", "path": "p1.mp4"}, {"id": "2", "path": "p2.mp4"}], "order": ["2", "1"]},
            "captions": [{"start": 0, "end": min(2, duration), "spoken_text": "A longer voice-only sentence.",
                          "caption_text": "Short point\n30% faster", "emphasis": ["Short", "30% faster"]}],
            "caption_style": {"font": str(font)}}


class ProductionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temporary = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temporary.name)
        cls.data = fixtures(cls.root)

    @classmethod
    def tearDownClass(cls):
        cls.temporary.cleanup()

    def setUp(self):
        self.m = copy.deepcopy(self.data)

    def build(self):
        return produce.build_timeline(self.m, self.root / "manifest.json")

    def reject(self, message):
        with self.assertRaisesRegex(produce.PreflightError, message):
            self.build()

    def test_over_sixty_seconds_resolved_from_audio(self):
        timeline, report = self.build()
        self.assertEqual(timeline["video"]["duration"], 61)
        self.assertEqual(report["warnings"], [])
        self.assertEqual(timeline["segments"][-1]["end"], 61)

    def test_rotation_and_continuity_across_upper_boundary(self):
        timeline, report = self.build()
        plan = report["presenter_clips_used"]
        self.assertEqual([e["id"] for e in plan[:4]], ["2", "1", "2", "1"])
        self.assertEqual(timeline["segments"][1]["presenter"]["in"], 1)
        self.assertTrue(all(not e["presenter"]["loop"] for e in timeline["segments"]))

    def test_caption_voice_separation_and_multiple_emphasis(self):
        timeline, _ = self.build()
        cue = timeline["subtitles"][0]
        self.assertNotIn("spoken_text", json.dumps(timeline))
        self.assertNotIn("voice-only", json.dumps(timeline))
        self.assertEqual(cue["text"], self.m["captions"][0]["caption_text"])
        image = render._subtitle_image(cue, timeline["style"], self.root)
        self.assertTrue(any(pixel[:3] == (255, 255, 102) for pixel in image.getdata()))

    def test_upper_image_and_video(self):
        timeline, _ = self.build()
        self.assertTrue(timeline["segments"][0]["top_media"]["path"].endswith(".mp4"))
        self.assertTrue(timeline["segments"][-1]["top_media"]["path"].endswith(".png"))

    def test_three_lines_rejected(self):
        self.m["captions"][0].update(caption_text="a\nb\nc", emphasis=[])
        self.reject("two subtitle lines")

    def test_wrapped_three_lines_rejected(self):
        self.m["captions"][0].update(caption_text="word " * 100, emphasis=[])
        self.reject("two lines")

    def test_missing_narration(self):
        self.m["narration"] = "missing.wav"
        self.reject("missing asset")

    def test_missing_presenter(self):
        self.m["presenter"]["assets"][0]["path"] = "missing.mp4"
        self.reject("missing asset")

    def test_missing_upper(self):
        self.m["upper_media"][1]["path"] = "missing.png"
        self.reject("missing asset")

    def test_gap_range(self):
        self.m["upper_media"][1]["start"] = 2
        self.reject(r"coverage gap \[1, 2\)")

    def test_overlap_rejected(self):
        self.m["upper_media"][1]["start"] = .5
        self.reject("overlap")

    def test_duration_overflow(self):
        self.m["captions"][0]["end"] = 62
        self.reject("exceeds")

    def test_invalid_canvas(self):
        self.m["canvas"]["width"] = 720
        self.reject("1080")

    def test_configurable_split_and_focus(self):
        self.m["canvas"]["top_ratio"] = .46
        self.m["presenter"]["assets"][1]["focus_x"] = .48
        timeline, _ = self.build()
        self.assertEqual(timeline["video"]["top_ratio"], .46)
        self.assertEqual(timeline["segments"][0]["presenter"]["focus_x"], .48)

    def test_upper_short_video_rejected(self):
        self.m["upper_media"][0]["end"] = 2
        self.m["upper_media"][1]["start"] = 2
        self.reject("insufficient duration")

    def test_source_offsets_respected(self):
        self.m["upper_media"][0].update({"in": .1, "out": 1.2})
        self.m["presenter"]["assets"][1].update({"in": .2, "out": 1.2})
        timeline, _ = self.build()
        self.assertEqual(timeline["segments"][0]["top_media"]["in"], .1)
        self.assertEqual(timeline["segments"][0]["presenter"]["in"], .2)

    def test_missing_emphasis_term(self):
        self.m["captions"][0]["emphasis"] = ["absent"]
        self.reject("emphasis")

    def test_invalid_focus(self):
        self.m["presenter"]["assets"][0]["focus_y"] = 2
        self.reject("maximum")

    def test_unknown_manifest_properties(self):
        self.m["tts_provider"] = "not-authorized"
        self.reject("Additional properties")

    def test_output_duration_mismatch(self):
        info = {"format": {"duration": "2"}, "streams": [
            {"codec_type": "video", "codec_name": "h264", "width": 1080, "height": 1920, "avg_frame_rate": "30/1", "duration": "2"},
            {"codec_type": "audio", "codec_name": "aac", "duration": "2"}]}
        with patch.object(render, "_probe", return_value=info):
            with self.assertRaisesRegex(ValueError, "duration mismatch"):
                produce.verify_output(Path("mock.mp4"), 61)

    def test_validate_only_has_no_output(self):
        with tempfile.TemporaryDirectory() as directory:
            self.m["output"] = str(Path(directory) / "new/final.mp4")
            path = self.root / "validate-only.json"
            path.write_text(json.dumps(self.m))
            self.assertEqual(produce.produce(path, validate_only=True)["render"], "NOT RUN")
            self.assertFalse((Path(directory) / "new").exists())

    def test_flip_forbidden(self):
        self.m["presenter"]["assets"][0]["flip"] = True
        self.reject("Additional properties")

    def test_unknown_order(self):
        self.m["presenter"]["order"] = ["unknown"]
        self.reject("unknown asset")

    def test_negative_and_nonfinite(self):
        for value in (-1, 0, float("nan"), float("inf")):
            self.m["target_duration"] = value
            self.reject("manifest|target_duration")

    def test_overwrite_and_input_alias_protection(self):
        self.m["output"] = "p1.mp4"
        self.reject("overwrite")

    def test_sidecar_overwrite_protection(self):
        with tempfile.TemporaryDirectory() as d:
            self.m["output"] = str(Path(d) / "final.mp4")
            (Path(d) / "validation_report.json").write_text("keep")
            self.reject("overwrite prohibited")

    def test_dangling_output_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            alias = Path(d) / "final.mp4"
            alias.symlink_to(Path(d) / "absent.mp4")
            self.m["output"] = str(alias)
            self.reject("overwrite prohibited")
            self.assertFalse((Path(d) / "absent.mp4").exists())

    def test_short_narration_warning(self):
        self.m["upper_media"] = [{"path": "upper.png", "start": 0, "end": 2}]
        real = produce.media_duration
        with patch.object(produce, "media_duration", side_effect=lambda p, k: 2 if k == "audio" else real(p, k)), \
             patch.object(render, "validate_timeline", return_value=[]):
            _, report = self.build()
        self.assertIn("greater than 60s", report["warnings"][0])

    def test_output_validation_rejects_wrong_codec(self):
        with self.assertRaises(ValueError):
            produce.verify_output(self.root / "p1.mp4", 1.2)

    def test_static_limit_not_evaded_by_presenter_segments(self):
        self.m["max_static_top_seconds"] = 10
        self.reject("max_static_top_seconds")

    def test_two_line_safe_area(self):
        self.m["caption_style"]["subtitle_y"] = 1900
        self.reject("safe area")

    def test_actual_render_cli_and_ffprobe(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            data = fixtures(root, 2.2)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps(data))
            before = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in root.iterdir() if p.is_file()}
            import sys
            result = subprocess.run([sys.executable, "-B", str(Path(produce.__file__)), "--manifest", str(manifest)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            output = root / "output/final.mp4"
            report = json.loads((output.parent / "validation_report.json").read_text())
            self.assertEqual(report["render"], "PASS")
            self.assertEqual(produce.verify_output(output, 2.2)["video_codec"], "h264")
            self.assertEqual(before, {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in before})
            self.assertEqual(produce.main(["--manifest", str(manifest)]), 1)
            # Presenter has a 1kHz source track; rendered audio must contain only master 330Hz.
            import numpy as np
            pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(output), "-t", "1", "-f", "f32le", "-ac", "1", "-ar", "44100", "-"])
            spectrum = abs(np.fft.rfft(np.frombuffer(pcm, dtype="<f4")))
            self.assertGreater(spectrum[330], spectrum[1000] * 50)


if __name__ == "__main__":
    unittest.main()
