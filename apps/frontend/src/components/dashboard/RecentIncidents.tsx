import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import api from "../../lib/api";
import { SeverityBadge } from "../common/SeverityBadge";
import { StatusBadge } from "../common/StatusBadge";

export function RecentIncidents() {
  const { data } = useQuery({
    queryKey: ["recent-incidents"],
    queryFn: async () => {
      const { data } = await api.get("/incidents", { params: { limit: 5 } });
      return data.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-soc-muted">
          Incidents récents
        </h3>
        <Link
          to="/incidents"
          className="text-xs text-soc-primary hover:underline"
        >
          Voir tout →
        </Link>
      </div>

      <div className="space-y-3">
        {data?.map((incident: any) => (
          <Link
            key={incident.id}
            to={`/incidents/${incident.id}`}
            className="flex items-center gap-4 p-3 rounded-lg hover:bg-soc-surface transition-colors"
          >
            <SeverityBadge severity={incident.severity} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {incident.title}
              </p>
              <p className="text-xs text-soc-muted">
                {formatDistanceToNow(new Date(incident.detectedAt), {
                  addSuffix: true,
                  locale: fr,
                })}
              </p>
            </div>
            <StatusBadge status={incident.status} />
          </Link>
        ))}

        {(!data || data.length === 0) && (
          <p className="text-sm text-soc-muted text-center py-4">
            Aucun incident récent
          </p>
        )}
      </div>
    </div>
  );
}
