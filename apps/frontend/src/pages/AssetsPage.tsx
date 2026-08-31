import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import toast from "react-hot-toast";

export function AssetsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newAsset, setNewAsset] = useState({
    hostname: "",
    ipAddress: "",
    os: "Linux",
    criticality: "medium",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["assets", page, search],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get("/assets", { params });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (assetData: typeof newAsset) => {
      const { data } = await api.post("/assets", assetData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success("Asset ajouté");
      setIsModalOpen(false);
      setNewAsset({
        hostname: "",
        ipAddress: "",
        os: "Linux",
        criticality: "medium",
      });
    },
    onError: () => toast.error("Erreur d'ajout"),
  });

  const criticalityColors = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-green-400",
  };

  const columns = [
    {
      key: "hostname",
      label: "Hostname",
      render: (item: any) => (
        <span className="font-mono text-sm text-white">{item.hostname}</span>
      ),
    },
    {
      key: "ipAddress",
      label: "IP",
      width: "130px",
      render: (item: any) => (
        <span className="font-mono text-xs text-soc-muted">
          {item.ipAddress || "—"}
        </span>
      ),
    },
    {
      key: "os",
      label: "OS",
      width: "120px",
      render: (item: any) => (
        <span className="text-xs text-soc-muted">{item.os || "—"}</span>
      ),
    },
    {
      key: "criticality",
      label: "Criticité",
      width: "90px",
      render: (item: any) => (
        <span
          className={clsx(
            "text-xs font-medium",
            criticalityColors[
              item.criticality as keyof typeof criticalityColors
            ],
          )}
        >
          {item.criticality}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Statut",
      width: "80px",
      render: (item: any) => (
        <span
          className={clsx(
            "flex items-center gap-1 text-xs",
            item.isActive ? "text-emerald-400" : "text-gray-500",
          )}
        >
          <span
            className={clsx(
              "h-1.5 w-1.5 rounded-full",
              item.isActive ? "bg-emerald-400" : "bg-gray-500",
            )}
          />
          {item.isActive ? "Actif" : "Inactif"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Assets</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm cursor-pointer"
        >
          <PlusIcon className="h-4 w-4" />
          Ajouter un asset
        </button>
      </div>

      <div className="relative w-64">
        <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-soc-muted" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher hostname / IP..."
          className="input pl-9 text-sm w-full"
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        onPageChange={setPage}
        isLoading={isLoading}
        emptyMessage="Aucun asset trouvé"
      />

      {/* Modal Modal Asset */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md bg-soc-card border border-soc-border p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Nouveau Asset</h2>
              <button onClick={() => setIsModalOpen(false)}>
                <XMarkIcon className="h-5 w-5 text-soc-muted" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(newAsset);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-soc-muted mb-1">
                  Hostname
                </label>
                <input
                  value={newAsset.hostname}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, hostname: e.target.value })
                  }
                  placeholder="srv-web-01"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-soc-muted mb-1">
                  Adresse IP
                </label>
                <input
                  value={newAsset.ipAddress}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, ipAddress: e.target.value })
                  }
                  placeholder="192.168.1.50"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-soc-muted mb-1">OS</label>
                <input
                  value={newAsset.os}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, os: e.target.value })
                  }
                  placeholder="Ubuntu / Windows Server"
                  className="input w-full"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost text-sm"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary text-sm">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
