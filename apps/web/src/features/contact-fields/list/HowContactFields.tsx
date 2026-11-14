import { Link } from "react-router-dom";
import { HowDemo, HowIcons, HowItWorks } from "@shared/ui/how-it-works/HowItWorks";

/**
 * «Cómo funciona» de Campos del cliente: lo que sabes de cada cliente y cambia
 * de uno a otro; los tres pasos con su dibujo (crear, preguntar en un flujo,
 * cada cliente lee lo suyo) y, para lo que es igual para todos, Datos del
 * negocio. Mismo cuadro que Datos del negocio.
 */
export function HowContactFields({ onClose }: { readonly onClose?: () => void }) {
  return (
    <HowItWorks
      title="Lo que sabes de cada cliente, en su ficha."
      description="Aquí va lo que cambia de un cliente a otro: su ciudad, su cumpleaños, su talla. Se llena solo cuando el cliente responde en un flujo, o lo pones tú en su ficha. Después lo usas en tus mensajes y cada cliente lee lo suyo."
      steps={[
        { icon: HowIcons.create, title: "Crea el campo", demo: <HowDemo.Field label="Campo" value="Ciudad" /> },
        { icon: HowIcons.ask, title: "Pregúntalo en un flujo", demo: <HowDemo.Message>¿De qué ciudad nos escribes? → se guarda en <HowDemo.Key>{"{ciudad}"}</HowDemo.Key></HowDemo.Message> },
        {
          icon: HowIcons.read,
          title: "Cada cliente lee lo suyo",
          demo: (
            <HowDemo.Bubble>
              Laura, te escribimos desde <HowDemo.Value>Medellín</HowDemo.Value> 🙌
            </HowDemo.Bubble>
          )
        }
      ]}
      footer={
        <>
          <span className="how__tip">
            {HowIcons.person}
            <span><b>Pedro</b> lee <b>Lima</b> en el mismo mensaje: cada uno, su ciudad.</span>
          </span>
          <Link className="how__link" to="/settings/business-data">
            ¿Algo igual para todos, como tu horario? <b>Datos del negocio →</b>
          </Link>
        </>
      }
      {...(onClose ? { onClose } : {})}
    />
  );
}
