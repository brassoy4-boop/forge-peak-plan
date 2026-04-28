import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, Users, Trophy, Target, Dumbbell, ClipboardList, BookOpen,
  FileText, MessageSquare, MessagesSquare, BarChart3, Upload, Settings, LogOut,
  Activity, ListChecks, FolderTree, Gauge, Timer,
} from "lucide-react";
import { useAuth, AppRole } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

interface Item { title: string; url: string; icon: any; }

const userItems: Item[] = [
  { title: "Mi panel", url: "/app", icon: LayoutDashboard },
  { title: "Mis oposiciones", url: "/app/oposiciones", icon: Trophy },
  { title: "Mis simulacros", url: "/app/simulacros", icon: Target },
  { title: "Mis tests de Cooper", url: "/app/cooper", icon: Timer },
  { title: "Mis rutinas", url: "/app/rutinas", icon: Dumbbell },
  { title: "Mi diario", url: "/app/diario", icon: BookOpen },
  { title: "Personalizado", url: "/app/personalizado", icon: FileText },
  { title: "Mi evolución", url: "/app/evolucion", icon: BarChart3 },
  { title: "Foro", url: "/app/foro", icon: MessagesSquare },
  { title: "Chat", url: "/app/chat", icon: MessageSquare },
];

const coachItems: Item[] = [
  { title: "Dashboard", url: "/app", icon: LayoutDashboard },
  { title: "Usuarios", url: "/app/usuarios", icon: Users },
  { title: "Oposiciones", url: "/app/oposiciones", icon: Trophy },
  { title: "Marcas", url: "/app/marcas", icon: ListChecks },
  { title: "Baremos", url: "/app/baremos", icon: Gauge },
  { title: "Simulacros", url: "/app/simulacros", icon: Target },
  { title: "Test de Cooper", url: "/app/cooper", icon: Timer },
  { title: "Ejercicios", url: "/app/ejercicios", icon: Activity },
  { title: "Rutinas", url: "/app/rutinas", icon: Dumbbell },
  { title: "Diario", url: "/app/diario", icon: BookOpen },
  { title: "Personalizado", url: "/app/personalizado", icon: FileText },
  
  { title: "Foro", url: "/app/foro", icon: MessagesSquare },
  { title: "Chat", url: "/app/chat", icon: MessageSquare },
  { title: "Analítica", url: "/app/analitica", icon: BarChart3 },
];

const adminItems: Item[] = [
  ...coachItems,
  { title: "Configuración", url: "/app/admin", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { primaryRole, signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const items: Item[] =
    primaryRole === "superadmin" ? adminItems :
    primaryRole === "entrenador" ? coachItems :
    userItems;

  const isActive = (url: string) => {
    if (url === "/app") return location.pathname === "/app";
    return location.pathname.startsWith(url);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        {!collapsed ? (
          <Brand size="md" className="text-sidebar-foreground" />
        ) : (
          <div className="brand-title text-2xl font-bold text-sidebar-foreground text-center">
            C<span className="brand-accent">10</span>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{primaryRole === "usuario" ? "Mi área" : primaryRole === "entrenador" ? "Entrenador" : "Administración"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/app"}>
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="text-xs text-sidebar-foreground/70 px-2 pb-2 truncate">{user.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Salir</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
