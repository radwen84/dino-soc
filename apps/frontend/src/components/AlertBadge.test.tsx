import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertBadge } from "./AlertBadge";

describe("AlertBadge Component", () => {
  it("renders correctly with severity and count", () => {
    render(<AlertBadge severity="medium" count={5} />);

    expect(screen.getByTestId("severity-label").textContent).toBe("MEDIUM");
    expect(screen.getByTestId("alert-count").textContent).toBe("Alerts: 5");
    expect(screen.queryByTestId("warning-msg")).toBeNull();
  });

  it("displays critical warning message when severity is critical", () => {
    render(<AlertBadge severity="critical" count={12} />);

    const warningText = screen.getByTestId("warning-msg");
    expect(warningText).not.toBeNull();
    expect(warningText.textContent).toBe("ACTION REQUIRED");
  });
});
