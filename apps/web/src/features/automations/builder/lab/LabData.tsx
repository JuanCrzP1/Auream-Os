import "./lab-data.css";
import { fieldValueText } from "@contracts/FieldValues";
import type { SimulationPersona } from "@contracts/SimulationContracts";

/** Como lo lee una persona («Sí», «13/11/1990»); lo que no es un dato simple, en JSON. */
const show = (value: unknown) => (typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? fieldValueText(value) : JSON.stringify(value));

/**
 * Los datos de la prueba: el cliente de prueba tal como quedó (etiquetas y
 * campos que le pusieron los bloques) y las variables de la conversación.
 */
export function LabData({ persona, variables }: { readonly persona: SimulationPersona; readonly variables: Readonly<Record<string, unknown>> }) {
  const fields = Object.entries(persona.fields);
  const vars = Object.entries(variables);
  return (
    <div className="lab-data">
      <section aria-labelledby="lab-data-contact">
        <h3 id="lab-data-contact" className="lab-data__title">Cliente de prueba</h3>
        <dl className="lab-data__list">
          <div>
            <dt>Nombre</dt>
            <dd>{persona.name}</dd>
          </div>
          <div>
            <dt>Teléfono</dt>
            <dd>+{persona.phone}</dd>
          </div>
          {persona.email ? (
            <div>
              <dt>Correo</dt>
              <dd>{persona.email}</dd>
            </div>
          ) : null}
          <div>
            <dt>Etiquetas</dt>
            <dd>{persona.tags.length ? <span className="lab-data__tags">{persona.tags.map((tag) => <span key={tag} className="lab-data__tag">{tag}</span>)}</span> : "Ninguna"}</dd>
          </div>
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{show(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="lab-data-vars">
        <h3 id="lab-data-vars" className="lab-data__title">Variables de la conversación</h3>
        {vars.length ? (
          <dl className="lab-data__list">
            {vars.map(([key, value]) => (
              <div key={key}>
                <dt>{`{${key}}`}</dt>
                <dd>{show(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="lab-data__empty">Todavía ningún bloque guardó datos.</p>
        )}
      </section>
    </div>
  );
}
