import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";

export function AssetsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["assets", page, search],
    queryFn: async () => {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      const { data } = await api.get("/assets", { params });
      return data;
    },
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
      key: "department",
      label: "Département",
      width: "130px",
      render: (item: any) => (
        <span className="text-xs text-soc-muted">{item.department || "—"}</span>
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
        <button className="btn-primary flex items-center gap-2 text-sm">
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
    </div>
  );
}
