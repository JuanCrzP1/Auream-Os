import type { FlowSnapshot } from "../../../contracts/FlowSnapshot.js";

/**
 * Fixture: flujo válido de captura de leads.
 *
 * Estructura:
 *   entry (message) → question-name (question) → capture-name (capture) → end
 *
 * Todos los nodos existen, todos los edges son válidos, question tiene fallback.
 */
export const validLeadCaptureFlow: FlowSnapshot = {
  flow: {
    id: "flow-lead-capture",
    tenantId: "tenant-test",
    key: "lead-capture",
    name: "Lead Capture",
    currentPublishedVersionId: "v1"
  },
  version: {
    id: "v1",
    tenantId: "tenant-test",
    flowId: "flow-lead-capture",
    versionNumber: 1,
    status: "published",
    entryNodeId: "node-entry"
  },
  nodes: {
    "node-entry": {
      id: "node-entry",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Bienvenida",
      content: { text: "¡Hola! ¿Cuál es tu nombre?" },
      config: {},
      metadata: {}
    },
    "node-question": {
      id: "node-question",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "question",
      name: "Pregunta nombre",
      content: { text: "Por favor escribe tu nombre." },
      // La captura de la respuesta la hace ahora el propio nodo `question`
      // mediante `targetKey`. Antes existía un nodo `capture` separado.
      config: { targetKey: "context.name" },
      metadata: {}
    },
    "node-capture": {
      id: "node-capture",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "message",
      name: "Confirmación de captura",
      content: { text: "Nombre registrado." },
      config: {},
      metadata: {}
    },
    "node-end": {
      id: "node-end",
      tenantId: "tenant-test",
      flowVersionId: "v1",
      type: "end",
      name: "Fin",
      content: { text: "Gracias, {{context.name}}." },
      config: {},
      metadata: {}
    }
  },
  edgesBySource: {
    "node-entry": [
      {
        id: "edge-entry-question",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-entry",
        toNodeId: "node-question",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ],
    "node-question": [
      {
        id: "edge-question-capture",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-question",
        toNodeId: "node-capture",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      },
      {
        id: "edge-question-fallback",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-question",
        toNodeId: "node-end",
        priority: 99,
        isFallback: true,
        condition: { operator: "always" }
      }
    ],
    "node-capture": [
      {
        id: "edge-capture-end",
        tenantId: "tenant-test",
        flowVersionId: "v1",
        fromNodeId: "node-capture",
        toNodeId: "node-end",
        priority: 0,
        isFallback: false,
        condition: { operator: "always" }
      }
    ]
  }
};
