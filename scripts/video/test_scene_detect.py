import copy
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("scene_detect.py")
spec = importlib.util.spec_from_file_location("scene_detect", MODULE_PATH)
scene_detect = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(scene_detect)


def sample():
    return json.loads((MODULE_PATH.parent / "examples/scene-detection.sample.json").read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fixture(path, colors=("red", "green", "blue"), audio=False):
    command = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-n"]
    for color in colors:
        command += ["-f", "lavfi", "-i", f"color=c={color}:s=160x90:r=30:d=1"]
    if audio:
        command += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={len(colors)}"]
    inputs = "".join(f"[{index}:v]" for index in range(len(colors)))
    command += ["-filter_complex", f"{inputs}concat=n={len(colors)}:v=1:a=0[v]", "-map", "[v]"]
    if audio:
        command += ["-map", f"{len(colors)}:a", "-c:a", "aac"]
    # Cut boundaries deliberately fall between keyframes to exercise accurate export.
    command += ["-c:v", "libx264", "-g", "300", "-sc_threshold", "0", "-pix_fmt", "yuv420p", str(path)]
    subprocess.run(command, check=True, capture_output=True)


class SceneValidationTests(unittest.TestCase):
    def test_threshold_accepts_authored_values(self):
        for value in (0.01, 10, 27, 60, 255, "27"):
            self.assertEqual(scene_detect.validate_threshold(value), float(value))

    def test_invalid_threshold_rejected(self):
        for value in (0, -1, 256, float("nan"), float("inf"), True, None, "bad"):
            with self.subTest(value=value), self.assertRaises(scene_detect.SceneDetectionError):
                scene_detect.validate_threshold(value)

    def test_schema_and_sample(self):
        from jsonschema import Draft202012Validator
        schema = json.loads(MODULE_PATH.with_name("scene_schema.json").read_text())
        Draft202012Validator.check_schema(schema)
        Draft202012Validator(schema).validate(sample())
        self.assertEqual(scene_detect.validate_document(sample()), sample())

    def test_schema_rejects_missing_metadata(self):
        for field in ("path", "duration", "fps", "width", "height", "codec"):
            data = sample()
            del data["source"][field]
            with self.subTest(field=field), self.assertRaisesRegex(scene_detect.SceneDetectionError, "schema"):
                scene_detect.validate_document(data)

    def test_semantic_interval_validation(self):
        for field, value in (("index", 4), ("start", 0.5), ("end", 0.5), ("duration", 0.5)):
            data = sample()
            data["scenes"][1][field] = value
            with self.subTest(field=field), self.assertRaises(scene_detect.SceneDetectionError):
                scene_detect.validate_document(data)

    def test_duration_coverage_validation(self):
        data = sample()
        data["source"]["duration"] = 10
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "cover"):
            scene_detect.validate_document(data)

    def test_nonfinite_json_rejected(self):
        for value in (float("nan"), float("inf")):
            data = sample()
            data["scenes"][0]["end"] = value
            with self.assertRaises(scene_detect.SceneDetectionError):
                scene_detect.validate_document(data)

    def test_document_not_mutated(self):
        data = sample()
        before = copy.deepcopy(data)
        scene_detect.validate_document(data)
        self.assertEqual(data, before)

    def test_duration_metadata_unavailable_rejected(self):
        info = {"streams": [{"codec_type": "video", "duration": "N/A"}]}
        with tempfile.NamedTemporaryFile() as source:
            result = subprocess.CompletedProcess([], 0, json.dumps(info), "")
            with patch.object(scene_detect, "_run", return_value=result):
                with self.assertRaisesRegex(scene_detect.SceneDetectionError, "unavailable"):
                    scene_detect.probe_source(source.name)

    def test_vfr_and_nonzero_origin_rejected(self):
        stream = {"codec_type": "video", "duration": "3", "avg_frame_rate": "24/1",
                  "r_frame_rate": "30/1", "width": 160, "height": 90, "codec_name": "h264"}
        with tempfile.NamedTemporaryFile() as source:
            result = subprocess.CompletedProcess([], 0, json.dumps({"streams": [stream]}), "")
            with patch.object(scene_detect, "_run", return_value=result):
                with self.assertRaisesRegex(scene_detect.SceneDetectionError, "VFR"):
                    scene_detect.probe_source(source.name)
            stream.update(avg_frame_rate="30/1", start_time="1.0")
            result.stdout = json.dumps({"streams": [stream]})
            with patch.object(scene_detect, "_run", return_value=result):
                with self.assertRaisesRegex(scene_detect.SceneDetectionError, "start time"):
                    scene_detect.probe_source(source.name)


class SceneIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        for module in ("scenedetect", "cv2", "jsonschema"):
            if importlib.util.find_spec(module) is None:
                raise RuntimeError(f"required integration dependency missing: {module}; install requirements.txt")
        for executable in ("ffmpeg", "ffprobe"):
            if not shutil.which(executable):
                raise RuntimeError(f"required integration executable missing: {executable}")
        cls.directory = tempfile.TemporaryDirectory()
        cls.base = Path(cls.directory.name)
        cls.cuts = cls.base / "cuts.mp4"
        cls.still = cls.base / "no-cut.mp4"
        fixture(cls.cuts, audio=True)
        fixture(cls.still, ("red",))

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.base = Path(self.directory.name)
        self.output = self.base / "scenes.json"

    def test_synthetic_multiple_hard_cuts(self):
        data = scene_detect.detect_scenes(self.cuts, 27)
        self.assertEqual(data["scenes"], sample()["scenes"])
        self.assertEqual(data["detection"]["threshold"], 27)

    def test_no_cut_is_one_scene(self):
        data = scene_detect.detect_scenes(self.still)
        self.assertEqual(data["scenes"], [{"index": 1, "start": 0, "end": 1, "duration": 1}])

    def test_threshold_controls_detection(self):
        self.assertEqual(len(scene_detect.detect_scenes(self.cuts, 255)["scenes"]), 1)
        self.assertEqual(len(scene_detect.detect_scenes(self.cuts, 10)["scenes"]), 3)

    def test_probe_actual_metadata(self):
        data = scene_detect.probe_source(self.cuts)
        self.assertEqual((data["width"], data["height"], data["fps"], data["codec"]),
                         (160, 90, 30, "h264"))
        self.assertEqual(data["duration"], 3)
        self.assertEqual(data["path"], str(self.cuts.resolve()))

    def test_deterministic_json_only_and_source_unchanged(self):
        before = digest(self.cuts)
        first = scene_detect.process_video(self.cuts, self.output)
        other = self.base / "other.json"
        second = scene_detect.process_video(self.cuts, other)
        self.assertEqual(first, second)
        self.assertEqual(self.output.read_bytes(), other.read_bytes())
        self.assertEqual(digest(self.cuts), before)
        self.assertEqual(sorted(p.name for p in self.base.iterdir()), ["other.json", "scenes.json"])

    def test_missing_input(self):
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "missing"):
            scene_detect.process_video(self.base / "missing.mp4", self.output)
        self.assertFalse(self.output.exists())

    def test_audio_only_no_video_stream(self):
        audio = self.base / "audio.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-n", "-f", "lavfi", "-i",
                        "sine=duration=0.1", str(audio)], check=True, capture_output=True)
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "no video stream"):
            scene_detect.process_video(audio, self.output)

    def test_corrupt_input(self):
        source = self.base / "corrupt.mp4"
        source.write_bytes(b"not a video")
        with self.assertRaises(scene_detect.SceneDetectionError):
            scene_detect.process_video(source, self.output)
        self.assertFalse(self.output.exists())

    def test_input_output_identical_and_aliases_rejected(self):
        before = digest(self.cuts)
        symbolic = self.base / "alias.json"
        symbolic.symlink_to(self.cuts)
        hard = self.base / "hard.json"
        os.link(self.cuts, hard)
        for destination in (self.cuts, symbolic, hard):
            with self.subTest(destination=destination), self.assertRaisesRegex(
                    scene_detect.SceneDetectionError, "overwrite input"):
                scene_detect.process_video(self.cuts, destination)
        self.assertEqual(digest(self.cuts), before)

    def test_existing_output_is_preserved(self):
        self.output.write_bytes(b"keep")
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "already exists"):
            scene_detect.process_video(self.cuts, self.output)
        self.assertEqual(self.output.read_bytes(), b"keep")

    def test_invalid_threshold_does_not_write(self):
        for threshold in (0, -10, float("nan")):
            with self.assertRaises(scene_detect.SceneDetectionError):
                scene_detect.process_video(self.cuts, self.output, threshold)
        self.assertFalse(self.output.exists())

    def test_optional_real_scene_exports(self):
        directory = self.base / "clips"
        before = digest(self.cuts)
        data = scene_detect.process_video(self.cuts, self.output, export_dir=directory)
        self.assertEqual(len(data["scenes"]), 3)
        self.assertEqual(sorted(p.name for p in directory.iterdir()),
                         ["scene-001.mp4", "scene-002.mp4", "scene-003.mp4"])
        import numpy as np
        for index, path in enumerate(sorted(directory.iterdir())):
            metadata = scene_detect.probe_source(path)
            self.assertEqual((metadata["width"], metadata["height"], metadata["fps"], metadata["codec"]),
                             (160, 90, 30, "h264"))
            self.assertAlmostEqual(metadata["duration"], 1, places=5)
            info = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-show_streams", "-of", "json", str(path)]))
            self.assertEqual(info["streams"][0]["nb_frames"], "30")
            self.assertEqual(info["streams"][1]["codec_name"], "aac")
            for offset in (0, 29 / 30):
                def frame_at(video, seconds):
                    raw = subprocess.check_output([
                        "ffmpeg", "-v", "error", "-ss", str(seconds), "-i", str(video),
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
                    ])
                    return np.frombuffer(raw, dtype=np.uint8).astype(float)
                expected = frame_at(self.cuts, index + offset)
                actual = frame_at(path, offset)
                self.assertEqual(actual.size, 160 * 90 * 3)
                self.assertLess(np.abs(actual - expected).mean(), 3)
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
                           check=True, capture_output=True)
        self.assertEqual(digest(self.cuts), before)

    def test_export_without_audio(self):
        directory = self.base / "clips"
        scene_detect.process_video(self.still, self.output, export_dir=directory)
        self.assertTrue((directory / "scene-001.mp4").is_file())

    def test_export_collision_preserves_existing_and_input(self):
        directory = self.base / "clips"
        directory.mkdir()
        existing = directory / "scene-002.mp4"
        existing.write_bytes(b"keep")
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "already exists"):
            scene_detect.process_video(self.cuts, self.output, export_dir=directory)
        self.assertEqual(existing.read_bytes(), b"keep")
        self.assertFalse((directory / "scene-001.mp4").exists())
        self.assertFalse(self.output.exists())

    def test_export_cannot_overwrite_source_alias(self):
        directory = self.base / "clips"
        directory.mkdir()
        (directory / "scene-001.mp4").symlink_to(self.cuts)
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "overwrite input"):
            scene_detect.process_video(self.cuts, self.output, export_dir=directory)
        self.assertFalse(self.output.exists())

    def test_failed_export_publishes_no_json_or_clips(self):
        directory = self.base / "clips"
        real_run = scene_detect._run

        def fail_export(command, **kwargs):
            if command[0] == "ffmpeg":
                raise scene_detect.SceneDetectionError("fixture export failure")
            return real_run(command, **kwargs)

        with patch.object(scene_detect, "_run", side_effect=fail_export):
            with self.assertRaisesRegex(scene_detect.SceneDetectionError, "export failure"):
                scene_detect.process_video(self.cuts, self.output, export_dir=directory)
        self.assertFalse(self.output.exists())
        self.assertEqual(list(directory.iterdir()), [])

    def test_publication_race_does_not_replace_output(self):
        staged = self.base / "staged"
        staged.write_bytes(b"new")
        self.output.write_bytes(b"existing")
        with self.assertRaisesRegex(scene_detect.SceneDetectionError, "already exists"):
            scene_detect._publish(self.output, staged)
        self.assertEqual(self.output.read_bytes(), b"existing")

    def test_cli_detection_and_json_validation(self):
        subprocess.run([sys.executable, "-B", str(MODULE_PATH), "--input", str(self.cuts),
                        "--output", str(self.output), "--threshold", "27"],
                       check=True, capture_output=True)
        subprocess.run([sys.executable, "-B", str(MODULE_PATH), "--validate-json", str(self.output)],
                       check=True, capture_output=True)
        self.assertEqual(json.loads(self.output.read_text())["scenes"], sample()["scenes"])


if __name__ == "__main__":
    unittest.main()
