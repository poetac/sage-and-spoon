import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MealDetail } from "./MealDetail.jsx";
import { CookbookTab } from "./CookbookTab.jsx";
import { EMPTY_PREFS } from "../data/meals.js";

expect.extend(toHaveNoViolations);

const meal = {
  id: "b2", name: "Greek Yogurt Berry Parfait", type: "breakfast", carbsG: 22, gi: "Low",
  prepMins: 5, cuisineTag: "Mediterranean", proteinTag: "Greek yogurt",
  proteinG: 20, fatG: 8, fiberG: 5,
  ingredients: [
    { n: "plain Greek yogurt", q: 2, u: "cup", c: "Dairy" },
    { n: "blueberries", q: 1, u: "cup", c: "Produce" },
  ],
  steps: ["Layer yogurt and berries.", "Top with seeds."],
};

// These render as embedded components; the app shell owns the page landmark/h1,
// so skip the document-structure rules (as the Onboarding smoke does) and keep
// the meaningful name/role/aria checks.
const OPTS = {
  rules: {
    region: { enabled: false },
    "landmark-one-main": { enabled: false },
    "page-has-heading-one": { enabled: false },
  },
};

describe("MealDetail — accessibility smoke", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <MealDetail meal={meal} servings={2} onClose={vi.fn()} isFavorite={false}
        onToggleFavorite={vi.fn()} note="" onSetNote={vi.fn()} userPhotos={[]}
        onAddPhoto={vi.fn()} onRemovePhoto={vi.fn()} canDelete={false} onDelete={vi.fn()} />,
    );
    expect(await axe(container, OPTS)).toHaveNoViolations();
  });
});

describe("CookbookTab — accessibility smoke", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <CookbookTab allMeals={[meal]} prefs={EMPTY_PREFS} favorites={[]} onToggleFavorite={vi.fn()}
        onPlace={vi.fn()} onDetails={vi.fn()} inWeek={new Set()} notedIds={new Set()}
        hiddenIds={[]} onToggleHidden={vi.fn()} />,
    );
    expect(await axe(container, OPTS)).toHaveNoViolations();
  });
});
