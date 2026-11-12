// La API del teléfono de prueba (/_sim/…). Ver phone/phoneApi.ts.

async function call(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

const enc = encodeURIComponent;

export const api = {
  state: () => call("GET", "/_sim/state"),
  chat: (instanceId, phone) => call("GET", `/_sim/chats/${enc(instanceId)}/${enc(phone)}`),
  scan: (instanceId, phone, profileName) => call("POST", `/_sim/instances/${enc(instanceId)}/scan`, { phone, profileName }),
  disconnect: (instanceId) => call("POST", `/_sim/instances/${enc(instanceId)}/disconnect`),
  addContact: (contact) => call("POST", "/_sim/contacts", contact),
  send: (instanceId, phone, message) => call("POST", `/_sim/chats/${enc(instanceId)}/${enc(phone)}/send`, message),
  advance: (instanceId, phone) => call("POST", `/_sim/chats/${enc(instanceId)}/${enc(phone)}/advance`),
  read: (instanceId, phone) => call("POST", `/_sim/chats/${enc(instanceId)}/${enc(phone)}/read`),
  upload: (base64, mimeType) => call("POST", "/_sim/files", { base64, mimeType }),
  reset: () => call("POST", "/_sim/reset")
};

/** Un archivo del equipo → base64 (sin el prefijo «data:»). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
