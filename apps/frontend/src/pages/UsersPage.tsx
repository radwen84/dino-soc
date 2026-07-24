import { useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { PlusIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";

export function UsersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get("/users");
      return data;
    },
  });

  const columns = [
    {
      key: "name",
      label: "Nom",
      render: (item: any) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-soc-primary/20 flex items-center justify-center">
            <span className="text-xs font-medium text-soc-primary">
              {item.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm text-white">{item.name}</p>
            <p className="text-xs text-soc-muted">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "roles",
      label: "Rôles",
      render: (item: any) => (
        <div className="flex gap-1 flex-wrap">
          {item.roles.map((role: string) => (
            <span
              key={role}
              className="badge bg-soc-surface text-soc-accent text-xs"
            >
              {role}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "mfaEnabled",
      label: "MFA",
      width: "60px",
      render: (item: any) => (
        <span
          className={clsx(
            "text-xs",
            item.mfaEnabled ? "text-emerald-400" : "text-soc-muted",
          )}
        >
          {item.mfaEnabled ? "✓" : "✗"}
        </span>
      ),
    },
    {
      key: "isActive",
      label: "Actif",
      width: "60px",
      render: (item: any) => (
        <span
          className={clsx(
            "h-2 w-2 rounded-full inline-block",
            item.isActive ? "bg-emerald-400" : "bg-gray-500",
          )}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Utilisateurs</h1>
        <button className="btn-primary flex items-center gap-2 text-sm">
          <PlusIcon className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        meta={data?.meta}
        isLoading={isLoading}
        emptyMessage="Aucun utilisateur"
      />
    </div>
  );
}
