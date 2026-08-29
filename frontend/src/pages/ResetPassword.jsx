import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, formatApiErrorDetail, LOGO_URL } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password reset. Please sign in.");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src={LOGO_URL} alt="logo" className="h-20 w-20 object-contain mb-2" />
        </div>
        <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-7">
          <h2 className="text-lg font-semibold text-white mb-1">Set a new password</h2>
          <p className="text-sm text-zinc-500 mb-6">Choose a strong password for your account.</p>
          <form onSubmit={submit} className="space-y-4">
            <input
              data-testid="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none"
              placeholder="New password"
            />
            {error && <div className="text-sm text-red-400">{error}</div>}
            <button
              data-testid="reset-submit"
              disabled={loading || !token}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-gold text-black font-semibold py-2.5 text-sm hover:bg-[#c99d2a] transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Reset Password
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/login" className="text-xs text-zinc-500 hover:text-gold transition-colors">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
