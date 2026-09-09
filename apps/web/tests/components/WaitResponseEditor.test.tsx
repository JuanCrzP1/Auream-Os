import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WaitResponseEditor } from "@features/automations/builder/tools/wait-response/WaitResponseEditor";
import type { NodePatch } from "@features/automations/builder/services/applyNodePatch";
import type { ToolDraft } from "@features/automations/builder/tools/ToolUi";
import {
  WAIT_RESPONSE_DEFAULT_CONFIG,
  WAIT_RESPONSE_DEFAULT_TIMEOUT
} from "@contracts/WaitResponseConfig";

// ---------------------------------------------------------------------------
// El editor de «Esperar respuesta».
//
// El editor no guarda: PROPONE. Por eso lo que se comprueba en cada caso es el
// PARCHE que emite, no un estado interno suyo — un editor con estado propio
// tendría una segunda verdad sobre la configuración del nodo.
//
// Se monta el editor solo, sin lienzo ni React Flow: su contrato dice que no
// los conoce, y montarlo así es lo que lo demuestra.
// ---------------------------------------------------------------------------

function borrador(config: Record<string, unknown> = {}, content: Record<string, unknown> = {}): ToolDraft {
  return {
    name: "Esperar respuesta",
    content,
    config: { ...WAIT_RESPONSE_DEFAULT_CONFIG, ...config }
  };
}

function pintar(draft: ToolDraft = borrador()) {
  const onChange = vi.fn<(patch: NodePatch) => void>();
  render(<WaitResponseEditor draft={draft} onChange={onChange} />);
  return onChange;
}

/** Editor gobernado, para los casos que necesitan varios gestos seguidos. */
function PintarConEstado({ inicial }: { readonly inicial?: ToolDraft }) {
  const [draft, setDraft] = useState<ToolDraft>(inicial ?? borrador());

  return (
    <WaitResponseEditor
      draft={draft}
      onChange={(patch) => setDraft((previo) => ({ ...previo, ...patch }))}
    />
  );
}

