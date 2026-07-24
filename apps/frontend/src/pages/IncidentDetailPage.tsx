import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { SeverityBadge } from "../components/common/SeverityBadge";
import { StatusBadge } from "../components/common/StatusBadge";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import toast from "react-hot-toast";
import { ClockIcon, UserIcon, TagIcon } from "@heroicons/react/24/outline";

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const { data } = await api.get(`/incidents/${id}`);
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      await api.patch(`/incidents/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      toast.success("Statut mis à jour");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-soc-primary/30 border-t-soc-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) return <p className="text-soc-muted">Incident non trouvé</p>;

  const timeline = [
    { label: "Détecté", time: incident.detectedAt },
    { label: "Acquitté", time: incident.acknowledgedAt },
    { label: "Contenu", time: incident.containedAt },
    { label: "Résolu", time: incident.resolvedAt },
    { label: "Fermé", time: incident.closedAt },
  ].filter((e) => e.time);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <SeverityBadge severity={incident.severity} size="md" />
              <StatusBadge status={incident.status} />
            </div>
            <h1 className="text-xl font-bold text-white">{incident.title}</h1>
            <p className="text-sm text-soc-muted mt-2">
              {incident.description}
            </p>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t border-soc-border text-sm text-soc-muted">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4" />
            {formatDistanceToNow(new Date(incident.detectedAt), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          <span className="flex items-center gap-1">
            <UserIcon className="h-4 w-4" />
            {incident.assignedTo?.name || "Non assigné"}
          </span>
          {incident.mitreTechniques?.length > 0 && (
            <span className="flex items-center gap-1">
              <TagIcon className="h-4 w-4" />
              {incident.mitreTechniques.join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card">
        <h3 className="text-sm font-medium text-soc-muted mb-3">
          Changer le statut
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            "triaged",
            "investigating",
            "contained",
            "eradicated",
            "recovered",
            "closed",
          ].map((status) => (
            <button
              key={status}
              onClick={() => updateStatus.mutate(status)}
              disabled={incident.status === status}
              className="btn-ghost text-xs border border-soc-border disabled:opacity-30"
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3 className="text-sm font-medium text-soc-muted mb-4">Timeline</h3>
        <div className="space-y-3">
          {timeline.map((event, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-soc-primary" />
              <span className="text-sm text-white font-medium w-24">
                {event.label}
              </span>
              <span className="text-sm text-soc-muted">
                {format(new Date(event.time), "dd/MM/yyyy HH:mm", {
                  locale: fr,
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
