import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth.store";
import { useNotificationsStore } from "../stores/notifications.store";
import { clsx } from "clsx";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ShieldCheckIcon,
  HomeIcon,
  ExclamationTriangleIcon,
  BellAlertIcon,
  FingerPrintIcon,
  ServerStackIcon,
  GlobeAltIcon,
  DocumentChartBarIcon,
  UsersIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  Bars3Icon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const navigation = [
  { name: "Dashboard", href: "/", icon: HomeIcon },
  { name: "Incidents", href: "/incidents", icon: ExclamationTriangleIcon },
  { name: "Alertes", href: "/alerts", icon: BellAlertIcon },
  { name: "IOC", href: "/ioc", icon: FingerPrintIcon },
  { name: "Assets", href: "/assets", icon: ServerStackIcon },
  { name: "Threat Intel", href: "/threat-intel", icon: GlobeAltIcon },
  { name: "Rapports", href: "/reports", icon: DocumentChartBarIcon },
  { name: "Utilisateurs", href: "/users", icon: UsersIcon },
  { name: "Paramètres", href: "/settings", icon: Cog6ToothIcon },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const { user, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
    useNotificationsStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-soc-bg">
      {/* Sidebar Mobile Overlay - s'affiche SEULEMENT si sidebarOpen est vrai */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-soc-surface border-r border-soc-border",
          "transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-6 border-b border-soc-border">
          <ShieldCheckIcon className="h-8 w-8 text-soc-primary" />
          <span className="text-lg font-bold text-white">Mini-SOC</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-soc-primary/10 text-soc-primary border border-soc-primary/20"
                    : "text-soc-muted hover:text-soc-text hover:bg-soc-card"
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-soc-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-full bg-soc-primary/20 flex items-center justify-center">
              <span className="text-sm font-medium text-soc-primary">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-soc-text truncate">
                {user?.name}
              </p>
              <p className="text-xs text-soc-muted truncate">
                {user?.roles?.[0]}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            type="button"
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-soc-muted hover:text-soc-danger rounded-lg hover:bg-soc-card transition-colors cursor-pointer"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-soc-surface border-b border-soc-border flex items-center justify-between px-6 shrink-0">
          <button
            type="button"
            className="lg:hidden text-soc-muted hover:text-soc-text cursor-pointer"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            {/* Notifications Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative p-2 text-soc-muted hover:text-soc-text rounded-lg hover:bg-soc-card transition-colors cursor-pointer"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-soc-danger text-white text-xs flex items-center justify-center font-medium">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-soc-card border border-soc-border rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-soc-border flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        Notifications ({notifications.length})
                      </span>
                      <div className="flex gap-2 text-xs">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={markAllAsRead}
                            className="text-soc-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <CheckIcon className="h-3 w-3" /> Tout lire
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={clearAll}
                            className="text-soc-danger hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <TrashIcon className="h-3 w-3" /> Effacer
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-soc-border">
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            if (n.link) {
                              navigate(n.link);
                              setNotifOpen(false);
                            }
                          }}
                          className={clsx(
                            "p-3 text-xs cursor-pointer transition-colors hover:bg-soc-surface",
                            !n.read ? "bg-soc-primary/5" : "opacity-75"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-white">
                              {n.title}
                            </span>
                            <span className="text-soc-muted shrink-0">
                              {formatDistanceToNow(new Date(n.timestamp), {
                                addSuffix: true,
                                locale: fr,
                              })}
                            </span>
                          </div>
                          <p className="text-soc-muted mt-1">{n.message}</p>
                        </div>
                      ))}

                      {notifications.length === 0 && (
                        <div className="p-6 text-center text-xs text-soc-muted">
                          Aucune notification
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-soc-success animate-pulse" />
              <span className="text-xs text-soc-muted hidden sm:block">
                Connecté
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6 z-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}