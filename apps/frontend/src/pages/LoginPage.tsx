import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import { useLogin, LoginCredentials } from "../hooks/useAuth";
import toast from "react-hot-toast";

interface LoginForm {
  email: string;
  password: string;
  mfaCode?: string;
  tempToken?: string;
}

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const loginMutation = useLogin();

  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      const payload: LoginCredentials = mfaRequired
        ? { mfaCode: data.mfaCode, tempToken }
        : { email: data.email, password: data.password };

      const result = await loginMutation.mutateAsync(payload);

      if (result?.requiresMfa) {
        setMfaRequired(true);
        // Correctif TypeScript: fallback sur "" si tempToken est undefined
        setTempToken(result.tempToken ?? "");
        toast.success("Veuillez saisir votre code MFA");
      }
    } catch (err) {
      // Les erreurs d'authentification sont gérées dans le hook useLogin via toast
    }
  };

  const handleBackToLogin = () => {
    setMfaRequired(false);
    setTempToken("");
    resetField("mfaCode");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-soc-bg px-4">
      <div className="w-full max-w-md">
        {/* En-tête */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-xl bg-soc-primary/10 flex items-center justify-center border border-soc-primary/20 shadow-lg">
              <ShieldCheckIcon className="h-9 w-9 text-soc-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Mini-SOC
          </h1>
          <p className="text-soc-muted text-sm mt-1">
            Security Operations Center
          </p>
        </div>

        {/* Formulaire */}
        <div className="card shadow-2xl relative border-soc-border">
          {mfaRequired && (
            <button
              type="button"
              onClick={handleBackToLogin}
              className="mb-4 text-xs text-soc-muted hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon className="h-3.5 w-3.5" /> Retour à la connexion
            </button>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {!mfaRequired ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-soc-muted mb-1.5">
                    Adresse Email
                  </label>
                  <input
                    {...register("email", {
                      required: "Email requis",
                      pattern: {
                        value: /^\S+@\S+$/,
                        message: "Format d'email invalide",
                      },
                    })}
                    type="email"
                    className="input w-full"
                    placeholder="analyst@minisoc.local"
                    autoComplete="email"
                  />
                  {errors.email && (
                    <p className="text-xs text-soc-danger mt-1">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-soc-muted mb-1.5">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <input
                      {...register("password", {
                        required: "Mot de passe requis",
                      })}
                      type={showPassword ? "text" : "password"}
                      className="input w-full pr-10"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-soc-muted hover:text-soc-text p-1 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-4 w-4" />
                      ) : (
                        <EyeIcon className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-soc-danger mt-1">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-soc-muted mb-1.5 text-center">
                  Code MFA (6 chiffres)
                </label>
                <input
                  {...register("mfaCode", {
                    required: "Code MFA requis",
                    pattern: {
                      value: /^\d{6}$/,
                      message: "Saisissez 6 chiffres",
                    },
                  })}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input w-full text-center text-2xl tracking-[0.5em] font-mono py-3"
                  placeholder="000000"
                  autoFocus
                  autoComplete="one-time-code"
                />
                {errors.mfaCode && (
                  <p className="text-xs text-soc-danger mt-1.5 text-center">
                    {errors.mfaCode.message}
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 cursor-pointer disabled:opacity-50"
            >
              {loginMutation.isPending && (
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {mfaRequired ? "Vérifier le code" : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-soc-muted mt-6">
          Mini-SOC Platform v1.0 — PFE 2026
        </p>
      </div>
    </div>
  );
}
