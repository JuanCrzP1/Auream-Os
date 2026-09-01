import type { NodeType } from "@contracts/FlowSnapshot";
import { MessageIcon } from "./message/MessageIcon";
import { WaitResponseIcon } from "./wait-response/WaitResponseIcon";
import { TagsIcon } from "./tags/TagsIcon";
import { PaymentProofIcon } from "./payment-proof/PaymentProofIcon";
import { ConditionalIcon } from "./conditional/ConditionalIcon";
import { DistributorIcon } from "./distributor/DistributorIcon";
import { PixelIcon } from "./pixel/PixelIcon";
import { AiExtensionIcon } from "./ai-extension/AiExtensionIcon";
import { IntervalIcon } from "./interval/IntervalIcon";
import { SaleApprovedIcon } from "./sale-approved/SaleApprovedIcon";
import { IntegrationIcon } from "./integration/IntegrationIcon";
import { MenuIcon } from "./menu/MenuIcon";
import { NotificationIcon } from "./notification/NotificationIcon";
import { EndIcon } from "./end/EndIcon";

// ---------------------------------------------------------------------------
// Iconografía de las herramientas.
//
// Vive separado de `registry.ts` a propósito: el registry es puro y lo consume
// la validación del canvas, que también corre en el test de paridad del backend
// sin runtime de React. Un SVG no puede colarse en esa cadena.
//
// Cada icono sigue viviendo dentro del módulo de su herramienta; aquí solo se
// asocian al tipo. Único consumidor: la paleta.
// ---------------------------------------------------------------------------

type ToolIcon = () => JSX.Element;

const ICONS: Partial<Record<NodeType, ToolIcon>> = {
  message: MessageIcon,
  question: WaitResponseIcon,
  tags: TagsIcon,
  "payment-proof": PaymentProofIcon,
  condition: ConditionalIcon,
  distributor: DistributorIcon,
  pixel: PixelIcon,
  ai: AiExtensionIcon,
  delay: IntervalIcon,
  "sale-approved": SaleApprovedIcon,
  integration: IntegrationIcon,
  menu: MenuIcon,
  notification: NotificationIcon,
  end: EndIcon
};

/** Icono de una herramienta, o `null` si el tipo no tiene uno registrado. */
export function getToolIcon(type: NodeType): ToolIcon | null {
  return ICONS[type] ?? null;
}

/**
 * Tipos que tienen icono declarado.
 *
 * Simétrico a `listAllTools()` del registry: permite comprobar que las dos
 * mitades del catálogo —definición e iconografía— hablan del mismo conjunto.
 * Sin esto, la única forma de detectar un icono olvidado era verlo faltar en
 * la paleta.
 */
export function listIconTypes(): ReadonlyArray<NodeType> {
  return Object.keys(ICONS) as NodeType[];
}
