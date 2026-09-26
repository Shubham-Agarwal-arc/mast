(() => {
  const vscode = acquireVsCodeApi();
  const form = document.getElementById("composer");
  const input = document.getElementById("message-input");
  const thread = document.getElementById("thread");
  const emptyState = document.getElementById("empty-state");
  const errorMessage = document.getElementById("error-message");
  const sendButton = form.querySelector("button[type='submit']");
  const masteryBadge = document.getElementById("mastery");
  const sessionBadge = document.getElementById("session-status");

  function appendMessage(kind, text, label) {
    emptyState.hidden = true;
    const article = document.createElement("article");
    article.className = `message ${kind}`;
    const heading = document.createElement("p");
    heading.className = "message-label";
    heading.textContent = label;
    const body = document.createElement("p");
    body.className = "message-body";
    body.textContent = text;
    article.append(heading, body);
    thread.append(article);
    article.scrollIntoView({ block: "end", behavior: "smooth" });
    return article;
  }

  function setPending(pending) {
    sendButton.disabled = pending;
    input.disabled = pending;
    sendButton.textContent = pending ? "Thinking..." : "Send";
    sessionBadge.textContent = pending ? "Thinking" : "Session active";
    sessionBadge.classList.toggle("active", !pending && sessionBadge.textContent === "Session active");
  }

  function appendActions(result) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    for (const suggestion of result.suggestions) {
      if (typeof suggestion !== "string") continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-button";
      button.textContent = suggestion;
      button.addEventListener("click", () => {
        appendMessage("learner", suggestion, "YOU");
        vscode.postMessage({ type: "followUp", text: suggestion });
        setPending(true);
      });
      actions.append(button);
    }
    const resolved = document.createElement("button");
    resolved.type = "button";
    resolved.className = "resolved-button";
    resolved.textContent = "Resolved";
    resolved.addEventListener("click", () => {
      resolved.disabled = true;
      vscode.postMessage({ type: "resolved" });
    });
    actions.append(resolved);
    thread.append(actions);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text || text.length > 4000) return;
    errorMessage.hidden = true;
    appendMessage("learner", text, "YOU");
    vscode.postMessage({ type: "submit", text });
    setPending(true);
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || typeof message !== "object") return;
    if (message.type === "pending") {
      setPending(true);
    } else if (message.type === "assistant" && typeof message.response === "string") {
      setPending(false);
      errorMessage.hidden = true;
      input.value = "";
      appendMessage("tutor", message.response, "MAST · SOCRATIC GUIDE");
      if (typeof message.category === "string" && Number.isFinite(message.confidence)) {
        const detail = document.createElement("p");
        detail.className = "classification-detail";
        detail.textContent = `${message.category.replaceAll("_", " ")} · ${(message.confidence * 100).toFixed(0)}% confidence`;
        thread.lastElementChild.append(detail);
      }
      if (Number.isFinite(message.masteryPercent)) {
        masteryBadge.textContent = `Mastery ${Math.max(0, Math.min(100, Math.round(message.masteryPercent)))}%`;
      }
      sessionBadge.textContent = "Session active";
      sessionBadge.classList.add("active");
      appendActions(message);
    } else if (message.type === "error" && typeof message.message === "string") {
      setPending(false);
      errorMessage.textContent = message.message;
      errorMessage.hidden = false;
      sessionBadge.textContent = "Session ready";
      sessionBadge.classList.remove("active");
      document.querySelectorAll(".message-actions .resolved-button").forEach((button) => {
        button.disabled = false;
      });
    } else if (message.type === "resolved") {
      if (Number.isFinite(message.masteryPercent)) {
        masteryBadge.textContent = `Mastery ${Math.max(0, Math.min(100, Math.round(message.masteryPercent)))}%`;
      }
      sessionBadge.textContent = "Session complete";
      sessionBadge.classList.remove("active");
      document.querySelectorAll(".message-actions .resolved-button").forEach((button) => {
        button.disabled = true;
        button.textContent = "Resolved";
      });
    }
  });
})();
