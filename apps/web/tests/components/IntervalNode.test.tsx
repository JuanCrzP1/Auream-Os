import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { NodeExpandedFrame } from "@features/automations/builder/components/canvas/NodeExpandedFrame";
import { FlowNodeCard } from "@features/automations/builder/components/canvas/FlowNodeCard";
import { BuilderEditingProvider } from "@features/automations/builder/context/BuilderEditingContext";
import { applyNodePatch } from "@features/automations/builder/services/applyNodePatch";
import { createNodeDraft } from "@features/automations/builder/services/createNodeDraft";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";
import { readIntervalConfig } from "@contracts/IntervalConfig";
import { summarizeInterval } from "@features/automations/builder/tools/interval/summarizeInterval";
import type { CanvasNode } from "@features/automations/builder/types/canvas";

// ---------------------------------------------------------------------------
// «Programador» dentro del Builder, por el camino real.
//
// No se monta el editor suelto: se monta el MARCO GENÉRICO que lo contiene
// —`NodeExpandedFrame`, el mismo que usan Mensaje, Esperar respuesta y
// Distribuidor— y la TARJETA REAL del lienzo. Lo que se prueba es la costura:
// que elegir modo cambie la configuración, que Guardar la conserve, que
// Cancelar la descarte y que el nodo cerrado diga lo que el dato dice.
// ---------------------------------------------------------------------------

function nodoIntervalo(): CanvasNode {
  return createNodeDraft("delay", 0);
}

/** Marco real gobernando un nodo real, con cierre que desmonta como el lienzo. */
function MarcoGobernado({ inicial }: { readonly inicial: CanvasNode }) {
  const [nodo, setNodo] = useState(inicial);
  const [abierto, setAbierto] = useState(true);

  return (
    <>
      {abierto ? (
        <NodeExpandedFrame
          data={nodo.data}
          tool={resolveTool(nodo.data.nodeType)}
          ui={resolveToolUi(nodo.data.nodeType)}
          onCommit={(patch) => setNodo((previo) => applyNodePatch(previo, patch))}
          onClose={() => setAbierto(false)}
        />
      ) : (
        <button type="button" onClick={() => setAbierto(true)}>
          reabrir
        </button>
      )}
      {/* Espejo de lo GUARDADO en el nodo, no de lo escrito en el editor: es lo
          que permite distinguir editar de guardar sin mirar el estado interno
          del marco.

          Un `div` y no un `output`: `output` tiene rol implícito `status`, el
          mismo que usa el editor para su confirmación, y el espejo de la prueba
          no puede competir con lo que la prueba quiere leer. */}
      <div data-testid="guardado">{summarizeInterval({}, nodo.data.config)}</div>

      {/* La configuración GUARDADA en crudo, tal cual va al disco. Es lo único
          que deja comprobar que el contrato sigue en 24 horas mientras la
          pantalla habla en doce: el resumen de arriba ya viene traducido. */}
      <div data-testid="config-cruda">{JSON.stringify(nodo.data.config)}</div>
    </>
  );
}

function pintarTarjeta(nodo: CanvasNode): HTMLElement {
  const props = { id: nodo.id, data: nodo.data, selected: false } as unknown as NodeProps<CanvasNode>;

  return render(
    <ReactFlowProvider>
      <BuilderEditingProvider
        requestEdit={vi.fn()}
        toggleExpand={vi.fn()}
        updateNode={vi.fn()}
        duplicateNode={vi.fn()}
        removeNode={vi.fn()}
      >
        <FlowNodeCard {...props} />
      </BuilderEditingProvider>
    </ReactFlowProvider>
  ).container;
}

/** Aplica configuración a un nodo por el mismo camino que el editor. */
const conConfig = (config: Record<string, unknown>): CanvasNode =>
  applyNodePatch(nodoIntervalo(), { config: { ...nodoIntervalo().data.config, ...config } });

/**
 * Un nodo con EXACTAMENTE esta configuración y nada más.
 *
 * Sirve para lo guardado por una versión anterior: si se le mezclaran encima
 * los valores de hoy, la prueba de compatibilidad dejaría de probar nada
 * —el `trigger` nuevo ganaría siempre— y daría verde aunque la traducción no
 * existiera.
 */
const conConfigCruda = (config: Record<string, unknown>): CanvasNode =>
  applyNodePatch(nodoIntervalo(), { config });

/** Elige el MOMENTO PRINCIPAL. Son dos y son excluyentes. */
const elegirMomento = (nombre: RegExp) =>
  fireEvent.click(screen.getByRole("radio", { name: nombre }));

/**
 * Enciende o apaga la RESTRICCIÓN horaria.
 *
 * Es un interruptor y no una pestaña, y esa diferencia es la regla de negocio:
 * el horario no sustituye al momento principal, se suma a él. Por eso este
 * ayudante no toca el grupo de radio.
 */
const conmutarHorario = () =>
  fireEvent.click(screen.getByRole("switch", { name: "Solo en horario permitido" }));
/**
 * EL CONTROL DE HORA, manejado COMO LO MANEJA UNA PERSONA.
 *
 * La hora ya no es una caja de texto en la que se vuelca una cadena: son tres
 * controles, y estos ayudantes obligan a las pruebas a pasar por cada uno igual
 * que un dedo. Escribir «02:45 p. m.» de un golpe probaría un campo que ya no
 * existe.
 */
