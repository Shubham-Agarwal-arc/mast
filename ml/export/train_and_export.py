from __future__ import annotations

import argparse
import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path

import joblib
import numpy as np
import torch
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import StringTensorType
from torch import nn


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "artifacts" / "synthetic"
RANDOM_SEED = 20260926
N_KCS = 30
N_CLASSES = 8
HIDDEN_SIZE = 256
EMBED_SIZE = 64
N_LAYERS = 2
P_SLIP = 0.02
P_GUESS = 0.05
STEPS_PER_STUDENT = 200
TRAINING_EPOCHS = 10

ERROR_TEMPLATES = {
    "shape_mismatch": [
        "RuntimeError: size mismatch between tensor dimensions {a} and {b}",
        "ValueError: operands could not be broadcast together with shapes ({a},) ({b},)",
        "Expected input shape {a}, received incompatible shape {b}",
        "mat1 and mat2 shapes cannot be multiplied ({a}x{b} and {c}x{d})",
    ],
    "dtype_device": [
        "RuntimeError: expected scalar type {dtype_a} but found {dtype_b}",
        "Expected all tensors to be on the same device, found cpu and cuda:0",
        "TypeError: cannot convert tensor with dtype {dtype_a} to {dtype_b}",
        "Input type {dtype_a} and weight type {dtype_b} should be the same",
    ],
    "nan_loss": [
        "loss became nan after {step} optimizer steps",
        "RuntimeWarning: invalid value encountered in log during loss computation",
        "training loss is nan; gradient contains non-finite values",
        "BCE loss input contains nan after softmax",
    ],
    "gradient_autograd": [
        "RuntimeError: one of the variables needed for gradient computation was modified in place",
        "element {index} of tensors does not require grad and does not have a grad_fn",
        "Trying to backward through the graph a second time",
        "leaf variable has been moved into the graph interior",
    ],
    "data_leakage": [
        "validation score is suspiciously high after preprocessing before train_test_split",
        "target information appears in a feature column after dataset merge",
        "scaler was fit on the full dataset before splitting train and test data",
        "duplicate samples detected across the training and validation folds",
    ],
    "overfitting": [
        "training accuracy {train} while validation accuracy is {valid}",
        "validation loss rises while training loss continues to decrease",
        "model memorizes training examples but generalizes poorly",
        "large train validation gap after {epoch} epochs",
    ],
    "underfitting": [
        "training and validation accuracy remain low at {score}",
        "model has high bias and fails to fit the training set",
        "loss remains high on both train and validation data",
        "classifier predicts only the majority class",
    ],
    "data_pipeline": [
        "ValueError: input contains {count} missing values after transformation",
        "feature order differs between fit and predict pipeline",
        "Found unknown categories during one hot encoding",
        "dataset labels and feature rows have different lengths",
    ],
}


@dataclass(frozen=True)
class ArtifactMetadata:
    provenance: str
    random_seed: int
    classifier_classes: list[str]
    n_kcs: int
    dkt_hidden_size: int
    dkt_embedding_size: int
    dkt_num_layers: int
    p_slip: float
    p_guess: float
    steps_per_student: int
    training_epochs: int
    student_count: int
    kc_mapping: list[dict[str, object]]
    holdout_evaluation: str


def set_deterministic_seeds(seed: int = RANDOM_SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)


def synthetic_error_dataset(seed: int = RANDOM_SEED) -> tuple[list[str], list[str]]:
    rng = random.Random(seed)
    texts: list[str] = []
    labels: list[str] = []
    values = {
        "a": [2, 3, 16, 32, 64],
        "b": [1, 4, 8, 15, 128],
        "c": [2, 5, 12],
        "d": [3, 7, 24],
        "dtype_a": ["float32", "float64", "int64"],
        "dtype_b": ["float16", "int32", "bool"],
        "step": [5, 20, 100],
        "index": [0, 1, 2],
        "train": [0.9, 0.98, 1.0],
        "valid": [0.42, 0.61, 0.73],
        "epoch": [20, 50, 100],
        "score": [0.25, 0.4, 0.55],
        "count": [1, 3, 12],
    }
    for label, templates in ERROR_TEMPLATES.items():
        for _ in range(240):
            template = rng.choice(templates)
            row = {key: rng.choice(options) for key, options in values.items()}
            texts.append(template.format(**row))
            labels.append(label)
    order = list(range(len(texts)))
    rng.shuffle(order)
    return [texts[i] for i in order], [labels[i] for i in order]


