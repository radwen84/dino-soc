import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { clsx } from "clsx";
import {
  XMarkIcon,
  CheckCircleIcon,
  ArrowUpRightIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

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
  destIp?: string;
  status: string;
  timestamp: string;
  rawPayload?: Record<string, any>;
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
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState<AlertsFilters>({
    status: "",
    source: "",
  });

  // Récupération des alertes
  const { data, isLoading } = useQuery<AlertsResponse>({
    queryKey: ["alerts", page, filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        limit: 25,
      };

      if (filters.status) params.status = filters.status;
      if (filters.source) params.source = filters.source;

      const response = await api.get("/alerts", { params });
      return response.data;
    },
  });

  // Mutation pour changer le statut d'une alerte
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await api.patch(`/alerts/${id}/status`, { status });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success(`Statut mis à jour : ${variables.status}`);
      if (selectedAlert?.id === variables.id) {
        setSelectedAlert((prev) =>
          prev ? { ...prev, status: variables.status } : null
        );
      }
    },
    onError: () => {
      toast.error("Échec de la mise à jour du statut");
    },
  });

  const handleStatusChange = (alertId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: alertId, status: newStatus });
  };

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
            <span className="text-xs text-soc-accent font-mono">
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
        <span className="text-xs text-soc-muted font-medium uppercase">
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
      width: "120px",
      render: (item: Alert) => (
        <span
          className={clsx(
            "badge text-xs capitalize",
            item.status === "new"
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : item.status === "acknowledged"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : item.status === "escalated"
              ? "bg-pink-500/20 text-pink-300 border border-pink-500/30"
              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
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
          {formatDistanceToNow(new Date(item.timestamp), {
            addSuffix: true,
            locale: fr,
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in relative">
      <h1 className="text-xl font-bold text-white">Alertes</h1>

      {/* Filtres */}
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
          className="input text-sm py-1.5 cursor-pointer"
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
          className="input text-sm py-1.5 cursor-pointer"
        >
          <option value="">Tous statuts</option>
          <option value="new">Nouveau</option>
          <option value="acknowledged">Acquitté</option>
          <option value="escalated">Escaladé</option>
          <option value="resolved">Résolu</option>
        </select>
      </div>

      {/* Tableau de données */}
      <DataTable<Alert>
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(item) => setSelectedAlert(item)}
        isLoading={isLoading}
        emptyMessage="Aucune alerte"
      />

      {/* Drawer d'inspection de l'alerte */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-lg bg-soc-card border-l border-soc-border p-6 h-full flex flex-col justify-between overflow-y-auto animate-fade-in shadow-2xl">
            <div className="space-y-6">
              {/* En-tête du drawer */}
              <div className="flex items-start justify-between border-b border-soc-border pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={clsx(
                        "text-xs font-mono font-bold px-2 py-0.5 rounded",
                        selectedAlert.level >= 12
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      )}
                    >
                      Niveau {selectedAlert.level}
                    </span>
                    <span className="text-xs uppercase text-soc-muted font-semibold">
                      {selectedAlert.source}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white">
                    {selectedAlert.ruleDescription || `Règle ${selectedAlert.ruleId}`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAlert(null)}
                  className="p-1 rounded-lg text-soc-muted hover:text-white hover:bg-soc-surface transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              {/* Détails de l'alerte */}
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-soc-muted block mb-1">Horodatage</span>
                  <span className="text-white font-mono">
                    {format(new Date(selectedAlert.timestamp), "dd/MM/yyyy HH:mm:ss", {
                      locale: fr,
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-soc-surface p-3 rounded-lg border border-soc-border">
                  <div>
                    <span className="text-soc-muted block">IP Source</span>
                    <span className="text-white font-mono">{selectedAlert.srcIp || "—"}</span>
                  </div>
                  <div>
                    <span className="text-soc-muted block">IP Destination</span>
                    <span className="text-white font-mono">{selectedAlert.destIp || "—"}</span>
                  </div>
                </div>

                {selectedAlert.mitreTechnique && (
                  <div>
                    <span className="text-soc-muted block mb-1">Technique MITRE ATT&CK</span>
                    <span className="badge bg-soc-surface text-soc-accent font-mono border border-soc-border">
                      {selectedAlert.mitreTechnique}
                    </span>
                  </div>
                )}

                {selectedAlert.rawPayload && (
                  <div>
                    <span className="text-soc-muted block mb-1">Payload Brut (JSON)</span>
                    <pre className="p-3 bg-soc-surface text-soc-text rounded-lg font-mono text-[11px] overflow-x-auto border border-soc-border max-h-48">
                      {JSON.stringify(selectedAlert.rawPayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Actions rapides sur le statut */}
            <div className="pt-4 border-t border-soc-border space-y-2">
              <span className="text-xs text-soc-muted block mb-2">Changer le statut</span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedAlert.id, "acknowledged")}
                  disabled={selectedAlert.status === "acknowledged" || updateStatusMutation.isPending}
                  className="btn-ghost text-xs border border-soc-border flex items-center justify-center gap-1 disabled:opacity-40"
                >
                  <CheckIcon className="h-3.5 w-3.5" /> Acquitter
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedAlert.id, "escalated")}
                  disabled={selectedAlert.status === "escalated" || updateStatusMutation.isPending}
                  className="btn-ghost text-xs border border-soc-border flex items-center justify-center gap-1 text-pink-400 disabled:opacity-40"
                >
                  <ArrowUpRightIcon className="h-3.5 w-3.5" /> Escalader
                </button>

                <button
                  type="button"
                  onClick={() => handleStatusChange(selectedAlert.id, "resolved")}
                  disabled={selectedAlert.status === "resolved" || updateStatusMutation.isPending}
                  className="btn-ghost text-xs border border-soc-border flex items-center justify-center gap-1 text-emerald-400 disabled:opacity-40"
                >
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Résoudre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
