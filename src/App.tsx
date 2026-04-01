import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import HomePage from "./pages/HomePage";
import NovaVisita from "./pages/NovaVisita";
import NovaVisitaExistente from "./pages/NovaVisitaExistente";
import DetalheVisita from "./pages/DetalheVisita";
import EditarVisita from "./pages/EditarVisita";
import EditarPessoa from "./pages/EditarPessoa";
import PessoasPage from "./pages/PessoasPage";
import PessoaDetalhePage from "./pages/PessoaDetalhePage";
import ConfigPage from "./pages/ConfigPage";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { session, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <Routes>
      {/* Home IS the registration form */}
      <Route path="/" element={<NovaVisita />} />
      <Route path="/nova-visita" element={<NovaVisita />} />
      <Route path="/nova-visita-existente/:pessoaId" element={<NovaVisitaExistente />} />
      <Route path="/visitas" element={<HomePage />} />
      <Route path="/visita/:id" element={<DetalheVisita />} />
      <Route path="/editar-visita/:id" element={<EditarVisita />} />
      <Route path="/editar-pessoa/:id" element={<EditarPessoa />} />
      {/* Admin-only routes */}
      <Route path="/pessoas" element={role === "admin" ? <PessoasPage /> : <Navigate to="/" replace />} />
      <Route path="/pessoa/:id" element={role === "admin" ? <PessoaDetalhePage /> : <Navigate to="/" replace />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);
  return null;
}

import VersionMonitor from "./components/VersionMonitor";
import InstallPWA from "./components/InstallPWA";
import { useOfflineSync } from "./hooks/useOfflineSync";

function GlobalOfflineSync() {
  useOfflineSync();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalOfflineSync />
      <InstallPWA />
      <VersionMonitor />
      <Toaster />
      <AuthProvider>
        <ThemeInitializer />
        <BrowserRouter>
          <ProtectedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

