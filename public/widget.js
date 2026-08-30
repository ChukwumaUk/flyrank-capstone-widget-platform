(function () {
  // 1. Find THIS script tag and read its ?id= param.
  const currentScript = document.currentScript;
  const scriptUrl = new URL(currentScript.src);
  const widgetId = scriptUrl.searchParams.get("id");
  const apiBase = scriptUrl.origin; // the API is wherever this script came from

  if (!widgetId) {
    console.error("[widget] no ?id= provided in script src");
    return;
  }

  // 2. Fetch the widget's public config.
  fetch(`${apiBase}/widgets/${widgetId}/config`)
    .then((res) => {
      if (!res.ok) throw new Error(`config fetch failed: ${res.status}`);
      return res.json();
    })
    .then((config) => renderWidget(config, apiBase))
    .catch((err) => console.error("[widget]", err.message));

  // 3. Render the form from the config.
  function renderWidget(config, apiBase) {
    const container = document.createElement("div");
    container.style.cssText =
      "border:1px solid #ddd;border-radius:8px;padding:16px;max-width:320px;font-family:sans-serif;";

    const heading = document.createElement("h3");
    heading.textContent = config.title;
    heading.style.marginTop = "0";
    container.appendChild(heading);

    const form = document.createElement("form");

    // The fields come from config.config.fields (owner-defined). Fall back to an email field.
    const fields = (config.config && config.config.fields) || [
      { name: "email", label: "Email", type: "email", required: true },
    ];

    fields.forEach((f) => {
      const input = document.createElement("input");
      input.name = f.name;
      input.type = f.type || "text";
      input.placeholder = f.label || f.name;
      if (f.required) input.required = true;
      input.style.cssText = "display:block;width:100%;margin:8px 0;padding:8px;box-sizing:border-box;";
      form.appendChild(input);
    });

    // The honeypot field — hidden from humans, a trap for bots.
    const honeypot = document.createElement("input");
    honeypot.name = "_hp";
    honeypot.style.cssText = "position:absolute;left:-9999px;";
    honeypot.setAttribute("tabindex", "-1");
    honeypot.setAttribute("autocomplete", "off");
    form.appendChild(honeypot);

    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Submit";
    button.style.cssText = "padding:8px 16px;cursor:pointer;";
    form.appendChild(button);

    const message = document.createElement("p");
    container.appendChild(form);
    container.appendChild(message);

    // 4. On submit, POST to /submissions.
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const data = {};
      let hp = "";
      formData.forEach((value, key) => {
        if (key === "_hp") hp = value;
        else data[key] = value;
      });

      try {
        const res = await fetch(`${apiBase}/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ widget_id: widgetId, data, _hp: hp }),
        });
        message.textContent = res.ok ? "Thanks! Submitted." : "Something went wrong.";
        message.style.color = res.ok ? "green" : "red";
        if (res.ok) form.reset();
      } catch (err) {
        message.textContent = "Network error.";
        message.style.color = "red";
      }
    });

    document.body.appendChild(container);
  }
})();