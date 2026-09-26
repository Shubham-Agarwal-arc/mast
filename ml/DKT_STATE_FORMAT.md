# DKT Hidden-State Serialization

The exported DKT graph accepts and returns recurrent state explicitly so the
extension can preserve learner state between interactions without a Python
process.

For each of `h` and `c`, serialize a float32 tensor with shape
`[2, 1, 256]` (`layers`, `batch`, `hidden`). The first dimension indexes the
two LSTM layers. For one learner, remove no dimensions: flatten the values in
C row-major order (layer, batch, hidden) and store exactly 512 float32 values
per tensor. Serialize each tensor as little-endian IEEE-754 float32 bytes,
Base64 encoded, alongside `dtype: "float32-le"`, `shape: [2, 1, 256]`, and the
artifact/model version. Restore by Base64-decoding and reshaping to the exact
shape before calling ONNX Runtime.

The ONNX inputs are `interaction_ids` (`int64`, shape `[batch, sequence]`),
`h0` and `c0` (`float32`, shape `[2, batch, 256]`). Each token is
`kc_index * 2 + response`, where the KC index is 0–29 and response is 0
(incorrect/unresolved) or 1 (correct/resolved). The ONNX outputs are mastery
probabilities (`float32`, `[batch, sequence, 30]`) and updated `hn`/`cn` state
(`float32`, `[2, batch, 256]`). For batch size one, persist the final `hn` and
`cn` returned for that interaction.

**Provenance warning:** Block 4 began without the original KC taxonomy, model
weights, session corpus, or holdout set. The included 30 IDs and resulting
weights are synthetic scaffolding only and must not be represented as the
research model or used to claim the PRD's published AUC/F1 results.