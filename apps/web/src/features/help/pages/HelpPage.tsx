import "@shared/ui/page/page.css";
import "@shared/ui/controls/controls.css";
import { useSearchParams } from "react-router-dom";
import { HelpAdmin } from "../admin/HelpAdmin";
import { ArticleView } from "../article/ArticleView";
import { ModuleView } from "../article/ModuleView";
import { HelpHome } from "../home/HelpHome";
import { TutorialsView } from "../tutorials/TutorialsView";

/**
 * Centro de ayuda (`/help`): la portada, cada artículo (`?article=`), cada
 * módulo (`?module=`), los tutoriales (`?view=videos[&play=]`) y, para el
 * equipo de Auream, administrar (`?view=admin`).
 */
export function HelpPage() {
  const [params, setParams] = useSearchParams();
  const go = (next: Record<string, string>) => setParams(next);
  const article = params.get("article");
  const module = params.get("module");
  const view = params.get("view");

  if (article) return <ArticleView slug={article} onNavigate={go} />;
  if (module) return <ModuleView moduleId={module} onNavigate={go} />;
  if (view === "videos") return <TutorialsView play={params.get("play")} onNavigate={go} />;
  if (view === "admin") return <HelpAdmin onNavigate={go} />;
  return <HelpHome onNavigate={go} />;
}
