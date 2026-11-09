// ---------------------------------------------------------------------------
// Valor de una compra escrito como lo escribe la gente (o como llega en una
// variable): «49900», «49.900», «$ 49.900», «1.234,50», «49,90», «12.5 USD».
//
// Regla de separadores, pensada para Latinoamérica:
//   · con «.» y «,» a la vez → el ÚLTIMO es el decimal
//   · un solo tipo, repetido → separador de miles («1.234.567»)
//   · un solo tipo, una vez, seguido de exactamente 3 dígitos → miles
//     («49.900» = 49900); si no → decimal («49.9», «10,50»)
// Devuelve `null` si no es un número positivo. Pura.
// ---------------------------------------------------------------------------

export function parseAmount(raw: string): number | null {
  const text = raw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(text) || text.includes("-")) return null;

  const dots = (text.match(/\./g) ?? []).length;
  const commas = (text.match(/,/g) ?? []).length;
  let normalized: string;

  if (dots > 0 && commas > 0) {
    const decimal = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    normalized = text.split(thousands).join("").replace(decimal, ".");
  } else if (dots + commas === 0) {
    normalized = text;
  } else {
    const separator = dots > 0 ? "." : ",";
    const count = dots + commas;
    const after = text.slice(text.lastIndexOf(separator) + 1);
    normalized = count > 1 || after.length === 3 ? text.split(separator).join("") : text.replace(separator, ".");
  }

  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}
