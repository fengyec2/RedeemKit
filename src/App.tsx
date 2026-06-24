import React, { useState, useEffect } from "react";
import {
  Megaphone,
  Search,
  MessageSquare,
  Clock,
  Coins,
  PackageOpen,
  Loader2,
  Shield,
  X,
  ChevronRight,
  KeyRound,
  ShieldAlert
} from "lucide-react";

import { SiteHeader } from "./components/SiteHeader";
import { QueryOrders } from "./components/QueryOrders";
import { CheckoutModal } from "./components/CheckoutModal";
import { AdminPanel } from "./components/AdminPanel";
import { Category, Product, SiteConfig } from "./types";

export default function App() {
  // Storefront & config state
  const [siteInfo, setSiteInfo] = useState<SiteConfig>({
    site_title: "自助发卡平台",
    announcement: "欢迎来到自助发卡平台！24小时自助发卡，付款后自动展示密钥。",
    contact_info: "QQ: 12345678 | Email: service@example.com",
    payment_instructions: "此支付通道为测试模拟通道，无需真实付款。点击【模拟支付】即可瞬间获得卡密。"
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Auth / Navigation states
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string>("");

  // Login modal state
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Global UI loader
  const [initialLoading, setInitialLoading] = useState<boolean>(true);

  // Load client store essentials
  const loadStorefrontData = async () => {
    try {
      const [infoRes, catRes, prodRes] = await Promise.all([
        fetch("/api/site-info"),
        fetch("/api/categories"),
        fetch("/api/products"),
      ]);

      if (infoRes.ok) {
        const info = await infoRes.json();
        setSiteInfo({
          site_title: info.site_title || "自助发卡平台",
          announcement: info.announcement || "",
          contact_info: info.contact_info || "",
          payment_instructions: info.payment_instructions || ""
        });
      }

      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats);
      }

      if (prodRes.ok) {
        const prods = await prodRes.json();
        setProducts(prods);
      }
    } catch (err) {
      console.error("加载商城配置与商品失败:", err);
    } finally {
      setInitialLoading(false);
    }
  };

  // Run Auth Check on Mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("fk_admin_token");
      if (storedToken) {
        try {
          const res = await fetch("/api/admin/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setIsAdmin(true);
            setAdminUsername(data.user.username);
            setAdminToken(storedToken);
          } else {
            // Token expired or invalid
            localStorage.removeItem("fk_admin_token");
          }
        } catch (err) {
          console.error("身份校验失败:", err);
        }
      }
      await loadStorefrontData();
    };

    checkAuth();
  }, []);

  // Handle Admin Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "用户名或密码不正确");
      }

      // Success
      localStorage.setItem("fk_admin_token", data.token);
      setIsAdmin(true);
      setAdminUsername(data.user.username);
      setAdminToken(data.token);
      setShowLoginModal(false);
      setLoginForm({ username: "", password: "" });
      
      // Auto enter admin view on success login
      setIsAdminView(true);
    } catch (err: any) {
      setLoginError(err.message || "服务器连接失败");
    } finally {
      setLoginLoading(false);
    }
  };

  // Admin Logout
  const handleLogout = () => {
    localStorage.removeItem("fk_admin_token");
    setIsAdmin(false);
    setAdminUsername(null);
    setAdminToken("");
    setIsAdminView(false);
  };

  // Filter products by category and search term
  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeCategoryId === "all" || p.category_id.toString() === activeCategoryId;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f9fafb]" id="global-loader">
        <div className="text-center space-y-3 flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="font-sans text-sm font-semibold text-gray-500">正在初始化自助发卡服务...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f9fafb] font-sans selection:bg-blue-100 selection:text-blue-900" id="app-root">
      {/* Global Navigation Header */}
      <SiteHeader
        siteTitle={siteInfo.site_title}
        isAdmin={isAdmin}
        isAdminView={isAdminView}
        adminUsername={adminUsername}
        onToggleView={(view) => setIsAdminView(view)}
        onLogout={handleLogout}
        onOpenLogin={() => setShowLoginModal(true)}
      />

      {/* ADMIN CONTROL PANEL WORKSPACE */}
      {isAdminView && isAdmin ? (
        <AdminPanel token={adminToken} />
      ) : (
        /* STOREFRONT CUSTOMER FACING VIEW */
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6" id="storefront-view">
          
          {/* Announcement Banner */}
          {siteInfo.announcement && (
            <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-blue-50/20 p-4 shadow-sm" id="site-announcement-banner">
              <div className="flex items-start space-x-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-100 text-blue-600">
                  <Megaphone className="h-4 w-4 animate-pulse" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-blue-800">最新公告</h4>
                  <p className="mt-1 font-sans text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-line">
                    {siteInfo.announcement}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Grid Layout: Main Store on left, widgets on right */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4" id="storefront-grid">
            
            {/* Left Main Store */}
            <div className="lg:col-span-3 space-y-6" id="storefront-left-main">
              
              {/* Category selector & Search bar */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm" id="filter-bar">
                
                {/* Horizontal Category scroll */}
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1.5 sm:pb-0 pr-2 scrollbar-none" id="categories-scroll">
                  <button
                    onClick={() => setActiveCategoryId("all")}
                    className={`rounded-lg px-4 py-2 text-xs font-bold transition shrink-0 cursor-pointer ${
                      activeCategoryId === "all"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                    id="cat-btn-all"
                  >
                    全部商品
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id.toString())}
                      className={`rounded-lg px-4 py-2 text-xs font-bold transition shrink-0 cursor-pointer ${
                        activeCategoryId === cat.id.toString()
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                      id={`cat-btn-${cat.id}`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Product search bar */}
                <div className="relative shrink-0 w-full sm:w-60" id="search-bar-container">
                  <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="在商店中搜索卡密..."
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 py-2 text-xs outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white transition"
                    id="search-products-input"
                  />
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3" id="products-grid">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center" id="no-products-state">
                    <PackageOpen className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-4 font-sans text-sm font-semibold text-gray-800">未找到任何发卡规格</h3>
                    <p className="mt-1 text-xs text-gray-500">当前分类暂无在售商品，或者可更换搜索词重试。</p>
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isOutOfStock = (p.stock_count ?? 0) <= 0;
                    return (
                      <div
                        key={p.id}
                        className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md flex flex-col h-full"
                        id={`product-card-${p.id}`}
                      >
                        {/* Image overlay */}
                        <div className="relative aspect-video w-full overflow-hidden bg-gray-50 shrink-0" id={`prod-img-box-${p.id}`}>
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />
                          
                          {/* Stock tag */}
                          <div className="absolute top-2.5 right-2.5" id={`prod-stock-${p.id}`}>
                            {isOutOfStock ? (
                              <span className="rounded bg-gray-950/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                                暂时缺货
                              </span>
                            ) : (
                              <span className="rounded bg-blue-600/95 backdrop-blur-sm px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
                                剩余库存: {p.stock_count}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Description content */}
                        <div className="p-4 flex flex-col flex-1" id={`prod-desc-box-${p.id}`}>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            {/* Category title info */}
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                              {categories.find((c) => c.id === p.category_id)?.name || "默认分类"}
                            </span>
                            <h3 className="font-sans text-sm font-bold text-gray-900 line-clamp-2" title={p.name}>
                              {p.name}
                            </h3>
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                              {p.description || "暂无此商品的使用简介"}
                            </p>
                          </div>

                          {/* Price & Buy trigger row */}
                          <div className="mt-4 pt-3.5 border-t border-zinc-200 flex items-center justify-between shrink-0" id={`prod-footer-box-${p.id}`}>
                            <div className="space-y-0.5">
                              <span className="text-[10px] text-zinc-400">兑换方式</span>
                              <p className="text-xs font-bold text-zinc-900">卡密核销</p>
                            </div>
                            <button
                              disabled={isOutOfStock}
                              onClick={() => setSelectedProduct(p)}
                              className={`inline-flex items-center space-x-1 rounded-lg px-3.5 py-2 text-xs font-bold transition cursor-pointer shadow-sm ${
                                isOutOfStock
                                  ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                                  : "bg-zinc-900 text-white hover:bg-zinc-800"
                              }`}
                              id={`buy-btn-${p.id}`}
                            >
                              <span>立即兑换</span>
                              <ChevronRight className="h-3 w-3 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right widgets sidebar */}
            <div className="space-y-6 lg:col-span-1" id="storefront-right-sidebar">
              {/* QueryWidget */}
              <QueryOrders />

              {/* Service/Support Widget */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" id="support-widget">
                <div className="mb-4 flex items-center space-x-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <h3 className="font-sans text-base font-semibold text-gray-900">客服与支持</h3>
                </div>
                
                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                  如在购买、扫码付款或卡密无法正常激活等过程中遇到问题，请联系客服处理：
                </p>

                <div className="space-y-2.5 rounded bg-gray-50 p-3 border border-gray-200 font-sans text-xs text-gray-700" id="support-details">
                  <div className="font-medium text-gray-900 break-words leading-relaxed whitespace-pre-line">
                    {siteInfo.contact_info || "QQ: 123456789\nEmail: contact@example.com"}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    24H自助发卡
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5" />
                    秒级交付出卡
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Core Footer */}
          <footer className="mt-12 border-t border-gray-200 py-6 text-center text-xs text-gray-400" id="site-footer">
            <p>© {new Date().getFullYear()} {siteInfo.site_title} | 24小时自助虚拟自动发卡平台服务</p>
          </footer>
        </div>
      )}

      {/* MODAL 1: CHECKOUT DIALOG */}
      {selectedProduct && (
        <CheckoutModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onSuccess={() => {
            loadStorefrontData(); // Reload inventory lists and details
          }}
        />
      )}

      {/* MODAL 2: ADMIN LOGIN OVERLAY */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in" id="login-modal-overlay">
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-lg border border-gray-200 flex flex-col animate-scale-up" id="login-modal-box">
            
            {/* Close button */}
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginError(null);
              }}
              className="absolute top-4 right-4 rounded-lg p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition cursor-pointer"
              id="login-close-btn"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <div className="flex flex-col items-center text-center space-y-1 mb-6">
              <div className="flex h-11 w-11 items-center justify-center rounded bg-blue-50 text-blue-600 shadow-inner">
                <Shield className="h-5 w-5" />
              </div>
              <h4 className="font-sans text-base font-bold text-gray-900 mt-2">管理员身份验证</h4>
              <p className="text-xs text-gray-450">登入管理控制台来维护卡密资产及看单</p>
            </div>

            {/* Error banner */}
            {loginError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 flex items-start gap-2 border border-red-100" id="login-error-alert">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Forms */}
            <form onSubmit={handleLoginSubmit} className="space-y-4" id="login-form-submit">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-605">管理员账号 (Username)</label>
                <input
                  type="text"
                  required
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="默认用户名: admin"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-605">登录密码 (Password)</label>
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  placeholder="默认密码: admin123"
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
                id="btn-admin-login-submit"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>登入验证中...</span>
                  </>
                ) : (
                  <span>管理员登入</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
