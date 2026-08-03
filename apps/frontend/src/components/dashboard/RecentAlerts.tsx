import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { clsx } from "clsx";

interface AlertItem {
  id: string;
  ruleDescription?: string;
  ruleId?: string;
  level?: number;
  timestamp?: string;
  srcIp?: string;
  source?: string;
}

export function RecentAlerts() {
  const { data } = useQuery<AlertItem[]>({
    queryKey: ["recent-alerts"],
    queryFn: async () => {
      const { data } = await api.get("/alerts", { params: { limit: 8 } });
      return data.data as AlertItem[];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-soc-muted">Alertes récentes</h3>
        <Link to="/alerts" className="text-xs text-soc-primary hover:underline">
          Voir tout →
        </Link>
      </div>

      <div className="space-y-2 max-h-[280px] overflow-y-auto">
        {data?.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center gap-3 p-2 rounded hover:bg-soc-surface transition-colors"
          >
            <div
              className={clsx(
                "h-2 w-2 rounded-full shrink-0",
                (alert.level ?? 0) >= 12
                  ? "bg-red-500"
                  : (alert.level ?? 0) >= 8
                    ? "bg-orange-500"
                    : (alert.level ?? 0) >= 5
                      ? "bg-yellow-500"
                      : "bg-green-500",
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white truncate">
                {alert.ruleDescription || `Rule ${alert.ruleId}`}
              </p>
              <p className="text-xs text-soc-muted">
                {alert.srcIp && `${alert.srcIp} → `}
                {alert.source}
              </p>
            </div>
            <span className="text-xs text-soc-muted shrink-0">
              {formatDistanceToNow(new Date(alert.timestamp || Date.now()), {
                locale: fr,
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
