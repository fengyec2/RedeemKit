import React, { useState } from "react";
import { X, ShoppingCart, ShieldCheck, Mail, Info, Key, Check, AlertCircle, Sparkles, Send } from "lucide-react";
import { Product, Order } from "../types";

interface CheckoutModalProps {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void; // Trigger storefront refresh
}

type Step = "configure" | "success";

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  if (!product) return null;

  const [step, setStep] = useState<Step>("configure");
  const [exchangeCode, setExchangeCode] = useState<string>("");
  const [contactInfo, setContactInfo] = useState<string>("");
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<Order | null>(null);

  // Parse product custom fields
  const customFieldsList = product.custom_fields
    ? product.custom_fields
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
    : [];

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!exchangeCode.trim()) {
      setError("请输入兑换卡密");
      return;
    }
    if (!contactInfo.trim()) {
      setError("请填写您的联系方式（邮箱或手机号）");
      return;
    }

    // Verify all custom fields are filled
    for (const field of customFieldsList) {
      if (!customValues[field] || !customValues[field].trim()) {
        setError(`请填写必要的附加信息：${field}`);
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          contactInfo: contactInfo.trim(),
          exchangeCode: exchangeCode.trim(),
          customValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "兑换失败，请检查卡密是否正确");
      }

      setOrderResult(data.order);
      setStep("success");
      onSuccess(); // Refresh stock in storefront
    } catch (err: any) {
      setError(err.message || "连接服务器出错，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm animate-fade-in" id="checkout-modal-overlay">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl border border-zinc-100 flex flex-col max-h-[90vh]" id="checkout-modal-box">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5 shrink-0" id="checkout-modal-header">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Key className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-zinc-900">
                {step === "configure" ? "卡密自助兑换" : "兑换提交成功"}
              </h3>
              <p className="text-[10px] text-zinc-400">快速验证卡密即可提取服务/产品</p>
            </div>
          </div>
          {step !== "success" && (
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition cursor-pointer"
              id="checkout-close-btn"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5" id="checkout-modal-content">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-xs text-red-600 flex items-start gap-2.5 border border-red-100" id="checkout-error">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* STEP 1: CONFIGURE & REDEEM */}
          {step === "configure" && (
            <form onSubmit={handleRedeem} className="space-y-4" id="order-config-form">
              {/* Product Info Summary */}
              <div className="flex items-center space-x-4 rounded-xl bg-zinc-50 p-3.5 border border-zinc-200/60" id="product-summary-card">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="h-12 w-12 rounded-lg object-cover border border-zinc-200"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-sans text-xs font-bold text-zinc-800 line-clamp-1">{product.name}</h4>
                  <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                    {product.description || "暂无产品描述信息"}
                  </p>
                </div>
              </div>

              {/* Exchange Code Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-zinc-400" />
                  <span>兑换卡密</span>
                </label>
                <input
                  type="text"
                  required
                  value={exchangeCode}
                  onChange={(e) => setExchangeCode(e.target.value)}
                  placeholder="请输入您的兑换卡密"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white transition"
                />
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                  <span>联系方式</span>
                </label>
                <input
                  type="text"
                  required
                  value={contactInfo}
                  onChange={(e) => setContactInfo(e.target.value)}
                  placeholder="填写您的邮箱或手机号（订单查询凭证）"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white transition"
                />
              </div>

              {/* Dynamic custom fields */}
              {customFieldsList.map((field) => (
                <div className="space-y-1.5" key={field}>
                  <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
                    <Send className="h-3.5 w-3.5 text-zinc-400" />
                    <span>{field}</span>
                    <span className="text-red-500 font-extrabold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customValues[field] || ""}
                    onChange={(e) =>
                      setCustomValues((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    placeholder={`请输入您的 ${field}`}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2.5 text-xs outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white transition"
                  />
                </div>
              ))}

              <div className="text-[10px] text-zinc-400 leading-relaxed bg-zinc-50 p-3 rounded-xl border border-zinc-200/50 flex gap-2">
                <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-zinc-400" />
                <span>
                  卡密验证正确后，系统将自动扣除该卡密资格并登记为已消费。本站为自助卡密兑换平台，真正的发货到账操作由管理员在后台核对无误后人工完成。
                </span>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    <span>正在校验卡密并出单...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4.5 w-4.5" />
                    <span>立即提交兑换</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: SUCCESS */}
          {step === "success" && orderResult && (
            <div className="space-y-4" id="success-panel">
              <div className="text-center space-y-1.5 flex flex-col items-center py-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
                <h4 className="font-sans text-sm font-bold text-zinc-900 mt-2">卡密核销成功！</h4>
                <p className="text-[10px] text-zinc-400">兑换订单已成功记录并提交通知</p>
              </div>

              {/* Order Metadata */}
              <div className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-4 text-xs space-y-2 text-zinc-600" id="issued-order-summary">
                <div className="flex justify-between">
                  <span className="text-zinc-400">订单编号：</span>
                  <span className="font-mono font-bold text-zinc-900">{orderResult.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">兑换商品：</span>
                  <span className="font-bold text-zinc-900">{orderResult.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">联系方式：</span>
                  <span className="text-zinc-900 font-bold">{orderResult.contact_info}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">卡密验证：</span>
                  <span className="text-emerald-600 font-mono font-semibold">【核销成功】</span>
                </div>
              </div>

              <div className="rounded-xl bg-zinc-50 p-4 text-[10px] text-zinc-500 leading-normal border border-zinc-200/60 flex gap-2">
                <Info className="h-4 w-4 mt-0.5 text-zinc-400 shrink-0" />
                <span>
                  <strong>温馨提示：</strong>
                  <br />
                  管理员已通过邮件收到您的兑换通知。人工客服将在核对后尽快为您完成真正的发货或到账。您可以记下您的订单编号 <strong>{orderResult.id}</strong>，或随时在网站顶部通过联系方式查询最新处理进度。
                </span>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-zinc-900 py-3 text-xs font-bold text-white transition hover:bg-zinc-800 cursor-pointer"
                id="checkout-done-btn"
              >
                好的，返回商店
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
