import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { OfflineBanner } from "./OfflineBanner.jsx";

describe("OfflineBanner", () => {
  it("stays hidden while online and appears/disappears with connectivity events", () => {
    render(<OfflineBanner />);
    expect(screen.queryByText(/You're offline/)).toBeNull();

    act(() => { window.dispatchEvent(new Event("offline")); });
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();

    act(() => { window.dispatchEvent(new Event("online")); });
    expect(screen.queryByText(/You're offline/)).toBeNull();
  });
});
