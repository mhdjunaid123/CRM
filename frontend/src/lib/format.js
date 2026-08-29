export const CURRENCY_SYMBOLS = { INR: "\u20b9", USD: "$", EUR: "\u20ac" };

export function money(amount, currency = "INR") {
  const sym = CURRENCY_SYMBOLS[currency] || "\u20b9";
  const n = Number(amount || 0);
  return sym + n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function fmtDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export const CLIENT_STATUS_STYLES = {
  ACTIVE: "bg-green-500/15 text-green-400 border-green-500/30",
  PIPELINE: "bg-gold/15 text-gold border-gold/30",
  "ON HOLD": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  EXITED: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const SERVICE_STATUS_STYLES = {
  ACTIVE: "bg-green-500/15 text-green-400 border-green-500/30",
  "IN PROGRESS": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  COMPLETED: "bg-green-500/15 text-green-400 border-green-500/30",
  "ON HOLD": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  CANCELLED: "bg-red-500/15 text-red-400 border-red-500/30",
};

export const INVOICE_STATUS_STYLES = {
  PAID: "bg-green-500/15 text-green-400 border-green-500/30",
  PENDING: "bg-gold/15 text-gold border-gold/30",
  "PARTIALLY PAID": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  OVERDUE: "bg-red-500/15 text-red-400 border-red-500/30",
  CANCELLED: "bg-red-500/15 text-red-400 border-red-500/30",
  DRAFT: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export const SERVICE_TYPES = ["PROJECT", "MONTHLY SERVICE", "ONE-TIME SERVICE"];
export const BILLING_TYPES = ["ONE-TIME", "MONTHLY"];
export const SERVICE_STATUSES = ["ACTIVE", "IN PROGRESS", "COMPLETED", "ON HOLD", "CANCELLED"];
export const CLIENT_STATUSES = ["PIPELINE", "ACTIVE", "ON HOLD", "EXITED"];
export const INVOICE_STATUSES = ["DRAFT", "PENDING", "PARTIALLY PAID", "PAID", "OVERDUE", "CANCELLED"];
export const PAYMENT_METHODS = ["UPI", "BANK TRANSFER", "CASH", "OTHER"];
export const PIPELINE_STAGES = ["NEW LEAD", "CONTACTED", "DISCUSSION", "PROPOSAL", "WON", "LOST"];
