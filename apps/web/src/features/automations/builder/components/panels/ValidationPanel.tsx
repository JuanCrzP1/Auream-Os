import "./panel-shell.css";
import "./validation-panel.css";
import type { BuilderValidationReport } from "@features/automations/builder/services/validateCanvasGraph";

interface ValidationPanelProps {
  report: BuilderValidationReport;
}

export function ValidationPanel({ report }: ValidationPanelProps) {
  return (
    <section className="sidebar-panel">
      <div className="sidebar-panel__header">
        <p>Validación</p>
        <span>{report.errors.length} errores · {report.warnings.length} avisos</span>
      </div>
      <div className="validation-block">
        <h3>Errores</h3>
        {report.errors.length === 0 ? (
          <p className="status-good">Sin errores bloqueantes.</p>
        ) : (
          <ul>
            {report.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="validation-block">
        <h3>Warnings</h3>
        {report.warnings.length === 0 ? (
          <p className="status-good">Sin warnings estructurales.</p>
        ) : (
          <ul>
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}