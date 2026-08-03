import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useNotificationsStore } from "../stores/notifications.store";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

// Event payload types for socket events handled by the hook
interface AlertEvent {
  id: string;
  ruleDescription?: string;
  ruleId?: string;
  level?: number;
  timestamp?: string;
  srcIp?: string;
  source?: string;
}

interface IncidentEvent {
  id: string;
  title?: string;
  status?: string;
  severity?: string;
  detectedAt?: string;
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addNotification } = useNotificationsStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    // New alert
    socket.on("alert:new", (alert: AlertEvent) => {
      addNotification({
        type: "alert",
        title: "Nouvelle alerte",
        message: `[${alert.source}] ${alert.ruleDescription || "Alerte détectée"}`,
        severity:
          (alert.level ?? 0) >= 12
            ? "critical"
            : (alert.level ?? 0) >= 8
              ? "high"
              : "medium",
        link: "/alerts",
      });

      if ((alert.level ?? 0) >= 12) {
        toast.error(`🚨 Alerte critique: ${alert.ruleDescription}`, {
          duration: 8000,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    // Incident update
    socket.on("incident:updated", (incident: IncidentEvent) => {
      addNotification({
        type: "incident",
        title: `Incident mis à jour`,
        message: `${incident.title} → ${incident.status}`,
        severity: incident.severity,
        link: `/incidents/${incident.id}`,
      });

      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["incident", incident.id] });
    });

    // New incident
    socket.on("incident:created", (incident: IncidentEvent) => {
      addNotification({
        type: "incident",
        title: "Nouvel incident",
        message: `[${incident.severity?.toUpperCase() ?? ""}] ${incident.title ?? "(sans titre)"}`,

        severity: incident.severity,
        link: `/incidents/${incident.id}`,
      });

      toast(`🔴 Nouvel incident: ${incident.title}`, { duration: 6000 });
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    return () => {
      disconnectSocket();
    };
  }, [addNotification, queryClient]);

  return socketRef.current;
}
