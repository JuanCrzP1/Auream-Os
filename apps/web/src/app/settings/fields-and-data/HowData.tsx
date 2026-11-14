import { HowDemo, HowIcons, HowItWorks } from "@shared/ui/how-it-works/HowItWorks";

/**
 * «Cómo funciona» de Campos y datos: un solo mensaje que usa los dos, para
 * que se vea la diferencia de un vistazo. La ciudad cambia con cada cliente;
 * el horario es igual para todos.
 */
export function HowData({ onClose }: { readonly onClose?: () => void }) {
  return (
    <HowItWorks
      title="Guárdalo una vez. Úsalo en todos tus mensajes."
      description="Hay dos clases de datos. Un campo del cliente cambia con cada persona: su ciudad, su cumpleaños. Un dato del negocio es igual para todos: tu horario, tu link de pago. Los dos se escriben entre llaves en flujos, difusiones y respuestas rápidas."
      steps={[
        {
          icon: HowIcons.create,
          title: "Crea el dato",
          demo: (
            <span className="how-demo-stack">
              <HowDemo.Field label="Campo del cliente" value="Ciudad" />
              <HowDemo.Field label="Dato del negocio" value="Horario: de 8 a 6" />
            </span>
          )
        },
        {
          icon: HowIcons.write,
          title: "Ponlo en tu mensaje",
          demo: (
            <HowDemo.Message>
              Te escribimos desde <HowDemo.Key>{"{ciudad}"}</HowDemo.Key>. Atendemos <HowDemo.Key>{"{g_horario}"}</HowDemo.Key>.
            </HowDemo.Message>
          )
        },
        {
          icon: HowIcons.read,
          title: "Cada cliente lo lee",
          demo: (
            <span className="how-demo-stack">
              <HowDemo.Bubble>
                <b>Laura:</b> …desde <HowDemo.Value>Medellín</HowDemo.Value>. Atendemos <HowDemo.Value>de 8 a 6</HowDemo.Value>.
              </HowDemo.Bubble>
              <HowDemo.Bubble>
                <b>Pedro:</b> …desde <HowDemo.Value>Lima</HowDemo.Value>. Atendemos <HowDemo.Value>de 8 a 6</HowDemo.Value>.
              </HowDemo.Bubble>
            </span>
          )
        }
      ]}
      footer={
        <>
          <span className="how__tip">
            {HowIcons.person}
            <span><b>Campos del cliente:</b> se llenan solos cuando el cliente responde en un flujo, o los pones en su ficha.</span>
          </span>
          <span className="how__tip">
            {HowIcons.calendar}
            <span><b>Datos del negocio:</b> puedes programar otro valor por unas fechas, como Navidad.</span>
          </span>
        </>
      }
      {...(onClose ? { onClose } : {})}
    />
  );
}
