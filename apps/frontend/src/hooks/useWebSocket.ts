import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useNotificationsStore } from "../stores/notifications.store";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addNotification } = useNotificationsStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = connectSocket();
    socketRef.current = socket;

    // New alert
    socket.on("alert:new", (alert: any) => {
      addNotification({
        type: "alert",
        title: "Nouvelle alerte",
        message: `[${alert.source}] ${alert.ruleDescription || "Alerte détectée"}`,
        severity:
          alert.level >= 12 ? "critical" : alert.level >= 8 ? "high" : "medium",
        link: "/alerts",
      });

      if (alert.level >= 12) {
        toast.error(`🚨 Alerte critique: ${alert.ruleDescription}`, {
          duration: 8000,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    });

    // Incident update
    socket.on("incident:updated", (incident: any) => {
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
    socket.on("incident:created", (incident: any) => {
      addNotification({
        type: "incident",
        title: "Nouvel incident",
        message: `[${incident.severity.toUpperCase()}] ${incident.title}`,
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
