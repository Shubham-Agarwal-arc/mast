import * as vscode from "vscode";
import path from "node:path";

import { ExtensionAuthService } from "./auth/authService.js";
import { AuthModeService } from "./auth/authMode.js";
import { ByokSecretStore } from "./auth/byokStore.js";
import { GatewayApiClient, GatewayApiError } from "./auth/gatewayClient.js";
import { MastTokenStore } from "./auth/tokenStore.js";
import type { AuthMode } from "./auth/types.js";
import { VscodeGitHubTokenProvider } from "./auth/vscodeGitHubTokenProvider.js";
import { ChatWorkflow } from "./chat/chatWorkflow.js";
import { showChatPanel } from "./chat/chatPanel.js";
import type { ChatPanelController } from "./chat/chatPanel.js";
import { showKnowledgeMapPanel } from "./knowledge/knowledgeMapView.js";
import type { KnowledgeMapPanel } from "./knowledge/knowledgeMapView.js";
import { capturedErrorText, runActivePythonFile } from "./execution/runPythonFile.js";
import { LocalInference } from "./inference/localInference.js";
import { resolveModelPaths } from "./inference/modelPaths.js";
import type { SerializedDktState } from "./inference/types.js";
import { LocalRetrieval } from "./retrieval/localRetrieval.js";

