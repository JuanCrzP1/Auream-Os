// ---------------------------------------------------------------------------
// RoundRobinCounter — turnos compartidos entre conversaciones (Distribuidor).
//
// `next` devuelve el turno actual (0, 1, 2…) y avanza el contador, en UNA
// operación atómica: dos clientes que llegan a la vez nunca reciben el mismo
// turno. Por cuenta y por clave (flujo + bloque).
// ---------------------------------------------------------------------------

export interface RoundRobinCounter {
  next(tenantId: string, key: string): Promise<number>;
}
