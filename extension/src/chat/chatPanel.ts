import { randomBytes } from "node:crypto";
import * as vscode from "vscode";

import { GatewayApiError } from "../auth/gatewayClient.js";
import { isChatPanelMessage } from "./chatWorkflow.js";
import type { ChatWorkflow, ChatTurnResult } from "./chatWorkflow.js";
import { createChatHtml } from "./chatView.js";

const panelType = "mast.chat";

export interface ChatPanelController {
  panel: vscode.WebviewPanel;
  sendCapturedError(errorText: string): Promise<void>;
}

export interface ChatPanelOptions {
  onMasteryChanged?: (masteryByKc: Readonly<Record<string, number>>) => Promise<void> | void;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof GatewayApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message === "Sign in with GitHub before starting a MAST chat.") {
    return "Sign in with GitHub, then send your message again.";
  }
  if (error instanceof Error && error.message === "Enter an error or question before sending.") {
    return error.message;
  }
  if (error instanceof Error && error.message === "Keep your message under 4,000 characters.") {
    return error.message;
  }
  return "MAST could not complete that request. Your draft is still here.";
}

async function postTurn(webview: vscode.Webview, result: ChatTurnResult): Promise<void> {
  await webview.postMessage({
    type: "assistant",
    response: result.response,
    category: result.category,
    confidence: result.confidence,
    masteryPercent: result.masteryPercent,
    suggestions: result.suggestions,
  });
}

export function showChatPanel(
  context: vscode.ExtensionContext,
  workflow: ChatWorkflow,
  options: ChatPanelOptions = {},
): ChatPanelController {
  const panel = vscode.window.createWebviewPanel(panelType, "MAST Chat", vscode.ViewColumn.Beside, {
    enableScripts: true,
    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
  });
  const nonce = randomBytes(16).toString("base64");
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "chat.js"));
  const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "chat.css"));
  panel.webview.html = createChatHtml(panel.webview.cspSource, String(scriptUri), String(styleUri), nonce);

  const submit = async (message: { type: "submit" | "followUp"; text: string }): Promise<void> => {
    await panel.webview.postMessage({ type: "pending" });
    try {
      const result = message.type === "followUp"
        ? await workflow.followUp(message.text)
        : await workflow.send(message.text);
      await postTurn(panel.webview, result);
    } catch (error) {
      await panel.webview.postMessage({ type: "error", message: safeErrorMessage(error) });
    }
  };

  const sendCapturedError = async (errorText: string): Promise<void> => {
    await panel.webview.postMessage({ type: "capturedError", text: errorText });
    await submit({ type: "submit", text: errorText });
  };

  panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!isChatPanelMessage(message)) {
      return;
    }
    if (message.type === "resolved") {
      try {
        const masteryPercent = await workflow.resolve();
        await options.onMasteryChanged?.(workflow.masterySnapshot);
        await panel.webview.postMessage({ type: "resolved", masteryPercent });
      } catch (error) {
        await panel.webview.postMessage({ type: "error", message: safeErrorMessage(error) });
      }
      return;
    }

    await submit(message);
  });

  context.subscriptions.push(panel);
  return { panel, sendCapturedError };
}
