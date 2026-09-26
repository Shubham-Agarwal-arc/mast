import json
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort

from ml.export.train_and_export import (
    export_artifacts,
    set_deterministic_seeds,
    synthetic_error_dataset,
    train_classifier,
    train_dkt,
)


def test_synthetic_classifier_training_is_deterministic() -> None:
    texts, labels = synthetic_error_dataset()
    first = train_classifier()
    second = train_classifier()

    assert first.classes_.tolist() == second.classes_.tolist()
    assert np.array_equal(first.predict(texts[:30]), second.predict(texts[:30]))
    assert len(set(labels)) == 8


def test_synthetic_dkt_training_is_deterministic() -> None:
    first = train_dkt(student_count=1, steps=4)
    first_parameters = {name: parameter.detach().clone() for name, parameter in first.state_dict().items()}
    second = train_dkt(student_count=1, steps=4)

    assert all(np.array_equal(first_parameters[name].numpy(), parameter.detach().numpy()) for name, parameter in second.state_dict().items())


def test_exported_onnx_models_have_expected_outputs(tmp_path: Path) -> None:
    export_artifacts(tmp_path, student_count=2, steps=12)

    classifier_path = tmp_path / "error_classifier.synthetic.onnx"
    dkt_path = tmp_path / "dkt.synthetic.onnx"
    onnx.checker.check_model(onnx.load(classifier_path))
    onnx.checker.check_model(onnx.load(dkt_path))

    classifier = ort.InferenceSession(str(classifier_path), providers=["CPUExecutionProvider"])
    result = classifier.run(None, {"error_text": np.asarray([["tensor shape mismatch"]], dtype=object)})
    assert result[0].shape == (1,)
    assert result[1].shape == (1, 8)

    dkt = ort.InferenceSession(str(dkt_path), providers=["CPUExecutionProvider"])
    output = dkt.run(
        None,
        {
            "interaction_ids": np.asarray([[0, 3, 12]], dtype=np.int64),
            "h0": np.zeros((2, 1, 256), dtype=np.float32),
            "c0": np.zeros((2, 1, 256), dtype=np.float32),
        },
    )
    assert output[0].shape == (1, 3, 30)
    assert output[1].shape == (2, 1, 256)
    assert output[2].shape == (2, 1, 256)
    assert np.all((output[0] >= 0) & (output[0] <= 1))

    metadata = json.loads((tmp_path / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["provenance"] == "SYNTHETIC_BOOTSTRAP_NOT_RESEARCH_MODEL"
    assert "NOT_RUN" in metadata["holdout_evaluation"]