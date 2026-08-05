import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "react-hot-toast";
import App from "./App";
import "./styles/globals.css";

// Configuration globale du client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30 secondes avant de considérer les données périmées
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Récupération sécurisée de l'élément DOM racine
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("L'élément racine #root n'a pas été trouvé dans le document HTML.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            className: "bg-soc-card text-soc-text border border-soc-border shadow-xl text-sm font-sans",
            duration: 4000,
            style: {
              background: "#1e2a3a",
              color: "#f1f5f9",
              border: "1px solid #2d3f52",
            },
          }}
        />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);