/** Iniciales del contacto sobre un color estable por teléfono (como WhatsApp sin foto). */
const HUES = [152, 200, 262, 330, 24, 45, 180, 290];

export function Avatar({ name, phone, size = 48 }: { readonly name: string | null; readonly phone: string; readonly size?: number }) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const initials = words.length ? (words[0]![0]! + (words[1]?.[0] ?? "")).toUpperCase() : "#";
  const hue = HUES[[...phone].reduce((sum, char) => sum + char.charCodeAt(0), 0) % HUES.length];
  return (
    <span className="ios-avatar" style={{ width: size, height: size, fontSize: size * 0.38, ["--avatar-hue" as string]: hue }} aria-hidden="true">
      {initials}
    </span>
  );
}