const dktStateKey = "mast.dktHiddenState.v1";
const walkthroughOpenedKey = "mast.walkthroughOpened.v1";
const firstSocraticQuestionKey = "mast.firstSocraticQuestion.v1";
const firstSocraticQuestionContext = "mast.firstSocraticQuestionComplete";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configuredDirectory = vscode.workspace.getConfiguration("mast").get<string>("modelDirectory", "");
  const paths = resolveModelPaths(context.extensionPath, configuredDirectory);
  const inference = await LocalInference.load(paths);
  context.subscriptions.push({ dispose: () => void inference.dispose() });
  const retrieval = await LocalRetrieval.load(
    context.extensionPath,
    path.join(context.extensionPath, "data", "reference-documents.v1.json"),
  );
  context.subscriptions.push({ dispose: () => void retrieval.dispose() });
  const tokenStore = new MastTokenStore(context.secrets);
  const byokStore = new ByokSecretStore(context.secrets);
  const modePreferences = vscode.workspace.getConfiguration("mast");
  const authMode = new AuthModeService(
    {
      get: () => modePreferences.get<unknown>("authMode", "managed"),
      set: async (mode: AuthMode) => modePreferences.update("authMode", mode, vscode.ConfigurationTarget.Global),
    },
    byokStore,
  );
  const githubTokenProvider = new VscodeGitHubTokenProvider(vscode.authentication);
  const createAuthService = () =>
    new ExtensionAuthService(
      githubTokenProvider,
      new GatewayApiClient(vscode.workspace.getConfiguration("mast").get("gatewayUrl", "http://127.0.0.1:8000")),
      tokenStore,
    );
  const createGatewayClient = () =>
    new GatewayApiClient(vscode.workspace.getConfiguration("mast").get("gatewayUrl", "http://127.0.0.1:8000"));
  let chatPanel: ChatPanelController | undefined;
  let knowledgeMap: KnowledgeMapPanel | undefined;

  const createChatWorkflow = (): ChatWorkflow => new ChatWorkflow({
    inference,
    retrieval,
    tokens: {
      get: async () => {
        const stored = await tokenStore.get();
        if (stored) {
          return stored;
        }
        await createAuthService().signInWithGitHub();
        return tokenStore.get();
      },
    },
    gateway: {
      chat: async (accessToken, payload) => {
        const gateway = createGatewayClient();
        try {
          return await gateway.chat(accessToken, payload);
        } catch (error) {
          if (!(error instanceof GatewayApiError) || error.statusCode !== 401) {
            throw error;
          }
          const refreshed = await createAuthService().refresh();
          return gateway.chat(refreshed.access_token, payload);
        }
      },
      feedback: async (accessToken, payload) => {
        const gateway = createGatewayClient();
        try {
          await gateway.feedback(accessToken, payload);
        } catch (error) {
          if (!(error instanceof GatewayApiError) || error.statusCode !== 401) {
            throw error;
          }
          const refreshed = await createAuthService().refresh();
          await gateway.feedback(refreshed.access_token, payload);
        }
      },
    },
    getDktState: () => context.globalState.get<SerializedDktState>(dktStateKey),
    saveDktState: async (state) => { await context.globalState.update(dktStateKey, state); },
    telemetryEnabled: vscode.workspace.getConfiguration("mast").get<boolean>("telemetryEnabled", false),
    onFirstSocraticQuestion: () => {
      void vscode.commands.executeCommand("mast.internal.firstQuestionComplete");
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("mast.openChat", () => {
      const workflow = createChatWorkflow();
      chatPanel = showChatPanel(context, workflow, {
        onMasteryChanged: async (masteryByKc) => {
          await knowledgeMap?.update(masteryByKc);
        },
      });
    }),
    vscode.commands.registerCommand("mast.openKnowledgeMap", () => {
      knowledgeMap = showKnowledgeMapPanel(
        context,
        inference.getKnowledgeComponents(),
        Object.fromEntries(inference.getKnowledgeComponents().map((kcId) => [kcId, 0.5])),
      );
    }),
    vscode.commands.registerCommand("mast.runCode", async () => {
      const editor = vscode.window.activeTextEditor;
      const workspaceFolder = editor ? vscode.workspace.getWorkspaceFolder(editor.document.uri) : undefined;
      if (!workspaceFolder) {
        await vscode.window.showErrorMessage("Open a Python file inside a workspace before running MAST code capture.");
        return;
      }
      try {
        const result = await runActivePythonFile(
          editor && { fileName: editor.document.fileName, languageId: editor.document.languageId },
          {
            workspaceRoot: workspaceFolder.uri.fsPath,
            pythonCommand: vscode.workspace.getConfiguration("mast").get("pythonCommand", "python"),
          },
        );
        const errorText = capturedErrorText(result);
        if (!errorText) {
          await vscode.window.showInformationMessage("MAST ran the active Python file without capturing an error.");
          return;
        }
        if (!chatPanel) {
          chatPanel = showChatPanel(context, createChatWorkflow(), {
            onMasteryChanged: async (masteryByKc) => {
              await knowledgeMap?.update(masteryByKc);
            },
          });
        }
        await chatPanel.sendCapturedError(errorText);
      } catch (error) {
        const message = error instanceof Error ? error.message : "MAST could not run the active Python file.";
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("mast.classifyError", async () => {
      const errorText = await vscode.window.showInputBox({
        prompt: "Paste a Python error to classify locally",
        ignoreFocusOut: true,
      });
      if (errorText === undefined) {
        return;
      }
      try {
        const result = await inference.classifyError(errorText);
        const syntheticNotice = result.provenance.startsWith("SYNTHETIC_") ? " (synthetic model)" : "";
        await vscode.window.showInformationMessage(
          `MAST classification${syntheticNotice}: ${result.label} (${(result.confidence * 100).toFixed(1)}%)`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown local inference error";
        await vscode.window.showErrorMessage(`MAST could not classify this error: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.updateMastery", async () => {
      const kcId = await vscode.window.showQuickPick(
        inference.getKnowledgeComponents(),
        { placeHolder: "Choose the KC for this learning interaction" },
      );
      if (kcId === undefined) {
        return;
      }
      const response = await vscode.window.showQuickPick(
        [
          { label: "Resolved", resolved: true },
          { label: "Still learning", resolved: false },
        ],
        { placeHolder: "Was this interaction resolved?" },
      );
      if (response === undefined) {
        return;
      }
      try {
        const previousState = context.globalState.get<SerializedDktState>(dktStateKey);
        const result = await inference.updateMastery(kcId, response.resolved, previousState);
        await context.globalState.update(dktStateKey, result.state);
        await vscode.window.showInformationMessage(
          `MAST mastery updated for ${kcId}: ${(result.masteryByKc[kcId] * 100).toFixed(1)}%${result.provenance.startsWith("SYNTHETIC_") ? " (synthetic model)" : ""}`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown local inference error";
        await vscode.window.showErrorMessage(`MAST could not update mastery: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.signIn", async () => {
      try {
        const tokens = await createAuthService().signInWithGitHub();
        if (tokens) {
          await vscode.window.showInformationMessage("Signed in to MAST with GitHub.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown sign-in error";
        await vscode.window.showErrorMessage(`MAST sign-in failed: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.refreshSession", async () => {
      try {
        await createAuthService().refresh();
        await vscode.window.showInformationMessage("MAST sign-in refreshed.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown refresh error";
        await vscode.window.showErrorMessage(`MAST refresh failed: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.signOut", async () => {
      await tokenStore.clear();
      await vscode.window.showInformationMessage("MAST credentials cleared from SecretStorage.");
    }),
    vscode.commands.registerCommand("mast.configureApiKey", async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your provider API key. It will be stored in VS Code SecretStorage.",
        password: true,
        ignoreFocusOut: true,
      });
      if (apiKey === undefined) {
        return;
      }
      try {
        await byokStore.setApiKey(apiKey);
        await authMode.setMode("byok");
        await vscode.window.showInformationMessage("Provider key stored in SecretStorage; BYOK mode selected.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown API key storage error";
        await vscode.window.showErrorMessage(`MAST could not store the provider key: ${message}`);
      }
    }),
    vscode.commands.registerCommand("mast.clearApiKey", async () => {
      await byokStore.clearApiKey();
      if (authMode.getMode() === "byok") {
        await authMode.setMode("managed");
      }
      await vscode.window.showInformationMessage("Provider key cleared from SecretStorage; Managed mode selected.");
    }),
    vscode.commands.registerCommand("mast.selectAuthMode", async () => {
      const choices = [
        { label: "Managed Cloud", description: "Use MAST-managed credentials", value: "managed" as const },
        { label: "Bring Your Own Key", description: "Use a provider key from SecretStorage", value: "byok" as const },
      ];
      const selection = await vscode.window.showQuickPick(choices, {
        placeHolder: `Current mode: ${authMode.getMode()}`,
      });
      if (!selection) {
        return;
      }
      try {
        await authMode.setMode(selection.value);
        await vscode.window.showInformationMessage(`MAST authentication mode set to ${selection.label}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown mode selection error";
        await vscode.window.showErrorMessage(message);
      }
    }),
    vscode.commands.registerCommand("mast.internal.firstQuestionComplete", async () => {
      await context.globalState.update(firstSocraticQuestionKey, true);
      await vscode.commands.executeCommand("setContext", firstSocraticQuestionContext, true);
    }),
  );

  if (context.globalState.get<boolean>(firstSocraticQuestionKey, false)) {
    await vscode.commands.executeCommand("setContext", firstSocraticQuestionContext, true);
  }
  if (!context.globalState.get<boolean>(walkthroughOpenedKey, false)) {
    await vscode.commands.executeCommand("workbench.action.openWalkthrough", "mast.mast#firstRun");
    await context.globalState.update(walkthroughOpenedKey, true);
  }
}

export function deactivate(): void {}