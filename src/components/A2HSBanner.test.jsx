import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { A2HSBanner } from "./A2HSBanner.jsx";

// Detection logic is covered in lib/pwa.test.js. Here we assert the banner stays
// out of the way in the (non-iOS) jsdom environment, and that the native install
// path appears when the browser offers it.
describe("A2HSBanner", () => {
  it("renders nothing when the environment can't add to home screen", () => {
    const { container } = render(<A2HSBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a native Install button on beforeinstallprompt and prompts on click", () => {
    render(<A2HSBanner />);
    const evt = new Event("beforeinstallprompt");
    evt.prompt = vi.fn();
    act(() => { window.dispatchEvent(evt); });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(evt.prompt).toHaveBeenCalledTimes(1);
  });
});
