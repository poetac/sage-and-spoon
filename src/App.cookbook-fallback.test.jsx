import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// Force the generated-recipe chunk to fail loading (flaky first-visit network).
// Everything else in meals.js stays real, so CORE_DB is the genuine core library.
vi.mock("./data/meals.js", async () => ({
  ...(await vi.importActual("./data/meals.js")),
  loadCookbook: vi.fn().mockRejectedValue(new Error("chunk failed")),
}));
import App from "./App.jsx";
import { store, K } from "./lib/storage.js";
import { EMPTY_PREFS } from "./data/meals.js";

beforeEach(() => store.clear(Object.values(K)));

describe("App — cookbook chunk fallback (TEST-3)", () => {
  it("falls back to the core recipes instead of hanging on the skeleton", async () => {
    store.set(K.prefs, EMPTY_PREFS);
    render(<App />);
    // Despite loadCookbook rejecting, the shell resolves on CORE_DB and the
    // planner renders (it would otherwise stay stuck on the loading skeleton).
    expect(await screen.findByText("No plan yet")).toBeInTheDocument();
  });
});
