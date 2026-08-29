import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, KanbanSquare, Activity, CheckCircle2,
  UserX, FileText, CreditCard, Settings as SettingsIcon, LogOut, Menu, X,
} from "lucide-react";
import { LOGO_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/active-services", label: "Active Services", icon: Activity },
  { to: "/completed-projects", label: "Completed Projects", icon: CheckCircle2 },
  { to: "/exited-clients", label: "Exited Clients", icon: UserX },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/payments", label: "Payments", icon: CreditCard },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavItems({ onNav }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNav}
          data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? "bg-gold text-black"
                : "text-zinc-400 hover:bg-[#18181B] hover:text-white"
            }`
          }
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success("Logged out");
    navigate("/login");
  };

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-[#27272A]">
        <img src={LOGO_URL} alt="MARKLENCEMEDIA" className="h-11 w-11 rounded-md object-contain" />
        <div className="leading-tight">
          <div className="text-sm font-bold text-white tracking-wide">MARKLENCEMEDIA</div>
          <div className="text-[10px] font-medium text-gold uppercase tracking-widest">Advertising & Ad Agency</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <NavItems onNav={() => setMobileOpen(false)} />
      </div>
      <div className="border-t border-[#27272A] p-3">
        <div className="px-3 py-2 mb-1">
          <div className="text-xs text-zinc-500">Signed in as</div>
          <div className="text-sm font-medium text-white truncate">{user?.email}</div>
        </div>
        <button
          onClick={handleLogout}
          data-testid="logout-button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors duration-200"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-[#09090B] border-r border-[#27272A] z-30">
        {SidebarInner}
      </aside>

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#09090B] border-b border-[#27272A] px-4 py-3">
        <div className="flex items-center gap-2">
          <img src={LOGO_URL} alt="logo" className="h-8 w-8 rounded object-contain" />
          <span className="text-sm font-bold text-white">MARKLENCEMEDIA</span>
        </div>
        <button data-testid="mobile-menu-toggle" onClick={() => setMobileOpen(true)} className="text-white p-1">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-[#09090B] border-r border-[#27272A]">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 text-white z-10">
              <X className="h-5 w-5" />
            </button>
            {SidebarInner}
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
