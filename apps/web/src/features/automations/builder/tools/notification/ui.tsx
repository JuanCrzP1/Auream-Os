import type { ToolUi } from "../ToolUi";
import { NotificationCompactBody } from "./NotificationCompactBody";
import { NotificationIcon } from "./NotificationIcon";
import { NotificationEditor } from "./NotificationEditor";

export const notificationUi: ToolUi = {
  type: "notification",
  Icon: NotificationIcon,
  frame: "card",
  CompactBody: NotificationCompactBody,
  Editor: NotificationEditor
};
