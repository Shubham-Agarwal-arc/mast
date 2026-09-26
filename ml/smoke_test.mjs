import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ort from "onnxruntime-node";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactDir = path.resolve(here, "..", "artifacts", "synthetic");

const classifier = await ort.InferenceSession.create(
  path.join(artifactDir, "error_classifier.synthetic.onnx"),
);
const classifierInputName = classifier.inputNames[0];
const classifierInput = new ort.Tensor("string", ["tensor shape mismatch"], [1, 1]);
const classifierOutput = await classifier.run({ [classifierInputName]: classifierInput });
const labelOutput = classifierOutput.label ?? classifierOutput[classifier.outputNames[0]];
assert.equal(labelOutput.dims[0], 1, "classifier should return one prediction per input");
assert.equal(typeof labelOutput.data[0], "string", "classifier should return a class label");
assert.ok(labelOutput.data[0].length > 0, "classifier label should not be empty");
const classOutput = Object.values(classifierOutput).find((value) => value !== labelOutput);
assert.ok(classOutput, "classifier should expose class scores");
assert.equal(classOutput.dims.at(-1), 8, "classifier should expose eight class scores");

const dkt = await ort.InferenceSession.create(path.join(artifactDir, "dkt.synthetic.onnx"));
const interactionIds = new ort.Tensor("int64", BigInt64Array.from([0n, 3n, 12n]), [1, 3]);
const zeroState = new ort.Tensor("float32", new Float32Array(2 * 1 * 256), [2, 1, 256]);
const dktOutput = await dkt.run({ interaction_ids: interactionIds, h0: zeroState, c0: zeroState });
assert.deepEqual(dktOutput.mastery.dims, [1, 3, 30]);
assert.deepEqual(dktOutput.hn.dims, [2, 1, 256]);
assert.deepEqual(dktOutput.cn.dims, [2, 1, 256]);
for (const probability of dktOutput.mastery.data) {
  assert.ok(probability >= 0 && probability <= 1, "mastery outputs must be sigmoid probabilities");
}

console.log("Synthetic ONNX artifact smoke test passed (8 classifier classes; 30 DKT KCs).");