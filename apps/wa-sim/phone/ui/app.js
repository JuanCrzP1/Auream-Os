import { api, fileToBase64 } from "./api.js";
import { renderChats, renderInstances, renderLog, renderThread } from "./render.js";

// ---------------------------------------------------------------------------
// El teléfono de prueba: consulta el estado del simulador cada segundo y el
// chat abierto un poco más seguido. Al abrir un chat lo marca «leído» (los
// chulos azules en Auream), como cuando el cliente mira su WhatsApp.
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const view = { phone: null, instanceId: null, state: null, showLog: false };
/** Lo último que se pintó de cada parte: si no cambió, no se repinta (no borra lo que se está escribiendo). */
const painted = new Map();
const changed = (key, data) => {
  const signature = JSON.stringify(data);
  if (painted.get(key) === signature) return false;
  painted.set(key, signature);
  return true;
};

function connected() {
  return (view.state?.instances ?? []).filter((instance) => instance.status === "connected");
}

async function refresh() {
  try {
    view.state = await api.state();
  } catch {
    return;
  }
  const { instances, contacts, chats, log } = view.state;
  $("numbers-empty").hidden = instances.length > 0;
  if (changed("instances", instances)) renderInstances($("instances"), instances, {
    onScan: (instanceId, phone) => api.scan(instanceId, phone.replace(/\D/g, ""), "Negocio de prueba").then(refresh).catch(alert),
    onDisconnect: (instanceId) => api.disconnect(instanceId).then(refresh).catch(alert)
  });
  if (changed("chats", [contacts, chats, view.phone])) renderChats($("chats"), contacts, chats, view.phone, openChat);
  if (view.showLog && changed("log", log)) renderLog($("log-list"), log);
  const options = connected();
  const select = $("chat-instance");
  if (select.options.length !== options.length) {
    select.replaceChildren(...options.map((instance) => new Option(`${instance.profileName || instance.name} · +${instance.phone}`, instance.id)));
  }
  if (!view.instanceId || !options.some((instance) => instance.id === view.instanceId)) view.instanceId = options[0]?.id ?? null;
  select.value = view.instanceId ?? "";
}

async function refreshChat() {
  if (!view.phone || !view.instanceId) return;
  const chat = await api.chat(view.instanceId, view.phone).catch(() => null);
  if (!chat) return;
  $("chat-name").textContent = chat.contact?.name ?? view.phone;
  $("chat-meta").textContent = `+${view.phone}${chat.contact?.ad ? " · llegó por un anuncio" : ""}`;
  if (changed("thread", [view.instanceId, view.phone, chat.messages, chat.presence])) renderThread($("thread"), chat.messages, chat.presence, choose);
  // Lo que llegue mientras el chat está abierto, el cliente lo «ve».
  if (chat.messages.some((message) => message.fromBusiness && message.status !== "read")) void api.read(view.instanceId, view.phone);
}

function openChat(phone) {
  view.phone = phone;
  // Si ya hay conversación, con el número con el que habló (no el primero de la lista).
  const existing = (view.state?.chats ?? []).find((chat) => chat.phone === phone);
  if (existing && connected().some((instance) => instance.id === existing.instanceId)) view.instanceId = existing.instanceId;
  $("chat-empty").hidden = true;
  $("chat-view").hidden = false;
  if (!view.instanceId) alert("Conecta primero un número (Números de la cuenta).");
  void refresh().then(refreshChat);
}

function send(message) {
  if (!view.phone || !view.instanceId) return alert("Elige un cliente y conecta un número.");
  return api.send(view.instanceId, view.phone, message).then(refreshChat).catch((error) => alert(error.message));
}

/** Tocar una opción de un menú del bot: responde como un botón o una lista de WhatsApp. */
function choose(type, option) {
  void send({ kind: type === "list" ? "list_reply" : "button_reply", text: option.title, choiceId: option.id });
}

$("composer").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("text").value.trim();
  if (!text) return;
  $("text").value = "";
  void send({ kind: "text", text });
});

$("file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const uploaded = await api.upload(await fileToBase64(file), file.type).catch((error) => alert(error.message));
  if (!uploaded) return;
  const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "document";
  void send({ kind, mediaUrl: uploaded.url, mimeType: uploaded.mimeType, fileName: file.name, voice: kind === "audio" && $("as-voice").checked, text: $("text").value.trim() });
  $("text").value = "";
});

$("new-contact").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = $("contact-phone").value.replace(/\D/g, "");
  api.addContact({ phone, name: $("contact-name").value.trim(), fromAd: $("contact-ad").checked })
    .then(() => {
      event.target.reset();
      openChat(phone);
    })
    .catch((error) => alert(error.message));
});

/** Un aviso corto bajo el encabezado del chat (se borra solo). */
let noticeTimer = 0;
function notice(message, isError = false) {
  const box = $("notice");
  box.textContent = message;
  box.classList.toggle("is-error", isError);
  box.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (box.hidden = true), 6_000);
}

const clock = (iso) => new Date(iso).toLocaleString("es", { weekday: "short", hour: "2-digit", minute: "2-digit" });

$("advance").addEventListener("click", async () => {
  if (!view.phone || !view.instanceId) return;
  const button = $("advance");
  button.disabled = true;
  try {
    const { advanced } = await api.advance(view.instanceId, view.phone);
    notice(advanced.length ? `⏩ Corre ya lo que esperaba hasta ${advanced.map(clock).join(", ")}.` : "Este chat no está esperando nada (el flujo terminó o espera un mensaje sin tiempo límite).");
  } catch (error) {
    notice(error.message, true);
  } finally {
    button.disabled = false;
  }
});

$("chat-instance").addEventListener("change", (event) => {
  view.instanceId = event.target.value;
  void refreshChat();
});

$("toggle-log").addEventListener("click", () => {
  view.showLog = !view.showLog;
  $("log").hidden = !view.showLog;
  $("toggle-log").textContent = view.showLog ? "Ocultar lo que pasó" : "Ver lo que pasó";
  void refresh();
});

$("reset").addEventListener("click", () => {
  if (!window.confirm("¿Borrar todos los números, clientes y mensajes del simulador? En Auream tendrás que volver a conectar el número.")) return;
  void api.reset().then(() => {
    view.phone = null;
    $("chat-view").hidden = true;
    $("chat-empty").hidden = false;
    return refresh();
  });
});

void refresh();
setInterval(refresh, 1_000);
setInterval(refreshChat, 800);
