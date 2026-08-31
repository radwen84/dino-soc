import { clsx } from "clsx";

export type SeverityType =
  "critical" | "high" | "medium" | "low" | "informational" | string | undefined;

interface SeverityBadgeProps {
  severity?: SeverityType;
  size?: "sm" | "md";
}

const classes: Record<string, string> = {
  critical: "badge-critical",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
  informational: "badge-info",
  info: "badge-info",
};

export function SeverityBadge({ severity, size = "sm" }: SeverityBadgeProps) {
  const normalizedSeverity = severity?.toLowerCase() || "informational";

  return (
    <span
      className={clsx(
        classes[normalizedSeverity] || "badge-info",
        size === "md" && "text-sm px-3 py-1",
      )}
    >
      {severity || "N/A"}
    </span>
  );
}