const reloj = (dentro?: HTMLElement) => {
  const grupo = (nombre: string) =>
    (dentro ? within(dentro) : screen).getByRole("group", { name: nombre });

  return (nombre: string) => {
    const raiz = grupo(nombre);

    return {
      raiz,
      hora: () => within(raiz).getByLabelText("Hora") as HTMLInputElement,
      minutos: () => within(raiz).getByLabelText("Minutos") as HTMLInputElement,
      am: () => within(raiz).getByRole("button", { name: "a. m." }),
      pm: () => within(raiz).getByRole("button", { name: "p. m." }),
      /** Lo que se LEE en el control, con sus dos puntos y su mitad del día. */
      leido: () => {
        const h = (within(raiz).getByLabelText("Hora") as HTMLInputElement).value;
        const m = (within(raiz).getByLabelText("Minutos") as HTMLInputElement).value;
        const mitad =
          within(raiz).getByRole("button", { name: "a. m." }).getAttribute("aria-pressed") === "true"
            ? "a. m."
            : "p. m.";

        return `${h} : ${m} ${mitad}`;
      }
    };
  };
};

/** El control de hora del modo fecha. */
const laHora = () => reloj()("Hora a la que continuar");

/** Teclea en un campo pieza a pieza, como quien pulsa una tecla detrás de otra. */
const teclear = (campo: HTMLInputElement, texto: string) => {
  fireEvent.change(campo, { target: { value: "" } });
  for (const tecla of texto) {
    fireEvent.change(campo, { target: { value: campo.value + tecla } });
  }
};

const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
const guardado = () => screen.getByTestId("guardado").textContent;

/** Lo que el nodo lleva dentro, sin traducir: `HH:mm` de 24 horas. */
const configGuardada = (): Record<string, unknown> =>
  JSON.parse(screen.getByTestId("config-cruda").textContent ?? "{}");

describe("estado inicial", () => {
  it("un nodo nuevo llega al editor en modo intervalo y ya guardable", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(screen.getByRole("radio", { name: /Después de un tiempo/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("abre con el marco compartido, no con uno propio", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(document.querySelector(".node-expanded")).not.toBeNull();
    expect(document.querySelector(".node-expanded__header")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument();
  });

  it("ofrece DOS momentos principales, y solo uno activo", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    const momentos = screen.getAllByRole("radio", {
      name: /Después de un tiempo|En una fecha/
    });
    expect(momentos).toHaveLength(2);
    expect(momentos.filter((m) => m.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("el horario NO es un tercer momento: es un interruptor, y nace apagado", () => {
    // La comprobación que impide que vuelva el modelo viejo. Mientras el
    // horario fue una tercera pestaña, la interfaz afirmaba que elegirlo
    // cancelaba la espera — y no la cancela.
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(screen.queryByRole("radio", { name: /horario/i })).toBeNull();
    expect(screen.getByRole("switch", { name: "Solo en horario permitido" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("apagado, el horario no ocupa la pantalla con días que no gobiernan", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(screen.queryByRole("switch", { name: "Lunes" })).toBeNull();
  });
});

describe("modo intervalo", () => {
  it("enseña la espera y su explicación", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(screen.getByLabelText("Esperar durante")).toHaveValue(5);
    expect(screen.getByRole("status")).toHaveTextContent("continuará 5 minutos");
  });

  it("cambiar la cantidad actualiza la explicación sin guardar todavía", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "3" } });

    expect(screen.getByRole("status")).toHaveTextContent("continuará 3 minutos");
    expect(guardado()).toBe("Esperar 5 minutos");
  });

  it("cambiar la unidad se refleja en la explicación", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Horas" }));

    expect(screen.getByRole("status")).toHaveTextContent("continuará 5 horas");
  });

  it("una espera inválida no se confirma, y el marco dice por qué al intentarlo", () => {
    // El motivo lo da el MARCO compartido, y solo al intentar guardar: avisar
    // mientras se escribe sería regañar por no haber terminado. El editor, por
    // su parte, calla su confirmación mientras lo configurado no valga.
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "0" } });
    expect(screen.queryByRole("status")).toBeNull();

    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("mayor que cero");
    expect(guardado()).toBe("Esperar 5 minutos");
  });

  it("pasarse del tope lo dice en palabras del usuario", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Días" }));
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "40" } });
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("31 días");
  });
});

describe("modo fecha", () => {
  it("al cambiar de modo pide la fecha y no inventa ninguna", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    elegirMomento(/En una fecha/);

    expect(screen.getByLabelText("Fecha")).toHaveValue("");
    expect(laHora().hora()).toHaveValue("");
    expect(laHora().minutos()).toHaveValue("");
    // Sin fecha no hay nada que confirmar: el editor calla en vez de regañar.
    expect(screen.queryByRole("status")).toBeNull();

    guardar();
    expect(screen.getByRole("alert")).toHaveTextContent("Elige la fecha y la hora");
  });

  it("con fecha y hora completas confirma lo que va a pasar", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-25" } });
    teclear(laHora().hora(), "02");
    teclear(laHora().minutos(), "30");
    fireEvent.click(laHora().pm());

    expect(screen.getByRole("status")).toHaveTextContent("hasta el 25 sep 2026 a las 02:30 p.m.");
  });

  it("elegir el día no borra la hora ya puesta", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    teclear(laHora().hora(), "08");
    teclear(laHora().minutos(), "00");
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-01-10" } });

    expect(laHora().leido()).toBe("08 : 00 a. m.");
  });
});

