import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  FolderTree,
  Tag,
  Key,
  ListOrdered,
  Settings,
  Plus,
  Edit2,
  Trash2,
  Upload,
  RefreshCw,
  Loader2,
  Info,
  CheckCircle,
  AlertCircle,
  Eye,
  FileSpreadsheet
} from "lucide-react";
import { Category, Product, Card, Order, SiteConfig } from "../types";

interface AdminPanelProps {
  token: string;
}

type Tab = "stats" | "categories" | "products" | "cards" | "orders" | "config";

export const AdminPanel: React.FC<AdminPanelProps> = ({ token }) => {
  const [activeTab, setActiveTab] = useState<Tab>("stats");
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // States for DB data
  const [stats, setStats] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    site_title: "",
    announcement: "",
    contact_info: "",
    payment_instructions: ""
  });

  // Filter States
  const [cardFilterProductId, setCardFilterProductId] = useState<string>("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("all");

  // Form states for Category
  const [categoryForm, setCategoryForm] = useState({ id: null as number | null, name: "", description: "", sortOrder: 0 });
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form states for Product
  const [productForm, setProductForm] = useState({
    id: null as number | null,
    categoryId: "",
    name: "",
    description: "",
    price: "",
    status: "active",
    imageUrl: "",
    customFields: ""
  });
  const [showProductForm, setShowProductForm] = useState(false);

  // Form states for Card Import
  const [cardImportForm, setCardImportForm] = useState({ productId: "", codes: "" });

  // Fetch helper
  const adminFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "请求接口失败");
    }
    return data;
  };

  // Toast notifier
  const showToast = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // Bulk loaders
  const loadStats = async () => {
    try {
      const data = await adminFetch("/api/admin/stats");
      setStats(data);
    } catch (err: any) {
      showToast("error", "获取统计失败: " + err.message);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await adminFetch("/api/categories");
      setCategories(data);
    } catch (err: any) {
      showToast("error", "获取分类失败: " + err.message);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await adminFetch("/api/admin/products");
      setProducts(data);
    } catch (err: any) {
      showToast("error", "获取商品失败: " + err.message);
    }
  };

  const loadCards = async () => {
    try {
      const pId = cardFilterProductId === "all" ? "" : `?productId=${cardFilterProductId}`;
      const data = await adminFetch(`/api/admin/cards${pId}`);
      setCards(data);
    } catch (err: any) {
      showToast("error", "获取卡密库存失败: " + err.message);
    }
  };

  const loadOrders = async () => {
    try {
      const data = await adminFetch("/api/admin/orders");
      setOrders(data);
    } catch (err: any) {
      showToast("error", "获取订单列表失败: " + err.message);
    }
  };

  const loadSiteConfig = async () => {
    try {
      const data = await adminFetch("/api/site-info");
      setSiteConfig({
        site_title: data.site_title || "",
        announcement: data.announcement || "",
        contact_info: data.contact_info || "",
        payment_instructions: data.payment_instructions || ""
      });
    } catch (err: any) {
      showToast("error", "获取系统配置失败: " + err.message);
    }
  };

  // Initial loader
  useEffect(() => {
    loadStats();
    loadCategories();
    loadProducts();
    loadSiteConfig();
  }, []);

  // Reload tab based data
  useEffect(() => {
    if (activeTab === "stats") loadStats();
    if (activeTab === "categories") loadCategories();
    if (activeTab === "products") { loadCategories(); loadProducts(); }
    if (activeTab === "cards") { loadProducts(); loadCards(); }
    if (activeTab === "orders") loadOrders();
    if (activeTab === "config") loadSiteConfig();
  }, [activeTab, cardFilterProductId]);

  // ==========================================
  // CATEGORY OPERATIONS
  // ==========================================
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name) return;

    try {
      setLoading(true);
      if (categoryForm.id) {
        // Edit
        await adminFetch(`/api/admin/categories/${categoryForm.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: categoryForm.name,
            description: categoryForm.description,
            sortOrder: categoryForm.sortOrder
          })
        });
        showToast("success", "修改分类成功！");
      } else {
        // Create
        await adminFetch("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify({
            name: categoryForm.name,
            description: categoryForm.description,
            sortOrder: categoryForm.sortOrder
          })
        });
        showToast("success", "新建分类成功！");
      }
      setCategoryForm({ id: null, name: "", description: "", sortOrder: 0 });
      setShowCategoryForm(false);
      loadCategories();
    } catch (err: any) {
      showToast("error", "保存分类失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!window.confirm("确定要删除这个分类吗？删除分类不会删除关联商品，但建议谨慎操作。")) return;
    try {
      await adminFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      showToast("success", "分类删除成功！");
      loadCategories();
    } catch (err: any) {
      showToast("error", "删除失败: " + err.message);
    }
  };

  // ==========================================
  // PRODUCT OPERATIONS
  // ==========================================
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const { id, categoryId, name, description, price, status, imageUrl, customFields } = productForm;
    if (!categoryId || !name || price === "") return;

    try {
      setLoading(true);
      const payload = {
        categoryId: Number(categoryId),
        name,
        description,
        price: Number(price),
        status,
        imageUrl,
        customFields
      };

      if (id) {
        await adminFetch(`/api/admin/products/${id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("success", "修改商品成功！");
      } else {
        await adminFetch("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        showToast("success", "发布商品成功！");
      }
      setProductForm({ id: null, categoryId: "", name: "", description: "", price: "", status: "active", imageUrl: "", customFields: "" });
      setShowProductForm(false);
      loadProducts();
    } catch (err: any) {
      showToast("error", "保存商品失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm("确定要删除此商品吗？删除该商品会【同时清空】该商品下所有【未售出的卡密库存】！已售出的卡密订单记录保留。")) return;
    try {
      await adminFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      showToast("success", "商品及未售卡密删除成功！");
      loadProducts();
    } catch (err: any) {
      showToast("error", "删除失败: " + err.message);
    }
  };

  // ==========================================
  // CARD / INVENTORY OPERATIONS
  // ==========================================
  const handleImportCards = async (e: React.FormEvent) => {
    e.preventDefault();
    const { productId, codes } = cardImportForm;
    if (!productId || !codes.trim()) {
      showToast("error", "请选择对应的商品并填写卡密数据");
      return;
    }

    try {
      setLoading(true);
      const res = await adminFetch("/api/admin/cards/import", {
        method: "POST",
        body: JSON.stringify({
          productId: Number(productId),
          codes
        })
      });
      showToast("success", res.message || "卡密批量导入成功！");
      setCardImportForm({ productId: "", codes: "" });
      loadCards();
      loadProducts(); // refresh stock numbers
    } catch (err: any) {
      showToast("error", "卡密导入失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCard = async (id: number) => {
    if (!window.confirm("确定删除此单条卡密吗？已售卡密删除可能影响用户查询凭证。")) return;
    try {
      await adminFetch(`/api/admin/cards/${id}`, { method: "DELETE" });
      showToast("success", "卡密删除成功");
      loadCards();
    } catch (err: any) {
      showToast("error", "删除卡密失败: " + err.message);
    }
  };

  const handleClearUnsoldCards = async (productId: number) => {
    if (!window.confirm("危险操作：您确定一键清空该商品的【所有未售出】卡密库存吗？已售出的卡密不受影响。")) return;
    try {
      setLoading(true);
      const res = await adminFetch(`/api/admin/cards/clear/${productId}`, { method: "DELETE" });
      showToast("success", res.message || "未售出卡密已全部清空！");
      loadCards();
      loadProducts();
    } catch (err: any) {
      showToast("error", "清空卡密失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CONFIGURATION OPERATIONS
  // ==========================================
  const handleSaveConfig = async (key: string, value: string) => {
    try {
      setLoading(true);
      await adminFetch("/api/admin/config", {
        method: "POST",
        body: JSON.stringify({ key, value })
      });
      showToast("success", "配置保存成功！");
      loadSiteConfig();
    } catch (err: any) {
      showToast("error", "配置保存失败: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter orders by search input
  const filteredOrders = orders.filter((o) => {
    if (orderSearchQuery === "all" || !orderSearchQuery.trim()) return true;
    const query = orderSearchQuery.toLowerCase().trim();
    return (
      o.id.toLowerCase().includes(query) ||
      o.product_name.toLowerCase().includes(query) ||
      o.contact_info.toLowerCase().includes(query) ||
      o.card_codes.toLowerCase().includes(query)
    );
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8" id="admin-workspace">
      
      {/* Toast Notification */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center space-x-2 rounded-lg p-4 shadow-lg border transition-all duration-300 ${
            message.type === "success" 
              ? "bg-emerald-50 border-emerald-100 text-emerald-800" 
              : "bg-red-50 border-red-100 text-red-800"
          }`}
          id="toast-notification"
        >
          {message.type === "success" ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {/* Main Admin Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center" id="admin-header">
        <div>
          <h2 className="font-sans text-2xl font-bold tracking-tight text-gray-900">后台管理工作台</h2>
          <p className="text-sm text-gray-500 mt-1">
            在这里您可以全面控制商品分类、卡密进货、查看销售统计与站点外观设置。
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (activeTab === "stats") loadStats();
              if (activeTab === "categories") loadCategories();
              if (activeTab === "products") loadProducts();
              if (activeTab === "cards") loadCards();
              if (activeTab === "orders") loadOrders();
              if (activeTab === "config") loadSiteConfig();
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition cursor-pointer"
            title="刷新数据"
            id="btn-admin-refresh"
          >
            <RefreshCw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Grid Layout: Left sidebar nav, Right content */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4" id="admin-grid">
        
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-1" id="admin-sidebar">
          <nav className="space-y-1.5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            {[
              { id: "stats", label: "数据统计", icon: TrendingUp },
              { id: "categories", label: "商品分类管理", icon: FolderTree },
              { id: "products", label: "商品列表管理", icon: Tag },
              { id: "cards", label: "卡密库存/补货", icon: Key },
              { id: "orders", label: "销售订单记录", icon: ListOrdered },
              { id: "config", label: "系统及支付配置", icon: Settings },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`w-full inline-flex items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                  id={`tab-btn-${tab.id}`}
                >
                  <IconComp className="h-4 w-4.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right Dynamic Workspace */}
        <main className="lg:col-span-3" id="admin-content-area">
          
          {/* TAB 1: DATA STATS */}
          {activeTab === "stats" && stats && (
            <div className="space-y-6" id="stats-tab">
              {/* Card Summary Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">总销售额 (成交金额)</p>
                  <p className="mt-2 text-2xl font-extrabold text-gray-900">¥{stats.totalSales.toFixed(2)}</p>
                  <div className="mt-2 text-[10px] text-gray-400">所有已发放卡密的销售流水</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">总订单笔数</p>
                  <p className="mt-2 text-2xl font-extrabold text-blue-600">{stats.totalOrders} 笔</p>
                  <div className="mt-2 text-[10px] text-gray-400">自助下单成功发放的数量</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">商品种类 / 规格</p>
                  <p className="mt-2 text-2xl font-extrabold text-green-600">{stats.totalProducts} 种</p>
                  <div className="mt-2 text-[10px] text-gray-400">当前上架的可用发卡商品数</div>
                </div>
              </div>

              {/* Inventory Details Stats */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="font-sans text-base font-bold text-gray-900">卡密库存全局画像</h3>
                <p className="text-xs text-gray-500 mt-1">
                  了解目前系统整体的卡密储备，以及已交付的激活码密总量。
                </p>

                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  <div className="rounded border border-gray-200 bg-gray-50 p-4">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalCards}</p>
                    <p className="text-xs text-gray-500 mt-1">导入卡密总量</p>
                  </div>
                  <div className="rounded border border-blue-100 bg-blue-50/20 p-4">
                    <p className="text-2xl font-bold text-blue-600">{stats.unsoldCards}</p>
                    <p className="text-xs text-blue-500 mt-1">未售剩余库存</p>
                  </div>
                  <div className="rounded border border-green-100 bg-green-50/25 p-4">
                    <p className="text-2xl font-bold text-green-600">{stats.soldCards}</p>
                    <p className="text-xs text-green-500 mt-1">已售出卡密</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden flex">
                    <div 
                      className="bg-green-500 h-full" 
                      style={{ width: `${stats.totalCards > 0 ? (stats.soldCards / stats.totalCards) * 100 : 0}%` }}
                      title={`已售出: ${stats.soldCards}`}
                    ></div>
                    <div 
                      className="bg-blue-600 h-full" 
                      style={{ width: `${stats.totalCards > 0 ? (stats.unsoldCards / stats.totalCards) * 100 : 0}%` }}
                      title={`未售出: ${stats.unsoldCards}`}
                    ></div>
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded bg-green-500 inline-block"></span>
                      已发卡比例: {stats.totalCards > 0 ? ((stats.soldCards / stats.totalCards) * 100).toFixed(1) : 0}%
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded bg-blue-600 inline-block"></span>
                      可用库存比例: {stats.totalCards > 0 ? ((stats.unsoldCards / stats.totalCards) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Guidance Info */}
              <div className="rounded border border-gray-200 bg-gray-50 p-4 text-xs text-gray-500 leading-normal flex gap-2">
                <Info className="h-4.5 w-4.5 shrink-0 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-700">快速上货指南：</p>
                  <p className="mt-1">
                    1. 先去 <strong className="text-gray-600">商品分类管理</strong> 新建一个门类。
                    <br />
                    2. 前往 <strong className="text-gray-600">商品列表管理</strong> 发布你要售卖的具体软件/游戏/卡卷卡密名称，并设置售价。
                    <br />
                    3. 在 <strong className="text-gray-600">卡密库存/补货</strong> 选择商品，复制粘贴卡密文本（一行一个，支持批量），即可立即开售！
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORIES MANAGEMENT */}
          {activeTab === "categories" && (
            <div className="space-y-6" id="categories-tab">
              <div className="flex justify-between items-center">
                <h3 className="font-sans text-base font-bold text-zinc-900">商品分类管理</h3>
                {!showCategoryForm && (
                  <button
                    onClick={() => {
                      setCategoryForm({ id: null, name: "", description: "", sortOrder: 0 });
                      setShowCategoryForm(true);
                    }}
                    className="inline-flex items-center space-x-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                  >
                    <Plus className="h-4 w-4" />
                    <span>添加分类</span>
                  </button>
                )}
              </div>

              {/* Form container */}
              {showCategoryForm && (
                <form onSubmit={handleSaveCategory} className="rounded-2xl border border-zinc-100 bg-zinc-50/50 p-5 space-y-4">
                  <h4 className="text-sm font-bold text-zinc-900">{categoryForm.id ? "编辑分类" : "发布新分类"}</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-zinc-600">分类名称</label>
                      <input
                        type="text"
                        required
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        placeholder="例如：游戏激活码、办公授权序列号"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">排序权重 (数字越小越靠前)</label>
                      <input
                        type="number"
                        value={categoryForm.sortOrder}
                        onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value, 10) || 0 })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">描述信息</label>
                    <input
                      type="text"
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      placeholder="选填描述..."
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowCategoryForm(false)}
                      className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center space-x-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>保存</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Category Table */}
              <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-zinc-500">
                    <thead className="bg-zinc-55/60 text-xs font-bold text-zinc-700 border-b border-zinc-100">
                      <tr>
                        <th className="px-5 py-3.5">ID</th>
                        <th className="px-5 py-3.5">分类名称</th>
                        <th className="px-5 py-3.5">描述</th>
                        <th className="px-5 py-3.5">排序权重</th>
                        <th className="px-5 py-3.5 text-right">管理操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {categories.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-zinc-400">
                            暂无分类数据，请点击上方按钮新建一个分类
                          </td>
                        </tr>
                      ) : (
                        categories.map((cat) => (
                          <tr key={cat.id} className="hover:bg-zinc-50">
                            <td className="px-5 py-3.5 font-mono text-xs">{cat.id}</td>
                            <td className="px-5 py-3.5 font-semibold text-zinc-950">{cat.name}</td>
                            <td className="px-5 py-3.5 text-xs text-zinc-500">{cat.description || "无"}</td>
                            <td className="px-5 py-3.5 font-mono">{cat.sort_order}</td>
                            <td className="px-5 py-3.5 text-right flex justify-end space-x-1.5">
                              <button
                                onClick={() => {
                                  setCategoryForm({ id: cat.id, name: cat.name, description: cat.description, sortOrder: cat.sort_order });
                                  setShowCategoryForm(true);
                                }}
                                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                                title="编辑"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                                title="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCTS MANAGEMENT */}
          {activeTab === "products" && (
            <div className="space-y-6" id="products-tab">
              <div className="flex justify-between items-center">
                <h3 className="font-sans text-base font-bold text-zinc-900">商品规格与上架管理</h3>
                {!showProductForm && (
                  <button
                    disabled={categories.length === 0}
                    onClick={() => {
                      setProductForm({ id: null, categoryId: categories[0]?.id.toString() || "", name: "", description: "", price: "", status: "active", imageUrl: "" });
                      setShowProductForm(true);
                    }}
                    className="inline-flex items-center space-x-1 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>添加新商品</span>
                  </button>
                )}
              </div>

              {categories.length === 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-800">
                  ⚠️ 提示：添加商品前，您必须先创建至少一个分类门类！
                </div>
              )}

              {/* Form container */}
              {showProductForm && (
                <form onSubmit={handleSaveProduct} className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                  <h4 className="text-sm font-bold text-gray-900">{productForm.id ? "编辑商品参数" : "上架新商品"}</h4>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">所属分类门类</label>
                      <select
                        value={productForm.categoryId}
                        onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-600">商品展示名称</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="例如：Windows 11 激活注册密钥 (自动发放)"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">单价价格 (CNY)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="¥ 9.90"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">上架状态</label>
                      <select
                        value={productForm.status}
                        onChange={(e) => setProductForm({ ...productForm, status: e.target.value })}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      >
                        <option value="active">立即上架发售 (Active)</option>
                        <option value="inactive">暂时下架维护 (Inactive)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">配图链接 (Image URL)</label>
                      <input
                        type="text"
                        value={productForm.imageUrl}
                        onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })}
                        placeholder="不填将使用系统预设商品封面"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">商品详细介绍 / 使用说明</label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="填写该软件密钥的卡密说明，用户下单后前台会展示..."
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 h-20 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                      <span>自定义附加输入项（普通用户兑换时需额外填写，用英文逗号分开，如：手机号,充值邮箱,充值账号）</span>
                      <span className="text-gray-400 font-normal text-[10px]">(可选)</span>
                    </label>
                    <input
                      type="text"
                      value={productForm.customFields}
                      onChange={(e) => setProductForm({ ...productForm, customFields: e.target.value })}
                      placeholder="如：手机号,游戏充值账号"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-2 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center space-x-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 cursor-pointer"
                    >
                      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>保存</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Product list table */}
              <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-zinc-500">
                    <thead className="bg-zinc-55/60 text-xs font-bold text-zinc-700 border-b border-zinc-100">
                      <tr>
                        <th className="px-5 py-3.5">商品名称</th>
                        <th className="px-5 py-3.5">分类</th>
                        <th className="px-5 py-3.5">零售单价</th>
                        <th className="px-5 py-3.5">未售卡密库存</th>
                        <th className="px-5 py-3.5">状态</th>
                        <th className="px-5 py-3.5 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {products.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-zinc-400">
                            暂无商品，请点击右上角发布您的第一个发卡规格
                          </td>
                        </tr>
                      ) : (
                        products.map((p) => {
                          const catName = categories.find((c) => c.id === p.category_id)?.name || `分类ID: ${p.category_id}`;
                          const isLowStock = (p.stock_count ?? 0) <= 2;
                          return (
                            <tr key={p.id} className="hover:bg-zinc-50">
                              <td className="px-5 py-3.5">
                                <div className="flex items-center space-x-3.5">
                                  <img src={p.image_url} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg object-cover border border-zinc-100" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-zinc-950 line-clamp-1">{p.name}</p>
                                    <p className="text-[10px] text-zinc-400">商品ID: {p.id}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-xs font-medium text-gray-600">{catName}</td>
                              <td className="px-5 py-3.5 font-bold text-blue-600">¥{p.price.toFixed(2)}</td>
                              <td className="px-5 py-3.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                  isLowStock 
                                    ? "bg-red-50 text-red-700 border border-red-100" 
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                }`}>
                                  {p.stock_count} 件
                                </span>
                              </td>
                              <td className="px-5 py-3.5">
                                {p.status === "active" ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                                    出售中
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500">
                                    已下架
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right flex justify-end space-x-1.5">
                                <button
                                  onClick={() => {
                                    setProductForm({
                                      id: p.id,
                                      categoryId: p.category_id.toString(),
                                      name: p.name,
                                      description: p.description,
                                      price: p.price.toString(),
                                      status: p.status,
                                      imageUrl: p.image_url,
                                      customFields: p.custom_fields || ""
                                    });
                                    setShowProductForm(true);
                                  }}
                                  className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition"
                                  title="编辑"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.id)}
                                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition"
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CARD / INVENTORY MANAGEMENT (补货) */}
          {activeTab === "cards" && (
            <div className="space-y-6" id="cards-tab">
              
              {/* Batch Import Card keys */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center space-x-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <h3 className="font-sans text-base font-bold text-gray-900">批量卡密补货进货</h3>
                </div>

                {products.length === 0 ? (
                  <div className="text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-100">
                    请先添加一个商品规格，再来为其导入库存卡密密钥。
                  </div>
                ) : (
                  <form onSubmit={handleImportCards} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">选择目标商品</label>
                        <select
                          required
                          value={cardImportForm.productId}
                          onChange={(e) => setCardImportForm({ ...cardImportForm, productId: e.target.value })}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                          <option value="">-- 请选择进货商品 --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (库存: {p.stock_count} 件)
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex items-end space-x-2">
                        {cardImportForm.productId && (
                          <button
                            type="button"
                            onClick={() => handleClearUnsoldCards(Number(cardImportForm.productId))}
                            className="h-[38px] rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs px-3 font-semibold transition cursor-pointer"
                          >
                            🚨 一键清空该商品未售库存
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600 flex justify-between">
                        <span>卡密序列号文本 (支持批量一行一个)</span>
                        <span className="text-gray-400">一行一条卡密，购买时将按顺序出卡</span>
                      </label>
                      <textarea
                        required
                        value={cardImportForm.codes}
                        onChange={(e) => setCardImportForm({ ...cardImportForm, codes: e.target.value })}
                        placeholder={`KEY-A8D9F-73NS8\nKEY-B93KD-198JD\nKEY-C93N2-P90KL`}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-xs outline-none focus:border-blue-500 h-28 resize-none leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !cardImportForm.productId || !cardImportForm.codes.trim()}
                      className="inline-flex items-center space-x-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4" />
                      <span>确认导入，加入库存</span>
                    </button>
                  </form>
                )}
              </div>

              {/* View/Search individual card keys */}
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-sans text-base font-bold text-gray-900 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4.5 w-4.5 text-gray-500" />
                    <span>卡密单体列表检索</span>
                  </h3>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 shrink-0">商品过滤:</span>
                    <select
                      value={cardFilterProductId}
                      onChange={(e) => setCardFilterProductId(e.target.value)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-500"
                    >
                      <option value="all">全部商品</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="overflow-hidden border border-zinc-100 rounded-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs text-zinc-500">
                      <thead className="bg-zinc-50 text-zinc-700 font-bold border-b border-zinc-100">
                        <tr>
                          <th className="px-4 py-2.5">ID</th>
                          <th className="px-4 py-2.5">卡密内容</th>
                          <th className="px-4 py-2.5">状态</th>
                          <th className="px-4 py-2.5">关联订单号</th>
                          <th className="px-4 py-2.5">导入时间</th>
                          <th className="px-4 py-2.5 text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 font-sans">
                        {cards.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                              没有查询到对应的卡密库存数据
                            </td>
                          </tr>
                        ) : (
                          cards.slice(0, 100).map((card) => (
                            <tr key={card.id} className="hover:bg-zinc-50">
                              <td className="px-4 py-2.5 font-mono text-zinc-400">{card.id}</td>
                              <td className="px-4 py-2.5 font-mono font-semibold text-zinc-800 truncate max-w-xs" title={card.code}>
                                {card.code}
                              </td>
                              <td className="px-4 py-2.5">
                                {card.status === "unsold" ? (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px]">
                                    未兑换 (Unsold)
                                  </span>
                                ) : (
                                  <span className="inline-flex px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium text-[10px]">
                                    已核销 (Sold)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-blue-600 font-bold">
                                {card.order_id || "--"}
                              </td>
                              <td className="px-4 py-2.5 text-[10px] text-zinc-400">
                                {new Date(card.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => handleDeleteCard(card.id)}
                                  className="text-zinc-400 hover:text-red-600 transition cursor-pointer"
                                  title="移除"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {cards.length > 100 && (
                  <div className="text-center text-[10px] text-zinc-400">
                    💡 仅展示最新的 100 条卡密记录，完整库存共计 {cards.length} 张。
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SALES ORDERS LOG */}
          {activeTab === "orders" && (
            <div className="space-y-6" id="orders-tab">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-sans text-base font-bold text-gray-900">自助兑换订单管理</h3>
                  <p className="text-xs text-gray-500">查看所有的客户商品兑换、卡密核销及附加账号到账详情。</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="搜订单/邮箱/手机号/卡密..."
                    onChange={(e) => setOrderSearchQuery(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-blue-500 w-48 sm:w-64"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-gray-500">
                    <thead className="bg-gray-50 text-xs font-bold text-gray-700 border-b border-gray-200">
                      <tr>
                        <th className="px-5 py-3.5">订单编号</th>
                        <th className="px-5 py-3.5">商品名称</th>
                        <th className="px-5 py-3.5">客户凭证(邮箱/手机)</th>
                        <th className="px-5 py-3.5">使用的卡密</th>
                        <th className="px-5 py-3.5">附加到账账号信息</th>
                        <th className="px-5 py-3.5 text-right">下单日期</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                            没有查找到任何兑换订单记录
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50 text-xs text-gray-600">
                            <td className="px-5 py-3.5 font-mono font-bold text-gray-950">{order.id}</td>
                            <td className="px-5 py-3.5 font-sans font-semibold text-gray-900">{order.product_name}</td>
                            <td className="px-5 py-3.5">{order.contact_info}</td>
                            <td className="px-5 py-3.5 max-w-[150px]">
                              <span className="font-mono text-xs bg-zinc-100 px-2 py-1 rounded border border-zinc-200 break-all inline-block">
                                {order.exchange_code || order.card_codes}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              {order.custom_values ? (
                                <div className="space-y-1 text-[11px]">
                                  {(() => {
                                    try {
                                      const parsed = JSON.parse(order.custom_values);
                                      return Object.entries(parsed).map(([k, v]) => (
                                        <div key={k} className="flex gap-1.5 leading-tight">
                                          <span className="text-zinc-400 font-medium shrink-0">{k}:</span>
                                          <span className="text-zinc-800 font-semibold break-all">{String(v)}</span>
                                        </div>
                                      ));
                                    } catch (e) {
                                      return <span className="text-zinc-500">{order.custom_values}</span>;
                                    }
                                  })()}
                                </div>
                              ) : (
                                <span className="text-zinc-400">无额外输入项</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-zinc-400 text-right">
                              {new Date(order.created_at).toLocaleString("zh-CN")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SITE LAYOUT & CONFIGURATION */}
          {activeTab === "config" && (
            <div className="space-y-6" id="configs-tab">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-center space-x-2 border-b border-gray-200 pb-3">
                  <Settings className="h-5 w-5 text-blue-600" />
                  <h3 className="font-sans text-base font-bold text-gray-900">系统外观及基础设置</h3>
                </div>

                <div className="space-y-5">
                  {/* Site title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">发卡平台标题</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={siteConfig.site_title}
                        onChange={(e) => setSiteConfig({ ...siteConfig, site_title: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        placeholder="例如：万能自动发卡小铺"
                      />
                      <button
                        onClick={() => handleSaveConfig("site_title", siteConfig.site_title)}
                        className="rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>

                  {/* Announcement Banner */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">平台顶部公告通知栏内容</label>
                    <div className="flex gap-2">
                      <textarea
                        value={siteConfig.announcement}
                        onChange={(e) => setSiteConfig({ ...siteConfig, announcement: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 h-16 resize-none"
                        placeholder="输入首页置顶的公告..."
                      />
                      <button
                        onClick={() => handleSaveConfig("announcement", siteConfig.announcement)}
                        className="rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition self-end cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>

                  {/* Customer Contact */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">底部客服联系信息</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={siteConfig.contact_info}
                        onChange={(e) => setSiteConfig({ ...siteConfig, contact_info: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        placeholder="QQ: 1234567 | 微信: service_wechat"
                      />
                      <button
                        onClick={() => handleSaveConfig("contact_info", siteConfig.contact_info)}
                        className="rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>

                  {/* Admin Notification Email */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                      <span>管理员通知邮箱 (订单接收邮箱)</span>
                      <span className="text-zinc-400 text-[10px] font-normal">(用于人工发货提醒)</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={siteConfig.admin_email || ""}
                        onChange={(e) => setSiteConfig({ ...siteConfig, admin_email: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        placeholder="例如: admin@example.com"
                      />
                      <button
                        onClick={() => handleSaveConfig("admin_email", siteConfig.admin_email || "")}
                        className="rounded-lg bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition cursor-pointer"
                      >
                        保存
                      </button>
                    </div>
                  </div>

                  {/* SMTP Settings Group */}
                  <div className="rounded-xl border border-zinc-200 p-4.5 bg-zinc-50/50 space-y-4">
                    <h4 className="text-xs font-bold text-zinc-800">发信 SMTP 邮箱服务商设置 (非必填，若不填则在服务器日志终端输出订单通知)</h4>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500">SMTP 服务器主机</label>
                        <input
                          type="text"
                          value={siteConfig.smtp_host || ""}
                          onChange={(e) => setSiteConfig({ ...siteConfig, smtp_host: e.target.value })}
                          placeholder="例如: smtp.qq.com"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500">SMTP 端口</label>
                        <input
                          type="text"
                          value={siteConfig.smtp_port || ""}
                          onChange={(e) => setSiteConfig({ ...siteConfig, smtp_port: e.target.value })}
                          placeholder="例如: 465 或 587"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500">SMTP 登录邮箱用户名</label>
                        <input
                          type="text"
                          value={siteConfig.smtp_user || ""}
                          onChange={(e) => setSiteConfig({ ...siteConfig, smtp_user: e.target.value })}
                          placeholder="例如: 12345678@qq.com"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500">SMTP 授权登录密码/密钥</label>
                        <input
                          type="password"
                          value={siteConfig.smtp_pass || ""}
                          onChange={(e) => setSiteConfig({ ...siteConfig, smtp_pass: e.target.value })}
                          placeholder="填写邮箱SMTP专属授权码"
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500">发件人地址 (Sender Address)</label>
                      <input
                        type="text"
                        value={siteConfig.smtp_from || ""}
                        onChange={(e) => setSiteConfig({ ...siteConfig, smtp_from: e.target.value })}
                        placeholder="不填则使用SMTP用户名"
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setLoading(true);
                            await handleSaveConfig("smtp_host", siteConfig.smtp_host || "");
                            await handleSaveConfig("smtp_port", siteConfig.smtp_port || "");
                            await handleSaveConfig("smtp_user", siteConfig.smtp_user || "");
                            await handleSaveConfig("smtp_pass", siteConfig.smtp_pass || "");
                            await handleSaveConfig("smtp_from", siteConfig.smtp_from || "");
                            showToast("success", "所有发信配置保存成功！");
                          } catch (e: any) {
                            showToast("error", "发信配置保存出错");
                          } finally {
                            setLoading(false);
                          }
                        }}
                        className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition cursor-pointer"
                      >
                        一键保存发信设置
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};