describe("valores por defecto", () => {
  it("arranca con «sin límite» apagado y el tiempo máximo activo en 30 minutos", () => {
    pintar();

    expect(screen.getByRole("switch", { name: /Esperar sin límite/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    // Visible y editable desde el primer render: el usuario no tiene que tocar
    // nada para ver ni para cambiar el tiempo máximo.
    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(30);
    expect(screen.getByRole("radio", { name: "Minutos" })).toHaveAttribute("aria-checked", "true");
  });

  it("con «sin límite» encendido, el tiempo máximo no se pinta", () => {
    // Nada deshabilitado insinuando que hace algo: si no aplica, no está.
    pintar(borrador({ waitIndefinitely: true, timeout: undefined }));

    expect(screen.queryByLabelText("Tiempo máximo")).not.toBeInTheDocument();
  });

  it("los demás interruptores nacen apagados", () => {
    pintar();

    for (const nombre of [/Agrupar mensajes/, /Responder al mensaje recibido/, /Reaccionar al mensaje recibido/]) {
      expect(screen.getByRole("switch", { name: nombre })).toHaveAttribute("aria-checked", "false");
    }
  });

  it("no muestra ningún nombre técnico al usuario", () => {
    const { container } = render(
      <WaitResponseEditor draft={borrador({ targetKey: "ciudad" })} onChange={vi.fn()} />
    );

    expect(container.textContent).not.toMatch(/targetKey|waitIndefinitely|groupMessages|replyToInbound/);
    expect(screen.getByText("Guardar respuesta en")).toBeInTheDocument();
  });
});

describe("esperar sin límite", () => {
  it("OFF: se usa el tiempo máximo", () => {
    // Estado inicial del editor: apagado, con el tiempo máximo activo.
    pintar();

    expect(screen.getByRole("switch", { name: /Esperar sin límite/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByLabelText("Tiempo máximo")).toBeInTheDocument();
  });

  it("ON: pasa a esperar sin límite y retira el tiempo del config persistido", () => {
    const onChange = pintar();

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ waitIndefinitely: true })
    });
    // Dejarlo escrito sería la contradicción que la validación rechaza:
    // «sin límite» y un tiempo máximo no pueden convivir en lo persistido. Que
    // el control deje de pintarse una vez aplicado el cambio ya está cubierto
    // arriba, con una configuración que empieza en `waitIndefinitely: true`.
    expect(onChange.mock.calls[0][0].config).not.toHaveProperty("timeout");
  });

  it("encender el switch REFLEJA el estado en pantalla: aria-checked y el control de tiempo desaparecen juntos", () => {
    // Con un componente gobernado —el patch se aplica de verdad al `draft`— y
    // no un espía inerte: lo que se comprueba es lo que el usuario VE, no solo
    // lo que se emitió.
    render(<PintarConEstado />);

    expect(screen.getByRole("switch", { name: /Esperar sin límite/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(screen.getByLabelText("Tiempo máximo")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));

    expect(screen.getByRole("switch", { name: /Esperar sin límite/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryByLabelText("Tiempo máximo")).not.toBeInTheDocument();
  });

  it("la primera vez que se apaga sin haber tocado nada, propone el default del contrato", () => {
    // Estaba escrito tres veces en este componente; ahora hay un solo dueño.
    const onChange = pintar(borrador({ waitIndefinitely: true, timeout: undefined }));

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ timeout: WAIT_RESPONSE_DEFAULT_TIMEOUT })
    });
    expect(WAIT_RESPONSE_DEFAULT_TIMEOUT).toEqual({ amount: 30, unit: "minutes" });
  });

  it("ON → OFF conserva el tiempo máximo que el usuario ya había configurado", () => {
    // El caso que de verdad importa: no siempre 30. Se edita a 90 minutos, se
    // enciende «sin límite» —que lo retira del config persistido— y al volver a
    // apagarlo debe reaparecer 90, no el default con el que nació el nodo.
    render(<PintarConEstado inicial={borrador({ waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } })} />);

    fireEvent.change(screen.getByLabelText("Tiempo máximo"), { target: { value: "90" } });
    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(90);

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));
    expect(screen.queryByLabelText("Tiempo máximo")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));
    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(90);
  });

  it("ON → OFF sin haber editado nada conserva la unidad, no solo la cantidad", () => {
    render(<PintarConEstado inicial={borrador({ waitIndefinitely: false, timeout: { amount: 2, unit: "hours" } })} />);

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));
    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));

    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(2);
    expect(screen.getByRole("radio", { name: "Horas" })).toHaveAttribute("aria-checked", "true");
  });

  it("con un timeout corrupto el control cae al mismo default del contrato", () => {
    // `readWaitResponseConfig` descarta lo ilegible, así que el control necesita
    // algo que enseñar: el respaldo es el default, no un 30 repetido a mano.
    pintar(borrador({ waitIndefinitely: false, timeout: "media hora" }));

    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(WAIT_RESPONSE_DEFAULT_TIMEOUT.amount);
    expect(screen.getByRole("radio", { name: "Minutos" })).toHaveAttribute("aria-checked", "true");
  });

  it("al volver a encenderlo RETIRA el tiempo guardado", () => {
    // Dejarlo escrito sería la contradicción que la validación rechaza,
    // esperando a reaparecer.
    const onChange = pintar(
      borrador({ waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } })
    );

    fireEvent.click(screen.getByRole("switch", { name: /Esperar sin límite/ }));

    const patch = onChange.mock.calls[0][0];
    expect(patch.config).toMatchObject({ waitIndefinitely: true });
    expect(patch.config).not.toHaveProperty("timeout");
  });
});

