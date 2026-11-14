// Pintar el teléfono de prueba. Todo con textContent (nada de HTML que llegue de afuera).

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const time = (iso) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
const STATUS = { connected: "Conectado", connecting: "Esperando el QR", disconnected: "Desconectado" };
const TICKS = { sent: "✓", delivered: "✓✓", read: "✓✓" };

/** Los números: conectar («escanear» el QR) o desconectar. */
export function renderInstances(list, instances, { onScan, onDisconnect }) {
  list.replaceChildren(
    ...instances.map((instance) => {
      const item = el("li", `item item--${instance.status}`);
      const info = el("div", "item__info");
      // `auream-<id>`: se muestra el final del id para reconocer la conexión de Auream.
      const label = instance.profileName || `Conexión …${instance.name.slice(-6)}`;
      info.append(el("strong", "", label), el("span", "", `${STATUS[instance.status]}${instance.phone ? ` · +${instance.phone}` : ""} · creado ${time(instance.createdAt)}`));
      item.append(info);
      if (instance.status !== "connected") {
        const form = el("form", "scan");
        const phone = el("input");
        phone.placeholder = "Número del negocio (opcional)";
        phone.inputMode = "tel";
        const button = el("button", "", instance.status === "connecting" ? "Escanear QR" : "Conectar");
        button.disabled = instance.status !== "connecting";
        button.title = instance.status === "connecting" ? "Simula escanear el QR que muestra Auream" : "Primero pide el QR desde Conexiones en Auream";
        form.append(phone, button);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          onScan(instance.id, phone.value);
        });
        item.append(form);
      } else {
        const off = el("button", "ghost small", "Desconectar");
        off.type = "button";
        off.addEventListener("click", () => onDisconnect(instance.id));
        item.append(off);
      }
      return item;
    })
  );
}

/** Los clientes de prueba (con su último mensaje si ya escribieron). */
export function renderChats(list, contacts, chats, selectedPhone, onOpen) {
  list.replaceChildren(
    ...contacts.map((contact) => {
      const last = chats.find((chat) => chat.phone === contact.phone);
      const item = el("li", `item item--chat${contact.phone === selectedPhone ? " is-selected" : ""}`);
      const button = el("button", "item__open");
      button.type = "button";
      button.append(el("strong", "", `${contact.name}${contact.ad ? " · anuncio" : ""}`), el("span", "", last ? `${last.fromBusiness ? "Negocio: " : ""}${last.last}` : `+${contact.phone}`));
      button.addEventListener("click", () => onOpen(contact.phone));
      item.append(button);
      return item;
    })
  );
}

function media(message) {
  if (!message.mediaUrl) return null;
  if (message.kind === "image") {
    const image = el("img", "bubble__image");
    image.src = message.mediaUrl;
    image.alt = message.text || "Foto";
    return image;
  }
  if (message.kind === "audio") {
    const audio = el("audio");
    audio.controls = true;
    audio.src = message.mediaUrl;
    return audio;
  }
  if (message.kind === "video") {
    const video = el("video", "bubble__image");
    video.controls = true;
    video.src = message.mediaUrl;
    return video;
  }
  const link = el("a", "bubble__doc", `📄 ${message.fileName || "Documento"}`);
  link.href = message.mediaUrl;
  link.target = "_blank";
  return link;
}

/** El chat: lo del negocio a la izquierda (como lo ve el cliente), lo del cliente a la derecha. */
export function renderThread(thread, messages, presence, onChoice) {
  const nodes = messages.map((message) => {
    const mine = !message.fromBusiness;
    const row = el("div", `bubble-row${mine ? " is-mine" : ""}`);
    const bubble = el("div", "bubble");
    if (message.viewOnce) bubble.append(el("span", "bubble__tag", "① Ver una vez"));
    if (message.voice) bubble.append(el("span", "bubble__tag", "🎤 Nota de voz"));
    const file = media(message);
    if (file) bubble.append(file);
    if (message.text) bubble.append(el("p", "bubble__text", message.text));
    const meta = el("span", "bubble__meta", time(message.at));
    if (!mine) meta.append(el("span", `ticks${message.status === "read" ? " is-read" : ""}`, ` ${TICKS[message.status]}`));
    bubble.append(meta);
    if (message.reaction) bubble.append(el("span", "bubble__reaction", message.reaction));
    row.append(bubble);
    if (message.menu) {
      const options = el("div", "options");
      for (const option of message.menu.options) {
        const button = el("button", "option", option.title);
        button.type = "button";
        if (option.description) button.title = option.description;
        button.addEventListener("click", () => onChoice(message.menu.type, option));
        options.append(button);
      }
      row.append(options);
    }
    return row;
  });
  if (presence) nodes.push(el("p", "typing", presence === "recording" ? "grabando audio…" : "escribiendo…"));
  const atBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
  thread.replaceChildren(...nodes);
  if (atBottom) thread.scrollTop = thread.scrollHeight;
}

export function renderLog(list, log) {
  list.replaceChildren(...log.map((entry) => el("li", entry.ok ? "" : "is-error", `${time(entry.at)} · ${entry.direction === "out" ? "" : "Auream pidió: "}${entry.summary}`)));
}
