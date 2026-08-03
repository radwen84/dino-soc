import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../stores/auth.store";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

interface LoginResponse {
  requiresMfa?: boolean;
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ApiErrorResponse {
  message?: string;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (
      credentials: LoginCredentials,
    ): Promise<LoginResponse> => {
      const { data } = await api.post("/auth/login", credentials);
      return data;
    },

    onSuccess: (data: LoginResponse) => {
      if (data.requiresMfa) {
        return data;
      }

      setAuth(
        data.user,
        data.accessToken,
        data.refreshToken,
      );

      toast.success(`Bienvenue, ${data.user.name}`);
      navigate("/");
    },

    onError: (error: unknown) => {
      let message = "Erreur de connexion";

      if (error instanceof AxiosError) {
        message =
          (error.response?.data as ApiErrorResponse)?.message ??
          message;
      }

      toast.error(message);
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  return () => {
    logout();
    navigate("/login");
    toast.success("Déconnecté");
  };
}