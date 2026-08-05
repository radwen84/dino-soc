import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { StatusBadge } from "../components/common/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { PlusIcon, FunnelIcon, XMarkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export function IncidentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state pour la création
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    severity: "medium",
    category: "Unspecified",
  });

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

  const createMutation = useMutation({
    mutationFn: async (payload: typeof newIncident) => {
      const { data } = await api.post("/incidents", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      toast.success("Incident créé avec succès");
      setIsModalOpen(false);
      setNewIncident({ title: "", description: "", severity: "medium", category: "Unspecified" });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncident.title.trim()) return toast.error("Titre requis");
    createMutation.mutate(newIncident);
  };

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
            {item.mitreTechniques?.length > 0 && `MITRE: ${item.mitreTechniques[0]}`}
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
        <span className="text-soc-muted text-xs">{item.assignedTo?.name || "—"}</span>
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
        {/* Relié au clic */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm cursor-pointer"
        >
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

      {/* Modal de création d'incident */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-lg relative bg-soc-card border border-soc-border p-6 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Créer un Incident</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-soc-muted hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Titre</label>
                <input
                  value={newIncident.title}
                  onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                  placeholder="ex: Infiltration Malware détectée"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Description</label>
                <textarea
                  value={newIncident.description}
                  onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                  placeholder="Détails de l'incident..."
                  className="input w-full h-24"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Sévérité</label>
                <select
                  value={newIncident.severity}
                  onChange={(e) => setNewIncident({ ...newIncident, severity: e.target.value })}
                  className="input w-full"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-sm"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary text-sm"
                >
                  {createMutation.isPending ? "Création..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}