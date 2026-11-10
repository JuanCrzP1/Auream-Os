import "./account-avatar.css";
import { useEffect, useState } from "react";

/** Colores estables por nombre (la misma persona o empresa siempre con el mismo). */
const HUES = [262, 200, 152, 330, 24, 45, 180, 290];

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return (words[0]![0]! + (words[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Foto de una persona o logo de una empresa; sin imagen (o si no carga), las
 * iniciales sobre un color estable. `shape="square"` para logos.
 */
export function AccountAvatar({
  name,
  imageUrl,
  size = 36,
  shape = "round",
  ring = false
}: {
  readonly name: string;
  readonly imageUrl: string | null;
  readonly size?: number;
  readonly shape?: "round" | "square";
  /** Aro con el degradado de la marca (la tarjeta de la cuenta). */
  readonly ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const hue = HUES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % HUES.length];
  const showImage = Boolean(imageUrl) && !failed;
  const className = `account-avatar account-avatar--${shape}${ring ? " account-avatar--ring" : ""}${showImage ? " has-image" : ""}`;
  return (
    <span className={className} style={{ width: size, height: size, fontSize: size * 0.38, ["--avatar-hue" as string]: hue }} aria-hidden="true">
      {showImage ? <img src={imageUrl!} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initialsOf(name)}
    </span>
  );
}