describe("EL CONTROL DE HORA — tres piezas, ni una caja de texto", () => {
  /** Un nodo ya configurado: la situación exacta en la que el usuario se atascó. */
  const nodoConCita = () =>
    applyNodePatch(nodoIntervalo(), {
      config: { trigger: "date", moment: { date: "2026-09-12", time: "12:30" } }
    });

  const abrirCita = () => {
    render(<MarcoGobernado inicial={nodoConCita()} />);
    return { fecha: () => screen.getByLabelText("Fecha") as HTMLInputElement, hora: laHora };
  };

  // ----- 16 · EL CASO QUE TENÍA QUE MORIR -----

  it("«10ndjd» NO PUEDE EXISTIR: las letras no entran en el campo", () => {
    // ESTE ES EL DEFECTO QUE CERRÓ ESTA ENTREGA. El campo anterior aceptaba
    // cualquier texto y lo rechazaba después; ahora la restricción vive en el
    // control y el estado nunca llega a contener basura.
    const { hora } = abrirCita();

    teclear(hora().hora(), "10ndjd");

    expect(hora().hora()).not.toHaveValue("10ndjd");
    expect(hora().hora()).toHaveValue("10");
  });

  it("y tampoco ninguna de sus variantes", () => {
    const { hora } = abrirCita();

    for (const [escrito, queda] of [
      ["abc", ""],
      ["1x", "1"],
      ["12x", "12"],
      ["99", "9"],
      ["10a", "10"]
    ] as const) {
      teclear(hora().hora(), escrito);
      expect(hora().hora(), escrito).toHaveValue(queda);
    }
  });

  it("en los minutos igual, y «60» se queda en «6»", () => {
    const { hora } = abrirCita();

    for (const [escrito, queda] of [
      ["abc", ""],
      ["9a", "9"],
      ["60", "6"],
      ["99", "9"],
      ["1x", "1"]
    ] as const) {
      teclear(hora().minutos(), escrito);
      expect(hora().minutos(), escrito).toHaveValue(queda);
    }
  });

  it("la basura tecleada tampoco llega a la configuración del nodo", () => {
    // No basta con que el campo se vea limpio: lo que importa es que el dato
    // nunca pase por un valor imposible.
    const { hora } = abrirCita();

    teclear(hora().hora(), "10ndjd");
    fireEvent.blur(hora().hora());
    guardar();

    expect(JSON.stringify(configGuardada())).not.toContain("ndjd");
    expect(configGuardada().moment).toEqual({ date: "2026-09-12", time: "22:30" });
  });

  // ----- 1–11 · EL CONTROL -----

  it("1 · hora máxima 12, minutos máximos 59, recorridos enteros", () => {
    const { hora } = abrirCita();

    for (let h = 1; h <= 12; h += 1) {
      teclear(hora().hora(), String(h).padStart(2, "0"));
      expect(hora().hora(), `hora ${h}`).toHaveValue(String(h).padStart(2, "0"));
    }

    teclear(hora().hora(), "13");
    expect(hora().hora(), "13 no debe entrar entero").toHaveValue("1");

    for (const m of ["00", "30", "59"]) {
      teclear(hora().minutos(), m);
      expect(hora().minutos(), `minuto ${m}`).toHaveValue(m);
    }
  });

  it("2 · enseña la hora guardada EN DOCE HORAS, en piezas", () => {
    const { fecha, hora } = abrirCita();

    expect(fecha()).toHaveValue("2026-09-12");
    expect(hora().leido()).toBe("12 : 30 p. m.");
  });

  it("2b · una hora de la tarde NUNCA se enseña en 24 horas", () => {
    const nodo = applyNodePatch(nodoIntervalo(), {
      config: { trigger: "date", moment: { date: "2026-09-12", time: "14:45" } }
    });
    render(<MarcoGobernado inicial={nodo} />);

    expect(laHora().leido()).toBe("02 : 45 p. m.");
  });

  it("3 · LOS DOS PUNTOS SIEMPRE ESTÁN, incluso con el control vacío", () => {
    // No son de ningún campo: no se teclean, no se borran y no desaparecen.
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    const dosPuntos = () => laHora().raiz.querySelector(".iv-time__colon");

    expect(dosPuntos()).toHaveTextContent(":");

    teclear(laHora().hora(), "08");
    expect(dosPuntos()).toHaveTextContent(":");

    fireEvent.change(laHora().hora(), { target: { value: "" } });
    expect(dosPuntos()).toHaveTextContent(":");
  });

  it("4 · el a. m./p. m. son DOS BOTONES, y solo uno está pulsado", () => {
    const { hora } = abrirCita();

    expect(hora().am()).toHaveAttribute("aria-pressed", "false");
    expect(hora().pm()).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(hora().am());

    expect(hora().am()).toHaveAttribute("aria-pressed", "true");
    expect(hora().pm()).toHaveAttribute("aria-pressed", "false");
  });

  it("5 · cambiar de mitad del día NO toca la hora ni los minutos", () => {
    const { hora } = abrirCita();

    fireEvent.click(hora().am());
    expect(hora().leido()).toBe("12 : 30 a. m.");

    fireEvent.click(hora().pm());
    expect(hora().leido()).toBe("12 : 30 p. m.");
  });

  it("6 · pero SÍ cambia lo que se guarda", () => {
    const { hora } = abrirCita();

    fireEvent.click(hora().am());
    guardar();

    expect(configGuardada().moment).toEqual({ date: "2026-09-12", time: "00:30" });
  });

  // ----- 17–21 · CADA PIEZA POR SEPARADO -----

  it("7 · cambiar SOLO la hora conserva minutos, mitad del día y fecha", () => {
    const { fecha, hora } = abrirCita();

    teclear(hora().hora(), "08");

    expect(hora().leido()).toBe("08 : 30 p. m.");
    expect(fecha()).toHaveValue("2026-09-12");
  });

  it("8 · cambiar SOLO los minutos conserva hora, mitad del día y fecha", () => {
    const { fecha, hora } = abrirCita();

    teclear(hora().minutos(), "05");

    expect(hora().leido()).toBe("12 : 05 p. m.");
    expect(fecha()).toHaveValue("2026-09-12");
  });

  it("9 · cambiar la fecha NO toca ninguna pieza de la hora", () => {
    const { fecha, hora } = abrirCita();

    fireEvent.change(fecha(), { target: { value: "2027-01-10" } });

    expect(hora().leido()).toBe("12 : 30 p. m.");
    guardar();
    expect(guardado()).toBe("10 ene 2027 · 12:30 p.m.");
  });

  it("10 · y las tres ediciones seguidas se acumulan sin pisarse", () => {
    // La secuencia exacta del encargo: 02:45 p. m. → 08 → 05 → a. m.
    const { hora } = abrirCita();

    teclear(hora().hora(), "02");
    teclear(hora().minutos(), "45");
    fireEvent.click(hora().pm());
    expect(hora().leido()).toBe("02 : 45 p. m.");

    teclear(hora().hora(), "08");
    expect(hora().leido()).toBe("08 : 45 p. m.");

    teclear(hora().minutos(), "05");
    expect(hora().leido()).toBe("08 : 05 p. m.");

    fireEvent.click(hora().am());
    expect(hora().leido()).toBe("08 : 05 a. m.");

    guardar();
    expect(configGuardada().moment).toEqual({ date: "2026-09-12", time: "08:05" });
  });

  // ----- 8, 9 · BORRADO TEMPORAL Y NORMALIZACIÓN -----

  it("11 · SE PUEDE BORRAR MIENTRAS SE EDITA, y el resto se queda", () => {
    const { hora } = abrirCita();

    fireEvent.change(hora().hora(), { target: { value: "" } });

    expect(hora().hora()).toHaveValue("");
    expect(hora().minutos(), "borrar la hora no tocó los minutos").toHaveValue("30");
  });

  it("12 · pero una hora INCOMPLETA no se guarda", () => {
    const { hora } = abrirCita();

    fireEvent.change(hora().hora(), { target: { value: "" } });
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Elige la fecha y la hora");
    // Ni se inventó un valor, ni se restauró el viejo en silencio.
    expect(configGuardada().moment).toEqual({ date: "2026-09-12", time: "12:30" });
  });

  it("13 · lo mismo si lo que falta son los minutos", () => {
    const { hora } = abrirCita();

    fireEvent.change(hora().minutos(), { target: { value: "" } });
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Elige la fecha y la hora");
  });

  it("14 · «8» se queda «8» mientras se edita y se lee «08» al salir", () => {
    const { hora } = abrirCita();

    fireEvent.change(hora().hora(), { target: { value: "8" } });
    expect(hora().hora(), "reformateó a media palabra").toHaveValue("8");

    fireEvent.blur(hora().hora());
    expect(hora().hora()).toHaveValue("08");
  });

  // ----- 22–27 · GUARDAR -----

  it("15 · fecha + hora guarda, y el contrato sigue en 24 horas", () => {
    const { hora } = abrirCita();

    teclear(hora().hora(), "01");
    teclear(hora().minutos(), "30");
    fireEvent.click(hora().pm());
    guardar();

    // Lo que el usuario lee, en doce.
    expect(guardado()).toBe("12 sep 2026 · 01:30 p.m.");
    // Lo que el nodo lleva dentro, en veinticuatro: EL CONTRATO NO SE MOVIÓ.
    expect(configGuardada().moment).toEqual({ date: "2026-09-12", time: "13:30" });
  });

  it("16 · hora sin fecha NO guarda", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    teclear(laHora().hora(), "02");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Elige la fecha y la hora");
  });

  it("17 · fecha sin hora NO guarda", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-11" } });
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Elige la fecha y la hora");
  });

  it("18 · al reabrir, fecha y hora están donde se dejaron", () => {
    const { hora } = abrirCita();

    teclear(hora().hora(), "01");
    teclear(hora().minutos(), "30");
    fireEvent.click(hora().pm());
    guardar();

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-12");
    expect(laHora().leido()).toBe("01 : 30 p. m.");
  });
});

