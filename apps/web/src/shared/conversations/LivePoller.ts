// ---------------------------------------------------------------------------
// LivePoller — «en vivo» sin conexiones abiertas (las funciones de Vercel no
// las mantienen): consulta una y otra vez, con estas reglas:
//
//   · una consulta a la vez (si piden otra mientras corre, va al terminar)
//   · más seguido mientras hay movimiento (`activeMs`), en calma más espaciado
//     (`idleMs`); el movimiento dura `activeWindowMs` desde el último cambio
//   · con la pestaña oculta no consulta; al volver, consulta enseguida
//
// `tick` hace la consulta y dice si algo cambió. No sabe de React ni de HTTP.
// ---------------------------------------------------------------------------

export interface LivePollerTiming {
  readonly activeMs: number;
  readonly idleMs: number;
  readonly activeWindowMs: number;
}

/** Lo que el poller usa del navegador (en pruebas, un reloj falso). */
export interface PollerEnvironment {
  now(): number;
  hidden(): boolean;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  /** Avisa cuando la pestaña se oculta o vuelve; devuelve cómo dejar de escuchar. */
  onVisibilityChange(listener: () => void): () => void;
}

export const browserEnvironment: PollerEnvironment = {
  now: () => Date.now(),
  hidden: () => typeof document !== "undefined" && document.visibilityState === "hidden",
  setTimeout: (run, ms) => window.setTimeout(run, ms),
  clearTimeout: (handle) => window.clearTimeout(handle as number),
  onVisibilityChange: (listener) => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }
};

export class LivePoller {
  private timer: unknown = null;
  private running = false;
  private again = false;
  private stopped = true;
  private activeUntil = 0;
  private unsubscribe: () => void = () => undefined;

  public constructor(
    private readonly tick: () => Promise<boolean>,
    private readonly timing: LivePollerTiming,
    private readonly env: PollerEnvironment = browserEnvironment
  ) {}

  public start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.unsubscribe = this.env.onVisibilityChange(() => (this.env.hidden() ? this.clear() : void this.run()));
    void this.run();
  }

  public stop(): void {
    this.stopped = true;
    this.clear();
    this.unsubscribe();
  }

  /** Consulta ya y entra en movimiento (p. ej. tras enviar algo o lanzar un flujo). */
  public nudge(): void {
    this.activeUntil = this.env.now() + this.timing.activeWindowMs;
    void this.run();
  }

  private async run(): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.clear();
    this.running = true;
    try {
      if (await this.tick()) this.activeUntil = this.env.now() + this.timing.activeWindowMs;
    } catch {
      // Un fallo suelto no detiene el vivo: se reintenta en la próxima vuelta.
    } finally {
      this.running = false;
    }
    if (this.again) {
      this.again = false;
      return this.run();
    }
    this.schedule();
  }

  private schedule(): void {
    if (this.stopped || this.env.hidden()) return;
    const delay = this.env.now() < this.activeUntil ? this.timing.activeMs : this.timing.idleMs;
    this.timer = this.env.setTimeout(() => void this.run(), delay);
  }

  private clear(): void {
    if (this.timer === null) return;
    this.env.clearTimeout(this.timer);
    this.timer = null;
  }
}
