import { clsx } from "clsx";

interface SeverityBadgeProps {
  severity: string;
  size?: "sm" | "md";
}

export function SeverityBadge({ severity, size = "sm" }: SeverityBadgeProps) {
  const classes = {
    critical: "badge-critical",
    high: "badge-high",
    medium: "badge-medium",
    low: "badge-low",
    informational: "badge-info",
  };

  return (
    <span
      className={clsx(
        classes[severity as keyof typeof classes] || "badge-info",
        size === "md" && "text-sm px-3 py-1",
      )}
    >
      {severity}
    </span>
  );
}
