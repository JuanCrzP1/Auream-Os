import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveTool } from "@features/automations/builder/tools/registry";
import { resolveToolUi } from "@features/automations/builder/tools/ui-registry";

// ---------------------------------------------------------------------------
// Contratos ARQUITECTÓNICOS del Distribuidor.
//
// Aquí no se renderiza nada ni se pulsa nada: eso es `DistributorNode.test.tsx`,
// que prueba el comportamiento. Lo que se fija aquí son las fronteras del
// módulo —qué declara, de qué no depende, qué no sabe de él la infraestructura
// genérica—, que es el tipo de propiedad que no se rompe con un fallo visible
// sino con una degradación lenta que nadie nota hasta que duele.
//
// Están separados porque se leen y se mantienen distinto: un test de
// comportamiento cambia cuando cambia el producto; uno de estos cambia cuando
// cambia la arquitectura, y eso debería pasar mucho menos.
// ---------------------------------------------------------------------------

const RAIZ = "src/features/automations/builder/tools/distributor";

/** Módulos del tool, sin comentarios: lo que se mira son los `import` reales. */
function fuenteSinComentarios(modulo: string): string {
  return readFileSync(`${RAIZ}/${modulo}`, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Los cuatro módulos que tienen que ser lógica pura, sin React de por medio. */
const MODULOS_PUROS = [
  "distributorOutputs.ts",
  "readDistributorConfig.ts",
  "validateDistributor.ts",
  "summarizeDistributor.ts"
];

/** Todo el módulo, para las comprobaciones que valen para cualquier archivo. */
const MODULOS = [
  ...MODULOS_PUROS,
  "definition.ts",
  "ui.tsx",
  "DistributorEditor.tsx",
  "DistributorCompactBody.tsx",
  "editor/DistributorOutputRow.tsx"
];

describe("la lógica pura se mantiene pura", () => {
  it("dominio, lectura, validación y resumen no importan React ni el lienzo", () => {
    // ES LO QUE LOS HACE PROBABLES Y REUTILIZABLES. Estas cuatro piezas son las
    // que podrán subir a `contracts/` el día que el motor aprenda a repartir; un
    // `import` de React dentro de cualquiera de ellas cerraría esa puerta, y lo
    // haría sin romper nada visible.
    for (const modulo of MODULOS_PUROS) {
      const fuente = fuenteSinComentarios(modulo);

      expect(fuente, `${modulo} importa React`).not.toMatch(/from\s+["']react["']/);
      expect(fuente, `${modulo} importa React Flow`).not.toMatch(/from\s+["']@xyflow/);
      expect(fuente, `${modulo} importa una hoja de estilos`).not.toMatch(/\.css["']/);

      // LA EXTENSIÓN ES LA BARRERA, no un regex buscando `<`: un `.ts` no
      // admite JSX y es el compilador quien lo impide, no una prueba. Mismo
      // criterio que documenta `ToolUi` para separar el registro puro del
      // registro de React. Buscar JSX a mano además no distingue `<div>` de un
      // genérico como `ReadonlyArray<Salida>`.
      expect(modulo, `${modulo} debería ser .ts para no poder llevar JSX`).toMatch(/\.ts$/);
    }
  });

  it("no tocan el DOM ni el almacenamiento del navegador", () => {
    for (const modulo of MODULOS_PUROS) {
      const fuente = fuenteSinComentarios(modulo);

      expect(fuente, `${modulo} usa el DOM`).not.toMatch(/\b(document|window)\./);
      expect(fuente, `${modulo} usa almacenamiento`).not.toMatch(/localStorage|sessionStorage/);
    }
  });
});

describe("la infraestructura genérica no sabe que existe el Distribuidor", () => {
  it("ni la tarjeta, ni el marco, ni la hoja del lienzo lo nombran", () => {
    // El cascarón trata a las catorce igual y pregunta por CAPACIDADES
    // —¿tiene cuerpo propio?, ¿monta sus salidas?—, nunca por el tipo de nodo.
    // Un `if` por Distribuidor aquí sería la frontera rota, y esta herramienta
    // no necesitó ninguno: `ownsOutputs` ya existía.
    const genericos = [
      "src/features/automations/builder/components/canvas/FlowNodeCard.tsx",
      "src/features/automations/builder/components/canvas/NodeExpandedFrame.tsx",
      "src/features/automations/builder/components/canvas/flow-node.css",
      "src/features/automations/builder/components/canvas/BuilderCanvas.tsx"
    ];

    for (const ruta of genericos) {
      const fuente = readFileSync(ruta, "utf8");

      expect(fuente.toLowerCase(), `${ruta} nombra al Distribuidor`).not.toMatch(
        /distributor|distribuidor|\bds-/
      );
    }
  });

  it("nadie fuera del módulo importa piezas internas del Distribuidor", () => {
    // El tool se consume por los DOS registros —`registry` y `ui-registry`—, que
    // es la única frontera que el core conoce. Si otro archivo importara, por
    // ejemplo, `readDistributorConfig`, el Distribuidor habría dejado de ser
    // sustituible por su contrato.
    const registros = [
      "src/features/automations/builder/tools/registry.ts",
      "src/features/automations/builder/tools/ui-registry.tsx"
    ].map((ruta) => readFileSync(ruta, "utf8"));

    for (const registro of registros) {
      const importes = [...registro.matchAll(/from\s+["']\.\/distributor\/([^"']+)["']/g)];

      // Cada registro importa exactamente su mitad, y nada más de dentro.
      expect(importes.map(([, modulo]) => modulo).sort()).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(definition|ui)$/)])
      );
      expect(importes).toHaveLength(1);
    }
  });
});

describe("independencia frente a las otras herramientas", () => {
  it("ningún módulo del Distribuidor importa de Mensaje ni de Esperar respuesta", () => {
    // La prueba de DOM vive en `DistributorNode.test.tsx`; esta mira el código,
    // que es donde el acoplamiento se introduce. Las tres herramientas comparten
    // el marco genérico y el contrato, y nada más.
    for (const modulo of MODULOS) {
      expect(
        fuenteSinComentarios(modulo),
        `${modulo} importa de otra herramienta`
      ).not.toMatch(/from\s+["'][^"']*tools\/(message|wait-response)/);
    }
  });
});

describe("la herramienta está bien declarada en el catálogo", () => {
  it("declara editor, cuerpo propio y sus propias salidas", () => {
    const ui = resolveToolUi("distributor");

    expect(ui.Editor).toBeDefined();
    expect(ui.CompactBody).toBeDefined();
    expect(ui.ownsOutputs).toBe(true);
  });

  it("declara resumen y validación en su definición", () => {
    const tool = resolveTool("distributor");

    expect(tool.summarize).toBeDefined();
    expect(tool.validateContent).toBeDefined();
    expect(tool.defaultConfig).toEqual({ outputs: [] });
  });

  it("sigue declarando que el motor todavía no sabe ejecutarla", () => {
    // Tener editor no es tener comportamiento: `DistributorNodeHandler` sigue
    // fallando con `distributor_executor_not_implemented`. Declararla ejecutable
    // por haber ganado configuración sería fingir capacidad.
    expect(resolveTool("distributor").executable).toBe(false);
  });

  it("su color no lo usa ninguna otra herramienta", () => {
    const tool = resolveTool("distributor");
    const otras = ["message", "question", "delay", "condition"].map(
      (tipo) => resolveTool(tipo).colors.header
    );

    expect(otras).not.toContain(tool.colors.header);
  });
});

describe("dark y light", () => {
  const hoja = readFileSync(`${RAIZ}/distributor-editor.css`, "utf8");

  it("el editor se pinta con tokens del tema, no con colores de un solo modo", () => {
    // Lo que hace que el editor funcione en los dos temas es apoyarse en la
    // paleta: si el fondo o el texto fueran un hex fijo, uno de los dos temas
    // quedaría ilegible.
    for (const token of ["--text", "--muted", "--border", "--surface-alt"]) {
      expect(hoja, `el editor no usa ${token}`).toContain(`var(${token})`);
    }
  });

  it("la identidad plateada se declara UNA vez y el resto la lee", () => {
    const declaraciones = [...hoja.matchAll(/^\s*--ds-(silver|steel):/gm)];

    expect(declaraciones).toHaveLength(2);
    expect(hoja).toMatch(/var\(--ds-steel\)/);
    expect(hoja).toMatch(/var\(--ds-silver\)/);
  });

  it("el plateado del editor es el mismo que publica la definición", () => {
    // Una segunda fuente de verdad para el color se notaría el día que uno de
    // los dos cambie: la cabecera del nodo y su editor dejarían de leerse como
    // la misma herramienta.
    const tool = resolveTool("distributor");

    expect(hoja).toContain(`--ds-silver: ${tool.colors.header};`);
    expect(hoja).toContain(`--ds-steel: ${tool.colors.body};`);
  });

  it("los estilos están acotados al tool: ningún selector suelto", () => {
    // Toda la hoja es global —así se empaqueta el CSS de este proyecto—, así
    // que el prefijo ES el aislamiento. Un selector de elemento o una clase sin
    // prefijo alcanzaría a nodos de otras herramientas.
    const selectores = [...hoja.matchAll(/^([^\s/@}][^{]*)\{/gm)].map(([, sel]) => sel.trim());

    expect(selectores.length).toBeGreaterThan(0);
    for (const selector of selectores) {
      expect(selector, `selector sin acotar: ${selector}`).toMatch(/^\.(distributor|ds-)/);
    }
  });
});
