import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "./pages/Auth";
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
import CargaMasiva from "./pages/CargaMasiva";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="oposiciones" element={<Oposiciones />} />
              <Route path="marcas" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Marcas /></ProtectedRoute>} />
              <Route path="simulacros" element={<Simulacros />} />
              <Route path="ejercicios" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Ejercicios /></ProtectedRoute>} />
              <Route path="rutinas" element={<Rutinas />} />
              <Route path="diario" element={<Diario />} />
              <Route path="personalizado" element={<Personalizado />} />
              <Route path="evolucion" element={<Evolucion />} />
              <Route path="analitica" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Evolucion /></ProtectedRoute>} />
              <Route path="foro" element={<Foro />} />
              <Route path="chat" element={<Chat />} />
              <Route path="usuarios" element={<ProtectedRoute allow={["entrenador","superadmin"]}><Usuarios /></ProtectedRoute>} />
              <Route path="carga-masiva" element={<ProtectedRoute allow={["entrenador","superadmin"]}><CargaMasiva /></ProtectedRoute>} />
              <Route path="admin" element={<ProtectedRoute allow={["superadmin"]}><Admin /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </Routes>... </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
