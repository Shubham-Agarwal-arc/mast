import { spawn } from "node:child_process";
import path from "node:path";

export interface PythonFileDocument {
  fileName: string;
  languageId: string;
}

export interface PythonWorkspace {
  workspaceRoot: string;
  pythonCommand: string;
}

export interface PythonRunResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

export interface ProcessRunner {
  run(command: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<PythonRunResult>;
}

const MAX_OUTPUT_LENGTH = 200_000;

export const childProcessRunner: ProcessRunner = {
  run(command, args, cwd, timeoutMs) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, [...args], {
        cwd,
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      const timer = setTimeout(() => {
        child.kill();
        if (!settled) {
          settled = true;
          reject(new Error("Python execution timed out."));
        }
      }, timeoutMs);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.once("error", (error) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
      child.once("close", (exitCode) => {
        clearTimeout(timer);
        if (!settled) {
          settled = true;
          resolve({
            exitCode,
            stdout: stdout.slice(-MAX_OUTPUT_LENGTH),
            stderr: stderr.slice(-MAX_OUTPUT_LENGTH),
          });
        }
      });
    });
  },
};

function isWithinWorkspace(fileName: string, workspaceRoot: string): boolean {
  const relative = path.relative(workspaceRoot, fileName);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function runActivePythonFile(
  document: PythonFileDocument | undefined,
  workspace: PythonWorkspace,
  runner: ProcessRunner = childProcessRunner,
): Promise<PythonRunResult> {
  if (!document || document.languageId !== "python") {
    throw new Error("Open a Python file before running MAST code capture.");
  }
  const fileName = path.resolve(document.fileName);
  const workspaceRoot = path.resolve(workspace.workspaceRoot);
  if (!isWithinWorkspace(fileName, workspaceRoot)) {
    throw new Error("The active Python file must be inside the current workspace.");
  }
  if (!workspace.pythonCommand.trim()) {
    throw new Error("MAST Python command is not configured.");
  }
  return runner.run(workspace.pythonCommand, [fileName], workspaceRoot, 120_000);
}

export function capturedErrorText(result: PythonRunResult): string | undefined {
  const stderr = result.stderr.trim();
  if (stderr) {
    return stderr;
  }
  if (result.exitCode !== 0 && result.exitCode !== null) {
    return `Python exited with status ${result.exitCode} without diagnostic output.`;
  }
  return undefined;
}
