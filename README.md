# Sage & Spoon 🌿

**Live app: [poetac.github.io/sage-and-spoon](https://poetac.github.io/sage-and-spoon/)**

A calm weekly meal planner for a household where the chef cooks for someone with **gestational diabetes (GD)**. Every meal — built-in or AI-generated — follows GD rules: low-GI carbs paired with protein/fat, per-meal carb caps, no added sugars, no juice, no white rice/bread.

> **Not medical advice.** Carb targets default to common GD guidance (≤30g breakfast, ≤45g lunch/dinner, ≤20g snacks) but are fully editable — follow your dietitian's numbers, always.

## What it does

- **Plan** — a real-date Mon–Sun grid with 6 slots/day (3 meals + AM/PM/bedtime snacks). Drag-and-drop on desktop, tap-to-move on touch. Swap any meal from the built-in cookbook, or ask Claude for a fresh idea.
- **Ingredients** — list what's in the kitchen; get GD-compliant meal suggestions ranked by ingredient overlap, with matched/missing chips and one-tap add-to-plan.
- **Shopping List** — auto-built from the week, grouped by aisle, scaled to your servings. Print, copy, or download.
- **Settings** — preferences quiz, carb targets, servings, API key, full reset.

First run shows a 3-step preference quiz (cuisines, proteins, vegetables, dislikes, allergies, textures, spice, cook time), then generates a starter week instantly. Allergies are hard-excluded everywhere.

It's an installable PWA — add it to your phone's home screen and the plan, cookbook, and shopping list keep working offline (the AI features still need a connection).

## Two modes

| | No API key | With a Claude API key |
|---|---|---|
| Weekly plan | Built from the 77-meal cookbook | "Generate Full Week" personalizes with Claude |
| Cookbook growth | Fixed library | "Grow cookbook" adds vetted AI meals permanently |
| Swaps | Cookbook swap | Cookbook swap **+** ✨ AI swap |
| Ingredient ideas | Cookbook matching | Tailored suggestions from Claude |

Everything works fully with no key. Add one in Settings to unlock the AI features.

**Security note:** the key is stored in `localStorage` and calls the Anthropic API directly from the browser (`anthropic-dangerous-direct-browser-access`). That's acceptable for personal, self-hosted use on your own devices — for anything more, route calls through a small backend proxy instead. Never commit a key to this repo.

## Quick start

```bash
npm install
npm run dev
```

Requires Node 20+. Tailwind v4 is compiled at build time via the `@tailwindcss/vite` plugin and imported in `src/styles.css` (`@import "tailwindcss"`) — no CDN script, no separate config file.

## Project shape

```
src/
  App.jsx          state, persistence, and composition
  styles.css       design tokens + component classes (Tailwind covers layout)
  data/meals.js    the 77-meal cookbook, quiz options, allergen/dislike maps
  lib/             pure logic: storage, dates, utils, planner, shopping, claude
  components/      primitives, MealCard, PrefsFields, Onboarding, and the four tabs
```

State persists to `localStorage` (`ss_*` keys) with an in-memory fallback for sandboxed contexts.

## License

[MIT](LICENSE)