describe("EL CASO CRÍTICO DEL ENCARGO, de principio a fin", () => {
  it("nodo nuevo → Fecha → 11/09/2026 02:45 p. m. → Guardar → cerrar → reabrir", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-11" } });
    teclear(laHora().hora(), "02");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());

    expect(laHora().leido()).toBe("02 : 45 p. m.");

    guardar();

    // LA CONFIGURACIÓN REAL DEL NODO, que es lo único que cuenta.
    expect(configGuardada().trigger).toBe("date");
    expect(configGuardada().moment).toEqual({ date: "2026-09-11", time: "14:45" });

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-11");
    expect(laHora().leido()).toBe("02 : 45 p. m.");
    expect(laHora().pm()).toHaveAttribute("aria-pressed", "true");
  });

  it("LA FECHA QUE SE VE ES LA DEL BORRADOR, aunque el nodo cambie por debajo", () => {
    // ESTE ERA EL FALLO DE GUARDAR. Con el calendario sin controlar, una
    // escritura cualquiera sobre el nodo resincronizaba el borrador del marco y
    // el DOM se quedaba enseñando una fecha que el borrador ya no tenía:
    // «11/09/2026» en pantalla y Guardar quejándose de que faltaba.
    const nodo = applyNodePatch(nodoIntervalo(), {
      config: { trigger: "date", moment: { date: "2026-01-01", time: "09:00" } }
    });
    render(<MarcoGobernado inicial={nodo} />);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-11" } });
    guardar();

    // Sin divergencia posible: lo que se veía es lo que se guardó.
    expect(configGuardada().moment).toEqual({ date: "2026-09-11", time: "09:00" });

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-11");
  });
});

