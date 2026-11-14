import { Link } from "react-router-dom";
import { HowDemo, HowIcons, HowItWorks } from "@shared/ui/how-it-works/HowItWorks";

/**
 * «Cómo funciona» de Datos del negocio: lo que les dices igual a todos tus
 * clientes, escrito una vez; los tres pasos con su dibujo; los cambios
 * programados y, para lo que cambia con cada cliente, Campos del cliente.
 */
export function HowBusinessData({ onClose }: { readonly onClose?: () => void }) {
  return (
    <HowItWorks
      title="Escríbelo una vez. Úsalo en todos tus mensajes."
      description="Aquí va lo que les dices igual a todos tus clientes: tu horario, tu dirección, tu link de pago. Cuando cambie, lo cambias solo aquí y se actualiza en todos tus flujos, difusiones y respuestas rápidas."
      steps={[
        { icon: HowIcons.create, title: "Crea el dato", demo: <HowDemo.Field label="Horario" value="Lunes a sábado, 8 a 6" /> },
        { icon: HowIcons.write, title: "Ponlo en tu mensaje", demo: <HowDemo.Message>Atendemos <HowDemo.Key>{"{g_horario}"}</HowDemo.Key> 🙌</HowDemo.Message> },
        { icon: HowIcons.read, title: "Tu cliente lo lee", demo: <HowDemo.Bubble>Atendemos <HowDemo.Value>lunes a sábado, 8 a 6</HowDemo.Value> 🙌</HowDemo.Bubble> }
      ]}
      footer={
        <>
          <span className="how__tip">
            {HowIcons.calendar}
            <span><b>¿Cierras en Navidad?</b> Programa otro valor por unas fechas y vuelve solo al de siempre.</span>
          </span>
          <Link className="how__link" to="/settings/contact-fields">
            ¿Algo que cambia con cada cliente, como su ciudad? <b>Campos del cliente →</b>
          </Link>
        </>
      }
      {...(onClose ? { onClose } : {})}
    />
  );
}
