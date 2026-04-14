import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ShieldAlert, TrendingUp, Users, CheckSquare, Zap, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencies";

export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard_metrics', profile?.role, profile?.id],
    queryFn: async () => {
      const [clientsRes, tasksRes, flagsRes, profilesRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('tasks').select('*, projects(client_id, clients(name))'),
        supabase.from('flags').select('*, clients(name)').eq('status', 'open'),
        supabase.from('profiles').select('id, full_name, role'),
      ]);
      
      const allClients = clientsRes.data || [];
      const allTasks = tasksRes.data || [];
      const allFlags = flagsRes.data || [];
      const allProfiles = profilesRes.data || [];
      
      const isTeammate = profile?.role === 'team_member';
      
      const relevantTasks = isTeammate ? allTasks.filter(t => t.assigned_to === profile?.id) : allTasks;
      const relevantFlags = allFlags;
      
      const completedTasks = relevantTasks.filter(t => t.status === 'completed');
      const overdueTasks = relevantTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed');
      const completionRate = relevantTasks.length ? Math.round((completedTasks.length / relevantTasks.length) * 100) : 100;

      // Month completion
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const completedThisMonth = relevantTasks.filter(t => t.status === 'completed' && t.updated_at >= monthStart).length;
      
      return {
        clients: allClients,
        tasks: relevantTasks,
        allTasks,
        flags: relevantFlags,
        profiles: allProfiles,
        metrics: {
          totalClients: allClients.length,
          greenClients: allClients.filter(c => c.health_score >= 80).length,
          amberClients: allClients.filter(c => c.health_score >= 50 && c.health_score < 80).length,
          redClients: allClients.filter(c => c.health_score < 50).length,
          completionRate,
          overdueCount: overdueTasks.length,
          openFlags: relevantFlags.length,
          completedThisMonth,
        }
      };
    },
    enabled: !!profile?.role
  });

  // Monthly task generation handler
  const handleGenerateMonthlyTasks = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthLabel = format(now, 'MMMM yyyy');

      console.log('--- Generating Tasks for', monthLabel, '---');

      const { count: globalServicesCount, error: gErr } = await supabase.from('client_services').select('id', { count: 'exact', head: true }).eq('is_active', true);
      console.log('Global active services count:', globalServicesCount, gErr);
      if (globalServicesCount === 0 || globalServicesCount === null) {
        toast.warning("No clients have active services assigned. Please assign services to active clients first.");
        setIsGenerating(false);
        return;
      }

      // Check and seed templates if empty
      const { data: existingTemplates } = await supabase.from('service_task_templates').select('id').limit(1);
      console.log('Existing templates count (max 1):', existingTemplates?.length);
      
      if (!existingTemplates || existingTemplates.length === 0) {
        console.log('Seeding service task templates...');
        const { data: services } = await supabase.from('services').select('id, name');
        if (services) {
          const presets: Record<string, string[]> = {
            'seo': ['Keyword Rankings Check', 'Backlink Building', 'Technical Audit', 'Content Publishing', 'Search Console Review', 'Monthly Report Sent'],
            'google ads': ['Campaign Performance Review', 'Budget Utilisation Check', 'Ad Copy Refresh', 'Negative Keywords Update'],
            'meta ads': ['Campaign Review', 'Audience Refresh', 'Creative Performance Review', 'Budget Pacing Check'],
            'social media': ['Content Calendar Approval', 'Posts Publishing', 'Engagement Report', 'Follower Count Update'],
            'web development': ['Project Status Update', 'Client Review Meeting', 'Milestone Check'],
            'web dev': ['Project Status Update', 'Client Review Meeting', 'Milestone Check']
          };
          const insertPayloads: any[] = [];
          for (const s of services) {
            const tasks = presets[s.name.toLowerCase()] || [];
            tasks.forEach((t, i) => {
              insertPayloads.push({
                service_id: s.id,
                template_name: t,
                sort_order: i
              });
            });
          }
          if (insertPayloads.length > 0) {
            console.log('Inserting', insertPayloads.length, 'templates');
            await supabase.from('service_task_templates').insert(insertPayloads);
          }
        }
      }

      const { data: activeClients } = await supabase.from('clients').select('id, name').eq('status', 'active');
      console.log('Active clients found:', activeClients?.length);
      
      if (!activeClients || activeClients.length === 0) {
        toast.info("No active clients found");
        setIsGenerating(false);
        return;
      }

      let generatedCount = 0;
      let csCount = 0;
      let ttCount = 0;
      let debugLog: string[] = [];
      const errLog = (msg: string) => { console.error(msg); debugLog.push(msg); };

      debugLog.push(`Found ${activeClients.length} active clients.`);

      for (const client of activeClients) {
        console.log(`Processing client: ${client.name} (${client.id})`);
        
        // Get active services for this client
        const { data: clientServices, error: csErr } = await supabase
          .from('client_services')
          .select('service_id, services(name)')
          .eq('client_id', client.id)
          .eq('is_active', true);

        if (csErr) errLog(`CS Error for ${client.name}: ${csErr.message}`);
        
        const count = clientServices?.length || 0;
        csCount += count;
        console.log(` - Services found for ${client.name}: ${count}`);
        
        if (count === 0) continue;

        // Get or create project
        let { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', client.id)
          .limit(1)
          .maybeSingle();

        if (!project) {
          console.log(' - Creating default project for', client.name);
          const { data: newProj, error: projErr } = await supabase
            .from('projects')
            .insert({ client_id: client.id, name: `${client.name} Default Project`, status: 'active' })
            .select('id')
            .single();
          if (projErr) {
            console.error(' - Project creation failed:', projErr);
            continue;
          }
          project = newProj;
        }

        for (const cs of clientServices) {
          const serviceName = (cs.services as any)?.name || 'Service';
          console.log(`   - Processing service: ${serviceName} (ID: ${cs.service_id})`);
          
          // Get templates for this service
          const { data: templates, error: tmplErr } = await supabase
            .from('service_task_templates')
            .select('id, template_name')
            .eq('service_id', cs.service_id)
            .order('sort_order');

          if (tmplErr) errLog(`Template Error for ${serviceName}: ${tmplErr.message}`);
          
          const tCount = templates?.length || 0;
          ttCount += tCount;
          console.log(`     - Templates found: ${tCount}`);
          
          if (tCount === 0) continue;

          for (const template of templates) {
            const title = `${template.template_name} - ${monthLabel}`;
            
            // Check duplicate
            const { data: existing } = await supabase
              .from('tasks')
              .select('id')
              .eq('project_id', project!.id)
              .eq('title', title)
              .maybeSingle();

            if (!existing) {
              const insertData = {
                title,
                project_id: project!.id,
                service_type: serviceName,
                due_date: format(lastDay, 'yyyy-MM-dd'),
                status: 'pending',
                priority: 'medium',
                service_template_id: template.id
              };
              console.log('       - Creating task with payload:', insertData);
              const { error: insErr } = await supabase.from('tasks').insert(insertData);
              if (insErr) {
                 errLog(`Insert Error for "${title}": ${insErr.message}`);
              } else {
                 generatedCount++;
                 console.log('       - Task created successfully');
              }
            } else {
               console.log('       - Task already exists (skipping):', title);
            }
          }
        }
      }

      console.log('--- Generation Complete! ---');
      const finalMsg = `Debug Summary:\nClients: ${activeClients.length}\nClient Services: ${csCount}\nTemplates Fetched: ${ttCount}\nTasks Generated: ${generatedCount}\nErrors: ${debugLog.filter(m => m.includes('Error')).length}`;
      alert(finalMsg + (debugLog.length > 1 ? '\n\nLogs:\n' + debugLog.join('\n') : ''));
      
      if (generatedCount > 0) {
        toast.success(`Generated ${generatedCount} tasks for ${monthLabel}`);
        queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] });
        queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
      } else {
        toast.info("No new tasks needed to be generated.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to generate tasks");
    } finally {
      setIsGenerating(false);
    }
  };

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

  const { metrics, clients, tasks, flags, allTasks, profiles } = dashboardData;
  const greeting = profile?.full_name ? profile.full_name.split(" ")[0] : "Welcome";
  const dateStr = format(new Date(), 'EEEE, MMMM do');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const myTasksToday = tasks.filter(t => t.assigned_to === profile?.id && t.due_date === todayStr && t.status !== 'completed');
  const myOverdue = tasks.filter(t => t.assigned_to === profile?.id && t.due_date && t.due_date < todayStr && t.status !== 'completed');
  const myThisWeek = tasks.filter(t => {
    if (!t.due_date || t.status === 'completed' || t.assigned_to !== profile?.id) return false;
    const d = new Date(t.due_date);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
    return d >= now && d <= weekEnd;
  });

  // Team member dashboard
  if (profile?.role === "team_member") {
    return (
      <div className="space-y-8">
        <div className="border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Hello, {greeting}</h1>
          <p className="text-muted-foreground">{dateStr} &bull; {myTasksToday.length} tasks due today</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-primary/20 shadow-md">
            <CardHeader>
              <CardTitle>Tasks Due Today</CardTitle>
              <CardDescription>Sorted by priority</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTasksToday.sort((a, b) => {
                const p = { high: 0, medium: 1, low: 2 };
                return (p[a.priority as keyof typeof p] ?? 1) - (p[b.priority as keyof typeof p] ?? 1);
              }).map(t => (
                <div key={t.id} className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border">
                  <div>
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Priority: {t.priority} &bull; {(t.projects as any)?.clients?.name}</p>
                  </div>
                  <Badge variant={t.priority === 'high' ? 'destructive' : 'secondary'}>{t.priority}</Badge>
                </div>
              ))}
              {myTasksToday.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 border-dashed border rounded-xl">
                  <CheckSquare className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">Inbox Zero! No tasks due today.</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="space-y-6">
            <Card className="border-red-200">
              <CardHeader><CardTitle className="text-destructive">Overdue</CardTitle></CardHeader>
              <CardContent>
                {myOverdue.length > 0 ? (
                  <div className="space-y-2">
                    {myOverdue.map(t => (
                      <div key={t.id} className="text-sm p-3 border border-red-200 bg-red-50 rounded-lg text-red-900">
                        <span className="font-semibold block">{t.title}</span>
                        <span className="text-xs opacity-80">Due {format(new Date(t.due_date!), 'MMM d')}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-green-600 font-medium">All caught up!</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>This Week</CardTitle></CardHeader>
              <CardContent>
                {myThisWeek.length > 0 ? (
                  <div className="space-y-2">
                    {myThisWeek.map(t => (
                      <div key={t.id} className="text-sm p-2 border rounded-lg flex justify-between items-center">
                        <span className="font-medium">{t.title}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(t.due_date!), 'EEE')}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No upcoming tasks this week.</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Manager dashboard
  if (profile?.role === "manager") {
    return (
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Hello, {greeting}</h1>
            <p className="text-muted-foreground">{dateStr}</p>
          </div>
          <Button onClick={handleGenerateMonthlyTasks} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Monthly Tasks
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Green Clients', count: metrics.greenClients, color: 'text-green-700 bg-green-50 border-green-200' },
            { label: 'Amber Clients', count: metrics.amberClients, color: 'text-orange-700 bg-orange-50 border-orange-200' },
            { label: 'Red Clients', count: metrics.redClients, color: 'text-red-700 bg-red-50 border-red-200' },
          ].map(c => (
            <Card key={c.label} className={c.color}>
              <CardContent className="pt-6">
                <p className="text-sm font-semibold uppercase tracking-wider">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.count}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-red-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5" /> Your Flags</CardTitle></CardHeader>
          <CardContent>
            {flags.length > 0 ? (
              <div className="divide-y">
                {flags.slice(0, 10).map((f: any) => (
                  <div key={f.id} className="py-3 flex justify-between items-center">
                    <div>
                      <Badge variant={f.priority === 'high' ? 'destructive' : 'secondary'} className="text-[10px] mr-2">{f.priority === 'high' ? 'Critical' : 'Warning'}</Badge>
                      <span className="text-sm font-medium">{f.title}</span>
                      <span className="text-xs text-muted-foreground ml-2">{(f.clients as any)?.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No open flags.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your Team Tasks Overview</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted/30 rounded-lg">
                <p className="text-2xl font-bold">{tasks.length}</p>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{tasks.filter(t => t.status === 'completed').length}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{metrics.overdueCount}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Owner dashboard
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
        
        <div className="flex gap-3 flex-wrap">
          <Button onClick={handleGenerateMonthlyTasks} disabled={isGenerating} variant="outline" className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Generate Monthly Tasks
          </Button>
           {metrics.openFlags > 0 && (
             <Button variant="destructive" className="gap-2" onClick={() => navigate('/flags')}>
               <ShieldAlert className="w-4 h-4" /> {metrics.openFlags} Open Flags
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

      {/* Agency Health Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50/50 border-green-200">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-green-800 uppercase tracking-wider">Green</p>
            <p className="text-3xl font-bold text-green-900">{metrics.greenClients}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50/50 border-orange-200">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-orange-800 uppercase tracking-wider">Amber</p>
            <p className="text-3xl font-bold text-orange-900">{metrics.amberClients}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-50 to-rose-50/50 border-red-200">
          <CardContent className="pt-6">
            <p className="text-sm font-semibold text-red-800 uppercase tracking-wider">Red</p>
            <p className="text-3xl font-bold text-red-900">{metrics.redClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Overdue Tasks</p>
            <p className="text-3xl font-bold">{metrics.overdueCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-muted-foreground">Completed MTD</p>
            <p className="text-3xl font-bold">{metrics.completedThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Red Flag Panel + Client Health */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border-red-200 shadow-sm">
          <CardHeader className="bg-red-50/50 border-b border-red-100 rounded-t-xl flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center text-red-900">
              <ShieldAlert className="w-5 h-5 mr-2" /> Active Flags
            </CardTitle>
            <Button variant="link" size="sm" onClick={() => navigate('/flags')}>View All</Button>
          </CardHeader>
          <CardContent className="p-0">
            {flags.length > 0 ? (
              <div className="divide-y divide-border/50">
                 {flags.slice(0,10).map((f: any) => (
                   <div key={f.id} className="p-4 flex gap-4 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate('/flags')}>
                     <Badge variant={f.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px] h-fit">
                       {f.priority === 'high' ? 'Critical' : 'Warning'}
                     </Badge>
                     <div className="flex-1 min-w-0">
                       <p className="font-semibold text-sm truncate">{f.title}</p>
                       <p className="text-xs text-muted-foreground mt-1">Client: {(f.clients as any)?.name} &bull; {format(new Date(f.created_at), 'MMM d')}</p>
                     </div>
                   </div>
                 ))}
              </div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <p className="font-medium">No open flags. All clear!</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center">
                 <TrendingUp className="w-4 h-4 mr-2 text-rose-500" /> Renewal Risk
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {clients.filter(c => c.health_score < 50).slice(0,5).map(c => (
                 <div key={c.id} className="flex justify-between items-center text-sm cursor-pointer hover:bg-muted/30 p-2 rounded" onClick={() => navigate(`/clients/${c.id}`)}>
                    <div className="flex flex-col">
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-muted-foreground">MRR: {formatCurrency(c.monthly_retainer_value || 0, c.currency || 'USD')}</span>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700">At Risk</Badge>
                 </div>
               ))}
               {clients.filter(c => c.health_score < 50).length === 0 && (
                 <p className="text-sm text-muted-foreground">No at-risk clients.</p>
               )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-md flex items-center">
                 <Users className="w-4 h-4 mr-2 text-green-500" /> Upsell Ops
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
               {clients.filter(c => c.health_score >= 80).slice(0,5).map(c => (
                 <div key={c.id} className="flex flex-col text-sm border-b pb-3 last:border-0 last:pb-0">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground mt-0.5">Strong health • Try pitching additional services</span>
                 </div>
               ))}
               {clients.filter(c => c.health_score >= 80).length === 0 && (
                 <p className="text-sm text-muted-foreground">No high-health clients yet.</p>
               )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Client Health Grid */}
      <Card>
        <CardHeader><CardTitle>Client Health Grid</CardTitle><CardDescription>All clients sorted by health score (worst first)</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[...clients].sort((a, b) => a.health_score - b.health_score).map(c => {
              const healthColor = c.health_score >= 80 ? 'bg-green-100 text-green-800 border-green-200' : c.health_score >= 50 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-red-100 text-red-800 border-red-200';
              return (
                <div key={c.id} className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/clients/${c.id}`)}>
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm">{c.name}</span>
                    <Badge className={healthColor}>{c.health_score}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{c.industry || 'General'}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Utilization */}
      <Card>
        <CardHeader><CardTitle>Team Utilization</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {profiles.map((p: any) => {
              const pTasks = (allTasks || []).filter((t: any) => t.assigned_to === p.id);
              const completed = pTasks.filter((t: any) => t.status === 'completed').length;
              const overdue = pTasks.filter((t: any) => t.due_date && t.due_date < todayStr && t.status !== 'completed').length;
              const util = pTasks.length > 0 ? Math.round((pTasks.length / 30) * 100) : 0;
              const utilColor = util > 100 ? 'bg-red-500' : util > 80 ? 'bg-amber-500' : 'bg-green-500';
              
              return (
                <div key={p.id} className="flex items-center gap-4">
                  <div className="w-32 truncate">
                    <span className="font-medium text-sm">{p.full_name || 'Unknown'}</span>
                  </div>
                  <div className="flex-1">
                    <Progress value={Math.min(util, 100)} className={`h-2 [&>div]:${utilColor}`} />
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground min-w-[200px]">
                    <span>Assigned: {pTasks.length}</span>
                    <span>Done: {completed}</span>
                    <span className={overdue > 0 ? 'text-red-600 font-semibold' : ''}>Overdue: {overdue}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