describe("A · VISIBILIDAD — el horario NO sustituye al momento principal", () => {
  // EL PRINCIPIO QUE FIJAN ESTAS PRUEBAS: activar el horario añade una
  // restricción DEBAJO; no cambia de pantalla ni esconde lo que gobierna. Si
  // alguien vuelve a montar los días en lugar del momento —y no encima de él—,
  // estas cuatro se ponen rojas.

  it("A1 · Fecha + Horario OFF muestra fecha, hora y el interruptor", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);

    expect(screen.getByLabelText("Fecha")).toBeInTheDocument();
    expect(laHora().hora()).toBeInTheDocument();
    expect(laHora().minutos()).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Solo en horario permitido" })).toBeInTheDocument();
    // Apagado, los días no ocupan la pantalla.
    expect(screen.queryByRole("switch", { name: "Lunes" })).toBeNull();
  });

  it("A2 · Fecha + Horario ON SIGUE mostrando fecha y hora, y añade los días", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    teclear(laHora().hora(), "10");
    teclear(laHora().minutos(), "39");

    conmutarHorario();

    // LO DE ARRIBA NO SE VA.
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-15");
    expect(laHora().leido()).toBe("10 : 39 a. m.");
    // Y lo de abajo se suma.
    expect(screen.getByRole("switch", { name: "Lunes" })).toBeInTheDocument();
    expect(screen.getByText("Horarios permitidos")).toBeInTheDocument();
  });

  it("A3 · Después + Horario ON SIGUE mostrando la espera", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "7" } });

    conmutarHorario();

    expect(screen.getByLabelText("Esperar durante")).toHaveValue(7);
    expect(screen.getByRole("switch", { name: "Lunes" })).toBeInTheDocument();
  });

  it("A4 · encender y apagar el horario NO toca el trigger ni el momento", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    teclear(laHora().hora(), "10");
    teclear(laHora().minutos(), "39");
    fireEvent.click(laHora().pm());

    conmutarHorario();
    conmutarHorario();

    expect(screen.getByRole("radio", { name: "En una fecha" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-15");
    expect(laHora().leido()).toBe("10 : 39 p. m.");

    guardar();
    expect(configGuardada().trigger).toBe("date");
    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "22:39" });
  });

  it("A5 · el horario ACTIVO no invalida una fecha y una hora que sí valen", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());
    conmutarHorario();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    guardar();

    // Fecha + horario conviven: ni el horario borra la cita ni la cita el horario.
    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "12:45" });
    expect(configGuardada().scheduleEnabled).toBe(true);
  });
});

describe("A-D · EL HORARIO SE SUMA, NUNCA SUSTITUYE (regresión del recorte)", () => {
  // EL FALLO QUE FIJAN ESTAS PRUEBAS no era un desmontaje: los campos seguían
  // en el DOM. `.interval` es una columna flex de altura fija, así que al
  // crecer el horario flexbox le ROBABA altura al panel del momento —de 150px
  // a 67px, justo las pestañas— y `overflow: hidden` recortaba lo de dentro.
  //
  // jsdom no calcula layout, así que aquí NO se puede medir el recorte: eso lo
  // comprueba la prueba de navegador. Lo que sí se fija aquí es la otra mitad
  // —que las dos secciones coexisten en el árbol y que apagar el horario no se
  // lleva nada por delante— y, sobre todo, que la regla que lo impide SIGA
  // ESCRITA: si alguien la borra, el recorte vuelve entero y en silencio.

  it("CASO A · Después + horario ON: la espera y los días conviven", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("radio", { name: "Segundos" }));

    conmutarHorario();

    expect(screen.getByLabelText("Esperar durante")).toHaveValue(60);
    expect(screen.getByRole("radio", { name: "Segundos" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Horarios permitidos")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Solo en horario permitido" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("CASO B · Fecha + horario ON: fecha, hora y días conviven", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());

    conmutarHorario();

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-15");
    expect(laHora().leido()).toBe("12 : 45 p. m.");
    expect(screen.getByText("Horarios permitidos")).toBeInTheDocument();
  });

  it("CASO C · Fecha + horario ON → OFF conserva fecha y hora, y deja guardar", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());

    conmutarHorario();
    conmutarHorario();

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-15");
    expect(laHora().leido()).toBe("12 : 45 p. m.");
    expect(screen.queryByText("Horarios permitidos")).toBeNull();

    guardar();
    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "12:45" });
  });

  it("CASO D · Después + horario ON → OFF conserva la espera", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "60" } });

    conmutarHorario();
    conmutarHorario();

    expect(screen.getByLabelText("Esperar durante")).toHaveValue(60);
    expect(screen.queryByText("Horarios permitidos")).toBeNull();

    guardar();
    expect(configGuardada().wait).toEqual({ amount: 60, unit: "minutes" });
  });

  it("la regla que impide el RECORTE sigue escrita en la hoja", () => {
    // La causa exacta, fijada donde se corrigió. Sin esto, el reparto flex
    // vuelve a robarle altura al momento y `overflow: hidden` lo recorta: los
    // campos siguen en el árbol —así que ninguna prueba de jsdom se entera— y
    // desaparecen de la pantalla.
    const hoja = readFileSync(
      "src/features/automations/builder/tools/interval/interval-editor.css",
      "utf8"
    );
    const declaraciones = hoja.replace(/\/\*[\s\S]*?\*\//g, "");

    expect(declaraciones).toMatch(/\.interval\s*>\s*\*\s*\{[^}]*flex-shrink:\s*0/);
  });
});

