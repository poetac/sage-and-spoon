import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "./Sparkline.jsx";

describe("Sparkline", () => {
  it("renders nothing below two points (no trend to show)", () => {
    const { container: c0 } = render(<Sparkline values={[]} target={95} />);
    const { container: c1 } = render(<Sparkline values={[90]} target={95} />);
    expect(c0.querySelector("svg")).toBeNull();
    expect(c1.querySelector("svg")).toBeNull();
  });

  it("draws a polyline, a target reference line, and a dot per value", () => {
    const { container } = render(<Sparkline values={[90, 100, 88]} target={95} />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("polyline")).not.toBeNull();
    expect(container.querySelector("line")).not.toBeNull();
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("colours each dot by its status", () => {
    const statusOf = (v) => (v > 95 ? "high" : "in");
    const { container } = render(<Sparkline values={[90, 120]} target={95} statusOf={statusOf} />);
    const fills = [...container.querySelectorAll("circle")].map((c) => c.getAttribute("fill"));
    expect(fills[0]).toContain("sage-deep"); // in range
    expect(fills[1]).toContain("amber"); // high
  });

  it("stays decorative — hidden from assistive tech", () => {
    const { container } = render(<Sparkline values={[90, 100]} target={95} />);
    expect(container.querySelector("svg").getAttribute("aria-hidden")).toBe("true");
  });
});
