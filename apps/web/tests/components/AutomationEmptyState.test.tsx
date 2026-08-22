import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AutomationEmptyState } from "../../src/features/automations/list/components/AutomationEmptyState";

function renderComponent(onCreateFlow = vi.fn()) {
  return render(
    <MemoryRouter>
      <AutomationEmptyState onCreateFlow={onCreateFlow} />
    </MemoryRouter>
  );
}

describe("AutomationEmptyState", () => {
  it("renders the empty state title", () => {
    renderComponent();
    expect(screen.getByText(/sin automatizaciones/i)).toBeInTheDocument();
  });

  it("renders the CTA button", () => {
    renderComponent();
    expect(screen.getByRole("button", { name: /nueva automatización/i })).toBeInTheDocument();
  });

  it("calls onCreateFlow when CTA is clicked", async () => {
    const fn = vi.fn();
    renderComponent(fn);
    await userEvent.click(screen.getByRole("button", { name: /nueva automatización/i }));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("renders descriptive body text", () => {
    renderComponent();
    expect(screen.getByText(/crea tu primera automatización/i)).toBeInTheDocument();
  });
});
