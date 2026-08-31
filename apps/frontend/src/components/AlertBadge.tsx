import React from "react";

interface AlertBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
  count: number;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({ severity, count }) => {
  const isCritical = severity === "critical";

  return (
    <div className={`alert-badge badge-${severity}`}>
      <span data-testid="severity-label">{severity.toUpperCase()}</span>
      <span data-testid="alert-count">Alerts: {count}</span>
      {isCritical && <strong data-testid="warning-msg">ACTION REQUIRED</strong>}
    </div>
  );
};
