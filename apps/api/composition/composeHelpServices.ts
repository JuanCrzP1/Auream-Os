import { randomUUID } from "node:crypto";
import { HelpServices } from "../../../domains/help/application/HelpServices";
import { SupportServices } from "../../../domains/help/application/SupportServices";
import { TutorialServices } from "../../../domains/help/application/TutorialServices";
import { MarkdownArticleLibrary } from "../../../infrastructure/help/MarkdownArticleLibrary";
import type { SqlClient } from "../../../infrastructure/persistence/sql/SqlClient";
import { SqlHelpTutorials } from "../../../infrastructure/persistence/sql/SqlHelpTutorials";
import { SqlOnboardingProbe } from "../../../infrastructure/persistence/sql/SqlOnboardingProbe";
import { SqlSupport } from "../../../infrastructure/persistence/sql/SqlSupport";
import type { HelpRoutes } from "../routes/routeHelpRequest";

// ---------------------------------------------------------------------------
// composeHelpServices — Ayuda: los artículos salen del repositorio
// (`content/help`, una sola fuente para la app, el MCP y `llms.txt`); los
// tutoriales, el soporte y las opiniones, de PostgreSQL.
// ---------------------------------------------------------------------------

export function composeHelpServices(sql: SqlClient): HelpRoutes {
  const support = new SqlSupport(sql);
  const tutorials = new TutorialServices(new SqlHelpTutorials(sql), randomUUID);
  return {
    help: new HelpServices(new MarkdownArticleLibrary(), tutorials, support, new SqlOnboardingProbe(sql), support),
    tutorials,
    support: new SupportServices(support, randomUUID)
  };
}
