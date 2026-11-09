import type { TaskKicker } from "../../domains/scheduling/application/ports/TaskPorts";

// ---------------------------------------------------------------------------
// Formas de despertar al trabajador de la cola cuando una tarea vence en
// segundos (no espera a la próxima ronda programada):
//
//   HttpTaskKicker       llama al endpoint del trabajador en una invocación
//                        NUEVA (tiempo completo de función). Producción.
//   InProcessTaskKicker  corre una ronda en el mismo proceso. Desarrollo, o
//                        cuando no hay dirección pública ni clave.
//
// Los dos agrupan avisos seguidos (`throttleMs`) y nunca lanzan.
// ---------------------------------------------------------------------------

type Background = (work: () => Promise<unknown>) => void;

export class HttpTaskKicker implements TaskKicker {
  private lastKick = 0;

  public constructor(
    private readonly runUrl: string,
    private readonly secret: string,
    private readonly background: Background,
    private readonly throttleMs = 3_000,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  public kick(): void {
    const now = Date.now();
    if (now - this.lastKick < this.throttleMs) return;
    this.lastKick = now;
    // El endpoint responde enseguida (202) y trabaja en su propia invocación.
    this.background(() =>
      this.fetchImpl(this.runUrl, { method: "POST", headers: { authorization: `Bearer ${this.secret}` }, signal: AbortSignal.timeout(10_000) }).catch(() => undefined)
    );
  }
}

export class InProcessTaskKicker implements TaskKicker {
  private running = false;
  private again = false;

  public constructor(
    private readonly runRound: () => Promise<unknown>,
    private readonly background: Background
  ) {}

  public kick(): void {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.background(async () => {
      try {
        do {
          this.again = false;
          await this.runRound();
        } while (this.again);
      } finally {
        this.running = false;
      }
    });
  }
}
