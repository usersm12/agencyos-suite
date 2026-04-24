import { LayoutDashboard, Users, CheckSquare, UserCog, Flag, BarChart3, Settings, LogOut, Menu, Sparkles } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Outlet } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useBackgroundEngine } from "@/hooks/useBackgroundEngine";
import { GlobalSearch } from "@/components/GlobalSearch";
import { QuickLogButton } from "@/components/QuickLogButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Team", url: "/team", icon: UserCog },
  { title: "Flags", url: "/flags", icon: Flag },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Settings", url: "/settings", icon: Settings },
];

function AppSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();

  const { data: openFlagsCount } = useQuery({
    queryKey: ['open-flags-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('flags')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-[#0d0d14] text-sidebar-foreground border-r border-white/[0.04]">
        <div className="p-4 flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              AgencyOS
            </h1>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-white/30 text-xs uppercase tracking-wider px-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="text-white/50 hover:bg-white/[0.04] hover:text-foreground transition-all duration-150 rounded-lg mx-1"
                      activeClassName="bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500 font-medium rounded-lg mx-1"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center justify-between w-full">
                          {item.title}
                          {item.title === "Flags" && openFlagsCount && openFlagsCount > 0 ? (
                            <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {openFlagsCount}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          {!collapsed && profile && (
            <div className="mb-3 px-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-[2px] shrink-0">
                <div className="w-full h-full rounded-full bg-[#0d0d14] flex items-center justify-center">
                  <span className="text-xs font-semibold text-indigo-300">
                    {profile.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">
                  {profile.full_name}
                </p>
                <span className="text-[10px] text-white/40 capitalize bg-white/5 px-1.5 py-0.5 rounded-full border border-white/[0.06]">
                  {profile.role.replace("_", " ")}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={signOut}
            className="w-full text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AppLayout() {
  useBackgroundEngine();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebarContent />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-white/[0.04] bg-[#0d0d14]/80 backdrop-blur-xl px-4 shrink-0">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4 text-white/50 hover:text-white/80 hover:bg-white/[0.04] rounded-lg transition-colors">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            </div>
            <div className="flex items-center gap-2">
              <div className="border border-white/[0.06] bg-white/[0.02] rounded-lg backdrop-blur-sm">
                <GlobalSearch />
              </div>
              <NotificationBell />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto bg-[#0a0a0f]">
            <ErrorBoundary>
              <div className="animate-fade-in">
                <Outlet />
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <QuickLogButton />
    </SidebarProvider>
  );
}
