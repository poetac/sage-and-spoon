import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrefsFields } from "./PrefsFields.jsx";
import { EMPTY_PREFS } from "../data/meals.js";

// PrefsFields is controlled — it only emits patches via `set`. This harness
// merges them back in so multi-step interactions (toggle, then assert) behave
// like they do inside SettingsTab / Onboarding.
function Harness({ step = 0, initial = EMPTY_PREFS, onChange }) {
  const [prefs, setPrefs] = useState(initial);
  const set = (patch) => setPrefs((p) => { const next = { ...p, ...patch }; onChange?.(next); return next; });
  return <PrefsFields step={step} prefs={prefs} set={set} />;
}

describe("PrefsFields", () => {
  it("toggles a multi-select chip on and off (step 0)", () => {
    const onChange = vi.fn();
    render(<Harness step={0} onChange={onChange} />);
    const italian = screen.getByRole("button", { name: "Italian" });
    expect(italian).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(italian);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cuisines: ["Italian"] }));
    expect(italian).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(italian);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ cuisines: [] }));
    expect(italian).toHaveAttribute("aria-pressed", "false");
  });

  it("renders single-select fields and reports the chosen value (step 2)", () => {
    const onChange = vi.fn();
    render(<Harness step={2} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ spice: "Bold" }));
  });

  it("filters the ingredient vocabulary and bans a match (step 1)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness step={1} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/Type to search ingredients/);
    await user.type(input, "quinoa");
    // "quinoa" is a single, exact entry in the vocabulary — one suggestion chip.
    const match = await screen.findByRole("button", { name: "quinoa" });
    await user.click(match);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ bannedIngredients: ["quinoa"] }),
    );
  });

  it("bans a free-text term that isn't in the vocabulary", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness step={1} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/Type to search ingredients/);
    await user.type(input, "rutabaga{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ bannedIngredients: ["rutabaga"] }),
    );
  });

  it("removes a previously banned ingredient when its chip is tapped", () => {
    const onChange = vi.fn();
    render(<Harness step={1} initial={{ ...EMPTY_PREFS, bannedIngredients: ["beets"] }} onChange={onChange} />);
    const remove = screen.getByRole("button", { name: "Allow beets again" });
    fireEvent.click(remove);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ bannedIngredients: [] }));
  });

  it("edits the free-text dislike field (step 1)", () => {
    const onChange = vi.fn();
    render(<Harness step={1} onChange={onChange} />);
    const field = screen.getByPlaceholderText(/Other dislikes/);
    fireEvent.change(field, { target: { value: "eggplant" } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ dislikeText: "eggplant" }));
  });

  it("scopes allergy chips to the allergies group (step 1)", () => {
    const onChange = vi.fn();
    render(<Harness step={1} onChange={onChange} />);
    // "Eggs" is an allergy option; click it and confirm it lands in allergies.
    const eggs = within(screen.getByText("Allergies").parentElement).getByRole("button", { name: "Eggs" });
    fireEvent.click(eggs);
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ allergies: ["Eggs"] }));
  });
});
