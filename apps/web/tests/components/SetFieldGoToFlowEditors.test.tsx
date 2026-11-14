import { describe, expect, it } from "vitest";
import { useState, type ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetFieldEditor } from "@features/automations/builder/tools/set-field/SetFieldEditor";
import { SetFieldCompactBody } from "@features/automations/builder/tools/set-field/SetFieldCompactBody";
import { GoToFlowEditor } from "@features/automations/builder/tools/go-to-flow/GoToFlowEditor";
import { GoToFlowCompactBody } from "@features/automations/builder/tools/go-to-flow/GoToFlowCompactBody";
import type { ToolDraft, ToolEditorProps } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";

// ---------------------------------------------------------------------------
// Los editores de «Guardar dato» (el Manipulador de Leona) e «Ir a otro flujo»
// (la Conexión de flujo): qué guardan en el bloque y qué le dicen a la persona.
// ---------------------------------------------------------------------------

function Editor({ Tool, resources, config = {} }: { Tool: ComponentType<ToolEditorProps>; resources: ToolResources; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Bloque", content: {}, config });
  return (
    <>
      <Tool draft={draft} resources={resources} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="config">{JSON.stringify(draft.config)}</output>
    </>
  );
}
const saved = () => JSON.parse(screen.getByTestId("config").textContent!) as Record<string, unknown>;
const fields = { fields: [], totalContacts: 0, canManage: false, status: "ready" as const };

describe("Guardar dato", () => {
  it("pone un valor por defecto y muestra cómo quedará", async () => {
    render(<Editor Tool={SetFieldEditor} resources={{ labels: [], contactFields: fields }} config={{ field: "cancion_video" }} />);
    await userEvent.type(screen.getByLabelText("Valor"), "{{cancion_2}");
    expect(saved()).toEqual({ field: "cancion_video", operation: "set", value: "{cancion_2}" });
    expect(screen.getByText("{cancion_video} = {cancion_2}")).toBeInTheDocument();
  });

  it("hace una cuenta: elige la operación y el número", async () => {
    render(<Editor Tool={SetFieldEditor} resources={{ labels: [], contactFields: fields }} config={{ field: "reintentos" }} />);
    await userEvent.click(screen.getByRole("radio", { name: "Hacer una cuenta" }));
    await userEvent.selectOptions(screen.getByLabelText("Cuenta"), "subtract");
    await userEvent.type(screen.getByLabelText("Con este número"), "1");
    expect(saved()).toEqual({ field: "reintentos", operation: "subtract", value: "1" });
    expect(screen.getByText("{reintentos} = {reintentos} − 1")).toBeInTheDocument();
    expect(screen.getByText(/el dato no cambia y el flujo sigue/)).toBeInTheDocument();
  });

  it("avisa si eligen un Dato del negocio, y el nodo cerrado resume la cuenta", () => {
    render(<Editor Tool={SetFieldEditor} resources={{ labels: [], contactFields: fields }} config={{ field: "g_horario", value: "x" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ese dato no se cambia desde un flujo");
    const { container } = render(<SetFieldCompactBody draft={{ name: "x", content: {}, config: { field: "reintentos", operation: "add", value: "1" } }} />);
    expect(container).toHaveTextContent("{reintentos}+ 1");
  });
});

describe("Ir a otro flujo", () => {
  const flows: ToolResources["flows"] = [
    { id: "f1", key: "venta", name: "Dilo cantando venezuela", status: "active" },
    { id: "f2", key: "promo", name: "dilo cantando Promoción", status: "active" },
    { id: "f3", key: "pausado", name: "Garantía", status: "paused" },
    { id: "f4", key: "viejo", name: "Viejo", status: "archived" },
    { id: "f5", key: "nuevo", name: "Después de pagar", status: "draft" }
  ];

  it("ofrece los flujos de la cuenta sin este ni los archivados; uno pausado se ve pero no se elige", async () => {
    render(<Editor Tool={GoToFlowEditor} resources={{ labels: [], flows, flowsStatus: "ready", currentFlowKey: "venta" }} />);
    const list = screen.getByRole("radiogroup", { name: "Flujo de destino" });
    expect(within(list).getAllByRole("radio").map((radio) => radio.closest("label")!.textContent)).toEqual(["dilo cantando PromociónActivo", "GarantíaPausado", "Después de pagarBorrador"]);
    expect(within(list).getByRole("radio", { name: /Garantía/ })).toBeDisabled();
    // Un borrador corre igual: se puede elegir.
    expect(within(list).getByRole("radio", { name: /Después de pagar/ })).toBeEnabled();
    await userEvent.click(within(list).getByRole("radio", { name: /Promoción/ }));
    expect(saved()).toEqual({ flowId: "f2", flowName: "dilo cantando Promoción" });
    expect(screen.getByText("Ninguno: la conversación sigue en el otro flujo.")).toBeInTheDocument();
  });

  it("avisa si el flujo elegido se pausó o ya no existe; sin otros flujos lo dice", () => {
    const { unmount } = render(<Editor Tool={GoToFlowEditor} resources={{ labels: [], flows, flowsStatus: "ready", currentFlowKey: "venta" }} config={{ flowId: "f3", flowName: "Garantía" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ese flujo está pausado");
    unmount();
    const second = render(<Editor Tool={GoToFlowEditor} resources={{ labels: [], flows, flowsStatus: "ready", currentFlowKey: "venta" }} config={{ flowId: "borrado", flowName: "Borrado" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Ese flujo ya no existe");
    second.unmount();
    render(<Editor Tool={GoToFlowEditor} resources={{ labels: [], flows: [flows[0]!], flowsStatus: "ready", currentFlowKey: "venta" }} />);
    expect(screen.getByText(/Aún no tienes otro flujo/)).toBeInTheDocument();
  });

  it("el nodo cerrado muestra el flujo de destino", () => {
    const { container } = render(<GoToFlowCompactBody draft={{ name: "x", content: {}, config: { flowId: "f2", flowName: "dilo cantando Promoción" } }} />);
    expect(container).toHaveTextContent("dilo cantando PromociónEste termina aquí");
  });
});
