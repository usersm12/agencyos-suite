import { LayoutDashboard, Users, CheckSquare, UserCog, Flag, BarChart3, Settings, LogOut, Menu, Sparkles, Sun, Moon } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
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
  { title: "Clients",   url: "/clients",   icon: Users },
  { title: "Tasks",     url: "/tasks",     icon: CheckSquare },
  { title: "Team",      url: "/team",      icon: UserCog },
  { title: "Flags",     url: "/flags",     icon: Flag },
  { title: "Reports",   url: "/reports",   icon: BarChart3 },
  { title: "Settings",  url: "/settings",  icon: Settings },
];

function AppSidebarContent() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();

  const { data: openFlagsCount } = useQuery({
    queryKey: ["open-flags-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("flags")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar border-r border-sidebar-border text-sidebar-foreground">
        {/* Logo */}
        <div className="p-4 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/25 shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-orange-400 to-orange-500 bg-clip-text text-transparent">
              AgencyOS
            </h1>
          )}
        </div>

        {/* Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-xs uppercase tracking-wider px-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all duration-150 rounded-lg mx-1"
                      activeClassName="bg-orange-500/15 text-orange-400 border-l-2 border-orange-500 font-medium rounded-lg mx-1"
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

        {/* User + sign out */}
        <div className="mt-auto p-4">
          {!collapsed && profile && (
            <div className="mb-3 px-1 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 p-[2px] shrink-0">
                <div className="w-full h-full rounded-full bg-sidebar flex items-center justify-center">
                  <span className="text-xs font-semibold text-orange-300">
                    {profile.full_name?.charAt(0)?.toUpperCase() ?? "U"}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground/90 truncate">
                  {profile.full_name}
                </p>
                <span className="text-[10px] text-sidebar-muted capitalize bg-sidebar-accent px-1.5 py-0.5 rounded-full border border-sidebar-border">
                  {profile.role.replace("_", " ")}
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            onClick={signOut}
            className="w-full text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function AppLayout() {
  useBackgroundEngine();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebarContent />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-xl px-4 shrink-0">
            <div className="flex items-center">
              <SidebarTrigger className="mr-3 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            </div>
            <div className="flex items-center gap-2">
              <GlobalSearch />
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
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
