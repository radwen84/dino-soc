import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuthStore } from "../stores/auth.store";
import toast from "react-hot-toast";
import axios from "axios";

interface LoginCredentials {
  email: string;
  password: string;
  mfaCode?: string;
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const { data } = await api.post("/auth/login", credentials);
      return data;
    },
    onSuccess: (data) => {
      if (data.requiresMfa) {
        return data; // MFA flow handled in component
      }
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success(`Bienvenue, ${data.user.name}`);
      navigate("/");
    },
    onError: (error: unknown) => {
      let message = "Erreur de connexion";
      if (axios.isAxiosError(error)) {
        const respData = error.response?.data as
          { message?: string } | undefined;
        message = respData?.message || message;
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
