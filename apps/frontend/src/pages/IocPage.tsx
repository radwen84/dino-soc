import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { PlusIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";

export function IocPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newIoc, setNewIoc] = useState({
    type: "ip",
    value: "",
    severity: "medium",
    confidence: 80,
    source: "Manual entry",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["iocs", page, search, typeFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get("/ioc", { params });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof newIoc) => {
      const { data } = await api.post("/ioc", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iocs"] });
      toast.success("IOC ajouté avec succès");
      setIsModalOpen(false);
      setNewIoc({ type: "ip", value: "", severity: "medium", confidence: 80, source: "Manual entry" });
    },
    onError: () => toast.error("Erreur lors de l'ajout de l'IOC"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIoc.value.trim()) return toast.error("Valeur requise");
    createMutation.mutate(newIoc);
  };

  const columns = [
    {
      key: "type",
      label: "Type",
      width: "100px",
      render: (item: any) => (
        <span className="badge bg-soc-surface text-soc-accent text-xs font-mono">
          {item.type}
        </span>
      ),
    },
    {
      key: "value",
      label: "Valeur",
      render: (item: any) => (
        <span className="text-sm font-mono text-white">{item.value}</span>
      ),
    },
    {
      key: "severity",
      label: "Sévérité",
      width: "90px",
      render: (item: any) => <SeverityBadge severity={item.severity} />,
    },
    {
      key: "confidence",
      label: "Confiance",
      width: "90px",
      render: (item: any) => (
        <div className="flex items-center gap-2">
          <div className="w-12 h-1.5 bg-soc-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-soc-primary rounded-full"
              style={{ width: `${item.confidence}%` }}
            />
          </div>
          <span className="text-xs text-soc-muted">{item.confidence}%</span>
        </div>
      ),
    },
    {
      key: "source",
      label: "Source",
      width: "120px",
      render: (item: any) => (
        <span className="text-xs text-soc-muted">{item.source || "—"}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Ajouté",
      width: "100px",
      render: (item: any) => (
        <span className="text-xs text-soc-muted">
          {formatDistanceToNow(new Date(item.createdAt), {
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
        <h1 className="text-xl font-bold text-white">
          Indicateurs de Compromission
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          Ajouter un IOC
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-soc-muted" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher (IP, domaine, hash...)"
            className="input pl-9 text-sm w-64"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="input text-sm py-1.5"
        >
          <option value="">Tous types</option>
          <option value="ip">IP</option>
          <option value="domain">Domaine</option>
          <option value="url">URL</option>
          <option value="hash_md5">Hash MD5</option>
          <option value="hash_sha256">Hash SHA256</option>
          <option value="email">Email</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="Aucun IOC trouvé"
      />

      {/* Modal Ajouter IOC */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md bg-soc-card border border-soc-border p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Ajouter un IOC</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-soc-muted hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Type</label>
                <select
                  value={newIoc.type}
                  onChange={(e) => setNewIoc({ ...newIoc, type: e.target.value })}
                  className="input w-full"
                >
                  <option value="ip">IP</option>
                  <option value="domain">Domaine</option>
                  <option value="url">URL</option>
                  <option value="hash_sha256">Hash SHA256</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Valeur</label>
                <input
                  value={newIoc.value}
                  onChange={(e) => setNewIoc({ ...newIoc, value: e.target.value })}
                  placeholder="ex: 192.168.1.100 ou bad-domain.com"
                  className="input w-full font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">Sévérité</label>
                <select
                  value={newIoc.severity}
                  onChange={(e) => setNewIoc({ ...newIoc, severity: e.target.value })}
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
                  {createMutation.isPending ? "Création..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}