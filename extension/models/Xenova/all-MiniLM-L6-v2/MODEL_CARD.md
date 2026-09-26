# Bundled Embedding Model

- Model: `Xenova/all-MiniLM-L6-v2` (Transformers.js-compatible export)
- Upstream: https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Pinned revision: `751bff37182d3f1213fa05d7196b954e230abad9`
- License declared by upstream: Apache-2.0
- ONNX file: `onnx/model_quantized.onnx` (INT8 quantized)
- ONNX SHA-256: `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`
- Embedding output: mean-pooled, L2-normalized, 384-dimensional float32 vectors

Model and tokenizer files are bundled under this directory so inference can
run without downloading model files at runtime. The MAST source reference
corpus is not bundled because it was absent from the repository; the nearby
synthetic corpus file under `extension/test/fixtures/` is test-only and is not
original MAST educational content.