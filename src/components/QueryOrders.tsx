import React, { useState } from "react";
import { Search, Key, Calendar, ShoppingBag, Copy, Check, Loader2, Info } from "lucide-react";
import { Order } from "../types";

export const QueryOrders: React.FC = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    if (!term) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search-orders?contact=${encodeURIComponent(term)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "查询失败");
      }
      const data = await res.json();
      setOrders(data);
      if (data.length > 0) {
        // Automatically expand the first order
        setExpandedOrderId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || "服务器连接失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" id="query-orders-widget">
      <div className="mb-4 flex items-center space-x-2">
        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600">
          <Search className="h-4 w-4" />
        </div>
        <h3 className="font-sans text-base font-semibold text-gray-900">自助订单查询</h3>
      </div>
      
      <p className="mb-4 text-xs text-gray-500 leading-relaxed">
        输入购买时填写的 <strong className="text-gray-700">邮箱/手机号</strong> 或 <strong className="text-gray-700">订单号</strong>，即可即时找回已购卡密。
      </p>

      <form onSubmit={handleSearch} className="flex gap-2" id="order-search-form">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入联系邮箱/手机号/订单号"
          required
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white transition"
          id="search-input"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          id="search-submit-btn"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "查询"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-600 flex items-start gap-2 border border-red-100" id="search-error">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Orders List Result */}
      {orders !== null && (
        <div className="mt-5 space-y-3.5 border-t border-gray-200 pt-4" id="search-results">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            查询到 {orders.length} 个订单
          </h4>

          {orders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400" id="no-orders-found">
              没有找到匹配的订单记录
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto pr-1 space-y-3" id="orders-list">
              {orders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                return (
                  <div
                    key={order.id}
                    className={`rounded-lg border transition-all ${
                      isExpanded 
                        ? "border-blue-100 bg-blue-50/10 shadow-sm" 
                        : "border-gray-100 bg-white hover:bg-gray-50"
                    }`}
                    id={`order-card-${order.id}`}
                  >
                    {/* Card Header (Summary) */}
                    <div
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="flex cursor-pointer items-start justify-between p-3.5"
                      id={`order-header-${order.id}`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-gray-900">{order.id}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-gray-600">
                            数量: {order.quantity}
                          </span>
                        </div>
                        <p className="font-sans text-sm font-semibold text-gray-800 line-clamp-1">
                          {order.product_name}
                        </p>
                        <div className="flex items-center space-x-3 text-[11px] text-gray-400">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(order.created_at).toLocaleDateString()}</span>
                          </span>
                          <span className="font-medium text-blue-600">
                            ¥{order.total_amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Expanded Content (Keys) */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-white p-3.5 rounded-b-lg space-y-2.5" id={`order-detail-${order.id}`}>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Key className="h-3.5 w-3.5 text-gray-400" />
                            <strong>卡密内容：</strong>
                          </span>
                          <button
                            onClick={() => copyToClipboard(order.card_codes, order.id)}
                            className="inline-flex items-center space-x-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
                            id={`copy-btn-${order.id}`}
                          >
                            {copiedId === order.id ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>已复制</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span>复制全部</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Keys Container */}
                        <div className="relative rounded bg-gray-50 border border-gray-200 p-2.5 font-mono text-xs text-gray-700 max-h-40 overflow-y-auto" id={`keys-box-${order.id}`}>
                          <pre className="whitespace-pre-wrap font-mono select-all leading-relaxed break-all">
                            {order.card_codes}
                          </pre>
                        </div>
                        
                        <div className="text-[10px] text-gray-400 leading-normal bg-gray-50/50 p-2 rounded border border-gray-200 flex gap-1 items-start">
                          <ShoppingBag className="h-3 w-3 mt-0.5 shrink-0 text-gray-400" />
                          <span>虚拟商品购买后概不退换，卡密请妥善保管。</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
