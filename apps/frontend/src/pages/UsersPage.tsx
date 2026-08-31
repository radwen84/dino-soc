import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { DataTable } from "../components/common/DataTable";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import toast from "react-hot-toast";

export function UsersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "analyst_l1",
    password: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get("/users");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof newUser) => {
      const { data } = await api.post("/users", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Utilisateur ajouté");
      setIsModalOpen(false);
      setNewUser({ name: "", email: "", role: "analyst_l1", password: "" });
    },
    onError: () => toast.error("Erreur lors de la création"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email)
      return toast.error("Informations incomplètes");
    createMutation.mutate(newUser);
  };

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
          {item.roles?.map((role: string) => (
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
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2 text-sm cursor-pointer"
        >
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

      {/* Modal Nouvel Utilisateur */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md bg-soc-card border border-soc-border p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                Nouvel Utilisateur
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-soc-muted hover:text-white"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">
                  Nom complet
                </label>
                <input
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  placeholder="John Doe"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  placeholder="analyst@minisoc.local"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">
                  Rôle
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser({ ...newUser, role: e.target.value })
                  }
                  className="input w-full"
                >
                  <option value="analyst_l1">Analyste L1</option>
                  <option value="analyst_l2">Analyste L2</option>
                  <option value="soc_manager">SOC Manager</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-soc-muted mb-1">
                  Mot de passe temporaire
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="input w-full"
                  required
                />
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
                  {createMutation.isPending ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