describe("B · AUTOAVANCE — la hora entrega el foco a los minutos", () => {
  const abrirFecha = () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
  };

  it("B5 · «12» pasa el foco a minutos", () => {
    abrirFecha();

    laHora().hora().focus();
    teclear(laHora().hora(), "12");

    expect(document.activeElement).toBe(laHora().minutos());
  });

  it("B6 · «09» también", () => {
    abrirFecha();
    laHora().hora().focus();
    teclear(laHora().hora(), "09");

    expect(document.activeElement).toBe(laHora().minutos());
  });

  it("B7 · «02» también", () => {
    abrirFecha();
    laHora().hora().focus();
    teclear(laHora().hora(), "02");

    expect(document.activeElement).toBe(laHora().minutos());
  });

  it("B7b · pero «1» ESPERA su segunda cifra: 10, 11 y 12 existen", () => {
    abrirFecha();
    laHora().hora().focus();
    fireEvent.change(laHora().hora(), { target: { value: "1" } });

    expect(document.activeElement, "se fue antes de tiempo").toBe(laHora().hora());
  });

  it("B7c · «2» no espera nada: no hay horas entre las 20 y las 29", () => {
    abrirFecha();
    laHora().hora().focus();
    fireEvent.change(laHora().hora(), { target: { value: "2" } });

    expect(document.activeElement).toBe(laHora().minutos());
    // Y al salir queda en su forma canónica.
    expect(laHora().hora()).toHaveValue("02");
  });

  it("B7d · «0» espera, porque «01»–«09» existen", () => {
    abrirFecha();
    laHora().hora().focus();
    fireEvent.change(laHora().hora(), { target: { value: "0" } });

    expect(document.activeElement).toBe(laHora().hora());
  });

  it("B8 · y escribir los minutos después NO mueve el foco a ninguna parte", () => {
    abrirFecha();
    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");

    expect(laHora().leido()).toBe("12 : 45 a. m.");
    expect(document.activeElement, "los minutos soltaron el foco").toBe(laHora().minutos());
  });

  it("B · la secuencia completa sin un solo clic entre campos", () => {
    abrirFecha();

    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");
    fireEvent.click(laHora().pm());

    expect(laHora().leido()).toBe("12 : 45 p. m.");

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    guardar();

    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "12:45" });
  });

  it("B14/15 · el meridiano no toca las cifras, pero sí el valor guardado", () => {
    abrirFecha();
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");

    fireEvent.click(laHora().pm());
    expect(laHora().leido()).toBe("12 : 45 p. m.");
    guardar();
    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "12:45" });

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));
    fireEvent.click(laHora().am());
    expect(laHora().leido(), "la mañana movió las cifras").toBe("12 : 45 a. m.");
    guardar();
    expect(configGuardada().moment).toEqual({ date: "2026-09-15", time: "00:45" });
  });

  it("B · BACKSPACE en minutos no destruye la hora, ni al revés", () => {
    abrirFecha();
    laHora().hora().focus();
    teclear(laHora().hora(), "12");
    teclear(laHora().minutos(), "45");

    fireEvent.change(laHora().minutos(), { target: { value: "" } });
    expect(laHora().hora(), "borrar minutos tocó la hora").toHaveValue("12");

    fireEvent.change(laHora().hora(), { target: { value: "" } });
    expect(laHora().minutos(), "borrar la hora tocó los minutos").toHaveValue("");
  });
});

