import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { StatusBadge } from "../components/common/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { PlusIcon, FunnelIcon } from "@heroicons/react/24/outline";

export function IncidentsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", severity: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["incidents", page, filters],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      const { data } = await api.get("/incidents", { params });
      return data;
    },
  });

  const columns = [
    {
      key: "severity",
      label: "Sévérité",
      width: "100px",
      render: (item: any) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: "title",
      label: "Titre",
      render: (item: any) => (
        <div>
          <p className="font-medium text-white">{item.title}</p>
          <p className="text-xs text-soc-muted mt-0.5">
            {item.category && `${item.category} • `}
            {item.mitreTechniques?.length > 0 &&
              `MITRE: ${item.mitreTechniques[0]}`}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Statut",
      width: "130px",
      render: (item: any) => <StatusBadge status={item.status} />,
    },
    {
      key: "assignedTo",
      label: "Assigné à",
      width: "150px",
      render: (item: any) => (
        <span className="text-soc-muted text-xs">
          {item.assignedTo?.name || "—"}
        </span>
      ),
    },
    {
      key: "detectedAt",
      label: "Détecté",
      width: "120px",
      render: (item: any) => (
        <span className="text-xs text-soc-muted">
          {formatDistanceToNow(new Date(item.detectedAt), {
            addSuffix: true,
            locale: fr,
          })}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Incidents</h1>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <PlusIcon className="h-4 w-4" />
          Créer un incident
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <FunnelIcon className="h-4 w-4 text-soc-muted" />
        <select
          value={filters.severity}
          onChange={(e) => {
            setFilters({ ...filters, severity: e.target.value });
            setPage(1);
          }}
          className="input text-sm py-1.5"
        >
          <option value="">Toutes sévérités</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            setPage(1);
          }}
          className="input text-sm py-1.5"
        >
          <option value="">Tous statuts</option>
          <option value="new">Nouveau</option>
          <option value="triaged">Trié</option>
          <option value="investigating">Investigation</option>
          <option value="contained">Contenu</option>
          <option value="closed">Fermé</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(item) => navigate(`/incidents/${item.id}`)}
        isLoading={isLoading}
        emptyMessage="Aucun incident trouvé"
      />
    </div>
  );
}
