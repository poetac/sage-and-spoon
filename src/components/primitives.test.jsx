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
  it("keeps an empty, always-mounted live region when there is no toast", () => {
    render(<Toast toast={null} />);
    // The polite status region stays in the DOM so screen readers announce
    // toasts when they appear; it just has no message yet.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("shows the message politely for ok and assertively (alert) for errors", () => {
    const { rerender } = render(<Toast toast={{ msg: "Saved", kind: "ok" }} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    rerender(<Toast toast={{ msg: "Something broke", kind: "error" }} />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "assertive");
  });

  it("renders an optional action button and fires it", () => {
    const onClick = vi.fn();
    render(<Toast toast={{ msg: "Swapped", kind: "ok", action: { label: "Undo", onClick } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onClick).toHaveBeenCalledTimes(1);
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

  it("is a modal dialog and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add meal" onClose={onClose}>
        <p>body content</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("locks background scroll while open and restores it on close", () => {
    document.body.style.overflow = "scroll";
    const { unmount } = render(
      <Modal title="Add meal" onClose={() => {}}>
        <p>body content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("scroll");
  });

  it("moves focus into the dialog and restores it to the trigger on close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Modal title="Add meal" onClose={() => {}}>
        <p>body content</p>
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
