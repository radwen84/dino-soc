import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import api from "../../lib/api";

const COLORS = {
  new: "#ef4444",
  triaged: "#f97316",
  investigating: "#eab308",
  contained: "#06b6d4",
  eradicated: "#8b5cf6",
  recovered: "#10b981",
  closed: "#6b7280",
  false_positive: "#64748b",
};

export function IncidentsByStatusChart() {
  const { data } = useQuery({
    queryKey: ["incidents-by-status"],
    queryFn: async () => {
      const { data } = await api.get("/reports/generate", {
        params: { type: "executive_summary", period: "last_30d" },
      });
      return data.data.status;
    },
    refetchInterval: 60000,
  });

  const chartData = data
    ? Object.entries(data).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="card">
      <h3 className="text-sm font-medium text-soc-muted mb-4">
        Incidents par statut
      </h3>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={COLORS[entry.name as keyof typeof COLORS] || "#6b7280"}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e2a3a",
                border: "1px solid #2d3f52",
                borderRadius: "8px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[250px] text-soc-muted">
          Aucune donnée
        </div>
      )}
    </div>
  );
}