describe("la restricción horaria", () => {
  const abrirHorarios = () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    conmutarHorario();
  };

  const dia = (nombre: string) =>
    screen.getByRole("switch", { name: nombre }).closest("li") as HTMLElement;

  it("los siete días aparecen, todos apagados y sin franjas", () => {
    abrirHorarios();

    // Siete días más el interruptor que los gobierna.
    expect(screen.getAllByRole("switch")).toHaveLength(8);
    expect(screen.queryAllByLabelText(/hora de inicio/)).toHaveLength(0);
    expect(screen.getByText(/Ningún día activo todavía/)).toBeInTheDocument();
  });

  it("sin ningún día activo no se puede guardar, y lo dice", () => {
    abrirHorarios();

    // El aviso contextual del propio modo SÍ está —es una guía, no un reproche—
    // y el motivo del rechazo lo da el marco al intentar guardar.
    expect(screen.getByText(/Ningún día activo todavía/)).toBeInTheDocument();

    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Activa al menos un día");
    expect(guardado()).toBe("Esperar 5 minutos");
  });

  it("apagarlo devuelve el nodo a guardable sin tocar ningún día", () => {
    // ES OPCIONAL DE VERDAD: lo que bloqueaba no era el horario a medias, sino
    // el horario a medias GOBERNANDO.
    abrirHorarios();
    guardar();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    conmutarHorario();
    guardar();

    expect(guardado()).toBe("Esperar 5 minutos");
  });

  it("la espera sigue gobernando debajo: el horario NO la sustituye", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    // Los campos de la espera siguen ahí y siguen contando.
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "3" } });
    guardar();

    expect(guardado()).toBe("Esperar 3 minutos + horario permitido");
  });

  it("activar un día le da una franja lista para editar", () => {
    abrirHorarios();

    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    // EL MISMO CONTROL QUE LA FECHA: tres piezas, también aquí.
    const franja = reloj(dia("Lunes"));

    expect(franja("Lunes: inicio").leido()).toBe("09 : 00 a. m.");
    expect(franja("Lunes: fin").leido()).toBe("06 : 00 p. m.");
  });

  it("desactivar un día esconde sus franjas", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    expect(screen.queryByRole("group", { name: "Lunes: inicio" })).toBeNull();
  });

  it("añadir una segunda franja el mismo día", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    fireEvent.click(within(dia("Lunes")).getByRole("button", { name: "Añadir horario" }));

    expect(within(dia("Lunes")).getAllByRole("group", { name: "Lunes: inicio" })).toHaveLength(2);
  });

  it("eliminar una franja deja las demás", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));
    fireEvent.click(within(dia("Lunes")).getByRole("button", { name: "Añadir horario" }));

    fireEvent.click(within(dia("Lunes")).getAllByRole("button", { name: /Eliminar horario/ })[0]);

    expect(within(dia("Lunes")).getAllByRole("group", { name: "Lunes: inicio" })).toHaveLength(1);
  });

  it("eliminar la última franja apaga el día", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    fireEvent.click(within(dia("Lunes")).getByRole("button", { name: /Eliminar horario/ }));

    expect(screen.getByRole("switch", { name: "Lunes" })).toHaveAttribute("aria-checked", "false");
  });

  it("editar una hora se refleja en el resumen", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    // INICIO Y FIN SE EDITAN POR SEPARADO: se toca el fin y el inicio no se mueve.
    const franja = reloj(dia("Lunes"));
    teclear(franja("Lunes: fin").hora(), "08");
    fireEvent.click(franja("Lunes: fin").pm());

    expect(franja("Lunes: inicio").leido(), "editar el fin movió el inicio").toBe("09 : 00 a. m.");
    expect(screen.getByRole("status")).toHaveTextContent("entre 09:00 a.m.–08:00 p.m.");
    // Y sin perder de vista lo que gobierna.
    expect(screen.getByRole("status")).toHaveTextContent("continuará 5 minutos");
  });

  it("una franja invertida bloquea Guardar y explica por qué", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    const franja = reloj(dia("Lunes"));
    teclear(franja("Lunes: fin").hora(), "08");
    fireEvent.click(franja("Lunes: fin").am());

    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("posterior a la de inicio");
    expect(guardado()).toBe("Esperar 5 minutos");
  });

  it("28–30 · inicio y fin son EL MISMO control, y se editan por separado", () => {
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    const franja = reloj(dia("Lunes"));

    // El mismo control profesional que la fecha: dos campos, dos puntos fijos y
    // dos botones. Nada de texto libre tampoco aquí.
    for (const nombre of ["Lunes: inicio", "Lunes: fin"]) {
      expect(franja(nombre).hora(), nombre).toBeInTheDocument();
      expect(franja(nombre).minutos(), nombre).toBeInTheDocument();
      expect(franja(nombre).am(), nombre).toBeInTheDocument();
      expect(franja(nombre).pm(), nombre).toBeInTheDocument();
      expect(franja(nombre).raiz.querySelector(".iv-time__colon"), nombre).toHaveTextContent(":");
    }

    // Tocar el inicio no mueve el fin…
    teclear(franja("Lunes: inicio").hora(), "07");
    expect(franja("Lunes: inicio").leido()).toBe("07 : 00 a. m.");
    expect(franja("Lunes: fin").leido()).toBe("06 : 00 p. m.");

    // …ni al revés.
    teclear(franja("Lunes: fin").minutos(), "45");
    expect(franja("Lunes: fin").leido()).toBe("06 : 45 p. m.");
    expect(franja("Lunes: inicio").leido()).toBe("07 : 00 a. m.");
  });

  it("31 · tampoco aquí entran letras, y la franja NO desaparece al borrar", () => {
    // Borrar un campo para reescribirlo llegaba a BORRAR LA FRANJA ENTERA: el
    // lector del contrato descartaba toda franja cuyas dos horas no estuvieran
    // completas, así que la fila se esfumaba bajo el cursor.
    abrirHorarios();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));

    const franja = reloj(dia("Lunes"));

    teclear(franja("Lunes: inicio").hora(), "10ndjd");
    expect(franja("Lunes: inicio").hora()).toHaveValue("10");

    fireEvent.change(franja("Lunes: inicio").minutos(), { target: { value: "" } });
    expect(within(dia("Lunes")).getAllByRole("group", { name: /Lunes:/ })).toHaveLength(2);

    // Y a medias no se guarda.
    guardar();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("32 · el horario APAGADO no bloquea Guardar, encendido y vacío sí", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);

    // Apagado: se guarda sin preguntar por días.
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "6" } });
    guardar();
    expect(guardado()).toBe("Esperar 6 minutos");

    // Encendido y sin días, el mismo nodo deja de poder guardarse.
    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));
    conmutarHorario();
    guardar();

    expect(screen.getByRole("alert")).toHaveTextContent("Activa al menos un día");
  });

  it("varios días seguidos se resumen como un rango", () => {
    abrirHorarios();
    for (const d of ["Lunes", "Martes", "Miércoles"]) {
      fireEvent.click(screen.getByRole("switch", { name: d }));
    }

    expect(screen.getByRole("status")).toHaveTextContent("de lunes a miércoles");
  });
});

