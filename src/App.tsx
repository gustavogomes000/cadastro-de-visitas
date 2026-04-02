import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { lazy, Suspense, useEffect } from "react";
import VersionMonitor from "./components/VersionMonitor";
import InstallPWA from "./components/InstallPWA";
import { useOfflineSync } from "./hooks/useOfflineSync";

// Lazy load pages
const Login = lazy(() => import("./pages/Login"));
const NovaVisita = lazy(() => import("./pages/NovaVisita"));
const NovaVisitaExistente = lazy(() => import("./pages/NovaVisitaExistente"));
const HomePage = lazy(() => import("./pages/HomePage"));
const DetalheVisita = lazy(() => import("./pages/DetalheVisita"));
const EditarVisita = lazy(() => import("./pages/EditarVisita"));
const EditarPessoa = lazy(() => import("./pages/EditarPessoa"));
const PessoasPage = lazy(() => import("./pages/PessoasPage"));
const PessoaDetalhePage = lazy(() => import("./pages/PessoaDetalhePage"));
const ConfigPage = lazy(() => import("./pages/ConfigPage"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoutes() {
  const { session, loading, role } = useAuth();

  if (loading) return <PageLoader />;
  if (!session) return <Suspense fallback={<PageLoader />}><Login /></Suspense>;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<NovaVisita />} />
        <Route path="/nova-visita" element={<NovaVisita />} />
        <Route path="/nova-visita-existente/:pessoaId" element={<NovaVisitaExistente />} />
        <Route path="/visitas" element={<HomePage />} />
        <Route path="/visita/:id" element={<DetalheVisita />} />
        <Route path="/editar-visita/:id" element={<EditarVisita />} />
        <Route path="/editar-pessoa/:id" element={<EditarPessoa />} />
        <Route path="/dashboard" element={role === "admin" ? <DashboardAdmin /> : <Navigate to="/" replace />} />
        <Route path="/pessoas" element={role === "admin" ? <PessoasPage /> : <Navigate to="/" replace />} />
        <Route path="/pessoa/:id" element={role === "admin" ? <PessoaDetalhePage /> : <Navigate to="/" replace />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
