import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import api from "../../lib/api";

const SEVERITY_COLORS = {
  critical: "#dc2626",
  high: "#f97316",
  medium: "#eab308",
  low: "#10b981",
  informational: "#6b7280",
};

export function SeverityDistribution() {
  const { data } = useQuery({
    queryKey: ["severity-distribution"],
    queryFn: async () => {
      const { data } = await api.get("/reports/generate", {
        params: { type: "executive_summary", period: "last_30d" },
      });
      return Object.entries(data.data.severity || {}).map(([name, value]) => ({
        name,
        value,
      }));
    },
    refetchInterval: 60000,
  });

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-soc-muted mb-4">
        Distribution par sévérité
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data || []} layout="vertical">
          <XAxis type="number" stroke="#64748b" fontSize={10} />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748b"
            fontSize={11}
            width={90}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e2a3a",
              border: "1px solid #2d3f52",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {(data || []).map((entry) => (
              <Cell
                key={entry.name}
                fill={
                  SEVERITY_COLORS[entry.name as keyof typeof SEVERITY_COLORS] ||
                  "#6b7280"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
