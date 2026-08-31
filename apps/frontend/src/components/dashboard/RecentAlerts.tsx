import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import api from "../../lib/api";

interface Alert {
  id: string;
  level: number;
  ruleDescription?: string;
  ruleId?: string | number;
  srcIp?: string;
  source: string;
  timestamp: string;
}

export function RecentAlerts() {
  const { data } = useQuery<Alert[]>({
    queryKey: ["recent-alerts"],
    queryFn: async () => {
      const response = await api.get("/alerts", {
        params: { limit: 8 },
      });

      return response.data.data as Alert[];
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
        {data?.map((alert: Alert) => (
          <div
            key={alert.id}
            className="flex items-center gap-3 p-2 rounded hover:bg-soc-surface transition-colors"
          >
            <div
              className={clsx(
                "h-2 w-2 rounded-full shrink-0",
                alert.level >= 12
                  ? "bg-red-500"
                  : alert.level >= 8
                    ? "bg-orange-500"
                    : alert.level >= 5
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
              {formatDistanceToNow(new Date(alert.timestamp), {
                locale: fr,
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
