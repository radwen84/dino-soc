import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../stores/auth.store";

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  const token = useAuthStore.getState().accessToken;

  socket = io("/", {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    console.log("[WS] Connected to SOC real-time feed");
  });

  socket.on("disconnect", (reason) => {
    console.log(`[WS] Disconnected: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    console.error("[WS] Connection error:", error.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
