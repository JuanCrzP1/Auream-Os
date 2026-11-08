import { describe, expect, it } from "vitest";
import { canonicalRedirectTarget } from "../../src/shared/config/canonicalOrigin";

// ---------------------------------------------------------------------------
// Una sola dirección oficial: entrar por una dirección técnica de Vercel lleva
// a la oficial conservando la ruta. Sin dirección oficial (desarrollo, vistas
// previas), no se toca nada.
// ---------------------------------------------------------------------------

const at = (href: string) => {
  const url = new URL(href);
  return { origin: url.origin, pathname: url.pathname, search: url.search, hash: url.hash };
};
const OFFICIAL = "https://auream-os.vercel.app";

describe("canonicalRedirectTarget", () => {
  it.each([
    ["https://auream-lllns1a48-juancrz.vercel.app/login", `${OFFICIAL}/login`],
    ["https://auream-os-git-main-juancrz.vercel.app/automations?x=1#a", `${OFFICIAL}/automations?x=1#a`],
    ["https://auream-os-juancrz.vercel.app/", `${OFFICIAL}/`]
  ])("%s → %s", (href, target) => {
    expect(canonicalRedirectTarget(at(href), OFFICIAL)).toBe(target);
  });

  it("en la dirección oficial no redirige", () => {
    expect(canonicalRedirectTarget(at(`${OFFICIAL}/contacts`), OFFICIAL)).toBeNull();
  });

  it("sin dirección oficial (desarrollo, vistas previas) no redirige", () => {
    expect(canonicalRedirectTarget(at("http://localhost:5173/login"), undefined)).toBeNull();
    expect(canonicalRedirectTarget(at("http://localhost:5173/login"), "no es una url")).toBeNull();
  });
});