def train_classifier(seed: int = RANDOM_SEED) -> Pipeline:
    texts, labels = synthetic_error_dataset(seed)
    classifier = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1, sublinear_tf=True)),
            ("classifier", LogisticRegression(max_iter=500, random_state=seed)),
        ]
    )
    classifier.fit(texts, labels)
    return classifier


def make_kc_mapping() -> list[dict[str, object]]:
    return [
        {"kc_id": f"KC_{kc_index:02d}", "cluster_id": f"cluster_{kc_index // 5}", "prerequisite": f"KC_{kc_index - 1:02d}" if kc_index else None}
        for kc_index in range(N_KCS)
    ]


def sample_kc(rng: random.Random, mastery: list[float]) -> int:
    cluster = rng.choices(range(6), weights=[6, 5, 4, 3, 2, 1], k=1)[0]
    cluster_start = cluster * 5
    candidates = list(range(cluster_start, min(cluster_start + 5, N_KCS)))
    if cluster > 0 and rng.random() < 0.4:
        candidates.append(cluster_start - 1)
    weights = [max(0.05, 1.0 - mastery[kc]) for kc in candidates]
    return rng.choices(candidates, weights=weights, k=1)[0]


def simulate_student_sequences(student_count: int, steps: int, seed: int = RANDOM_SEED) -> np.ndarray:
    rng = random.Random(seed)
    sequences: list[list[int]] = []
    for _student in range(student_count):
        mastery = [0.2] * N_KCS
        sequence: list[int] = []
        for _ in range(steps):
            kc_id = sample_kc(rng, mastery)
            mastered = rng.random() < mastery[kc_id]
            if mastered:
                answered_correctly = rng.random() >= P_SLIP
            else:
                answered_correctly = rng.random() < P_GUESS
            response_token = 1 if answered_correctly else 0
            sequence.append(kc_id * 2 + response_token)
            if answered_correctly:
                mastery[kc_id] = min(0.98, mastery[kc_id] + 0.08)
            else:
                mastery[kc_id] = max(0.02, mastery[kc_id] - 0.02)
        sequences.append(sequence)
    return np.asarray(sequences, dtype=np.int64)


