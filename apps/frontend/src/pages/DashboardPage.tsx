import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWebSocket } from "../hooks/useWebSocket";
import api from "../lib/api";
import { StatsCard } from "../components/dashboard/StatsCard";
import { IncidentsByStatusChart } from "../components/dashboard/IncidentsByStatusChart";
import { AlertsTimelineChart } from "../components/dashboard/AlertsTimelineChart";
import { SeverityDistribution } from "../components/dashboard/SeverityDistribution";
import { RecentIncidents } from "../components/dashboard/RecentIncidents";
import { RecentAlerts } from "../components/dashboard/RecentAlerts";
import {
  ExclamationTriangleIcon,
  BellAlertIcon,
  FingerPrintIcon,
  ServerStackIcon,
  ClockIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

interface SeverityMetric {
  avgMttdHours?: number;
  avgMttrHours?: number;
}

interface KpiMetrics {
  severityMetrics?: SeverityMetric[];
  falsePositiveRate?: number;
}

export function DashboardPage() {
  useWebSocket();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [incidents, alerts, iocs, assets] = await Promise.all([
        api.get("/incidents?limit=1"),
        api.get("/alerts?limit=1"),
        api.get("/ioc/stats"),
        api.get("/assets/stats"),
      ]);
      setLastUpdated(new Date());
      return {
        incidents: incidents.data?.meta,
        alerts: alerts.data?.meta,
        iocs: iocs.data,
        assets: assets.data,
      };
    },
    refetchInterval: 30000,
  });

  const { data: kpis } = useQuery<KpiMetrics>({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const { data } = await api.get("/reports/generate", {
        params: { type: "kpi_metrics", period: "last_7d" },
      });
      return data.data;
    },
    refetchInterval: 60000,
  });

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] }),
      queryClient.invalidateQueries({ queryKey: ["incidents-by-status"] }),
      queryClient.invalidateQueries({ queryKey: ["severity-distribution"] }),
      queryClient.invalidateQueries({ queryKey: ["alerts-timeline"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-alerts"] }),
      queryClient.invalidateQueries({ queryKey: ["recent-incidents"] }),
    ]);
    setLastUpdated(new Date());
    toast.success("Tableau de bord actualisé");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-soc-primary/30 border-t-soc-primary rounded-full animate-spin" />
      </div>
    );
  }

  const mttdHours =
    kpis?.severityMetrics?.[0]?.avgMttdHours ??
    kpis?.severityMetrics?.[0]?.avgMttrHours;
  const mttrHours = kpis?.severityMetrics?.[0]?.avgMttrHours;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">SOC Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-soc-muted">
            <ClockIcon className="h-4 w-4" />
            <span>Dernière MAJ: {lastUpdated.toLocaleTimeString("fr-FR")}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-lg text-soc-muted hover:text-white hover:bg-soc-surface transition-colors cursor-pointer"
            title="Rafraîchir"
          >
            <ArrowPathIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Incidents ouverts"
          value={stats?.incidents?.total || 0}
          icon={ExclamationTriangleIcon}
          trend={{ value: 12, direction: "up" }}
          color="danger"
        />
        <StatsCard
          title="Alertes (24h)"
          value={stats?.alerts?.total || 0}
          icon={BellAlertIcon}
          trend={{ value: 5, direction: "down" }}
          color="warning"
        />
        <StatsCard
          title="IOCs actifs"
          value={stats?.iocs?.active || 0}
          icon={FingerPrintIcon}
          color="primary"
        />
        <StatsCard
          title="Assets surveillés"
          value={stats?.assets?.active || 0}
          icon={ServerStackIcon}
          color="success"
        />
      </div>

      {/* MTTR / MTTD */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-sm text-soc-muted">MTTD</p>
            <p className="text-2xl font-bold text-soc-accent mt-1">
              {mttdHours !== undefined
                ? `${Math.round(mttdHours * 60)}min`
                : "N/A"}
            </p>
            <p className="text-xs text-soc-muted mt-1">Mean Time to Detect</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-soc-muted">MTTR</p>
            <p className="text-2xl font-bold text-soc-warning mt-1">
              {mttrHours !== undefined ? `${mttrHours}h` : "N/A"}
            </p>
            <p className="text-xs text-soc-muted mt-1">Mean Time to Resolve</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-soc-muted">Faux Positifs</p>
            <p className="text-2xl font-bold text-soc-success mt-1">
              {kpis.falsePositiveRate || 0}%
            </p>
            <p className="text-xs text-soc-muted mt-1">Taux de faux positifs</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncidentsByStatusChart />
        <SeverityDistribution />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsTimelineChart />
        <RecentAlerts />
      </div>

      {/* Incidents récents */}
      <RecentIncidents />
    </div>
  );
}
