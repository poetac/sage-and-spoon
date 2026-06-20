import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { Onboarding } from "./Onboarding.jsx";

expect.extend(toHaveNoViolations);

describe("Onboarding — accessibility smoke (TEST-8)", () => {
  it("has no axe violations on the first step", async () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    // Onboarding renders standalone (the app shell provides the page-level
    // landmark/h1), so skip the document-structure rules that don't apply to an
    // isolated component and keep the meaningful label/name/aria checks.
    const results = await axe(container, {
      rules: {
        region: { enabled: false },
        "landmark-one-main": { enabled: false },
        "page-has-heading-one": { enabled: false },
      },
    });
    expect(results).toHaveNoViolations();
  });
});

describe("Onboarding", () => {
  it("walks the three quiz steps and returns the collected prefs", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    // Step 0 — Back is hidden, so it's absent from the accessibility tree
    expect(screen.getByText("The good stuff")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Italian" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 1
    expect(screen.getByText("The no-thank-yous")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    // Step 2 — final step swaps "Next" for "Plan my week"
    expect(screen.getByText("How meals should feel")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plan my week" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ cuisines: ["Italian"] }),
      [], // no starter meals offered → no favorites chosen
    );
  });

  it("offers a starter-favorites step when meals are provided", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const starterMeals = [{ id: "b1", name: "Veggie Scramble" }, { id: "l1", name: "Cobb Salad" }];
    render(<Onboarding onDone={onDone} starterMeals={starterMeals} />);

    // Three quiz steps now precede the favorites step, so "Next" three times.
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByText("Any of these sound good?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Veggie Scramble" }));
    await user.click(screen.getByRole("button", { name: "Plan my week" }));

    expect(onDone).toHaveBeenCalledWith(expect.any(Object), ["b1"]);
  });

  it("keeps selections when navigating back", async () => {
    const user = userEvent.setup();
    render(<Onboarding onDone={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Italian" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.getByRole("button", { name: "Italian" })).toHaveAttribute("aria-pressed", "true");
  });
});
