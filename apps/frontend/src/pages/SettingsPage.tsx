import { useState } from "react";
import { useAuthStore } from "../stores/auth.store";
import { XMarkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeModal, setActiveModal] = useState<"password" | "mfa" | "sessions" | null>(null);

  const [passwordForm, setPasswordForm] = useState({ current: "", newPass: "", confirm: "" });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirm) {
      return toast.error("Les mots de passe ne correspondent pas");
    }
    toast.success("Mot de passe mis à jour");
    setActiveModal(null);
    setPasswordForm({ current: "", newPass: "", confirm: "" });
  };

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
              {user?.roles?.map((role) => (
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
          <button
            type="button"
            onClick={() => setActiveModal("password")}
            className="btn-ghost text-sm border border-soc-border w-full text-left cursor-pointer hover:bg-soc-surface"
          >
            Changer le mot de passe
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("mfa")}
            className="btn-ghost text-sm border border-soc-border w-full text-left cursor-pointer hover:bg-soc-surface"
          >
            Configurer le MFA (TOTP)
          </button>
          <button
            type="button"
            onClick={() => setActiveModal("sessions")}
            className="btn-ghost text-sm border border-soc-border w-full text-left cursor-pointer hover:bg-soc-surface"
          >
            Sessions actives
          </button>
        </div>
      </div>

      {/* Modales Paramètres */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md bg-soc-card border border-soc-border p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {activeModal === "password" && "Changer le mot de passe"}
                {activeModal === "mfa" && "Configuration MFA (TOTP)"}
                {activeModal === "sessions" && "Sessions Actives"}
              </h3>
              <button onClick={() => setActiveModal(null)}>
                <XMarkIcon className="h-5 w-5 text-soc-muted" />
              </button>
            </div>

            {activeModal === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-soc-muted mb-1">Mot de passe actuel</label>
                  <input
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-soc-muted mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    value={passwordForm.newPass}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-soc-muted mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setActiveModal(null)} className="btn-ghost text-sm">
                    Annuler
                  </button>
                  <button type="submit" className="btn-primary text-sm">
                    Enregistrer
                  </button>
                </div>
              </form>
            )}

            {activeModal === "mfa" && (
              <div className="space-y-4 text-center">
                <p className="text-xs text-soc-muted">Scannez ce QR Code avec Google Authenticator ou Authy :</p>
                <div className="h-32 w-32 bg-white mx-auto flex items-center justify-center rounded-lg text-black font-mono text-xs">
                  [QR CODE MFA]
                </div>
                <button
                  onClick={() => {
                    toast.success("MFA activé");
                    setActiveModal(null);
                  }}
                  className="btn-primary w-full text-sm"
                >
                  Valider la configuration
                </button>
              </div>
            )}

            {activeModal === "sessions" && (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-soc-surface rounded-lg flex items-center justify-between border border-soc-border">
                  <div>
                    <p className="font-semibold text-white">Navigateur actuel</p>
                    <p className="text-soc-muted">Windows • Chrome • 127.0.0.1</p>
                  </div>
                  <span className="badge bg-emerald-500/20 text-emerald-300">Actif</span>
                </div>
                <button onClick={() => setActiveModal(null)} className="btn-ghost w-full text-sm">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}