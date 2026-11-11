import { Link } from "react-router-dom";
import type { OnboardingStep } from "@contracts/HelpContracts";

/** «Empieza aquí»: los pasos esenciales; cada uno se marca solo cuando Auream ve que ya lo hiciste. */
export function StartChecklist({ steps }: { readonly steps: ReadonlyArray<OnboardingStep> }) {
  const done = steps.filter((step) => step.done).length;
  if (steps.length === 0) return null;
  return (
    <section className="help-start" aria-label="Empieza aquí">
      <div className="help-start__intro">
        <h2>{done === steps.length ? "¡Ya tienes todo listo!" : "Empieza aquí"}</h2>
        <p>Lo esencial para vender por WhatsApp con Auream. Cada paso se marca solo cuando lo haces.</p>
        <span className="help-start__bar" aria-hidden="true"><span style={{ width: `${Math.round((done / steps.length) * 100)}%` }} /></span>
        <strong>{done} de {steps.length} listos</strong>
      </div>
      <ol className="help-start__steps">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link to={step.path} className={step.done ? "help-start__step help-start__step--done" : "help-start__step"}>
              <span className="help-start__check" aria-hidden="true">{step.done ? "✓" : index + 1}</span>
              <span><strong>{step.title}</strong><small>{step.done ? "Listo" : step.detail}</small></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