describe("tiempo máximo", () => {
  const conLimite = borrador({ waitIndefinitely: false, timeout: { amount: 30, unit: "minutes" } });

  it("aparece cuando se quita el «sin límite»", () => {
    pintar(conLimite);

    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(30);
    expect(screen.getByRole("radio", { name: "Minutos" })).toHaveAttribute("aria-checked", "true");
  });

  it("cambia la cantidad", () => {
    const onChange = pintar(conLimite);

    fireEvent.change(screen.getByLabelText("Tiempo máximo"), { target: { value: "45" } });

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ timeout: { amount: 45, unit: "minutes" } })
    });
  });

  it("cambia a horas conservando la cantidad", () => {
    const onChange = pintar(conLimite);

    fireEvent.click(screen.getByRole("radio", { name: "Horas" }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ timeout: { amount: 30, unit: "hours" } })
    });
  });

  it("acota la entrada: cero, negativos y decimales no llegan al parche", () => {
    const onChange = pintar(conLimite);
    const campo = screen.getByLabelText("Tiempo máximo");

    for (const valor of ["0", "-5", ""]) {
      fireEvent.change(campo, { target: { value: valor } });
      expect(onChange).toHaveBeenLastCalledWith({
        config: expect.objectContaining({ timeout: { amount: 1, unit: "minutes" } })
      });
    }

    fireEvent.change(campo, { target: { value: "2.7" } });
    expect(onChange).toHaveBeenLastCalledWith({
      config: expect.objectContaining({ timeout: { amount: 2, unit: "minutes" } })
    });
  });

  it("la unidad elegida sobrevive a cambiar la cantidad", () => {
    render(<PintarConEstado inicial={conLimite} />);

    fireEvent.click(screen.getByRole("radio", { name: "Horas" }));
    fireEvent.change(screen.getByLabelText("Tiempo máximo"), { target: { value: "6" } });

    expect(screen.getByLabelText("Tiempo máximo")).toHaveValue(6);
    expect(screen.getByRole("radio", { name: "Horas" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("agrupar mensajes y responder al recibido", () => {
  it("agrupar mensajes se enciende", () => {
    const onChange = pintar();

    fireEvent.click(screen.getByRole("switch", { name: /Agrupar mensajes/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ groupMessages: true })
    });
  });

  it("responder al mensaje recibido se enciende", () => {
    const onChange = pintar();

    fireEvent.click(screen.getByRole("switch", { name: /Responder al mensaje recibido/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ replyToInbound: true })
    });
  });

  it("y se apagan de nuevo", () => {
    const onChange = pintar(borrador({ groupMessages: true }));

    fireEvent.click(screen.getByRole("switch", { name: /Agrupar mensajes/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ groupMessages: false })
    });
  });
});

describe("reaccionar al mensaje recibido", () => {
  it("apagado no ofrece emoji que elegir", () => {
    pintar();

    expect(screen.queryByRole("radiogroup", { name: "Emoji de la reacción" })).not.toBeInTheDocument();
  });

  it("al encenderlo queda con un emoji utilizable, no vacío", () => {
    const onChange = pintar();

    fireEvent.click(screen.getByRole("switch", { name: /Reaccionar al mensaje recibido/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ reaction: "👍" })
    });
  });

  it("encendido deja elegir otro emoji", () => {
    const onChange = pintar(borrador({ reaction: "👍" }));

    fireEvent.click(screen.getByRole("radio", { name: "Reaccionar con ❤️" }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ reaction: "❤️" })
    });
  });

  it("al apagarlo BORRA el emoji: sin emoji no se reacciona", () => {
    const onChange = pintar(borrador({ reaction: "👍" }));

    fireEvent.click(screen.getByRole("switch", { name: /Reaccionar al mensaje recibido/ }));

    expect(onChange.mock.calls[0][0].config).not.toHaveProperty("reaction");
  });

  it("el interruptor refleja el emoji guardado, sin un booleano aparte", () => {
    pintar(borrador({ reaction: "🙏" }));

    expect(screen.getByRole("switch", { name: /Reaccionar al mensaje recibido/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Reaccionar con 🙏" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("su interruptor es el compartido, con la misma accesibilidad que los demás", () => {
    // Reutiliza `WaitResponseSwitch` en lugar de repetir su marcado. Se
    // comprueba por lo observable: los cuatro interruptores del editor tienen
    // la misma estructura, el mismo rol y el mismo nombre accesible ligado a su
    // rótulo. Si alguien volviera a escribir un switch a mano aquí, esta
    // igualdad se rompería.
    pintar();

    const interruptores = screen.getAllByRole("switch");
    expect(interruptores).toHaveLength(4);

    for (const interruptor of interruptores) {
      expect(interruptor).toHaveClass("wr-switch__control");
      expect(interruptor.closest(".wr-switch")).not.toBeNull();
      expect(interruptor.getAttribute("aria-labelledby")).toBeTruthy();
      expect(interruptor.getAttribute("aria-describedby")).toBeTruthy();
      expect(interruptor.querySelector(".wr-switch__knob")).not.toBeNull();
    }

    // Y el de la reacción no trae un contenedor duplicado propio.
    expect(document.querySelectorAll(".wr-reaction .wr-switch")).toHaveLength(1);
  });
});

describe("guardar la respuesta en un campo", () => {
  it("escribe el destino", () => {
    const onChange = pintar();

    fireEvent.change(screen.getByLabelText("Guardar respuesta en"), {
      target: { value: "ciudad" }
    });

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ targetKey: "ciudad" })
    });
  });

  it("vaciarlo retira la clave en lugar de dejarla vacía", () => {
    const onChange = pintar(borrador({ targetKey: "ciudad" }));

    fireEvent.change(screen.getByLabelText("Guardar respuesta en"), { target: { value: "" } });

    expect(onChange.mock.calls[0][0].config).not.toHaveProperty("targetKey");
  });

  it("muestra la clave normalizada, sin el prefijo técnico", () => {
    // Un nodo guardado con `context.ciudad` —o pegado así por el usuario— se
    // presenta como `ciudad`: el campo que el usuario nombra es el que el motor
    // escribe, y `context.` no le pertenece.
    pintar(borrador({ targetKey: "context.ciudad" }));

    expect(screen.getByLabelText("Guardar respuesta en")).toHaveValue("ciudad");
  });

  it("al tocar cualquier cosa, la clave se persiste ya normalizada", () => {
    // Auto-reparación: el parche se construye desde la configuración LEÍDA, así
    // que la primera escritura deja el nodo limpio sin migración ninguna.
    const onChange = pintar(borrador({ targetKey: "context.ciudad" }));

    fireEvent.click(screen.getByRole("switch", { name: /Agrupar mensajes/ }));

    expect(onChange).toHaveBeenCalledWith({
      config: expect.objectContaining({ targetKey: "ciudad" })
    });
  });
});

