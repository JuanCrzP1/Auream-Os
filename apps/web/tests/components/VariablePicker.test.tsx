import { describe, expect, it, vi } from "vitest";
import { useState, type ComponentType } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationEditor } from "@features/automations/builder/tools/notification/NotificationEditor";
import { ConditionEditor } from "@features/automations/builder/tools/conditional/ConditionEditor";
import { MessageEditor } from "@features/automations/builder/tools/message/MessageEditor";
import { insertVariable } from "@features/automations/builder/tools/_kit/variables/insertVariable";
import type { ToolDraft, ToolEditorProps } from "@features/automations/builder/tools/ToolUi";
import type { ToolResources } from "@features/automations/builder/tools/ToolResources";

// ---------------------------------------------------------------------------
// El botón «{ } Variables» de los campos de texto, como en Leona: abre una
// lista con buscador y por grupos (del cliente, campos del cliente, datos del
// negocio, del sistema…) y elegir una la pone donde estaba el cursor.
// ---------------------------------------------------------------------------

const resources = {
  labels: [],
  contactFields: { fields: [{ key: "ciudad", label: "Ciudad" }], totalContacts: 0, canManage: false, status: "ready" },
  businessData: [{ key: "g_horario", label: "Horario de atención" }]
} as unknown as ToolResources;

function Editor({ Tool, config = {} }: { Tool: ComponentType<ToolEditorProps>; config?: Record<string, unknown> }) {
  const [draft, setDraft] = useState<ToolDraft>({ name: "Bloque", content: {}, config });
  return (
    <>
      <Tool draft={draft} resources={resources} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }) as ToolDraft)} />
      <output data-testid="config">{JSON.stringify(draft.config)}</output>
    </>
  );
}
const saved = () => JSON.parse(screen.getByTestId("config").textContent!) as Record<string, unknown>;

describe("insertar una variable", () => {
  it("donde está el cursor, reemplazando lo marcado, o al final", () => {
    expect(insertVariable("Hola ", "{first_name}", { start: 5, end: 5 })).toEqual({ value: "Hola {first_name}", caret: 17 });
    expect(insertVariable("Hola amigo!", "{first_name}", { start: 5, end: 10 })).toEqual({ value: "Hola {first_name}!", caret: 17 });
    expect(insertVariable("Hola", "{dia}", null)).toEqual({ value: "Hola{dia}", caret: 9 });
  });
});

describe("el botón de variables", () => {
  it("muestra los grupos con los campos y datos de la cuenta, y pone la elegida en el cursor", async () => {
    render(<Editor Tool={NotificationEditor} config={{ message: "Hola , ¿cómo estás?" }} />);
    const field = screen.getByLabelText("Texto del aviso") as HTMLTextAreaElement;
    field.focus();
    field.setSelectionRange(5, 5);
    await userEvent.click(screen.getByRole("button", { name: "Variables" }));
    const menu = screen.getByRole("dialog", { name: "Elegir una variable" });
    expect(within(menu).getAllByRole("heading").map((h) => h.textContent)).toEqual(["Del cliente", "Campos del cliente", "Datos del negocio", "Del sistema", "Del anuncio", "De otros bloques"]);
    await userEvent.click(within(menu).getByRole("button", { name: /\{first_name\}/ }));
    expect(saved()).toMatchObject({ message: "Hola {first_name}, ¿cómo estás?" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("busca por nombre o por lo que es, sin tildes; Enter pone la primera", async () => {
    render(<Editor Tool={NotificationEditor} config={{ message: "" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Variables" }));
    await userEvent.type(screen.getByLabelText("Buscar variable"), "dia");
    const options = within(screen.getByRole("dialog")).getAllByRole("button").map((b) => b.querySelector("code")?.textContent);
    expect(options).toContain("{dia}");
    expect(options).not.toContain("{first_name}");
    await userEvent.clear(screen.getByLabelText("Buscar variable"));
    await userEvent.type(screen.getByLabelText("Buscar variable"), "horario{Enter}");
    expect(saved()).toMatchObject({ message: "{g_horario}" });
  });

  it("el Condicional compara contra una variable", async () => {
    render(<Editor Tool={ConditionEditor} config={{ match: "all", rules: [{ id: "r", category: "customField", field: "ref_nuevo", operator: "equal", value: "" }] }} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Insertar variable" })[0]!);
    await userEvent.type(screen.getByLabelText("Buscar variable"), "data{Enter}");
    expect((saved().rules as Array<{ value: string }>)[0]!.value).toBe("{data}");
  });

  it("el texto del Mensaje también lo tiene; sin tocar el campo, va al final", async () => {
    const onChange = vi.fn();
    render(<MessageEditor draft={{ name: "Mensaje", content: {}, config: { items: [{ id: "t", kind: "text", text: "Hola " }] } }} resources={resources} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Variables" }));
    await userEvent.type(screen.getByLabelText("Buscar variable"), "saludo{Enter}");
    const patch = onChange.mock.calls.at(-1)![0] as { config: { items: Array<{ text: string }> } };
    expect(patch.config.items[0]!.text).toBe("Hola {saludo}");
  });
});
