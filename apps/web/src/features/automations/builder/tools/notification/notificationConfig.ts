// La forma de los datos es el contrato compartido con el motor
// (`contracts/NotificationConfig.ts`): aviso por WhatsApp a un número del
// equipo (no al cliente), por el mismo número conectado que atiende el chat.
export {
  NOTIFICATION_DEFAULT_CONFIG,
  NOTIFICATION_PHONE_DIGITS,
  readNotificationConfig,
  type NotificationConfig
} from "@contracts/NotificationConfig";
