import type { IncomingMessage, ServerResponse } from "node:http";
import type { ConfirmImageRequest, ImageUploadRequest, UpdateMyProfileRequest } from "../../../contracts/AccountContracts";
import type { ProfileServices } from "../../../domains/profiles/application/ProfileServices";
import { parseJsonBody } from "../http/parseJsonBody";
import { sendJson } from "../http/sendJson";

// ---------------------------------------------------------------------------
// `/me/profile` — el perfil de la persona que pregunta (Mi perfil). Lo llama
// `routeMeRequest`, que ya exige una identidad de USUARIO; el `userId` sale de
// ella, nunca de la petición. No depende de la cuenta activa: el perfil es el
// mismo en todas las empresas.
//
//   GET    /me/profile                 nombre visible, WhatsApp personal y foto
//   PATCH  /me/profile                 cambiar nombre o WhatsApp personal
//   POST   /me/profile/photo/uploads   permiso para subir la foto
//   PUT    /me/profile/photo           usar la foto subida
//   DELETE /me/profile/photo           quitar la foto
// ---------------------------------------------------------------------------

const PATHS = new Set(["/me/profile", "/me/profile/photo", "/me/profile/photo/uploads"]);

export async function routeMyProfileRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  profiles: ProfileServices | undefined,
  userId: string
): Promise<boolean> {
  const path = url.pathname;
  if (!PATHS.has(path)) return false;
  const method = request.method ?? "GET";
  if (!profiles) {
    sendJson(response, 503, { message: "El perfil no está disponible." });
    return true;
  }

  if (path === "/me/profile" && method === "GET") {
    sendJson(response, 200, await profiles.get(userId));
    return true;
  }
  if (path === "/me/profile" && method === "PATCH") {
    sendJson(response, 200, await profiles.update(userId, await parseJsonBody<Partial<UpdateMyProfileRequest>>(request)));
    return true;
  }
  if (path.startsWith("/me/profile/photo") && !profiles.canUploadPhotos) {
    sendJson(response, 503, { message: "La subida de imágenes no está disponible: falta conectar el almacén de archivos." });
    return true;
  }
  if (path === "/me/profile/photo/uploads" && method === "POST") {
    sendJson(response, 201, await profiles.photoTicket(userId, await parseJsonBody<Partial<ImageUploadRequest>>(request)));
    return true;
  }
  if (path === "/me/profile/photo" && method === "PUT") {
    sendJson(response, 200, await profiles.setPhoto(userId, await parseJsonBody<Partial<ConfirmImageRequest>>(request)));
    return true;
  }
  if (path === "/me/profile/photo" && method === "DELETE") {
    sendJson(response, 200, await profiles.removePhoto(userId));
    return true;
  }

  sendJson(response, 405, { message: "Method not allowed" });
  return true;
}
