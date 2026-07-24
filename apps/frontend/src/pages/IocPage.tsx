import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { PlusIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function IocPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

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
        <button className="btn-primary flex items-center gap-2 text-sm">
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
    </div>
  );
}
