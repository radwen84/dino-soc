import { useQuery } from "@tanstack/react-query";
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
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export function DashboardPage() {
  useWebSocket();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [incidents, alerts, iocs, assets] = await Promise.all([
        api.get("/incidents?limit=1"),
        api.get("/alerts?limit=1"),
        api.get("/ioc/stats"),
        api.get("/assets/stats"),
      ]);
      return {
        incidents: incidents.data.meta,
        alerts: alerts.data.meta,
        iocs: iocs.data,
        assets: assets.data,
      };
    },
    refetchInterval: 30000,
  });

  const { data: kpis } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const { data } = await api.get("/reports/generate", {
        params: { type: "kpi_metrics", period: "last_7d" },
      });
      return data.data;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-soc-primary/30 border-t-soc-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">SOC Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-soc-muted">
          <ClockIcon className="h-4 w-4" />
          <span>Dernière MAJ: {new Date().toLocaleTimeString("fr-FR")}</span>
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
              {kpis.severityMetrics?.[0]?.avgMttrHours
                ? `${Math.round(kpis.severityMetrics[0].avgMttrHours * 60)}min`
                : "N/A"}
            </p>
            <p className="text-xs text-soc-muted mt-1">Mean Time to Detect</p>
          </div>
          <div className="card text-center">
            <p className="text-sm text-soc-muted">MTTR</p>
            <p className="text-2xl font-bold text-soc-warning mt-1">
              {kpis.severityMetrics?.[0]?.avgMttrHours
                ? `${kpis.severityMetrics[0].avgMttrHours}h`
                : "N/A"}
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

      {/* Recent incidents */}
      <RecentIncidents />
    </div>
  );
}
