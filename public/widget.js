const state = {
  sessionId: null,
  status: "active",
  lastEstimate: null,
};

const messagesEl = document.getElementById("messages");
const statusEl = document.getElementById("status");
const estimateEl = document.getElementById("estimate");
const crmResultEl = document.getElementById("crmResult");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const confirmBtn = document.getElementById("confirmBtn");

function appendMessage(text, role) {
  const item = document.createElement("div");
  item.className = `msg msg--${role}`;
  item.textContent = text;
  messagesEl.appendChild(item);
}

function setStatus(text) {
  statusEl.innerHTML = `<strong>Status:</strong> ${text}`;
}

function renderEstimate(payload) {
  const estimate = payload?.estimate;
  if (!estimate) {
    estimateEl.innerHTML = "<strong>Estimate:</strong> not ready yet";
    return;
  }

  const rows = estimate.breakdown
    .map(
      (line) =>
        `<li>${line.name}: ${line.quantity} ${line.unit} × ${line.unitPrice} = ${line.total} PLN</li>`,
    )
    .join("");

  estimateEl.innerHTML = `
    <strong>Estimate:</strong>
    <div>Subtotal: ${estimate.subtotal} PLN</div>
    <div>Total: ${estimate.total} PLN</div>
    <ul>${rows}</ul>
  `;
}

function renderWarnings(payload) {
  if (!payload?.warnings?.length) {
    return;
  }

  appendMessage(`Warnings: ${payload.warnings.join(" | ")}`, "assistant");
}

function renderResponse(payload) {
  state.sessionId = payload.sessionId ?? state.sessionId;
  state.status = payload.status ?? state.status;
  state.lastEstimate = payload.estimate ?? state.lastEstimate;

  setStatus(payload.status ?? "active");

  if (payload.assistantMessage) {
    appendMessage(payload.assistantMessage, "assistant");
  }

  renderEstimate(payload);
  renderWarnings(payload);
  confirmBtn.disabled = state.status !== "ready_for_confirmation";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await response.json();
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
    appendMessage(`Error: ${error.message}`, "assistant");
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

    setStatus(payload.status);
    appendMessage("Estimate confirmed and ready for manager handoff.", "assistant");

    crmResultEl.innerHTML = `
      <strong>CRM DTO (preview):</strong>
      <div>sessionId: ${payload.crmLead.sessionId}</div>
      <div>city: ${payload.crmLead.customer.city ?? "n/a"}</div>
      <div>timeline: ${payload.crmLead.customer.timeline ?? "n/a"}</div>
      <div>total: ${payload.crmLead.estimate.total} ${payload.crmLead.estimate.currency}</div>
    `;
  } catch (error) {
    appendMessage(`Confirm error: ${error.message}`, "assistant");
  } finally {
    confirmBtn.disabled = false;
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

setStatus("Waiting for first message");
estimateEl.innerHTML = "<strong>Estimate:</strong> not ready yet";
crmResultEl.innerHTML = "<strong>CRM DTO:</strong> available after confirmation";
