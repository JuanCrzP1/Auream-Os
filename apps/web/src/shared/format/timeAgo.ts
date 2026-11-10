// «hace 4 min», «hace 3 h», «ayer», «hace 5 días».

const MINUTE = 60_000;

export function timeAgo(at: string | null, now = Date.now()): string {
  if (!at) return "";
  const minutes = Math.max(0, Math.floor((now - new Date(at).getTime()) / MINUTE));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "ayer" : `hace ${days} días`;
}
