import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SimContact, SimGroup, SimInstance, SimLogEntry, SimMessage, SimPresence } from "./types";

// ---------------------------------------------------------------------------
// El estado del WhatsApp simulado: números, clientes, mensajes y grupos.
// Se guarda en un archivo JSON (`data/wa-sim/state.json`) para que, si se
// reinicia el simulador, Auream siga encontrando sus números (si no, sus
// tokens dejarían de valer). El registro de lo que pasó y la presencia
// («escribiendo…») viven solo en memoria.
// ---------------------------------------------------------------------------

interface Snapshot {
  readonly instances: SimInstance[];
  readonly contacts: SimContact[];
  readonly messages: SimMessage[];
  readonly groups: SimGroup[];
}

/** Mensajes que se guardan como máximo (los más viejos se descartan). */
const MAX_MESSAGES = 5_000;
const MAX_LOG = 200;
const SAVE_DELAY_MS = 250;

export class SimulatorStore {
  public readonly instances = new Map<string, SimInstance>();
  public readonly contacts = new Map<string, SimContact>();
  public messages: SimMessage[] = [];
  public readonly groups = new Map<string, SimGroup>();
  public readonly log: SimLogEntry[] = [];
  /** Presencia por chat (`<instancia>:<teléfono>`). */
  public readonly presence = new Map<string, SimPresence>();
  private saveTimer: NodeJS.Timeout | null = null;

  /** `file`: dónde guardar (`null`: solo en memoria, p. ej. en las pruebas). */
  public constructor(private readonly file: string | null) {
    if (file) this.load(file);
  }

  public instanceByToken(token: string): SimInstance | null {
    for (const instance of this.instances.values()) if (instance.token === token) return instance;
    return null;
  }

  public instanceByName(name: string): SimInstance | null {
    for (const instance of this.instances.values()) if (instance.name === name) return instance;
    return null;
  }

  /** El cliente de ese teléfono (lo crea con un nombre de prueba si no existe). */
  public contact(phone: string, name?: string): SimContact {
    const existing = this.contacts.get(phone);
    if (existing) {
      if (name) existing.name = name;
      return existing;
    }
    const created: SimContact = { phone, name: name || `Cliente ${phone.slice(-4)}`, ad: null };
    this.contacts.set(phone, created);
    this.changed();
    return created;
  }

  public addMessage(message: SimMessage): SimMessage {
    this.messages.push(message);
    if (this.messages.length > MAX_MESSAGES) this.messages = this.messages.slice(-MAX_MESSAGES);
    this.changed();
    return message;
  }

  public message(id: string): SimMessage | null {
    return this.messages.find((message) => message.id === id) ?? null;
  }

  public chat(instanceId: string, phone: string): SimMessage[] {
    return this.messages.filter((message) => message.instanceId === instanceId && message.contactPhone === phone);
  }

  public record(direction: SimLogEntry["direction"], summary: string, ok = true): void {
    this.log.unshift({ at: new Date().toISOString(), direction, summary, ok });
    if (this.log.length > MAX_LOG) this.log.length = MAX_LOG;
  }

  /** Algo cambió: se guarda en un momento (varios cambios seguidos, una escritura). */
  public changed(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, SAVE_DELAY_MS);
  }

  /** Guarda ya (al cerrar el simulador). */
  public flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.save();
  }

  /** Borra todo (empezar de cero). */
  public reset(): void {
    this.instances.clear();
    this.contacts.clear();
    this.messages = [];
    this.groups.clear();
    this.presence.clear();
    this.log.length = 0;
    this.changed();
  }

  private save(): void {
    if (!this.file) return;
    const snapshot: Snapshot = {
      instances: [...this.instances.values()],
      contacts: [...this.contacts.values()],
      messages: this.messages,
      groups: [...this.groups.values()]
    };
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(snapshot, null, 2));
  }

  private load(file: string): void {
    let snapshot: Partial<Snapshot>;
    try {
      snapshot = JSON.parse(readFileSync(file, "utf8")) as Partial<Snapshot>;
    } catch {
      return; // primera vez (o archivo dañado): empieza vacío
    }
    for (const instance of snapshot.instances ?? []) this.instances.set(instance.id, instance);
    for (const contact of snapshot.contacts ?? []) this.contacts.set(contact.phone, contact);
    this.messages = [...(snapshot.messages ?? [])];
    for (const group of snapshot.groups ?? []) this.groups.set(group.jid, group);
  }
}
