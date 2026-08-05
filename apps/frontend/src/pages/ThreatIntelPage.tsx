import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import api from "../lib/api";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { clsx } from "clsx";
import toast from "react-hot-toast";

export function ThreatIntelPage() {
  const [lookupValue, setLookupValue] = useState("");

  const { data: feedStatus } = useQuery({
    queryKey: ["feed-status"],
    queryFn: async () => {
      const { data } = await api.get("/threat-intel/feeds/status");
      return data;
    },
  });

  const lookupMutation = useMutation({
    mutationFn: async (value: string) => {
      const { data } = await api.get(
        `/threat-intel/lookup/${encodeURIComponent(value)}`,
      );
      return data;
    },
    onError: () => {
      toast.error("Impossible de récupérer la réputation");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post("/threat-intel/feeds/sync");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sync terminé: OTX=${data?.otx || 0}, MISP=${data?.misp || 0}`);
    },
    onError: () => {
      toast.error("Erreur lors de la synchronisation des flux");
    },
  });

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (lookupValue.trim()) {
      lookupMutation.mutate(lookupValue.trim());
    } else {
      toast.error("Veuillez saisir une valeur");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Threat Intelligence</h1>
        <button
          type="button"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="btn-ghost text-sm border border-soc-border flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <ArrowPathIcon
            className={clsx(
              "h-4 w-4",
              syncMutation.isPending && "animate-spin",
            )}
          />
          Sync feeds
        </button>
      </div>

      {/* Lookup Form */}
      <div className="card">
        <h3 className="text-sm font-medium text-soc-muted mb-3">
          Recherche de réputation
        </h3>
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-soc-muted" />
            <input
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
              placeholder="IP, domaine ou hash..."
              className="input pl-9 w-full"
            />
          </div>
          <button
            type="submit"
            disabled={lookupMutation.isPending}
            className="btn-primary cursor-pointer disabled:opacity-50"
          >
            {lookupMutation.isPending ? "Analyse..." : "Analyser"}
          </button>
        </form>

        {/* Results */}
        {lookupMutation.data && (
          <div className="mt-4 p-4 bg-soc-surface rounded-lg border border-soc-border">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-sm text-white">
                {lookupMutation.data.value}
              </span>
              <span
                className={clsx(
                  "badge",
                  lookupMutation.data.riskLevel === "critical"
                    ? "badge-critical"
                    : lookupMutation.data.riskLevel === "high"
                      ? "badge-high"
                      : lookupMutation.data.riskLevel === "medium"
                        ? "badge-medium"
                        : lookupMutation.data.riskLevel === "low"
                          ? "badge-low"
                          : "badge-info",
                )}
              >
                Risque: {lookupMutation.data.riskLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-soc-muted">IOC connu</p>
                <p className="text-white">
                  {lookupMutation.data.knownIoc ? "Oui ✓" : "Non"}
                </p>
              </div>
              <div>
                <p className="text-soc-muted">Sources</p>
                <p className="text-white">
                  {lookupMutation.data.sources?.join(", ") || "Aucune"}
                </p>
              </div>
              {lookupMutation.data.abuseIpDb && (
                <>
                  <div>
                    <p className="text-soc-muted">AbuseIPDB Score</p>
                    <p className="text-white">
                      {lookupMutation.data.abuseIpDb.abuseConfidenceScore}%
                    </p>
                  </div>
                  <div>
                    <p className="text-soc-muted">Signalements</p>
                    <p className="text-white">
                      {lookupMutation.data.abuseIpDb.totalReports}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Feed status */}
      <div className="card">
        <h3 className="text-sm font-medium text-soc-muted mb-4">
          Statut des feeds
        </h3>
        <div className="space-y-3">
          {feedStatus?.feeds?.map((feed: any) => (
            <div
              key={feed.name}
              className="flex items-center justify-between p-3 bg-soc-surface rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span
                  className={clsx(
                    "h-2.5 w-2.5 rounded-full",
                    feed.enabled ? "bg-emerald-400" : "bg-gray-500",
                  )}
                />
                <span className="text-sm text-white">{feed.name}</span>
              </div>
              <span className="text-xs text-soc-muted">
                {feed.enabled ? "Actif" : "Non configuré"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}