describe("mensaje antes de esperar", () => {
  it("es opcional y arranca vacío", () => {
    pintar();

    expect(screen.getByLabelText("Mensaje antes de esperar")).toHaveValue("");
  });

  it("escribe en content.text, no en config", () => {
    const onChange = pintar();

    fireEvent.change(screen.getByLabelText("Mensaje antes de esperar"), {
      target: { value: "¿En qué ciudad te encuentras?" }
    });

    expect(onChange).toHaveBeenCalledWith({
      content: { text: "¿En qué ciudad te encuentras?" }
    });
    expect(onChange.mock.calls[0][0]).not.toHaveProperty("config");
  });

  it("conserva el resto del contenido al escribir", () => {
    const onChange = pintar(borrador({}, { text: "viejo", otro: 1 }));

    fireEvent.change(screen.getByLabelText("Mensaje antes de esperar"), {
      target: { value: "nuevo" }
    });

    expect(onChange).toHaveBeenCalledWith({ content: { text: "nuevo", otro: 1 } });
  });
});

describe("no hay segunda fuente de verdad", () => {
  it("el editor no guarda nada: lo que se ve sale siempre del borrador recibido", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <WaitResponseEditor draft={borrador({ targetKey: "ciudad" })} onChange={onChange} />
    );

    expect(screen.getByLabelText("Guardar respuesta en")).toHaveValue("ciudad");

    // Se reemplaza el borrador desde fuera —lo que hace el marco al resincronizar
    // con el nodo— y el editor obedece: si tuviera estado propio, seguiría
    // enseñando «ciudad».
    rerender(<WaitResponseEditor draft={borrador({ targetKey: "correo" })} onChange={onChange} />);

    expect(screen.getByLabelText("Guardar respuesta en")).toHaveValue("correo");
  });

  it("escribir sin que nadie aplique el parche NO cambia lo que se ve", () => {
    // Confirma que el control es gobernado por `draft` y no por un estado local:
    // con un `onChange` que descarta, la interfaz no puede avanzar sola.
    pintar();
    const campo = screen.getByLabelText("Guardar respuesta en");

    fireEvent.change(campo, { target: { value: "ciudad" } });

    expect(campo).toHaveValue("");
  });
});

describe("independencia de Mensaje", () => {
  it("el editor se monta sin ninguna pieza de Mensaje presente", () => {
    const { container } = render(<WaitResponseEditor draft={borrador()} onChange={vi.fn()} />);

    // Ni una clase de Mensaje en el árbol: si alguien reutilizara su editor o su
    // hoja de estilos, estas clases aparecerían.
    for (const clase of ["message-editor", "message-builder", "message-item", "send-once", "message-library"]) {
      expect(container.querySelector(`.${clase}`)).toBeNull();
    }
  });
});
