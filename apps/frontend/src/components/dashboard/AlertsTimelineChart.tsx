import { useQuery } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function AlertsTimelineChart() {
  const { data } = useQuery({
    queryKey: ["alerts-timeline"],
    queryFn: async () => {
      // Generate hourly buckets for last 24h
      const now = new Date();
      const buckets = Array.from({ length: 24 }, (_, i) => {
        const hour = new Date(now.getTime() - (23 - i) * 3600000);
        return {
          time: hour.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          alerts: Math.floor(Math.random() * 50) + 5, // TODO: Replace with real API
          critical: Math.floor(Math.random() * 5),
        };
      });
      return buckets;
    },
    refetchInterval: 60000,
  });

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-soc-muted mb-4">Alertes (24h)</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data || []}>
          <defs>
            <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3f52" />
          <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
          <YAxis stroke="#64748b" fontSize={10} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e2a3a",
              border: "1px solid #2d3f52",
              borderRadius: "8px",
            }}
          />
          <Area
            type="monotone"
            dataKey="alerts"
            stroke="#3b82f6"
            fill="url(#alertGradient)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="critical"
            stroke="#ef4444"
            fill="url(#criticalGradient)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
