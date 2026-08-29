import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SettingsProvider } from "@/context/SettingsContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientProfile from "@/pages/ClientProfile";
import Pipeline from "@/pages/Pipeline";
import ActiveServices from "@/pages/ActiveServices";
import CompletedProjects from "@/pages/CompletedProjects";
import ExitedClients from "@/pages/ExitedClients";
import Invoices from "@/pages/Invoices";
import Payments from "@/pages/Payments";
import Settings from "@/pages/Settings";

function Loader() {
  return (
    <div className="flex h-screen items-center justify-center bg-black">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#27272A] border-t-gold" />
    </div>
  );
}

function Protected({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <Loader />;
  if (user === false) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  if (user === null) return <Loader />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <SettingsProvider>
            <Toaster theme="dark" position="top-right" richColors />
            <Routes>
              <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/" element={<Protected><Dashboard /></Protected>} />
              <Route path="/clients" element={<Protected><Clients /></Protected>} />
              <Route path="/clients/:id" element={<Protected><ClientProfile /></Protected>} />
              <Route path="/pipeline" element={<Protected><Pipeline /></Protected>} />
              <Route path="/active-services" element={<Protected><ActiveServices /></Protected>} />
              <Route path="/completed-projects" element={<Protected><CompletedProjects /></Protected>} />
              <Route path="/exited-clients" element={<Protected><ExitedClients /></Protected>} />
              <Route path="/invoices" element={<Protected><Invoices /></Protected>} />
              <Route path="/payments" element={<Protected><Payments /></Protected>} />
              <Route path="/settings" element={<Protected><Settings /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
