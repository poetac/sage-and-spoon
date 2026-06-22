import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShoppingTab } from "./ShoppingTab.jsx";
import { store, K } from "../lib/storage.js";

// Edits persist to localStorage scoped to the week; reset between tests so one
// test's added/removed items can't leak into the next.
beforeEach(() => store.set(K.shoppingEdits, null));

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
    expect(container).toHaveTextContent("3 items ·");
  });

  it("strikes through an item when its checkbox is ticked", () => {
    renderTab();
    const checkbox = screen.getAllByRole("checkbox")[0];
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("keeps each added item's checked state with its own row after a mid-list removal", () => {
    renderTab();
    const add = (name) => {
      fireEvent.change(screen.getByLabelText("New item name"), { target: { value: name } });
      fireEvent.click(screen.getByRole("button", { name: /Add/ }));
    };
    add("almond flour");
    add("sparkling water");
    // Tick the first added item, then delete it.
    fireEvent.click(screen.getByText("almond flour"));
    expect(screen.getByText("almond flour")).toHaveStyle("text-decoration: line-through");
    fireEvent.click(screen.getByRole("button", { name: "Remove almond flour" }));
    // The survivor must NOT inherit the deleted row's struck-through state
    // (the array-index key bug would re-bind it to the now-vacated index 0).
    expect(screen.getByText("sparkling water")).not.toHaveStyle("text-decoration: line-through");
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
    expect(container).toHaveTextContent("0 items");
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
    expect(container).toHaveTextContent("2 items ·");
    expect(screen.queryByRole("heading", { level: 3, name: "Produce" })).toBeNull();
    // Listed in the staples section; tapping it puts it back.
    fireEvent.click(screen.getByRole("button", { name: "Stop always-having broccoli" }));
    expect(onTogglePantry).toHaveBeenCalledWith("broccoli");
  });

  it("persists removed items and restores them on remount for the same week", () => {
    store.set(K.shoppingEdits, null);
    const { unmount } = renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Remove chicken breast" }));
    expect(screen.getByText(/1 item removed/)).toBeInTheDocument();
    unmount();
    // Remount fresh: the removal is restored from storage (same weekStart).
    renderTab();
    expect(screen.getByText(/1 item removed/)).toBeInTheDocument();
    expect(screen.queryByText("chicken breast")).toBeNull();
  });

  it("persists a manually added item across remounts", () => {
    store.set(K.shoppingEdits, null);
    const { unmount } = renderTab();
    fireEvent.change(screen.getByLabelText("New item name"), { target: { value: "sparkling water" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    expect(screen.getByText("sparkling water")).toBeInTheDocument();
    unmount();
    renderTab();
    expect(screen.getByText("sparkling water")).toBeInTheDocument();
  });

  it("ignores edits saved for a different week", () => {
    store.set(K.shoppingEdits, { weekStart: "1999-01-01", removed: ["chicken breast|lb"], extra: ["soda"] });
    renderTab();
    expect(screen.queryByText(/removed from this list/)).toBeNull();
    expect(screen.getAllByText("chicken breast").length).toBeGreaterThan(0);
    expect(screen.queryByText("soda")).toBeNull();
  });
});
