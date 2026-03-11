const state = {
  sessionId: null,
  status: "active",
  lastEstimate: null,
};

const STATUS_LABELS = Object.freeze({
  active: "aktywna",
  needs_clarification: "wymaga doprecyzowania",
  ready_for_confirmation: "gotowa do potwierdzenia",
  confirmed: "potwierdzona",
});

const messagesEl = document.getElementById("messages");
const statusEl = document.getElementById("status");
const estimateEl = document.getElementById("estimate");
const crmResultEl = document.getElementById("crmResult");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const confirmBtn = document.getElementById("confirmBtn");

function scrollMessagesToBottom({ smooth = true } = {}) {
  if (!messagesEl) {
    return;
  }

  const behavior = smooth ? "smooth" : "auto";
  requestAnimationFrame(() => {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior,
    });
  });
}

function appendMessage(text, role) {
  const item = document.createElement("div");
  item.className = `msg msg--${role}`;
  item.textContent =
    role === "assistant" ? normalizeAssistantMessage(text) : String(text ?? "");
  messagesEl.appendChild(item);
  scrollMessagesToBottom();
}

function setStatus(status) {
  const label = STATUS_LABELS[status] ?? status;
  statusEl.innerHTML = `<strong>Status:</strong> ${label}`;
}

function normalizeAssistantMessage(text) {
  const raw = String(text ?? "");
  if (!raw) {
    return raw;
  }

  const withBullets = raw.replace(/\s*[\u2022\u00b7]\s*/g, "\n- ");
  const inlineHyphenCount = (withBullets.match(/\s-\s/g) ?? []).length;
  if (inlineHyphenCount >= 2 && !withBullets.includes("\n- ")) {
    return withBullets.replace(/\s-\s/g, "\n- ");
  }

  return withBullets;
}

function renderEstimate(payload) {
  const estimate = payload?.estimate;
  const status = String(payload?.status ?? state.status ?? "");
  const isFinalizable =
    status === "ready_for_confirmation" || status === "confirmed";

  if (!estimate || !isFinalizable) {
    estimateEl.innerHTML =
      "<strong>Wycena:</strong> pojawi sie po uzupelnieniu kluczowych informacji";
    return;
  }

  const visibleBreakdown = (estimate.breakdown ?? []).filter(
    (line) => line?.name !== "minimum_order_adjustment",
  );
  const rows = visibleBreakdown
    .map(
      (line) =>
        `<li>${line.name}: ${line.quantity} ${line.unit} x ${line.unitPrice} = ${line.total} PLN</li>`,
    )
    .join("");

  estimateEl.innerHTML = `
    <strong>Wycena:</strong>
    <div>Lacznie: ${estimate.total} PLN</div>
    ${rows ? `<ul>${rows}</ul>` : ""}
  `;
}

function renderWarnings(payload) {
  if (!payload?.warnings?.length) {
    return;
  }

  appendMessage(`Uwagi: ${payload.warnings.join(" | ")}`, "assistant");
}

function renderResponse(payload) {
  state.sessionId = payload.sessionId ?? state.sessionId;
  state.status = payload.status ?? state.status;
  state.lastEstimate = payload.estimate ?? state.lastEstimate;

  setStatus(state.status);

  if (payload.assistantMessage) {
    appendMessage(payload.assistantMessage, "assistant");
  }

  renderEstimate(payload);
  renderWarnings(payload);
  confirmBtn.disabled = state.status !== "ready_for_confirmation";
  scrollMessagesToBottom();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (error) {
    throw new Error(`Serwer zwrocil niepoprawna odpowiedz (${response.status}).`);
  }

  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }

  return payload;
}

async function handleSend(message) {
  appendMessage(message, "user");

  sendBtn.disabled = true;
  confirmBtn.disabled = true;

  try {
    let payload;
    if (!state.sessionId) {
      payload = await postJson("/api/chat/start", { message });
    } else {
      payload = await postJson("/api/chat/message", {
        sessionId: state.sessionId,
        message,
      });
    }

    renderResponse(payload);
  } catch (error) {
    appendMessage(`Blad: ${error.message}`, "assistant");
  } finally {
    sendBtn.disabled = false;
    confirmBtn.disabled = state.status !== "ready_for_confirmation";
  }
}

async function handleConfirm() {
  if (!state.sessionId) {
    return;
  }

  confirmBtn.disabled = true;

  try {
    const payload = await postJson("/api/estimate/confirm", {
      sessionId: state.sessionId,
      sendToCrm: false,
    });

    state.status = payload.status ?? "confirmed";
    setStatus(state.status);
    appendMessage(
      "Wycena zostala potwierdzona i jest gotowa do przekazania opiekunowi.",
      "assistant",
    );

    crmResultEl.innerHTML = `
      <strong>CRM DTO (podglad):</strong>
      <div>sessionId: ${payload.crmLead.sessionId}</div>
      <div>miasto: ${payload.crmLead.customer.city ?? "brak"}</div>
      <div>termin: ${payload.crmLead.customer.timeline ?? "brak"}</div>
      <div>lacznie: ${payload.crmLead.estimate.total} ${payload.crmLead.estimate.currency}</div>
    `;
  } catch (error) {
    appendMessage(`Blad potwierdzenia: ${error.message}`, "assistant");
  } finally {
    confirmBtn.disabled = state.status !== "ready_for_confirmation";
    scrollMessagesToBottom();
  }
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (!message) {
    return;
  }

  messageInput.value = "";
  await handleSend(message);
});

confirmBtn.addEventListener("click", handleConfirm);

setStatus("active");
estimateEl.innerHTML =
  "<strong>Wycena:</strong> pojawi sie po uzupelnieniu kluczowych informacji";
crmResultEl.innerHTML = "<strong>CRM DTO:</strong> dostepne po potwierdzeniu";
