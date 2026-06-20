import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// The component reads the photo array by id; mock it so we can drive both
// single-photo, multi-photo, and the generated-thumbnail fallback paths.
const images = {};
vi.mock("../data/recipe-image-store.js", () => ({
  photosForRecipe: (id) => images[id] || [],
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
    images.m1 = [{ src: "https://example.com/a.jpg", credit: "Jane Doe", creditUrl: "https://example.com", license: "by" }];
    render(<RecipeImage meal={meal} showCredit />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/a.jpg");
    expect(img).toHaveAttribute("alt", "Test Bowl");
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(/\(BY\)/)).toBeInTheDocument();
  });

  it("shows visible card attribution (creator + license) without showCredit", () => {
    images.m1 = [{ src: "https://example.com/a.jpg", credit: "Jane Doe", license: "by-sa" }];
    const { container } = render(<RecipeImage meal={meal} height={104} />);
    // Cards carry no figcaption; the credit rides on the image as an overlay.
    expect(container.querySelector("figcaption")).toBeNull();
    expect(screen.getByText(/Jane Doe · BY-SA/)).toBeInTheDocument();
  });

  it("omits the card overlay for cook photos", () => {
    images.m1 = [{ src: "https://example.com/a.jpg", credit: "Jane Doe", license: "by" }];
    render(<RecipeImage meal={meal} height={104} userPhotos={["data:image/jpeg;base64,AAAA"]} />);
    // Leading photo is the user's — no third-party credit to show.
    expect(screen.queryByText(/Jane Doe/)).not.toBeInTheDocument();
  });

  it("does not double up the credit when showCredit renders the figcaption", () => {
    images.m1 = [{ src: "https://example.com/a.jpg", credit: "Jane Doe", license: "by" }];
    render(<RecipeImage meal={meal} showCredit />);
    // figcaption carries the credit; the overlay must not also render it.
    expect(screen.getAllByText(/Jane Doe/)).toHaveLength(1);
  });

  it("falls back to the thumbnail when the stored photo fails to load", () => {
    images.m1 = [{ src: "https://example.com/broken.jpg", credit: "Jane Doe" }];
    render(<RecipeImage meal={meal} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("🍗")).toBeInTheDocument();
  });

  it("uses the 400px card variant for a self-hosted photo at card height", () => {
    images.m1 = [{ src: "recipe-images/m1.webp", credit: "Jane Doe" }];
    render(<RecipeImage meal={meal} height={120} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/recipe-images/m1-400.webp");
  });

  it("uses the 800px variant for a self-hosted photo at detail height", () => {
    images.m1 = [{ src: "recipe-images/m1.webp", credit: "Jane Doe" }];
    render(<RecipeImage meal={meal} height={800} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/recipe-images/m1.webp");
  });

  describe("gallery (multi-photo)", () => {
    const photos = [
      { src: "https://example.com/a.jpg", credit: "Alice", creditUrl: "https://a.com", license: "cc0" },
      { src: "https://example.com/b.jpg", credit: "Bob",   creditUrl: "https://b.com", license: "by" },
      { src: "https://example.com/c.jpg", credit: "Carol", creditUrl: "https://c.com", license: "by-sa" },
    ];

    beforeEach(() => { images.m1 = [...photos]; });

    it("shows first photo and 1/3 counter with showCredit", () => {
      render(<RecipeImage meal={meal} showCredit />);
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[0].src);
      expect(screen.getByText(/1\/3/)).toBeInTheDocument();
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    it("hides gallery controls without showCredit", () => {
      render(<RecipeImage meal={meal} />);
      expect(screen.queryByLabelText("Next photo")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Previous photo")).not.toBeInTheDocument();
    });

    it("advances to second photo on Next click", () => {
      render(<RecipeImage meal={meal} showCredit />);
      fireEvent.click(screen.getByLabelText("Next photo"));
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[1].src);
      expect(screen.getByText(/2\/3/)).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("wraps from first to last on Previous click", () => {
      render(<RecipeImage meal={meal} showCredit />);
      fireEvent.click(screen.getByLabelText("Previous photo"));
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[2].src);
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });

    it("dot navigation jumps directly to selected photo", () => {
      render(<RecipeImage meal={meal} showCredit />);
      fireEvent.click(screen.getByLabelText("Photo 3"));
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[2].src);
      expect(screen.getByText(/3\/3/)).toBeInTheDocument();
    });

    it("error cascade advances to next photo and eventually falls back to gradient", () => {
      render(<RecipeImage meal={meal} />);
      // error on photo 0 → photo 1
      fireEvent.error(screen.getByRole("img"));
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[1].src);
      // error on photo 1 → photo 2
      fireEvent.error(screen.getByRole("img"));
      expect(screen.getByRole("img")).toHaveAttribute("src", photos[2].src);
      // error on photo 2 → gradient fallback
      fireEvent.error(screen.getByRole("img"));
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("🍗")).toBeInTheDocument();
    });
  });

  describe("user photos", () => {
    it("leads the gallery with cook photos before curated ones, labelled", () => {
      images.m1 = [{ src: "https://example.com/a.jpg", credit: "Alice" }];
      render(<RecipeImage meal={meal} showCredit userPhotos={["data:image/jpeg;base64,AAAA"]} />);
      expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/jpeg;base64,AAAA");
      expect(screen.getByText(/Your photo/)).toBeInTheDocument();
      expect(screen.getByText(/1\/2/)).toBeInTheDocument(); // 1 cook + 1 curated
    });

    it("uses a data URL verbatim, with no size-variant rewrite", () => {
      render(<RecipeImage meal={meal} height={120} userPhotos={["data:image/png;base64,ZZZZ"]} />);
      expect(screen.getByRole("img")).toHaveAttribute("src", "data:image/png;base64,ZZZZ");
    });

    it("removes a cook photo via its delete control", () => {
      const onRemovePhoto = vi.fn();
      render(<RecipeImage meal={meal} showCredit userPhotos={["data:image/jpeg;base64,AAAA"]} onRemovePhoto={onRemovePhoto} />);
      fireEvent.click(screen.getByLabelText("Remove your photo"));
      expect(onRemovePhoto).toHaveBeenCalledWith(0);
    });

    it("shows no delete control for curated photos", () => {
      images.m1 = [{ src: "https://example.com/a.jpg", credit: "Alice" }];
      render(<RecipeImage meal={meal} showCredit onRemovePhoto={() => {}} />);
      expect(screen.queryByLabelText("Remove your photo")).not.toBeInTheDocument();
    });
  });
});
