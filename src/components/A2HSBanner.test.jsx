import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { A2HSBanner } from "./A2HSBanner.jsx";

// Detection logic is covered in lib/pwa.test.js. Here we only assert the banner
// stays out of the way in the (non-iOS) jsdom environment.
describe("A2HSBanner", () => {
  it("renders nothing when the environment can't add to home screen", () => {
    const { container } = render(<A2HSBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
