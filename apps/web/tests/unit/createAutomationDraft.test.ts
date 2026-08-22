import { describe, it, expect } from "vitest";
import { createAutomationDraft } from "../../src/features/automations/list/services/createAutomationDraft";

describe("createAutomationDraft", () => {
  it("returns a string", () => {
    expect(typeof createAutomationDraft()).toBe("string");
  });

  it("returns a UUID v4 format", () => {
    const id = createAutomationDraft();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("returns a unique id each call", () => {
    const a = createAutomationDraft();
    const b = createAutomationDraft();
    expect(a).not.toBe(b);
  });
});
