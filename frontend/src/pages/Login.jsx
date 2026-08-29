import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth, formatApiErrorDetail } from "@/context/AuthContext";
import { LOGO_URL } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back");
      navigate(location.state?.from?.pathname || "/", { replace: true });
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
          <img src={LOGO_URL} alt="MARKLENCEMEDIA" className="h-24 w-24 object-contain mb-2" />
          <h1 className="text-xl font-bold text-white tracking-wide">MARKLENCEMEDIA</h1>
          <p className="text-xs font-medium text-gold uppercase tracking-[0.2em]">Advertising & Ad Agency</p>
        </div>
        <div className="bg-[#09090B] border border-[#27272A] rounded-lg p-7">
          <h2 className="text-lg font-semibold text-white mb-1">Sign in to your CRM</h2>
          <p className="text-sm text-zinc-500 mb-6">Internal agency management system</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none"
                placeholder="you@agency.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md bg-black border border-[#27272A] px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-gold focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            {error && <div data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">{error}</div>}
            <button
              data-testid="login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md bg-gold text-black font-semibold py-2.5 text-sm hover:bg-[#c99d2a] transition-colors duration-200 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign In
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link to="/forgot-password" data-testid="forgot-password-link" className="text-xs text-zinc-500 hover:text-gold transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
