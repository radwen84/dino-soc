/**

* @vitest-environment jsdom

*/
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SeverityBadge } from "../../components/common/SeverityBadge";

describe("SeverityBadge", () => {
  it("renders severity text", () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText("critical")).toBeInTheDocument();
  });

  it("applies critical styling", () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    expect(container.firstChild).toHaveClass("badge-critical");
  });

  it("applies medium styling", () => {
    const { container } = render(<SeverityBadge severity="medium" />);
    expect(container.firstChild).toHaveClass("badge-medium");
  });

  it("falls back to info for unknown severity", () => {
    const { container } = render(<SeverityBadge severity="unknown" />);
    expect(container.firstChild).toHaveClass("badge-info");
  });
});
