import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth.store";
import { useNotificationsStore } from "../stores/notifications.store";
import { clsx } from "clsx";
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
  const { user, logout } = useAuthStore();
  const { unreadCount } = useNotificationsStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 w-64 bg-soc-surface border-r border-soc-border",
          "transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
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
                    : "text-soc-muted hover:text-soc-text hover:bg-soc-card",
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
                {user?.roles[0]}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-soc-muted hover:text-soc-danger rounded-lg hover:bg-soc-card transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-soc-surface border-b border-soc-border flex items-center justify-between px-6">
          <button
            className="lg:hidden text-soc-muted hover:text-soc-text"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <div className="flex items-center gap-4 ml-auto">
            {/* Notifications */}
            <button className="relative p-2 text-soc-muted hover:text-soc-text rounded-lg hover:bg-soc-card transition-colors">
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-soc-danger text-white text-xs flex items-center justify-center font-medium">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-soc-success animate-pulse-slow" />
              <span className="text-xs text-soc-muted hidden sm:block">
                Connecté
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
