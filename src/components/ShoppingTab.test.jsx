import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingTab } from "./ShoppingTab.jsx";

const meal = {
  id: "m1", name: "Sheet-Pan Chicken", type: "dinner", carbsG: 35,
  ingredients: [
    { n: "chicken breast", q: 2, u: "lb", c: "Protein" },
    { n: "broccoli", q: 1, u: "head", c: "Produce" },
    { n: "salt", q: null, u: "", c: "Pantry" },
  ],
};
const plan = { weekStart: "2026-06-15", days: [{ dinner: "m1" }] };
const mealsById = { m1: meal };

function renderTab(overrides = {}) {
  const setSettings = vi.fn();
  const toastOk = vi.fn();
  const toastErr = vi.fn();
  const settings = { servings: 2, targets: { breakfastMax: 30, mainMax: 45, snackMax: 20 } };
  const utils = render(
    <ShoppingTab plan={plan} mealsById={mealsById} settings={settings}
      setSettings={setSettings} toastOk={toastOk} toastErr={toastErr} {...overrides} />,
  );
  return { ...utils, setSettings, toastOk, toastErr, settings };
}

describe("ShoppingTab", () => {
  it("lists each ingredient grouped with scaled quantities", () => {
    renderTab();
    // Category names also appear in the hidden print sheet (as <h2>), so scope
    // to the on-screen grid headings (<h3>).
    expect(screen.getByRole("heading", { level: 3, name: "Produce" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Protein" })).toBeInTheDocument();
    // qtyLabel renders "2 lb"; the name and quantity share a list item. The grid
    // copy comes before the print copy in the DOM.
    const chicken = screen.getAllByText("chicken breast")[0].closest("li");
    expect(chicken).toHaveTextContent("2 lb");
    // quantity-less ingredients fall back to the unit/"to taste" with no amount.
    expect(screen.getAllByText("salt")[0]).toBeInTheDocument();
  });

  it("reports the total item count in the header", () => {
    const { container } = renderTab();
    expect(container).toHaveTextContent("3 items from this week's plan");
  });

  it("strikes through an item when its checkbox is ticked", () => {
    renderTab();
    const checkbox = screen.getAllByRole("checkbox")[0];
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("clamps the servings stepper between 1 and 8", () => {
    const { setSettings } = renderTab({ settings: { servings: 1, targets: {} } });
    fireEvent.click(screen.getByRole("button", { name: "Fewer servings" }));
    expect(setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "More servings" }));
    expect(setSettings).toHaveBeenLastCalledWith(expect.objectContaining({ servings: 2 }));
  });

  it("copies the list to the clipboard and confirms with a toast", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const { toastOk } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: /Copy/ }));
    await vi.waitFor(() => expect(toastOk).toHaveBeenCalledWith("Shopping list copied"));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain("chicken breast");
  });

  it("renders nothing to buy as an empty grouping when there is no plan", () => {
    const { container } = renderTab({ plan: null });
    expect(container).toHaveTextContent("0 items from this week's plan");
  });

  it("marks an item as a pantry staple via its 'have it' button", () => {
    const onTogglePantry = vi.fn();
    renderTab({ onTogglePantry });
    fireEvent.click(screen.getByRole("button", { name: "Always have broccoli" }));
    expect(onTogglePantry).toHaveBeenCalledWith("broccoli");
  });

  it("hides pantry staples from the list and shows them in a restorable section", () => {
    const onTogglePantry = vi.fn();
    const { container } = renderTab({ pantry: ["broccoli"], onTogglePantry });
    // Dropped from the list (count falls from 3 to 2) and no Produce heading.
    expect(container).toHaveTextContent("2 items from this week's plan");
    expect(screen.queryByRole("heading", { level: 3, name: "Produce" })).toBeNull();
    // Listed in the staples section; tapping it puts it back.
    fireEvent.click(screen.getByRole("button", { name: "Stop always-having broccoli" }));
    expect(onTogglePantry).toHaveBeenCalledWith("broccoli");
  });
});
