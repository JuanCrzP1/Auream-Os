import { StateCard } from "@shared/ui/state/StateCard";
import { StateIcons } from "@shared/ui/state/stateIcons";

/**
 * Meta Ads → Campañas: lo que se verá al conectar la cuenta publicitaria.
 * Auream ya guarda de qué anuncio viene cada chat; faltan el gasto y el
 * catálogo de campañas, que llegan con «Conectar con Meta».
 */
export function CampaignsTab() {
  return (
    <StateCard
      icon={StateIcons.target}
      title="Tus campañas, con su gasto y sus ventas"
      description="Al conectar tu cuenta publicitaria verás cada campaña y anuncio con su gasto, los chats que trajo, sus ventas, su ROAS y su costo por venta. Auream ya registra de qué anuncio viene cada chat."
    />
  );
}

/**
 * Meta Ads → Cuentas: «Conectar con Meta» (inicio de sesión de Meta, como en
 * Leona; no por webhook). Para cuentas de otros negocios, Meta aprueba antes
 * la app.
 */
export function AccountsTab() {
  return (
    <StateCard
      icon={StateIcons.lock}
      title="Conectar con Meta"
      description="Inicias sesión con tu cuenta de Meta y eliges qué cuentas publicitarias usa Auream. Nada que descargar: el gasto se actualiza solo. Estamos terminando la conexión oficial con Meta."
    />
  );
}
