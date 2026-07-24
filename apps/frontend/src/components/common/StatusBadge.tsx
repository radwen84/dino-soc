import { clsx } from "clsx";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  new: { color: "bg-red-500/20 text-red-300", label: "Nouveau" },
  triaged: { color: "bg-orange-500/20 text-orange-300", label: "Trié" },
  investigating: {
    color: "bg-yellow-500/20 text-yellow-300",
    label: "Investigation",
  },
  contained: { color: "bg-cyan-500/20 text-cyan-300", label: "Contenu" },
  eradicated: { color: "bg-purple-500/20 text-purple-300", label: "Éradiqué" },
  recovered: { color: "bg-emerald-500/20 text-emerald-300", label: "Récupéré" },
  closed: { color: "bg-gray-500/20 text-gray-300", label: "Fermé" },
  false_positive: {
    color: "bg-slate-500/20 text-slate-300",
    label: "Faux positif",
  },
  acknowledged: { color: "bg-blue-500/20 text-blue-300", label: "Acquitté" },
  escalated: { color: "bg-pink-500/20 text-pink-300", label: "Escaladé" },
  resolved: { color: "bg-emerald-500/20 text-emerald-300", label: "Résolu" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    color: "bg-gray-500/20 text-gray-300",
    label: status,
  };

  return <span className={clsx("badge", config.color)}>{config.label}</span>;
}
