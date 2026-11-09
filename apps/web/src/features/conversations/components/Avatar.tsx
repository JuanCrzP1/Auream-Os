import { useEffect, useState } from "react";

/** Iniciales del contacto sobre un color estable por teléfono (como WhatsApp sin foto). */
const HUES = [152, 200, 262, 330, 24, 45, 180, 290];

/**
 * Foto de perfil de WhatsApp del contacto; sin foto, o si el enlace (temporal)
 * ya venció, sus iniciales sobre un color estable.
 */
export function Avatar({ name, phone, photoUrl = null, size = 48 }: { readonly name: string | null; readonly phone: string; readonly photoUrl?: string | null; readonly size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = words.length ? (words[0]![0]! + (words[1]?.[0] ?? "")).toUpperCase() : "#";
  const hue = HUES[[...phone].reduce((sum, char) => sum + char.charCodeAt(0), 0) % HUES.length];
  const showPhoto = Boolean(photoUrl) && !failed;
  return (
    <span className={`ios-avatar${showPhoto ? " has-photo" : ""}`} style={{ width: size, height: size, fontSize: size * 0.38, ["--avatar-hue" as string]: hue }} aria-hidden="true">
      {showPhoto ? <img src={photoUrl!} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials}
    </span>
  );
}
