import React from "react";
import { Shield, ShoppingBag, LogOut, KeyRound } from "lucide-react";

interface SiteHeaderProps {
  siteTitle: string;
  isAdmin: boolean;
  isAdminView: boolean;
  adminUsername: string | null;
  onToggleView: (adminView: boolean) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  siteTitle,
  isAdmin,
  isAdminView,
  adminUsername,
  onToggleView,
  onLogout,
  onOpenLogin,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white" id="site-header">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div 
          className="flex cursor-pointer items-center space-x-2.5" 
          onClick={() => onToggleView(false)}
          id="logo-container"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white">
            <KeyRound className="h-4.5 w-4.5" />
          </div>
          <span className="font-sans text-xl font-bold tracking-tight text-gray-900">
            {siteTitle || "自动发卡平台"}
          </span>
        </div>

        {/* Navigation / Actions */}
        <div className="flex items-center space-x-3" id="nav-actions">
          {isAdmin ? (
            <div className="flex items-center space-x-3">
              {/* Toggle storefront vs dashboard */}
              {isAdminView ? (
                <button
                  onClick={() => onToggleView(false)}
                  className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 cursor-pointer"
                  id="btn-storefront"
                >
                  <ShoppingBag className="h-4 w-4 text-gray-500" />
                  <span className="hidden sm:inline">浏览前台</span>
                </button>
              ) : (
                <button
                  onClick={() => onToggleView(true)}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 cursor-pointer"
                  id="btn-admin-dashboard"
                >
                  <Shield className="h-4 w-4" />
                  <span>管理面板</span>
                </button>
              )}

              {/* Logged in info & logout */}
              <div className="hidden items-center space-x-1.5 text-sm text-gray-500 md:flex" id="user-info">
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
                <span>管理员: {adminUsername}</span>
              </div>

              <button
                onClick={onLogout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                title="退出登录"
                id="btn-logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
              id="btn-login-open"
            >
              <Shield className="h-4 w-4 text-gray-400" />
              <span>管理登录</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
