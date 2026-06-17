import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const Boom = () => { throw new Error("kaboom"); };
const Fine = () => <p>all good</p>;

describe("ErrorBoundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("renders children when nothing throws", () => {
    render(<ErrorBoundary><Fine /></ErrorBoundary>);
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("catches a thrown render and shows a recovery card with retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // silence React's error log
    const { rerender } = render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("Something went sideways");

    // Swap in a healthy child (boundary still shows the fallback), then "Try
    // again" clears the error and the recovered view renders.
    rerender(<ErrorBoundary><Fine /></ErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("all good")).toBeInTheDocument();
  });
});
