import type { AttentionDashboardResponse, ConnectionAttention } from "../../../contracts/AttentionContracts";
import type { DashboardFilters } from "../../../contracts/DashboardContracts";
import { CurrencyConverter, type FxRates } from "./CurrencyConverter";
import { change, periodOf, previousPeriod, type Period } from "./DashboardPeriod";
import { DashboardScopeResolver } from "./DashboardScopeResolver";
import { MoneyBook, mostUsedCurrency, round } from "./MoneyBook";

// ---------------------------------------------------------------------------
// Dashboard › Atención: cuántos escriben, cuántos atiende un asesor y cuántos
// solo el bot, en cuánto responden, cuándo escriben (mapa de calor) y cómo le
// va a cada asesor (lo que atiende Y lo que vende). Solo lee.
// ---------------------------------------------------------------------------

export interface ChatCounts {
  readonly leads: number;
  readonly attended: number;
  readonly botOnly: number;
  readonly firstResponseMinutes: number | null;
}

export interface AgentActivity {
  readonly userId: string;
  readonly name: string;
  readonly attended: number;
  readonly messages: number;
  readonly responseMinutes: number | null;
}

export interface AgentSale {
  readonly userId: string;
  readonly day: string;
  readonly currency: string;
  readonly amount: number;
  readonly count: number;
}

export interface AttentionReader {
  chats(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined): Promise<ChatCounts>;
  waiting(tenantId: string, connectionIds: ReadonlyArray<string> | undefined): Promise<{ count: number; oldestAt: string | null }>;
  /** [lunes=0..domingo=6][bloque de 2 h] → chats nuevos. */
  heatmap(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined, timezone: string): Promise<number[][]>;
  agents(tenantId: string, period: Period, connectionIds: ReadonlyArray<string> | undefined): Promise<ReadonlyArray<AgentActivity>>;
  agentSales(tenantId: string, period: Period, timezone: string): Promise<ReadonlyArray<AgentSale>>;
  connections(tenantId: string, period: Period): Promise<ReadonlyArray<ConnectionAttention>>;
}

export class AttentionDashboardService {
  public constructor(
    private readonly reader: AttentionReader,
    private readonly fx: FxRates,
    private readonly timezoneOf: (tenantId: string) => Promise<string>,
    private readonly now: () => Date = () => new Date(),
    /** Resuelve la línea de venta y los números elegidos. */
    private readonly scopes: DashboardScopeResolver = new DashboardScopeResolver()
  ) {}

  public async overview(tenantId: string, filters: DashboardFilters): Promise<AttentionDashboardResponse> {
    const timezone = await this.timezoneOf(tenantId);
    const period = periodOf(filters.from, filters.to, timezone, this.now());
    const before = previousPeriod(period, timezone);
    const { connectionIds } = await this.scopes.resolve(tenantId, filters);
    await this.fx.refresh();
    const [current, previous, waiting, heatmap, agents, sales, connections, rates] = await Promise.all([
      this.reader.chats(tenantId, period, connectionIds),
      this.reader.chats(tenantId, before, connectionIds),
      this.reader.waiting(tenantId, connectionIds),
      this.reader.heatmap(tenantId, period, connectionIds, timezone),
      this.reader.agents(tenantId, period, connectionIds),
      this.reader.agentSales(tenantId, period, timezone),
      this.reader.connections(tenantId, period),
      this.fx.table(period.fromDay, period.toDay)
    ]);
    const converter = new CurrencyConverter(rates);
    const book = new MoneyBook(converter, mostUsedCurrency(sales.filter((sale) => converter.has(sale.currency))) ?? mostUsedCurrency(sales) ?? "USD");
    let peak: AttentionDashboardResponse["peak"] = null;
    heatmap.forEach((row, weekday) => row.forEach((chats, block) => {
      if (chats > 0 && (!peak || chats > peak.chats)) peak = { weekday, hour: block * 2, chats };
    }));

    return {
      currency: book.currency,
      leads: { value: current.leads, previous: previous.leads, change: change(current.leads, previous.leads) },
      attendedByAgents: { value: current.attended, previous: previous.attended, change: change(current.attended, previous.attended) },
      botOnly: current.botOnly,
      unanswered: waiting.count,
      oldestWaitingAt: waiting.oldestAt,
      firstResponseMinutes: current.firstResponseMinutes,
      previousFirstResponseMinutes: previous.firstResponseMinutes,
      heatmap,
      peak,
      agents: agents
        .map((agent) => {
          const mine = sales.filter((sale) => sale.userId === agent.userId);
          return { ...agent, sales: mine.reduce((sum, sale) => sum + sale.count, 0), revenue: round(book.sum(mine, (sale) => ({ amount: sale.amount, currency: sale.currency, day: sale.day }))) };
        })
        .sort((a, b) => b.revenue - a.revenue || b.attended - a.attended),
      connections
    };
  }
}
