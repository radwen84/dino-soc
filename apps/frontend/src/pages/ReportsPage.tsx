import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "../lib/api";
import {
  DocumentChartBarIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

const reportTypes = [
  {
    type: "executive_summary",
    label: "Executive Summary",
    description: "Vue d'ensemble pour la direction",
  },
  {
    type: "incident_report",
    label: "Rapport d'incidents",
    description: "Analyse détaillée des incidents",
  },
  {
    type: "threat_landscape",
    label: "Paysage des menaces",
    description: "Tendances et menaces observées",
  },
  {
    type: "kpi_metrics",
    label: "Métriques KPI",
    description: "MTTD, MTTR, SLA, taux de FP",
  },
  {
    type: "compliance",
    label: "Conformité",
    description: "Rapport d'audit et conformité",
  },
  {
    type: "asset_inventory",
    label: "Inventaire Assets",
    description: "Vue d'ensemble des assets",
  },
];

export function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("last_7d");
  const [activeReportType, setActiveReportType] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: async (type: string) => {
      setActiveReportType(type);
      const { data } = await api.get("/reports/generate", {
        params: { type, period: selectedPeriod, format: "json" },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Rapport généré avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la génération du rapport");
    },
    onSettled: () => {
      setActiveReportType(null);
    },
  });

  const handleDownloadJson = (data: any, reportType: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `rapport_${reportType}_${selectedPeriod}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Rapports</h1>
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          className="input text-sm py-1.5"
        >
          <option value="last_24h">Dernières 24h</option>
          <option value="last_7d">7 derniers jours</option>
          <option value="last_30d">30 derniers jours</option>
          <option value="last_90d">90 derniers jours</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTypes.map((report) => (
          <div
            key={report.type}
            className="card hover:border-soc-primary/30 transition-colors flex flex-col justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-soc-primary/10 flex items-center justify-center shrink-0">
                <DocumentChartBarIcon className="h-5 w-5 text-soc-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white">
                  {report.label}
                </h3>
                <p className="text-xs text-soc-muted mt-1">
                  {report.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => generateMutation.mutate(report.type)}
              disabled={generateMutation.isPending}
              className="mt-4 w-full btn-ghost text-xs border border-soc-border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              {generateMutation.isPending && activeReportType === report.type
                ? "Génération..."
                : "Générer"}
            </button>
          </div>
        ))}
      </div>

      {/* Résultat du rapport */}
      {generateMutation.data && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-soc-muted">
              Résultat : {generateMutation.data.metadata?.type || "Rapport"}
            </h3>
            <button
              type="button"
              onClick={() =>
                handleDownloadJson(
                  generateMutation.data.data,
                  generateMutation.data.metadata?.type || "report"
                )
              }
              className="btn-primary text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" /> Exporter JSON
            </button>
          </div>
          <pre className="text-xs text-soc-text bg-soc-surface p-4 rounded-lg overflow-auto max-h-96 font-mono border border-soc-border">
            {JSON.stringify(generateMutation.data.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}