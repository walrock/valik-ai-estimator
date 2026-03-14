(function initValikEstimatorEmbed() {
  const script = document.currentScript;
  if (!script) {
    return;
  }

  const scriptUrl = new URL(script.src, window.location.href);
  const widgetUrl = new URL("/", scriptUrl.origin);

  const parsedHeight = Number.parseInt(script.dataset.height ?? "", 10);
  const height = Number.isFinite(parsedHeight) && parsedHeight >= 320 ? parsedHeight : 760;
  const maxWidth = script.dataset.maxWidth || "980px";
  const title = script.dataset.title || "Kalkulator wyceny";
  const whatsappPhone = (script.dataset.whatsappPhone || "").trim();

  if (whatsappPhone) {
    widgetUrl.searchParams.set("whatsapp", whatsappPhone);
  }

  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.maxWidth = maxWidth;
  container.style.margin = "0 auto";

  const iframe = document.createElement("iframe");
  iframe.src = widgetUrl.toString();
  iframe.title = title;
  iframe.loading = "lazy";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.style.width = "100%";
  iframe.style.minHeight = `${height}px`;
  iframe.style.border = "1px solid rgba(30, 43, 44, 0.14)";
  iframe.style.borderRadius = "26px";
  iframe.style.boxShadow = "0 14px 40px rgba(30, 43, 44, 0.12)";

  container.appendChild(iframe);
  script.parentNode?.insertBefore(container, script.nextSibling);
})();
