import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { createElement } from "react";
import {
  findToolUi,
  listUiTypes,
  resolveToolUi
} from "@features/automations/builder/tools/ui-registry";
import { listAllTools } from "@features/automations/builder/tools/registry";
import type { ToolFrame } from "@features/automations/builder/tools/ToolUi";

// ---------------------------------------------------------------------------
// Frontera de UI de las herramientas.
//
// La identidad de una herramienta está declarada en dos mitades: `registry.ts`,
// que es puro porque lo ejecuta el test de paridad del backend sin React, y
// `ui-registry.tsx`, que es la mitad React. Están separadas por una restricción
// real del entorno, no por gusto.
//
// Esa separación abre un hueco, y es el que estos tests existen para cerrar:
// una herramienta declarada en una mitad y olvidada en la otra se pintaba sin
// icono, en silencio, sin error y sin que nada lo notara. Por eso la paridad se
// comprueba en LOS DOS sentidos.
// ---------------------------------------------------------------------------

const FRAMES: ReadonlyArray<ToolFrame> = ["card", "diamond", "circle", "pill"];

describe("paridad catálogo puro ↔ catálogo visual", () => {
  it("toda herramienta registrada tiene UI declarada", () => {
    for (const tool of listAllTools()) {
      expect(findToolUi(tool.type), `la herramienta '${tool.type}' no declara UI`).not.toBeNull();
    }
  });

  it("no hay UI declarada para tipos que ninguna herramienta registra", () => {
    const declarados = new Set(listAllTools().map((tool) => tool.type));

    for (const type of listUiTypes()) {
      expect(declarados.has(type), `hay UI para '${type}', que no está en el registry`).toBe(true);
    }
  });

  it("las dos mitades tienen exactamente el mismo tamaño", () => {
    expect(listUiTypes()).toHaveLength(listAllTools().length);
  });

  it("no registra el mismo tipo dos veces", () => {
    const tipos = listUiTypes();

    expect(new Set(tipos).size).toBe(tipos.length);
  });
});

describe("contrato ToolUi", () => {
  it("toda herramienta declara icono y forma", () => {
    for (const type of listUiTypes()) {
      const ui = findToolUi(type);

      expect(typeof ui?.Icon, `'${type}' sin icono`).toBe("function");
      expect(FRAMES, `'${type}' declara una forma fuera del catálogo`).toContain(ui?.frame);
    }
  });

  it("el tipo viaja dentro del objeto y coincide con su clave de búsqueda", () => {
    for (const type of listUiTypes()) {
      expect(findToolUi(type)?.type).toBe(type);
    }
  });

  it("el icono de cada herramienta se renderiza", () => {
    for (const type of listUiTypes()) {
      const ui = findToolUi(type)!;
      const { container, unmount } = render(createElement(ui.Icon));

      expect(container.firstChild, `el icono de '${type}' no pinta nada`).not.toBeNull();
      unmount();
    }
  });

  it("el editor es opcional: la mayoría de herramientas todavía no declara uno", () => {
    // Que sea opcional es lo que permite ir herramienta por herramienta sin que
    // ninguna se quede entretanto sin forma de configurarse: las que no
    // declaran editor siguen abriendo el modal heredado.
    const sinEditor = listUiTypes().filter((type) => !findToolUi(type)?.Editor);

    expect(sinEditor.length).toBeGreaterThan(0);
  });

  it("Mensaje declara editor propio, y por eso se configura dentro del lienzo", () => {
    // El sistema común decide dónde abrir preguntando por este campo, no por el
    // tipo de nodo. Si esto deja de ser cierto, Mensaje volvería al modal sin
    // que nada más falle: por eso se fija aquí.
    expect(findToolUi("message")?.Editor).toBeTypeOf("function");
  });

  it("ninguna herramienta declara todavía cuerpo compacto propio", () => {
    // El compacto sigue siendo el genérico para las catorce, a propósito: este
    // bloque cambia cómo se CONFIGURA un Mensaje, no cómo se ve en reposo.
    for (const type of listUiTypes()) {
      expect(findToolUi(type)?.CompactBody).toBeUndefined();
    }
  });
});

describe("resolución de un tipo desconocido", () => {
  const desconocido = "herramienta-de-otra-version";

  it("no lo reconoce", () => {
    expect(findToolUi(desconocido)).toBeNull();
  });

  it("aun así devuelve algo pintable, en lugar de romper el lienzo", () => {
    const ui = resolveToolUi(desconocido);

    expect(typeof ui.Icon).toBe("function");
    expect(FRAMES).toContain(ui.frame);
  });

  it("el icono neutro se renderiza", () => {
    const ui = resolveToolUi(desconocido);
    const { container } = render(createElement(ui.Icon));

    expect(container.firstChild).not.toBeNull();
  });

  it("conserva el tipo recibido, para que la interfaz pueda nombrarlo", () => {
    expect(resolveToolUi(desconocido).type).toBe(desconocido);
  });

  it("no le inventa configuración ni cuerpo propio", () => {
    const ui = resolveToolUi(desconocido);

    expect(ui.CompactBody).toBeUndefined();
    expect(ui.Editor).toBeUndefined();
  });

  it("un tipo conocido no cae en el neutro", () => {
    expect(resolveToolUi("message")).toBe(findToolUi("message"));
  });
});

describe("la frontera visual no conoce el motor", () => {
  it("no declara ejecutabilidad ni comportamiento de runtime", () => {
    // `executable`, `terminal` y `defaultConfig` pertenecen a `ToolDefinition`:
    // describen lo que una herramienta HACE. Si se filtraran aquí habría dos
    // fuentes de verdad sobre lo mismo, y la visual sería la que nadie valida
    // contra el backend.
    for (const type of listUiTypes()) {
      const ui = findToolUi(type)! as Record<string, unknown>;

      expect(ui.executable).toBeUndefined();
      expect(ui.terminal).toBeUndefined();
      expect(ui.defaultConfig).toBeUndefined();
      expect(ui.availableInPalette).toBeUndefined();
    }
  });
});
