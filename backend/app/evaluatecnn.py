"""Evaluate the outfit CNN against a folder-per-class test dataset.

Expected layout (the folder name is the ground-truth label)::

    cnn_test_images/
        Warm-Weather/*.png
        Cold-Weather/*.png
        Rain-Weather/*.png

Run from ``backend`` (or provide explicit paths)::

    .\\venv\\Scripts\\python.exe app\\evaluatecnn.py
    .\\venv\\Scripts\\python.exe app\\evaluatecnn.py --batch-size 16

The preprocessing deliberately matches ``main.py`` so these metrics describe
the predictions returned by the live ``/predict-outfit`` endpoint.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

# Must be set before TensorFlow is imported.  It is also used by main.py.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError
from sklearn.metrics import accuracy_score, balanced_accuracy_score, classification_report, confusion_matrix


APP_DIR = Path(__file__).resolve().parent
DEFAULT_MODEL_PATH = APP_DIR / "model" / "keras_model.h5"
DEFAULT_LABELS_PATH = APP_DIR / "model" / "labels.txt"
DEFAULT_TEST_DIR = APP_DIR / "cnn_test_images"
IMAGE_SUFFIXES = {".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Evaluate Ano Tara's outfit CNN and print a confusion matrix.")
    parser.add_argument("--test-dir", type=Path, default=DEFAULT_TEST_DIR, help=f"Folder-per-label test data (default: {DEFAULT_TEST_DIR})")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL_PATH, help="Keras .h5 model path")
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS_PATH, help="Model labels.txt path")
    parser.add_argument("--batch-size", type=int, default=16, help="Images per inference batch (default: 16)")
    parser.add_argument("--output-dir", type=Path, default=APP_DIR / "evaluation_output", help="Directory for CSV and JSON reports")
    return parser.parse_args()


def read_labels(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"Labels file was not found: {path}")
    labels = [line.strip().split(" ", 1)[-1] for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not labels or len(labels) != len(set(labels)):
        raise ValueError(f"Labels must be non-empty and unique; got {labels!r}")
    return labels


def collect_images(test_dir: Path, class_names: list[str]) -> tuple[list[tuple[Path, int]], list[str]]:
    if not test_dir.is_dir():
        raise FileNotFoundError(f"Test-image directory was not found: {test_dir}")
    present_dirs = {entry.name for entry in test_dir.iterdir() if entry.is_dir()}
    unknown = sorted(present_dirs - set(class_names))
    if unknown:
        raise ValueError(f"These test-data folders are not model labels: {unknown}. Expected only: {class_names}")
    missing = [label for label in class_names if label not in present_dirs]
    samples = [(path, class_index) for class_index, label in enumerate(class_names) for path in sorted((test_dir / label).rglob("*")) if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES]
    if not samples:
        raise ValueError(f"No supported image files found below {test_dir}")
    return samples, missing


def load_batch(samples: list[tuple[Path, int]]) -> tuple[np.ndarray, list[int], list[Path], list[dict[str, str]]]:
    images: list[np.ndarray] = []
    labels: list[int] = []
    paths: list[Path] = []
    failures: list[dict[str, str]] = []
    for path, label in samples:
        try:
            # Same conversion, resize, and [-1, 1] normalization as main.py.
            with Image.open(path) as image:
                array = np.asarray(image.convert("RGB").resize((224, 224)), dtype=np.float32)
            images.append((array / 127.5) - 1.0)
            labels.append(label)
            paths.append(path)
        except (OSError, UnidentifiedImageError, ValueError) as exc:
            failures.append({"file": str(path), "error": str(exc)})
    return np.asarray(images, dtype=np.float32), labels, paths, failures


def matrix_text(matrix: np.ndarray, labels: list[str], value_format: str = "d") -> str:
    width = max(13, *(len(label) for label in labels))
    header = f"{'actual \\ predicted':>{width}} " + " ".join(f"{label:>{width}}" for label in labels)
    rows = [header]
    for label, row in zip(labels, matrix):
        rows.append(f"{label:>{width}} " + " ".join(f"{value:{width}{value_format}}" for value in row))
    return "\n".join(rows)


def write_reports(output_dir: Path, labels: list[str], actual: np.ndarray, predicted: np.ndarray, probabilities: np.ndarray, paths: list[Path], report: dict, raw_matrix: np.ndarray, normalized_matrix: np.ndarray, failures: list[dict[str, str]]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "predictions.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["file", "actual_label", "predicted_label", "correct", "confidence", *[f"probability_{label}" for label in labels]])
        for path, truth, prediction, scores in zip(paths, actual, predicted, probabilities):
            writer.writerow([str(path), labels[int(truth)], labels[int(prediction)], bool(truth == prediction), f"{float(scores[prediction]):.8f}", *[f"{float(score):.8f}" for score in scores]])
    payload = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(), "labels": labels,
        "samples_evaluated": int(len(actual)), "unreadable_images": failures,
        "accuracy": float(accuracy_score(actual, predicted)), "balanced_accuracy": float(balanced_accuracy_score(actual, predicted)),
        "classification_report": report, "confusion_matrix": raw_matrix.tolist(),
        "confusion_matrix_row_normalized": normalized_matrix.tolist(),
    }
    (output_dir / "metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    args = parse_args()
    if args.batch_size < 1:
        raise ValueError("--batch-size must be at least 1")
    class_names = read_labels(args.labels)
    samples, missing_classes = collect_images(args.test_dir, class_names)
    print("CNN OUTFIT EVALUATION")
    print(f"Model:      {args.model}")
    print(f"Labels:     {class_names}")
    print(f"Test data:  {args.test_dir}")
    print(f"Found:      {len(samples)} image files")
    print("By actual label: " + ", ".join(f"{label}={sum(target == index for _, target in samples)}" for index, label in enumerate(class_names)))
    if missing_classes:
        print(f"WARNING: no test folder for {missing_classes}; their metrics will have zero support.")

    if not args.model.is_file():
        raise FileNotFoundError(f"Model file was not found: {args.model}")
    print("Loading model...")
    try:
        model = tf.keras.models.load_model(str(args.model), compile=False)
    except (AttributeError, ImportError, TypeError, ValueError) as exc:
        raise RuntimeError(
            "Could not load the CNN. Use TensorFlow 2.19 plus tf-keras, as "
            "specified in backend/requirements.txt."
        ) from exc
    expected_outputs = int(model.output_shape[-1])
    if expected_outputs != len(class_names):
        raise ValueError(f"Model has {expected_outputs} outputs but labels.txt has {len(class_names)} labels.")

    actual: list[int] = []
    predicted: list[int] = []
    probabilities: list[np.ndarray] = []
    paths: list[Path] = []
    failures: list[dict[str, str]] = []
    total_batches = (len(samples) + args.batch_size - 1) // args.batch_size
    for batch_number, start in enumerate(range(0, len(samples), args.batch_size), start=1):
        batch, targets, batch_paths, batch_failures = load_batch(samples[start : start + args.batch_size])
        failures.extend(batch_failures)
        if len(batch):
            scores = np.asarray(model.predict(batch, verbose=0))
            if scores.ndim != 2 or scores.shape[1] != len(class_names):
                raise ValueError(f"Unexpected prediction shape {scores.shape}; expected (batch_size, {len(class_names)}).")
            actual.extend(targets); predicted.extend(np.argmax(scores, axis=1).astype(int).tolist()); probabilities.extend(scores); paths.extend(batch_paths)
        print(f"Processed batch {batch_number}/{total_batches} ({min(start + args.batch_size, len(samples))}/{len(samples)} files)")
    if not actual:
        raise ValueError("All discovered images were unreadable; nothing could be evaluated.")

    actual_array, predicted_array, probability_array = np.asarray(actual), np.asarray(predicted), np.asarray(probabilities)
    indexes = list(range(len(class_names)))
    raw_matrix = confusion_matrix(actual_array, predicted_array, labels=indexes)
    normalized_matrix = confusion_matrix(actual_array, predicted_array, labels=indexes, normalize="true")
    report = classification_report(actual_array, predicted_array, labels=indexes, target_names=class_names, zero_division=0, output_dict=True)
    accuracy, balanced = accuracy_score(actual_array, predicted_array), balanced_accuracy_score(actual_array, predicted_array)

    print("\nRESULTS")
    print(f"Evaluated images:    {len(actual_array)}")
    print(f"Unreadable images:   {len(failures)}")
    print(f"Correct / incorrect: {int(np.trace(raw_matrix))} / {int(len(actual_array) - np.trace(raw_matrix))}")
    print(f"Accuracy:            {accuracy:.2%}")
    print(f"Balanced accuracy:   {balanced:.2%}")
    print(f"Mean confidence:     {np.mean(np.max(probability_array, axis=1)):.2%}")
    print("\nPER-CLASS METRICS")
    print(f"{'label':<16} {'precision':>10} {'recall':>10} {'f1-score':>10} {'support':>10}")
    for label in class_names:
        values = report[label]
        print(f"{label:<16} {values['precision']:>9.2%} {values['recall']:>9.2%} {values['f1-score']:>9.2%} {int(values['support']):>10}")
    print("\nCONFUSION MATRIX (counts; rows = actual, columns = predicted)")
    print(matrix_text(raw_matrix, class_names))
    print("\nCONFUSION MATRIX (row-normalized recall; rows = actual, columns = predicted)")
    print(matrix_text(normalized_matrix, class_names, ".2f"))

    wrong = np.flatnonzero(actual_array != predicted_array)
    print(f"\nMISCLASSIFICATIONS ({len(wrong)})")
    if len(wrong):
        for index in wrong:
            print(f"- {paths[index]} | actual={class_names[actual_array[index]]} | predicted={class_names[predicted_array[index]]} | confidence={probability_array[index, predicted_array[index]]:.2%}")
    else:
        print("None.")
    if failures:
        print("\nUNREADABLE FILES")
        for failure in failures:
            print(f"- {failure['file']}: {failure['error']}")
    write_reports(args.output_dir, class_names, actual_array, predicted_array, probability_array, paths, report, raw_matrix, normalized_matrix, failures)
    print(f"\nSaved detailed reports to: {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (FileNotFoundError, ImportError, RuntimeError, ValueError) as exc:
        print(f"Evaluation failed: {exc}", file=sys.stderr)
        if isinstance(exc, (ImportError, RuntimeError)):
            print("Use the backend virtual environment after installing backend/requirements.txt; this model requires TensorFlow 2.19 with tf-keras.", file=sys.stderr)
        raise SystemExit(2)
