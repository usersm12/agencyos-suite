import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ShieldAlert, TrendingUp, Users, CheckSquare, Target, Activity, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { profile } = useAuth();
  
  // Fetch unified dashboard data 
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard_metrics', profile?.role, profile?.id],
    queryFn: async () => {
      // We pull down aggregates dynamically. To handle role-bindings, we emulate RLS filtering client-side for immediate UX, 
      // though securely this would be backed by Supabase RLS policies active on the user token.
      const [clientsRes, tasksRes, flagsRes, activitiesRes] = await Promise.all([
        supabase.from('clients').select(`
          *,
          client_services (services (name)),
          profiles!clients_manager_id_fkey (full_name)
        `),
        supabase.from('tasks').select('*'),
        supabase.from('flags').select(`*, clients(name)`).eq('resolved', false),
        supabase.from('activity_logs').select(`*, profiles(full_name)`).order('created_at', { ascending: false }).limit(6)
      ]);
      
      const allClients = clientsRes.data || [];
      const allTasks = tasksRes.data || [];
      const allFlags = flagsRes.data || [];
      const activities = activitiesRes.data || [];
      
      const isManager = profile?.role === 'manager';
      const isTeammate = profile?.role === 'team_member';
      
      // Filter constraints
      const relevantClients = isManager ? allClients.filter(c => c.manager_id === profile.id) : allClients;
      const relevantTasks = isTeammate ? allTasks.filter(t => t.assigned_to === profile.id) : 
                            isManager ? allTasks.filter(t => relevantClients.find(c => c.id === t.client_id)) : allTasks;
      const relevantFlags = isManager ? allFlags.filter(f => relevantClients.find(c => c.id === f.client_id)) : allFlags;
      
      // Derived metrics
      const completedTasks = relevantTasks.filter(t => t.status === 'completed');
      const overdueTasks = relevantTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
      
      const completionRate = relevantTasks.length ? Math.round((completedTasks.length / relevantTasks.length) * 100) : 100;
      
      return {
        clients: relevantClients,
        tasks: relevantTasks,
        flags: relevantFlags,
        activities,
        metrics: {
          totalClients: relevantClients.length,
          greenClients: relevantClients.filter(c => c.health_score >= 80).length,
          amberClients: relevantClients.filter(c => c.health_score >= 50 && c.health_score < 80).length,
          redClients: relevantClients.filter(c => c.health_score < 50).length,
          completionRate,
          overdueCount: overdueTasks.length,
          unreadFlags: relevantFlags.filter(f => !f.seen_by_owner).length
        }
      };
    },
    enabled: !!profile?.role
  });

  if (isLoading || !dashboardData) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-muted/20 animate-pulse rounded-xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  const { metrics, clients, tasks, flags, activities } = dashboardData;
  const greeting = profile?.full_name ? profile.full_name.split(" ")[0] : "Welcome";
  const dateStr = format(new Date(), 'EEEE, MMMM do');

  const myTasksToday = tasks.filter(t => t.assigned_to === profile?.id && t.due_date === format(new Date(), 'yyyy-MM-dd') && t.status !== 'completed');

  return (
    <div className="space-y-8">
      {/* Top Strip */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Hello, {greeting}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-medium text-foreground">{dateStr}</span> &bull; 
            {myTasksToday.length} personal tasks due today
          </p>
        </div>
        
        <div className="flex gap-4">
           {metrics.unreadFlags > 0 && (
             <Button variant="destructive" className="gap-2">
               <ShieldAlert className="w-4 h-4" /> {metrics.unreadFlags} Unread Flags
             </Button>
           )}
           <div className="bg-muted px-4 py-2 rounded-lg flex items-center gap-4 text-sm font-medium">
             <div className="flex flex-col">
               <span className="text-muted-foreground text-xs uppercase tracking-wider">Completion</span>
               <span className="text-lg leading-none mt-0.5">{metrics.completionRate}%</span>
             </div>
             <div className="w-px h-8 bg-border" />
             <div className="flex flex-col">
               <span className="text-muted-foreground text-xs uppercase tracking-wider">Clients</span>
               <span className="text-lg leading-none mt-0.5">{metrics.totalClients}</span>
             </div>
           </div>
        </div>
      </div>

      {profile?.role === "team_member" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 border-primary/20 shadow-md">
             <CardHeader>
               <CardTitle>Your Priorities Today</CardTitle>
               <CardDescription>Focus deeply, clear your blockers.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               {myTasksToday.length > 0 ? myTasksToday.map(t => (
                 <div key={t.id} className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border">
                   <div>
                     <p className="font-semibold text-sm">{t.title}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">Priority: {t.priority}</p>
                   </div>
                   <Button size="sm">Quick Fill</Button>
                 </div>
               )) : (
                 <div className="h-32 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 border-dashed border rounded-xl">
                    <CheckSquare className="w-8 h-8 opacity-20 mb-2" />
                    <p className="text-sm">Inbox Zero! No tasks due today.</p>
                 </div>
               )}
             </CardContent>
           </Card>
           
           <Card>
             <CardHeader>
               <CardTitle>Overdue Items</CardTitle>
             </CardHeader>
             <CardContent>
               {tasks.filter(t => t.assigned_to === profile?.id && t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length > 0 ? (
                 <div className="space-y-3">
                   {tasks.filter(t => t.assigned_to === profile?.id && t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').map(t => (
                     <div key={t.id} className="text-sm p-3 border border-red-200 bg-red-50 rounded-lg text-red-900">
                       <span className="font-semibold block">{t.title}</span>
                       <span className="text-xs opacity-80 mt-1 block">Due {format(new Date(t.due_date || ''), 'MMM d')}</span>
                     </div>
                   ))}
                 </div>
               ) : (
                 <p className="text-sm text-green-600 font-medium">All caught up!</p>
               )}
             </CardContent>
           </Card>
        </div>
      ) : (
        <>
          {/* Health Row (Owner & Manager) */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-green-800 uppercase tracking-wider">Green Clients</CardTitle>
                <Activity className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{metrics.greenClients}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50/50 border-orange-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-orange-800 uppercase tracking-wider">Amber Clients</CardTitle>
                <Activity className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold text-orange-900">{metrics.amberClients}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-red-50 to-rose-50/50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-red-800 uppercase tracking-wider">Red Clients</CardTitle>
                <Activity className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold text-red-900">{metrics.redClients}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio Tasks Overdue</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                 <div className="text-3xl font-bold">{metrics.overdueCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Red Flag Panel */}
            <Card className="md:col-span-2 border-red-200 shadow-sm">
              <CardHeader className="bg-red-50/50 border-b border-red-100 rounded-t-xl">
                <CardTitle className="text-lg flex items-center text-red-900">
                  <ShieldAlert className="w-5 h-5 mr-2" /> Action Required (Active Flags)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {flags.length > 0 ? (
                  <div className="divide-y divide-border/50">
                     {flags.slice(0,10).map((f: any) => (
                       <div key={f.id} className="p-4 flex gap-4 hover:bg-muted/30 transition-colors">
                         <div className="mt-1 flex-shrink-0">
                           <Badge variant={f.severity === 'critical' ? 'destructive' : 'secondary'} className="uppercase text-[10px]">
                             {f.severity}
                           </Badge>
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="font-semibold text-sm truncate">{f.description}</p>
                           <p className="text-xs text-muted-foreground mt-1">Client: {f.clients?.name} &bull; Open for {format(new Date(f.triggered_date), 'MMM d')}</p>
                         </div>
                         <Button variant="outline" size="sm" className="hidden sm:inline-flex">Resolve</Button>
                       </div>
                     ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="font-medium">No unresolved flags detected.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Renewal Risk */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-md flex items-center">
                     <TrendingUp className="w-4 h-4 mr-2 text-rose-500" /> Renewal Risk
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {clients.filter(c => c.health_score < 80).slice(0,5).map(c => (
                     <div key={c.id} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-xs text-muted-foreground">MRR: ${(c.monthly_retainer_value || 0).toLocaleString()}</span>
                        </div>
                        <Badge variant="outline" className="bg-red-50 text-red-700">At Risk</Badge>
                     </div>
                   ))}
                </CardContent>
              </Card>

              {/* Upsell Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-md flex items-center">
                     <Users className="w-4 h-4 mr-2 text-green-500" /> Upsell Ops
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {clients.filter(c => c.health_score >= 80).slice(0,5).map((c: any) => {
                     const activeCount = c.client_services?.length || 0;
                     if (activeCount >= 3) return null; // Fully saturated client
                     return (
                       <div key={c.id} className="flex flex-col text-sm border-b pb-3 last:border-0 last:pb-0">
                          <span className="font-semibold">{c.name}</span>
                          <span className="text-xs text-muted-foreground mt-0.5">Strong health • Try pitching SEO/Ads</span>
                       </div>
                     );
                   })}
                </CardContent>
              </Card>
            </div>
            
            {/* Activity Logs */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="text-md">Recent Global Activity</CardTitle>
                <CardDescription>System log of all actions mapped across the agency.</CardDescription>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((act: any) => (
                       <div key={act.id} className="flex justify-between items-center text-sm border-b pb-3 last:border-0 last:pb-0">
                         <div className="flex flex-col">
                           <span className="font-semibold text-muted-foreground">{act.profiles?.full_name || 'System'}</span>
                           <span>{act.action} <span className="opacity-70 font-mono text-xs ml-1">({act.entity_type})</span></span>
                         </div>
                         <span className="text-xs text-muted-foreground">{format(new Date(act.created_at), 'MMM d, h:mm a')}</span>
                       </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4 italic">No recent activity detected.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
