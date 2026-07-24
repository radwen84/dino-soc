import { useAuthStore } from "../stores/auth.store";

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold text-white">Paramètres</h1>

      <div className="card max-w-2xl">
        <h2 className="text-sm font-medium text-soc-muted mb-4">Profil</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-soc-muted mb-1">Nom</label>
            <input
              defaultValue={user?.name}
              className="input w-full"
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs text-soc-muted mb-1">Email</label>
            <input
              defaultValue={user?.email}
              className="input w-full"
              readOnly
            />
          </div>
          <div>
            <label className="block text-xs text-soc-muted mb-1">Rôles</label>
            <div className="flex gap-2">
              {user?.roles.map((role) => (
                <span
                  key={role}
                  className="badge bg-soc-surface text-soc-accent"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card max-w-2xl">
        <h2 className="text-sm font-medium text-soc-muted mb-4">Sécurité</h2>
        <div className="space-y-3">
          <button className="btn-ghost text-sm border border-soc-border w-full text-left">
            Changer le mot de passe
          </button>
          <button className="btn-ghost text-sm border border-soc-border w-full text-left">
            Configurer le MFA (TOTP)
          </button>
          <button className="btn-ghost text-sm border border-soc-border w-full text-left">
            Sessions actives
          </button>
        </div>
      </div>
    </div>
  );
}
