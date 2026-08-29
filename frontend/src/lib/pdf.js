import { api } from "@/lib/api";
import { toast } from "sonner";

export async function downloadInvoicePdf(invoiceId, invoiceNumber) {
  try {
    const res = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoiceNumber || "invoice"}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download PDF");
  }
}
