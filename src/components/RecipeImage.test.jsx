import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The component reads the library map by id; mock it so we can drive both the
// photo path and the generated-thumbnail fallback.
const images = {};
vi.mock("../data/recipe-images.js", () => ({
  imageForRecipe: (id) => images[id] || null,
}));

import { RecipeImage } from "./RecipeImage.jsx";

const meal = { id: "m1", name: "Test Bowl", type: "lunch", proteinTag: "Chicken", cuisineTag: "Mediterranean" };

beforeEach(() => { for (const k of Object.keys(images)) delete images[k]; });

describe("RecipeImage", () => {
  it("falls back to a tag-derived emoji thumbnail when no image is stored", () => {
    render(<RecipeImage meal={meal} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("🍗")).toBeInTheDocument(); // Chicken proteinTag
  });

  it("uses the meal type emoji when the protein tag is unknown", () => {
    render(<RecipeImage meal={{ id: "m2", name: "x", type: "breakfast" }} />);
    expect(screen.getByText("🍳")).toBeInTheDocument();
  });

  it("renders the stored photo with alt text and attribution when present", () => {
    images.m1 = { src: "https://example.com/a.jpg", credit: "Jane Doe", creditUrl: "https://example.com", license: "by" };
    render(<RecipeImage meal={meal} showCredit />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/a.jpg");
    expect(img).toHaveAttribute("alt", "Test Bowl");
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/\(BY\)/)).toBeInTheDocument();
  });

  it("falls back to the thumbnail when the stored photo fails to load", () => {
    images.m1 = { src: "https://example.com/broken.jpg", credit: "Jane Doe" };
    render(<RecipeImage meal={meal} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("🍗")).toBeInTheDocument();
  });

  it("uses the 400px card variant for a self-hosted photo at card height", () => {
    images.m1 = { src: "recipe-images/m1.webp", credit: "Jane Doe" };
    render(<RecipeImage meal={meal} height={120} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/recipe-images/m1-400.webp");
  });

  it("uses the 800px variant for a self-hosted photo at detail height", () => {
    images.m1 = { src: "recipe-images/m1.webp", credit: "Jane Doe" };
    render(<RecipeImage meal={meal} height={800} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/recipe-images/m1.webp");
  });
});
