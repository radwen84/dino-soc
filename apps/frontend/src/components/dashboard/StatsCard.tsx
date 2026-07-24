import { clsx } from "clsx";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: { value: number; direction: "up" | "down" };
  color: "primary" | "success" | "warning" | "danger";
}

const colorMap = {
  primary: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  success: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  warning: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  danger: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/20",
  },
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  color,
}: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className={clsx("card border", colors.border)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-soc-muted">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {trend && (
            <p
              className={clsx(
                "text-xs mt-1 flex items-center gap-1",
                trend.direction === "up" ? "text-red-400" : "text-emerald-400",
              )}
            >
              {trend.direction === "up" ? "↑" : "↓"} {trend.value}%
              <span className="text-soc-muted">vs semaine dernière</span>
            </p>
          )}
        </div>
        <div
          className={clsx(
            "h-12 w-12 rounded-lg flex items-center justify-center",
            colors.bg,
          )}
        >
          <Icon className={clsx("h-6 w-6", colors.text)} />
        </div>
      </div>
    </div>
  );
}
