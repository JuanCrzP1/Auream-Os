import type { ComponentType } from "react";
import type { NodeType } from "@contracts/FlowSnapshot";
import type { NodePatch } from "../services/applyNodePatch";

/**
 * Contrato visual de una herramienta: su mitad React.
 *
 * POR QUÉ EXISTE SEPARADO DE `ToolDefinition`
 *
 * `registry.ts` es puro y lo ejecuta `tests/contract/toolRegistryParity.test.ts`
 * en un entorno Node sin React, cuyo `resolve.extensions` es `[".ts", ".js"]`:
 * ahí un `.tsx` ni siquiera se resuelve. Un componente dentro de
 * `ToolDefinition` rompería esa cadena, y con ella la paridad entre el catálogo
 * del builder y la validación del backend.
 *
 * Por eso la identidad de una herramienta se declara en dos mitades y NO en dos
 * mapas: `definition.ts` (pura — tipo, etiqueta, colores, ejecutabilidad) y
 * `ui.tsx` (React — icono, forma, cuerpos). Cada mitad tiene su barril, y un
 * test de paridad falla si una herramienta aparece en una y no en la otra.
 *
 * La extensión `.tsx` de los módulos de UI no es cosmética: es la barrera. Si
 * alguien importa `ui.tsx` desde la cadena pura, el test raíz falla al no poder
 * resolverlo, en lugar de romperse mucho más tarde y lejos.
 *
 * LO QUE NO ENTRA AQUÍ
 *
 * Nada de negocio: ni ejecución, ni validación, ni acceso al lienzo, al grafo,
 * al snapshot o al motor. Esto describe cómo SE VE y SE CONFIGURA una
 * herramienta, no lo que hace.
 */

// ---------------------------------------------------------------------------
// Forma y tamaño
// ---------------------------------------------------------------------------

/**
 * Silueta del nodo en reposo.
 *
 * La forma comunica la CLASE de cosa que hace el nodo, no la herramienta
 * concreta: trece siluetas distintas serían una colección, no un sistema.
 *
 *   card     envía o pide algo y continúa
 *   diamond  decide por dónde sigue el flujo
 *   circle   actúa sobre algo externo y continúa
 *   pill     nodo de sistema: entrada y cierre del flujo
 *
 * Ampliar el catálogo es añadir un miembro aquí y su clase en la hoja de
 * marcos. No hay ningún mapa de componentes que actualizar: la forma es un
 * dato, no un componente.
 */
export type ToolFrame = "card" | "diamond" | "circle" | "pill";

/** Escalón de tamaño del nodo en reposo. Lo resuelve el marco. */
export type ToolSize = "sm" | "md" | "lg";

// ---------------------------------------------------------------------------
// Props de los cuerpos que aporta una herramienta
// ---------------------------------------------------------------------------

/**
 * Lo que el usuario ha configurado en un nodo, tal y como lo ve su herramienta.
 *
 * Se deriva de `NodePatch` en lugar de redeclararse para que el contrato de
 * lectura y el de escritura no puedan divergir: lo que el editor recibe es
 * exactamente lo que el editor puede cambiar.
 */
export type ToolDraft = Required<NodePatch>;

/** Cuerpo del nodo en reposo. Solo lee: en compacto no se configura nada. */
export interface ToolCompactProps {
  readonly draft: ToolDraft;
}

/**
 * Editor de la herramienta, dentro del nodo expandido.
 *
 * Recibe los datos y una devolución de llamada explícita. NO recibe el nodo,
 * ni el lienzo, ni React Flow, ni el snapshot, ni el motor: un editor que no
 * puede tocar el grafo no puede convertirse en un mini-builder por muy rica que
 * llegue a ser su configuración interna. La modularidad se sostiene en este
 * contrato, no en la disciplina de quien lo implemente.
 */
export interface ToolEditorProps {
  readonly draft: ToolDraft;
  readonly onChange: (patch: NodePatch) => void;
}

// ---------------------------------------------------------------------------
// El contrato
// ---------------------------------------------------------------------------

export interface ToolUi {
  /** Tipo canónico. Va DENTRO del objeto, no como clave de un mapa: así no
   *  puede desincronizarse de la herramienta que describe. */
  readonly type: NodeType;

  /** Icono de la paleta y de la cabecera del nodo. */
  readonly Icon: ComponentType;

  /** Silueta en reposo. */
  readonly frame: ToolFrame;

  /** Tamaño en reposo. Ausente: lo decide el marco. */
  readonly size?: ToolSize;

  /**
   * Cuerpo propio en reposo. Ausente: el cascarón pinta el cuerpo genérico.
   * Opcional a propósito — una herramienta sin nada que mostrar en compacto no
   * debe verse obligada a escribir un componente vacío.
   */
  readonly CompactBody?: ComponentType<ToolCompactProps>;

  /**
   * Editor propio. Ausente: el cascarón cae al formulario declarativo, y si
   * tampoco lo hay, al aviso de «sin configuración».
   */
  readonly Editor?: ComponentType<ToolEditorProps>;

  /**
   * La herramienta dibuja SUS PROPIAS salidas y el cascarón no pone ninguna.
   *
   * Por defecto —ausente o `false`— `FlowNodeCard` pinta un único `Handle` de
   * origen a la derecha del nodo, que es lo que necesitan las herramientas de
   * un solo camino: las trece que hay hoy salvo una.
   *
   * `true` es para una herramienta con VARIOS resultados posibles, donde cada
   * salida necesita su propio handle, su rótulo y su sitio dentro de una
   * composición que solo la herramienta conoce. El cascarón no puede colocar
   * eso: no sabe cuántas salidas hay —en Esperar respuesta dependen de la
   * configuración del nodo— ni junto a qué texto va cada una. Así que se
   * aparta, y la herramienta monta los `Handle` que quiera dentro de su
   * `CompactBody`.
   *
   * Lo que el cascarón sigue poniendo siempre es el handle de ENTRADA: recibir
   * conexiones es igual para todas y ninguna herramienta lo decide.
   *
   * Es una bandera, no un componente ni una lista: el cascarón solo necesita
   * saber si debe callarse. Cómo se ven y dónde van esas salidas no le
   * concierne, y por eso no hay aquí ningún mapa de handles que mantener.
   */
  readonly ownsOutputs?: boolean;
}
