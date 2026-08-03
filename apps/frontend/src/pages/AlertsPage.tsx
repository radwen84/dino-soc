import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { clsx } from "clsx";

import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";

interface Alert {
  id: string;
  level: number;
  ruleDescription?: string;
  ruleId?: string;
  mitreTechnique?: string;
  source: string;
  srcIp?: string;
  status: string;
  timestamp: string;
}

interface AlertsFilters {
  status: string;
  source: string;
}

interface AlertsResponse {
  data: Alert[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function AlertsPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AlertsFilters>({
    status: "",
    source: "",
  });

  const { data, isLoading } = useQuery<AlertsResponse>({
    queryKey: ["alerts", page, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: 25,
      };

      if (filters.status) {
        params.status = filters.status;
      }

      if (filters.source) {
        params.source = filters.source;
      }

      const response = await api.get("/alerts", { params });

      return response.data;
    },
  });

  const columns = [
    {
      key: "level" as keyof Alert,
      label: "Niveau",
      width: "70px",
      render: (item: Alert) => (
        <span
          className={clsx(
            "text-xs font-mono font-bold",
            item.level >= 12
              ? "text-red-400"
              : item.level >= 8
              ? "text-orange-400"
              : item.level >= 5
              ? "text-yellow-400"
              : "text-green-400"
          )}
        >
          L{item.level}
        </span>
      ),
    },
    {
      key: "ruleDescription" as keyof Alert,
      label: "Description",
      render: (item: Alert) => (
        <div>
          <p className="text-sm text-white truncate max-w-md">
            {item.ruleDescription || `Rule ${item.ruleId}`}
          </p>

          {item.mitreTechnique && (
            <span className="text-xs text-soc-accent">
              {item.mitreTechnique}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "source" as keyof Alert,
      label: "Source",
      width: "100px",
      render: (item: Alert) => (
        <span className="text-xs text-soc-muted">
          {item.source}
        </span>
      ),
    },
    {
      key: "srcIp" as keyof Alert,
      label: "IP Source",
      width: "130px",
      render: (item: Alert) => (
        <span className="text-xs font-mono text-soc-muted">
          {item.srcIp || "—"}
        </span>
      ),
    },
    {
      key: "status" as keyof Alert,
      label: "Statut",
      width: "100px",
      render: (item: Alert) => (
        <span
          className={clsx(
            "badge text-xs",
            item.status === "new"
              ? "bg-red-500/20 text-red-300"
              : item.status === "acknowledged"
              ? "bg-blue-500/20 text-blue-300"
              : "bg-gray-500/20 text-gray-300"
          )}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: "timestamp" as keyof Alert,
      label: "Quand",
      width: "100px",
      render: (item: Alert) => (
        <span className="text-xs text-soc-muted">
          {formatDistanceToNow(
            new Date(item.timestamp),
            { locale: fr }
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-white">
        Alertes
      </h1>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filters.source}
          onChange={(e) => {
            setFilters({
              ...filters,
              source: e.target.value,
            });
            setPage(1);
          }}
          className="input text-sm py-1.5"
        >
          <option value="">Toutes sources</option>
          <option value="wazuh">Wazuh</option>
          <option value="suricata">Suricata</option>
          <option value="falco">Falco</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({
              ...filters,
              status: e.target.value,
            });
            setPage(1);
          }}
          className="input text-sm py-1.5"
        >
          <option value="">Tous statuts</option>
          <option value="new">Nouveau</option>
          <option value="acknowledged">Acquitté</option>
          <option value="escalated">Escaladé</option>
          <option value="resolved">Résolu</option>
        </select>
      </div>

      <DataTable<Alert>
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="Aucune alerte"
      />
    </div>
  );
}