import { Outlet, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { UserCircle } from "lucide-react";

export default function AppLayout() {
  const { primaryRole } = useAuth();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b bg-card px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="brand-title text-lg hidden sm:inline">CORPORE<span className="brand-accent">10</span></span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button variant="ghost" size="icon" asChild>
                <Link to="/app/perfil" aria-label="Mi perfil"><UserCircle className="h-5 w-5" /></Link>
              </Button>
              {primaryRole && (
                <Badge variant={primaryRole === "superadmin" ? "destructive" : primaryRole === "entrenador" ? "default" : "secondary"} className="uppercase tracking-wider">
                  {primaryRole}
                </Badge>
              )}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
