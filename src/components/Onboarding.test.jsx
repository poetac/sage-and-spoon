import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Onboarding } from "./Onboarding.jsx";

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
    );
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
