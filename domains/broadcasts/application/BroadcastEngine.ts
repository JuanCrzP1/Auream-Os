import type { Random } from "../domain/Pace";
import type { BusinessValues } from "../domain/Personalize";
import type {
  AudienceSource,
  BroadcastRepository,
  BroadcastResults,
  BroadcastSender,
  BroadcastTicker,
  FlowDirectory,
  NumberDirectory,
  OptOutStore,
  RecipientStore,
  TimezoneOf
} from "./BroadcastPorts";

// Todo lo que usan el arranque y el envío de las difusiones (una sola bolsa
// para que cada servicio no repita diez parámetros).
export interface BroadcastEngine {
  readonly broadcasts: BroadcastRepository;
  readonly recipients: RecipientStore;
  readonly audience: AudienceSource;
  readonly optOuts: OptOutStore;
  readonly results: BroadcastResults;
  readonly sender: BroadcastSender;
  readonly numbers: NumberDirectory;
  readonly flows: FlowDirectory;
  readonly ticker: BroadcastTicker;
  readonly timezoneOf: TimezoneOf;
  readonly now: () => Date;
  readonly random: Random;
  readonly newId: () => string;
  /** Datos del negocio (`{g_horario}`) para el texto. Ausente: quedan con su valor por defecto. */
  readonly business?: (tenantId: string) => Promise<BusinessValues>;
}
