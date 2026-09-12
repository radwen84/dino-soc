import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "../stores/auth.store";
import { XMarkIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import api from "../lib/api";

export function SettingsPage() {
  const { user } = useAuthStore();
  const [activeModal, setActiveModal] = useState<
    "password" | "mfa" | "sessions" | null
  >(null);
  const [mfaSetup, setMfaSetup] = useState<{
    qrCode: string;
    otpauthUrl: string;
  } | null>(null);
  const [totpToken, setTotpToken] = useState("");

  const setupMfa = useMutation({
    mutationFn: async () => (await api.post("/auth/mfa/setup")).data,
    onSuccess: (data) => setMfaSetup(data),
    onError: () => toast.error("Impossible de démarrer la configuration MFA"),
  });

  const enableMfa = useMutation({
    mutationFn: async (token: string) =>
      (await api.post("/auth/mfa/enable", { totpToken: token })).data,
    onSuccess: () => {
      toast.success("MFA activé");
      setActiveModal(null);
      setMfaSetup(null);
      setTotpToken("");
    },
    onError: () => toast.error("Code TOTP invalide ou expiré"),
  });

  const openMfa = () => {
    setActiveModal("mfa");
    setMfaSetup(null);
    setTotpToken("");
    setupMfa.mutate();
  };

  const unsupported = (feature: string) =>
    toast.error(
      `${feature} n'est pas disponible : aucune route backend correspondante n'existe encore.`,
    );

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
            onClick={openMfa}
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
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md bg-soc-card border border-soc-border p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {activeModal === "password"
                  ? "Changer le mot de passe"
                  : activeModal === "mfa"
                    ? "Configuration MFA (TOTP)"
                    : "Sessions actives"}
              </h3>
              <button type="button" onClick={() => setActiveModal(null)}>
                <XMarkIcon className="h-5 w-5 text-soc-muted" />
              </button>
            </div>
            {activeModal === "password" && (
              <div className="space-y-4 text-sm text-soc-muted">
                <p>
                  Cette action est affichée dans l'interface, mais l'API ne
                  fournit actuellement aucune route authentifiée de changement
                  de mot de passe.
                </p>
                <button
                  type="button"
                  onClick={() => unsupported("Le changement de mot de passe")}
                  className="btn-primary w-full text-sm"
                >
                  Vérifier la disponibilité
                </button>
              </div>
            )}
            {activeModal === "mfa" && (
              <div className="space-y-4 text-center">
                {setupMfa.isPending && (
                  <p className="text-xs text-soc-muted">
                    Génération du QR code…
                  </p>
                )}
                {mfaSetup && (
                  <>
                    <p className="text-xs text-soc-muted">
                      Scannez ce QR code puis saisissez le code à 6 chiffres.
                    </p>
                    <img
                      src={mfaSetup.qrCode}
                      alt="QR code de configuration MFA"
                      className="h-48 w-48 bg-white mx-auto p-2 rounded-lg"
                    />
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={totpToken}
                      onChange={(e) => setTotpToken(e.target.value)}
                      className="input w-full text-center tracking-widest"
                      placeholder="Code TOTP"
                    />
                    <button
                      type="button"
                      disabled={enableMfa.isPending || totpToken.length !== 6}
                      onClick={() => enableMfa.mutate(totpToken)}
                      className="btn-primary w-full text-sm disabled:opacity-50"
                    >
                      Valider la configuration
                    </button>
                  </>
                )}
              </div>
            )}
            {activeModal === "sessions" && (
              <div className="space-y-4 text-sm text-soc-muted">
                <p>
                  Aucune route backend de liste ou de révocation des sessions
                  actives n'existe actuellement.
                </p>
                <button
                  type="button"
                  onClick={() => unsupported("La gestion des sessions")}
                  className="btn-primary w-full text-sm"
                >
                  Vérifier la disponibilité
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
