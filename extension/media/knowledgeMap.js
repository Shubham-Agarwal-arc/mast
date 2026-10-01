(() => {
  const map = document.getElementById("map");

  const initialState = document.getElementById("initial-state");

  function render(components) {
    map.replaceChildren();
    for (const component of components) {
      const card = document.createElement("article");
      card.className = "kc-card";
      const title = document.createElement("div");
      title.className = "kc-title";
      const id = document.createElement("span");
      id.textContent = component.kcId;
      const value = document.createElement("span");
      value.textContent = `${Math.round(component.mastery * 100)}%`;
      title.append(id, value);
      const bar = document.createElement("div");
      bar.className = "mastery-track";
      const fill = document.createElement("span");
      fill.className = "mastery-fill";
      fill.style.width = `${Math.round(component.mastery * 100)}%`;
      bar.append(fill);
      const band = document.createElement("p");
      band.className = "kc-band neutral";
      band.textContent = "Band unavailable";
      card.append(title, bar, band);
      map.append(card);
    }
  }

  window.addEventListener("message", (event) => {
    if (event.data?.type === "knowledgeState" && Array.isArray(event.data.components)) {
      render(event.data.components);
    }
  });

  if (initialState) {
    try {
      render(JSON.parse(initialState.textContent || "[]"));
    } catch {
      map.textContent = "Knowledge Map data could not be loaded.";
    }
  }
})();
