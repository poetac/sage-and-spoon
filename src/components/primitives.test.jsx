import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Icon, ICONS, Toast, Modal, GiPill, Chip } from "./primitives.jsx";

describe("Icon", () => {
  it("renders one path per entry and is hidden from a11y", () => {
    const { container } = render(<Icon d={ICONS.leaf} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll("path")).toHaveLength(ICONS.leaf.length);
  });
});

describe("GiPill", () => {
  it("labels low- and medium-GI meals", () => {
    // The label sits beside an <Icon>, so assert on the element's text content.
    const { container, rerender } = render(<GiPill gi="Low" />);
    expect(container).toHaveTextContent("Low GI");
    rerender(<GiPill gi="Medium" />);
    expect(container).toHaveTextContent("Medium GI");
  });
});

describe("Chip", () => {
  it("reflects pressed state and fires onClick", () => {
    const onClick = vi.fn();
    render(<Chip on onClick={onClick}>Italian</Chip>);
    const chip = screen.getByRole("button", { name: "Italian" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chip);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is unpressed when off", () => {
    render(<Chip onClick={() => {}}>Mexican</Chip>);
    expect(screen.getByRole("button", { name: "Mexican" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Toast", () => {
  it("renders nothing without a toast", () => {
    const { container } = render(<Toast toast={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the message for both kinds", () => {
    const { rerender } = render(<Toast toast={{ msg: "Saved", kind: "ok" }} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    rerender(<Toast toast={{ msg: "Something broke", kind: "error" }} />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });
});

describe("Modal", () => {
  it("renders title and children", () => {
    render(
      <Modal title="Add meal" onClose={() => {}}>
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Add meal" })).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("closes on the backdrop and the close button, but not on inner clicks", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal title="Add meal" onClose={onClose}>
        <p>body content</p>
      </Modal>,
    );
    // inner click is swallowed by stopPropagation
    fireEvent.click(screen.getByText("body content"));
    expect(onClose).not.toHaveBeenCalled();
    // backdrop is the outermost element
    fireEvent.click(container.firstChild);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
