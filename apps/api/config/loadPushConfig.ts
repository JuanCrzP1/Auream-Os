import { ApiConfigError } from "./ApiConfigError";

/**
 * Las claves de los avisos al celular (Web Push, estándar VAPID). Se generan
 * una sola vez con `npx web-push generate-vapid-keys` y van en Vercel:
 *
 *   VAPID_PUBLIC_KEY   la pública (la ve el navegador al suscribirse)
 *   VAPID_PRIVATE_KEY  la privada (firma cada aviso; nunca sale del servidor)
 *   VAPID_SUBJECT      contacto que exige el estándar (`mailto:` o `https:`);
 *                      por defecto, la dirección https de la app
 *
 * Sin las dos claves no hay avisos al celular: la página lo dice y nada falla.
 * Si se cambian, cada persona tiene que volver a activarlos.
 */
export interface PushConfig {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
}

const PUBLIC_KEY = /^[A-Za-z0-9_-]{86,88}$/;
const PRIVATE_KEY = /^[A-Za-z0-9_-]{42,44}$/;

export function loadPushConfig(env: NodeJS.ProcessEnv, appOrigin: string): PushConfig | null {
  const publicKey = env["VAPID_PUBLIC_KEY"]?.trim() ?? "";
  const privateKey = env["VAPID_PRIVATE_KEY"]?.trim() ?? "";
  if (!publicKey && !privateKey) return null;
  if (!publicKey || !privateKey) throw new ApiConfigError("VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY van juntas: falta una de las dos.");
  if (!PUBLIC_KEY.test(publicKey) || !PRIVATE_KEY.test(privateKey)) {
    throw new ApiConfigError("Las claves VAPID no tienen el formato esperado: genéralas con «npx web-push generate-vapid-keys» y cópialas completas.");
  }
  const subject = env["VAPID_SUBJECT"]?.trim() || appOrigin;
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)) {
    throw new ApiConfigError("VAPID_SUBJECT debe ser un correo (mailto:soporte@tuempresa.com) o una dirección https.");
  }
  return { publicKey, privateKey, subject };
}
