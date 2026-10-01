import { existsSync } from "node:fs";
import path from "node:path";

export interface ModelPaths {
  directory: string;
  classifier: string;
  dkt: string;
  metadata: string;
}

export function resolveModelPaths(extensionPath: string, configuredDirectory = ""): ModelPaths {
  const packagedDirectory = path.join(extensionPath, "models", "MAST-Synthetic");
  const directory = configuredDirectory.trim()
    ? path.resolve(extensionPath, configuredDirectory)
    : existsSync(packagedDirectory)
      ? packagedDirectory
      : path.resolve(extensionPath, "..", "artifacts", "synthetic");

  return {
    directory,
    classifier: path.join(directory, "error_classifier.synthetic.onnx"),
    dkt: path.join(directory, "dkt.synthetic.onnx"),
    metadata: path.join(directory, "metadata.json"),
  };
}