describe("guardar y descartar, por el marco compartido", () => {
  it("Guardar conserva la configuración en el nodo", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "3" } });

    guardar();

    expect(guardado()).toBe("Esperar 3 minutos");
  });

  it("Cancelar descarta: ni se confirma ni sobrevive a reabrir", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-25" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(guardado()).toBe("Esperar 5 minutos");

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));
    expect(screen.getByRole("radio", { name: /Después de un tiempo/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("la configuración guardada reaparece exactamente al reabrir", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-25" } });
    teclear(laHora().hora(), "02");
    teclear(laHora().minutos(), "30");
    fireEvent.click(laHora().pm());
    // Guardar CIERRA el editor: el marco compartido confirma y se retira, así
    // que no hay que cancelar nada después. Reabrir es el gesto real.
    guardar();
    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));

    expect(screen.getByLabelText("Fecha")).toHaveValue("2026-09-25");
    expect(laHora().leido()).toBe("02 : 30 p. m.");
    expect(guardado()).toBe("25 sep 2026 · 02:30 p.m.");
  });

  it("un horario completo sobrevive al guardado con sus franjas", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    conmutarHorario();
    fireEvent.click(screen.getByRole("switch", { name: "Viernes" }));
    guardar();

    expect(guardado()).toBe("Esperar 5 minutos + horario permitido");

    fireEvent.click(screen.getByRole("button", { name: "reabrir" }));
    expect(screen.getByRole("switch", { name: "Viernes" })).toHaveAttribute("aria-checked", "true");
  });

  it("FECHA Y HORARIO A LA VEZ, que es lo que el modelo viejo hacía imposible", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    elegirMomento(/En una fecha/);
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-25" } });
    teclear(laHora().hora(), "02");
    teclear(laHora().minutos(), "30");
    fireEvent.click(laHora().pm());

    conmutarHorario();
    fireEvent.click(screen.getByRole("switch", { name: "Lunes" }));
    guardar();

    expect(guardado()).toBe("25 sep 2026 · 02:30 p.m. + horario permitido");
  });

  it("apagar el horario no borra sus días: vuelven al encenderlo", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    conmutarHorario();
    fireEvent.click(screen.getByRole("switch", { name: "Miércoles" }));

    conmutarHorario();
    conmutarHorario();

    expect(screen.getByRole("switch", { name: "Miércoles" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("cambiar de momento principal y volver conserva lo del anterior", () => {
    render(<MarcoGobernado inicial={nodoIntervalo()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Horas" }));

    elegirMomento(/En una fecha/);
    elegirMomento(/Después de un tiempo/);

    expect(screen.getByRole("radio", { name: "Horas" })).toHaveAttribute("aria-checked", "true");
  });

  it("conserva lo que esta versión no conoce de la configuración", () => {
    const nodo = applyNodePatch(nodoIntervalo(), { config: { deOtraVersion: 7 } });
    render(<MarcoGobernado inicial={nodo} />);

    fireEvent.change(screen.getByLabelText("Esperar durante"), { target: { value: "9" } });
    guardar();

    expect(guardado()).toBe("Esperar 9 minutos");
  });
});

describe("el nodo cerrado en el lienzo", () => {
  const detalle = (c: HTMLElement) => c.querySelector(".iv-node__detail")?.textContent;
  const modo = (c: HTMLElement) => c.querySelector(".iv-node__mode")?.textContent;

  it("un nodo nuevo resume su espera", () => {
    const contenedor = pintarTarjeta(nodoIntervalo());

    expect(modo(contenedor)).toBe("Intervalo");
    expect(detalle(contenedor)).toBe("Esperar 5 minutos");
  });

  it("con una fecha enseña día y hora", () => {
    const contenedor = pintarTarjeta(
      conConfig({ trigger: "date", moment: { date: "2026-09-25", time: "14:30" } })
    );

    expect(modo(contenedor)).toBe("Fecha");
    // También aquí en doce horas: el nodo del lienzo y el editor no pueden
    // enseñar la misma hora de dos maneras distintas.
    expect(detalle(contenedor)).toBe("25 sep 2026 · 02:30 p.m.");
  });

  it("con horario, lo clasifica arriba y deja el valor para lo que gobierna", () => {
    // La jerarquía tipográfica ES el modelo: la espera ocupa el renglón grande
    // y la restricción se anota junto a la clase, porque no la sustituye.
    const franja = [{ start: "09:00", end: "18:00" }];
    const contenedor = pintarTarjeta(
      conConfig({
        scheduleEnabled: true,
        schedule: {
          ...readIntervalConfig({}).schedule,
          monday: { enabled: true, ranges: franja }
        }
      })
    );

    expect(modo(contenedor)).toBe("Intervalo · en horario");
    expect(detalle(contenedor)).toBe("Esperar 5 minutos");
  });

  it("un nodo guardado con la versión anterior se pinta con el modelo de hoy", () => {
    const franja = [{ start: "09:00", end: "18:00" }];
    const contenedor = pintarTarjeta(
      conConfigCruda({
        mode: "schedule",
        schedule: {
          ...readIntervalConfig({}).schedule,
          monday: { enabled: true, ranges: franja }
        }
      })
    );

    expect(modo(contenedor)).toBe("Intervalo · en horario");
    expect(detalle(contenedor)).toBe("Esperar 5 minutos");
  });

  it("es un RESUMEN: no monta el editor ni sus controles", () => {
    const contenedor = pintarTarjeta(nodoIntervalo());

    expect(contenedor.querySelector(".interval")).toBeNull();
    expect(contenedor.querySelector(".iv-tabs")).toBeNull();
    expect(contenedor.querySelectorAll("input")).toHaveLength(0);
  });

  it("mantiene la salida única del cascarón: no declara salidas propias", () => {
    const contenedor = pintarTarjeta(nodoIntervalo());

    expect(contenedor.querySelectorAll(".flow-node__handle--source")).toHaveLength(1);
    expect(resolveToolUi("delay").ownsOutputs).toBeUndefined();
  });

  it("publica el cyan aprobado al lienzo", () => {
    const contenedor = pintarTarjeta(nodoIntervalo());
    const tarjeta = contenedor.querySelector<HTMLElement>(".flow-node");
    const tool = resolveTool("delay");

    expect(tarjeta?.style.getPropertyValue("--flow-node-accent")).toBe(tool.colors.header);
    expect(tool.colors.header).toBe("#0891b2");
  });
});

describe("independencia entre herramientas", () => {
  it("Intervalo no monta ninguna pieza de las otras herramientas", () => {
    const { container } = render(<MarcoGobernado inicial={nodoIntervalo()} />);

    expect(container.querySelector(".interval")).not.toBeNull();
    for (const clase of [
      "message-editor",
      "message-item",
      "wait-response",
      "wr-node",
      "distributor",
      "ds-out"
    ]) {
      expect(container.querySelector(`.${clase}`), `montó .${clase}`).toBeNull();
    }
  });
});
