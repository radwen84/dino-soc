import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../stores/auth.store";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  mfaCode?: string;
  tempToken?: string;
}

export interface LoginResponse {
  requiresMfa?: boolean;
  tempToken?: string;
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface ApiErrorResponse {
  message?: string;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation<
    LoginResponse,
    AxiosError<ApiErrorResponse>,
    LoginCredentials
  >({
    mutationFn: async (
      credentials: LoginCredentials,
    ): Promise<LoginResponse> => {
      const { data } = await api.post("/auth/login", credentials);
      return data;
    },

    onSuccess: (data: LoginResponse) => {
      if (data.requiresMfa) {
        return;
      }

      setAuth(data.user, data.accessToken, data.refreshToken);

      toast.success(`Bienvenue, ${data.user.name}`);
      navigate("/");
    },

    onError: (error: AxiosError<ApiErrorResponse>) => {
      const message = error.response?.data?.message ?? "Erreur de connexion";
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
