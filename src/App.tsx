import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { FeatureFlagsProvider } from "@/lib/featureFlags";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FeatureRoute } from "@/components/FeatureRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Oposiciones from "./pages/Oposiciones";
import Marcas from "./pages/Marcas";
import Simulacros from "./pages/Simulacros";
import Ejercicios from "./pages/Ejercicios";
import Rutinas from "./pages/Rutinas";
import Diario from "./pages/Diario";
import Personalizado from "./pages/Personalizado";
import Evolucion from "./pages/Evolucion";
import Foro from "./pages/Foro";
import Chat from "./pages/Chat";
import Usuarios from "./pages/Usuarios";

import Admin from "./pages/Admin";
import Perfil from "./pages/Perfil";
import Baremos from "./pages/Baremos";
import Cooper from "./pages/Cooper";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <FeatureFlagsProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="oposiciones" element={<Oposiciones />} />
              <Route path="marcas" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Marcas /></ProtectedRoute>} />
              <Route path="simulacros" element={<Simulacros />} />
              <Route path="cooper" element={<Cooper />} />
              <Route path="ejercicios" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Ejercicios /></ProtectedRoute>} />
              <Route path="rutinas" element={<Rutinas />} />
              <Route path="diario" element={<Diario />} />
              <Route path="personalizado" element={<Personalizado />} />
              <Route path="evolucion" element={<Evolucion />} />
              <Route path="analitica" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Evolucion /></ProtectedRoute>} />
              <Route path="foro" element={<FeatureRoute feature="foro"><Foro /></FeatureRoute>} />
              <Route path="chat" element={<FeatureRoute feature="chat"><Chat /></FeatureRoute>} />
              <Route path="usuarios" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Usuarios /></ProtectedRoute>} />
              
              <Route path="baremos" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Baremos /></ProtectedRoute>} />
              <Route path="admin" element={<ProtectedRoute allow={["superadmin"]}><Admin /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </FeatureFlagsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
