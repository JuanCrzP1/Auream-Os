import type { ToolUi } from "../ToolUi";
import { NotificationIcon } from "./NotificationIcon";

/** Mitad React de la herramienta. Único punto donde declara cómo se ve. */
export const notificationUi: ToolUi = {
  type: "notification",
  Icon: NotificationIcon,
  frame: "card"
};
