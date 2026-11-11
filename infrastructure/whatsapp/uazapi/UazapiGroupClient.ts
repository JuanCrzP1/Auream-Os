import type { GroupPostContent } from "../../../contracts/GroupContracts";
import { record, sentId, text, type Json } from "./uazapiResponses";
import { UazapiError, UazapiHttp, type FetchLike, type UazapiCredentials } from "./UazapiHttp";

// ---------------------------------------------------------------------------
// Grupos en uazapi (uazapiGO v2), con el token de la instancia (cabecera):
//   POST /group/list · /group/create · /group/update{Name,Description,Image,Announce,Locked}
//   GET  /group/invitelink/{jid}
//   POST /send/text · /send/media · /send/menu (poll), con `mentions: "all"`
// Límite de uazapi: 10 peticiones por segundo por instancia.
// ---------------------------------------------------------------------------

const PAGE = 500;
const MAX_PAGES = 10;

export class UazapiGroupClient {
  private readonly http: UazapiHttp;

  public constructor(credentials: Pick<UazapiCredentials, "baseUrl">, fetchImpl: FetchLike = fetch) {
    this.http = new UazapiHttp(credentials, fetchImpl);
  }

  /** Todos los grupos de la instancia, con sus miembros (en páginas). */
  public async list(token: string): Promise<ReadonlyArray<Json>> {
    const all: Json[] = [];
    let offset = 0;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const body = await this.http.request("POST", "/group/list", { token }, { limit: PAGE, offset, noParticipants: false });
      const groups = Array.isArray(body["groups"]) ? body["groups"].map(record) : [];
      all.push(...groups);
      const pagination = record(body["pagination"]);
      if (pagination["hasMore"] !== true || groups.length === 0) break;
      offset = typeof pagination["nextOffset"] === "number" ? pagination["nextOffset"] : offset + groups.length;
    }
    return all;
  }

  public async create(token: string, name: string): Promise<string> {
    const body = await this.http.request("POST", "/group/create", { token }, { name, participants: [] });
    const jid = text(record(body["group"])["JID"]);
    if (!jid) throw new UazapiError("unavailable", "uazapi no devolvió el grupo creado.");
    return jid;
  }

  public async updateName(token: string, groupjid: string, name: string): Promise<void> {
    await this.http.request("POST", "/group/updateName", { token }, { groupjid, name: name.slice(0, 25) });
  }

  public async updateDescription(token: string, groupjid: string, description: string): Promise<void> {
    await this.http.request("POST", "/group/updateDescription", { token }, { groupjid, description: description.slice(0, 512) });
  }

  /** JPEG de hasta 640×640 (URL); `null` la quita. */
  public async updateImage(token: string, groupjid: string, image: string | null): Promise<void> {
    await this.http.request("POST", "/group/updateImage", { token }, { groupjid, image: image ?? "remove" });
  }

  public async updateAnnounce(token: string, groupjid: string, announce: boolean): Promise<void> {
    await this.http.request("POST", "/group/updateAnnounce", { token }, { groupjid, announce });
  }

  public async updateLocked(token: string, groupjid: string, locked: boolean): Promise<void> {
    await this.http.request("POST", "/group/updateLocked", { token }, { groupjid, locked });
  }

  public async inviteLink(token: string, groupjid: string): Promise<string> {
    const body = await this.http.request("GET", `/group/invitelink/${encodeURIComponent(groupjid)}`, { token });
    const link = text(body["inviteLink"]) || text(body["InviteLink"]);
    if (!/^https:\/\/chat\.whatsapp\.com\//.test(link)) throw new UazapiError("unavailable", "uazapi no devolvió el enlace del grupo.");
    return link;
  }

  /** `mentions`: «all» (notifica a todos sin listar nombres) o teléfonos separados por coma. */
  public async send(token: string, number: string, content: GroupPostContent, mentions: string | null): Promise<string | null> {
    const extra = mentions ? { mentions } : {};
    if (content.kind === "poll") {
      return sentId(await this.http.request("POST", "/send/menu", { token }, { number, type: "poll", text: content.text, choices: [...content.choices], selectableCount: 1, ...extra }));
    }
    if (content.kind === "text") return sentId(await this.http.request("POST", "/send/text", { token }, { number, text: content.text, ...extra }));
    return sentId(
      await this.http.request("POST", "/send/media", { token }, { number, type: content.kind === "audio" ? "ptt" : content.kind, file: content.mediaUrl ?? "", ...(content.text ? { text: content.text } : {}), ...extra })
    );
  }
}
