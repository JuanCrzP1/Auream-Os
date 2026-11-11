// Los emojis del selector del chat, por grupos (los que más se usan al vender
// por WhatsApp). Sin librerías: es una lista corta y fija.

export const EMOJI_GROUPS: ReadonlyArray<{ readonly label: string; readonly emojis: ReadonlyArray<string> }> = [
  {
    label: "Caras",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😋", "😎", "🤩", "🥳", "🤗", "🤔", "🤭", "😏", "😌", "😴", "🥺", "😢", "😭", "😮", "😱", "😡", "🙄", "😬", "🤝"]
  },
  {
    label: "Gestos",
    emojis: ["👍", "👎", "👌", "✌️", "🤞", "🙏", "👏", "🙌", "💪", "👋", "👉", "👇", "☝️", "✋", "🫶", "🤙"]
  },
  {
    label: "Corazones",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💕", "💖", "💯", "✨", "⭐", "🔥", "🎉", "🎁"]
  },
  {
    label: "Ventas",
    emojis: ["✅", "❌", "⚠️", "📌", "📍", "📞", "📲", "💬", "📦", "🚚", "🛒", "💳", "💰", "💵", "🏷️", "🧾", "📅", "⏰", "⏳", "🔔", "📸", "🎶", "🎬", "👉"]
  }
];