class DKTModel(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.embedding = nn.Embedding(N_KCS * 2, EMBED_SIZE)
        self.lstm = nn.LSTM(EMBED_SIZE, HIDDEN_SIZE, num_layers=N_LAYERS, batch_first=True)
        self.output = nn.Linear(HIDDEN_SIZE, N_KCS)

    def forward(
        self, interaction_ids: torch.Tensor, h0: torch.Tensor, c0: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        embedded = self.embedding(interaction_ids)
        recurrent, (hn, cn) = self.lstm(embedded, (h0, c0))
        mastery = torch.sigmoid(self.output(recurrent))
        return mastery, hn, cn


def mastery_targets(interaction_ids: np.ndarray) -> np.ndarray:
    batch_size, sequence_length = interaction_ids.shape
    targets = np.zeros((batch_size, sequence_length, N_KCS), dtype=np.float32)
    for batch_index, sequence in enumerate(interaction_ids):
        mastery = np.full(N_KCS, 0.2, dtype=np.float32)
        for time_index, token in enumerate(sequence):
            targets[batch_index, time_index] = mastery
            kc_id, is_correct = divmod(int(token), 2)
            if is_correct:
                mastery[kc_id] = min(0.98, mastery[kc_id] + 0.08)
            else:
                mastery[kc_id] = max(0.02, mastery[kc_id] - 0.02)
    return targets


def train_dkt(student_count: int, steps: int, seed: int = RANDOM_SEED) -> DKTModel:
    set_deterministic_seeds(seed)
    model = DKTModel()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    loss_function = nn.BCELoss()
    sequences = simulate_student_sequences(student_count, steps, seed)
    targets = mastery_targets(sequences)
    interaction_tensor = torch.from_numpy(sequences)
    target_tensor = torch.from_numpy(targets)
    for _ in range(TRAINING_EPOCHS):
        zero_state = torch.zeros(N_LAYERS, student_count, HIDDEN_SIZE)
        predictions, _, _ = model(interaction_tensor, zero_state, zero_state.clone())
        loss = loss_function(predictions, target_tensor)
        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        optimizer.step()
    model.eval()
    return model


def export_classifier(classifier: Pipeline, output_dir: Path) -> None:
    joblib.dump(classifier, output_dir / "error_classifier.synthetic.joblib")
    model_onnx = convert_sklearn(
        classifier,
        initial_types=[("error_text", StringTensorType([None, 1]))],
        target_opset=17,
        options={id(classifier.named_steps["classifier"]): {"zipmap": False}},
    )
    (output_dir / "error_classifier.synthetic.onnx").write_bytes(model_onnx.SerializeToString())


def export_dkt(model: DKTModel, output_dir: Path) -> None:
    example_ids = torch.zeros(2, 5, dtype=torch.int64)
    example_state = torch.zeros(N_LAYERS, 2, HIDDEN_SIZE)
    torch.onnx.export(
        model,
        (example_ids, example_state, example_state.clone()),
        output_dir / "dkt.synthetic.onnx",
        input_names=["interaction_ids", "h0", "c0"],
        output_names=["mastery", "hn", "cn"],
        dynamic_axes={
            "interaction_ids": {0: "batch", 1: "sequence"},
            "mastery": {0: "batch", 1: "sequence"},
            "h0": {1: "batch"},
            "c0": {1: "batch"},
            "hn": {1: "batch"},
            "cn": {1: "batch"},
        },
        opset_version=17,
        dynamo=False,
    )
    torch.save(model.state_dict(), output_dir / "dkt.synthetic.state_dict.pt")


def export_artifacts(output_dir: Path, student_count: int = 8, steps: int = STEPS_PER_STUDENT) -> ArtifactMetadata:
    output_dir.mkdir(parents=True, exist_ok=True)
    set_deterministic_seeds()
    classifier = train_classifier()
    model = train_dkt(student_count, steps)
    export_classifier(classifier, output_dir)
    export_dkt(model, output_dir)
    metadata = ArtifactMetadata(
        provenance="SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL",
        random_seed=RANDOM_SEED,
        classifier_classes=list(classifier.classes_),
        n_kcs=N_KCS,
        dkt_hidden_size=HIDDEN_SIZE,
        dkt_embedding_size=EMBED_SIZE,
        dkt_num_layers=N_LAYERS,
        p_slip=P_SLIP,
        p_guess=P_GUESS,
        steps_per_student=steps,
        training_epochs=TRAINING_EPOCHS,
        student_count=student_count,
        kc_mapping=make_kc_mapping(),
        holdout_evaluation="NOT_RUN: no original holdout data was present in the repository",
    )
    (output_dir / "metadata.json").write_text(json.dumps(asdict(metadata), indent=2) + "\n", encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Train provisional synthetic MAST models and export ONNX artifacts.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--students", type=int, default=8)
    parser.add_argument("--steps", type=int, default=STEPS_PER_STUDENT)
    args = parser.parse_args()
    if args.students < 1 or args.steps < 1:
        parser.error("--students and --steps must be positive")
    metadata = export_artifacts(args.output_dir, args.students, args.steps)
    print(f"Exported synthetic bootstrap artifacts to {args.output_dir}")
    print(f"Classifier classes: {len(metadata.classifier_classes)}; DKT KCs: {metadata.n_kcs}")
    print("These artifacts are not research-trained models and have no validated benchmark scores.")


if __name__ == "__main__":
    main()