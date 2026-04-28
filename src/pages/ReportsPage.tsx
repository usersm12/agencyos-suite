import { useState, useMemo } from "react";
import { formatCurrency } from "@/lib/currencies";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Printer } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("agency");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const { data: allFlagsForHealth } = useQuery({
    queryKey: ['reports-flags-health'],
    queryFn: async () => {
      const { data } = await supabase.from('flags').select('client_id, status');
      return data || [];
    }
  });

  const { data: rawClients } = useQuery({
    queryKey: ['reports-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, industry, monthly_retainer_value, currency').order('name');
      return data || [];
    }
  });

  // Calculate health_score client-side from open flag counts
  const clients = useMemo(() => {
    if (!rawClients) return [];
    const flagCountByClient: Record<string, number> = {};
    (allFlagsForHealth || []).forEach((f: any) => {
      if (f.client_id && f.status === 'open') {
        flagCountByClient[f.client_id] = (flagCountByClient[f.client_id] || 0) + 1;
      }
    });
    return rawClients.map((c: any) => ({
      ...c,
      health_score: Math.max(0, 100 - (flagCountByClient[c.id] || 0) * 15),
    }));
  }, [rawClients, allFlagsForHealth]);

  const { data: allTasks } = useQuery({
    queryKey: ['reports-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('*, projects(client_id, clients(name))');
      return data || [];
    }
  });

  const { data: allFlags } = useQuery({
    queryKey: ['reports-flags'],
    queryFn: async () => {
      const { data } = await supabase.from('flags').select('*, clients(name)');
      return data || [];
    }
  });

  const { data: profiles } = useQuery({
    queryKey: ['reports-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      return data || [];
    }
  });

  // Generate monthly data for charts
  const monthlyData = useMemo(() => {
    if (!allTasks) return [];
    const months: { name: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push({
        name: format(d, 'MMM'),
        start: startOfMonth(d),
        end: endOfMonth(d),
      });
    }

    return months.map(m => {
      const monthTasks = allTasks.filter(t => {
        const created = new Date(t.created_at);
        return created >= m.start && created <= m.end;
      });
      const completed = monthTasks.filter(t => t.status === 'completed').length;
      const total = monthTasks.length;
      return {
        name: m.name,
        completion: total > 0 ? Math.round((completed / total) * 100) : 0,
        total,
        completed,
      };
    });
  }, [allTasks]);

  // Client-specific data
  const clientData = useMemo(() => {
    if (!allTasks || selectedClient === 'all') return null;
    const clientTasks = allTasks.filter(t => (t.projects as any)?.client_id === selectedClient);
    const clientFlags = allFlags?.filter(f => f.client_id === selectedClient) || [];

    const months: { name: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      months.push({ name: format(d, 'MMM'), start: startOfMonth(d), end: endOfMonth(d) });
    }

    const chartData = months.map(m => {
      const mTasks = clientTasks.filter(t => new Date(t.created_at) >= m.start && new Date(t.created_at) <= m.end);
      const completed = mTasks.filter(t => t.status === 'completed').length;
      return {
        name: m.name,
        completed,
        total: mTasks.length,
        rate: mTasks.length > 0 ? Math.round((completed / mTasks.length) * 100) : 0,
      };
    });

    return { chartData, flags: clientFlags };
  }, [allTasks, allFlags, selectedClient]);

  const handleExportCSV = () => {
    if (!clients) return;
    const headers = ['Client', 'Health Score', 'Health Status', 'Industry', 'MRR'];
    const rows = clients.map((c: any) => {
      const status = c.health_score >= 80 ? 'Green' : c.health_score >= 50 ? 'Amber' : 'Red';
      return [c.name, c.health_score, status, c.industry || '', formatCurrency(c.monthly_retainer_value || 0, c.currency || 'USD')];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agency-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Team performance
  const teamPerformance = useMemo(() => {
    if (!profiles || !allTasks) return [];
    return profiles.map(p => {
      const pTasks = allTasks.filter(t => t.assigned_to === p.id);
      const completed = pTasks.filter(t => t.status === 'completed').length;
      const overdue = pTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length;
      return {
        name: p.full_name || 'Unknown',
        role: p.role,
        assigned: pTasks.length,
        completed,
        onTimeRate: pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 100,
        overdue,
      };
    });
  }, [profiles, allTasks]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Reports</h1>
          <p className="text-muted-foreground mt-1">Exportable insights for client performance and agency health.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button onClick={handleExportCSV} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="agency">Agency Overview</TabsTrigger>
            <TabsTrigger value="client">Client Performance</TabsTrigger>
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
          </TabsList>
          
          {activeTab === 'client' && (
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Select a client..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients (Aggregate)</SelectItem>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <TabsContent value="agency" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Agency Task Completion Trend</CardTitle>
                <CardDescription>6-month completion rate trend</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="completion" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} name="Completion %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tasks Volume per Month</CardTitle>
                <CardDescription>Total vs completed tasks</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="completed" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          {/* All Clients Health */}
          <Card>
            <CardHeader><CardTitle>All Clients Health Scores</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Health Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients?.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.industry || '-'}</TableCell>
                      <TableCell>{c.health_score}</TableCell>
                      <TableCell>
                        <Badge className={
                          c.health_score >= 80 ? 'bg-green-100 text-green-700' :
                          c.health_score >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }>
                          {c.health_score >= 80 ? 'Green' : c.health_score >= 50 ? 'Amber' : 'Red'}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(c.monthly_retainer_value || 0, c.currency || 'USD')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card>
            <CardHeader><CardTitle>Team Performance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>On-Time %</TableHead>
                    <TableHead>Overdue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamPerformance.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="capitalize">{t.role?.replace('_', ' ')}</TableCell>
                      <TableCell>{t.assigned}</TableCell>
                      <TableCell>{t.onTimeRate}%</TableCell>
                      <TableCell className={t.overdue > 0 ? 'text-red-600 font-semibold' : ''}>{t.overdue}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="client" className="space-y-6">
          {selectedClient !== 'all' && clientData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{clients?.find(c => c.id === selectedClient)?.name} — Task Completion per Month</CardTitle>
                </CardHeader>
                <CardContent className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={clientData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} />
                      <YAxis axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Total Tasks" />
                      <Bar dataKey="completed" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Completed" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Flag History</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientData.flags.map(f => (
                        <TableRow key={f.id}>
                          <TableCell>{format(new Date(f.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{f.title}</TableCell>
                          <TableCell><Badge variant={f.priority === 'high' ? 'destructive' : 'secondary'}>{f.priority}</Badge></TableCell>
                          <TableCell><Badge variant="outline">{f.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                      {clientData.flags.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No flags for this client.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a specific client from the dropdown to view their performance report.
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="time" className="space-y-6">
          <TimeTrackingTab clients={clients} profiles={profiles || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Time Tracking Tab ───────────────────────────────────────────────────────

interface TimeTrackingTabProps {
  clients: any[];
  profiles: any[];
}

function TimeTrackingTab({ clients, profiles }: TimeTrackingTabProps) {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<string>(toDateStr(startOfMonth(now)));
  const [dateTo, setDateTo] = useState<string>(toDateStr(endOfMonth(now)));
  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterMember, setFilterMember] = useState<string>("all");

  const { data: rawLogs = [] } = useQuery({
    queryKey: ["reports-time-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*, profiles(full_name), tasks(title, service_type, client_id, clients(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Quick ranges
  function applyThisMonth() {
    setDateFrom(toDateStr(startOfMonth(now)));
    setDateTo(toDateStr(endOfMonth(now)));
  }
  function applyLastMonth() {
    const last = subMonths(now, 1);
    setDateFrom(toDateStr(startOfMonth(last)));
    setDateTo(toDateStr(endOfMonth(last)));
  }
  function applyLast3Months() {
    setDateFrom(toDateStr(startOfMonth(subMonths(now, 2))));
    setDateTo(toDateStr(endOfMonth(now)));
  }

  // Filtered logs (client-side)
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((l: any) => {
      const d = new Date(l.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (filterClient !== "all") {
        const clientId = l.client_id || l.tasks?.client_id;
        if (clientId !== filterClient) return false;
      }
      if (filterMember !== "all" && l.user_id !== filterMember) return false;
      return true;
    });
  }, [rawLogs, dateFrom, dateTo, filterClient, filterMember]);

  const totalMinutes = useMemo(
    () => filteredLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0),
    [filteredLogs]
  );
  const uniqueClients = useMemo(() => {
    const ids = new Set(filteredLogs.map((l: any) => l.client_id || l.tasks?.client_id).filter(Boolean));
    return ids.size;
  }, [filteredLogs]);
  const avgPerSession = filteredLogs.length > 0 ? totalMinutes / filteredLogs.length : 0;

  // Hours by client (top 8)
  const byClient = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }> = {};
    filteredLogs.forEach((l: any) => {
      const name = l.tasks?.clients?.name || "Unknown";
      if (!map[name]) map[name] = { name, minutes: 0 };
      map[name].minutes += l.duration_minutes || 0;
    });
    return Object.values(map)
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 8)
      .map((v) => ({ name: v.name, hours: parseFloat((v.minutes / 60).toFixed(1)) }));
  }, [filteredLogs]);

  // Hours by team member
  const byMember = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }> = {};
    filteredLogs.forEach((l: any) => {
      const name = l.profiles?.full_name || "Unknown";
      if (!map[name]) map[name] = { name, minutes: 0 };
      map[name].minutes += l.duration_minutes || 0;
    });
    return Object.values(map).map((v) => ({
      name: v.name,
      hours: parseFloat((v.minutes / 60).toFixed(1)),
    }));
  }, [filteredLogs]);

  function handleExportCSV() {
    const headers = ["Date", "Client", "Task", "Service Type", "Team Member", "Duration (mins)", "Notes"];
    const rows = filteredLogs.map((l: any) => [
      format(new Date(l.created_at), "yyyy-MM-dd"),
      l.tasks?.clients?.name || "",
      l.tasks?.title || "",
      l.tasks?.service_type || "",
      l.profiles?.full_name || "",
      l.duration_minutes || 0,
      (l.notes || "").replace(/,/g, " "),
    ]);
    const csv = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `time-tracking-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-38 text-sm h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">To</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-38 text-sm h-8"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Client</span>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Team Member</span>
              <Select value={filterMember} onValueChange={setFilterMember}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {profiles.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyThisMonth}>This Month</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyLastMonth}>Last Month</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyLast3Months}>Last 3 Months</Button>
            </div>
            <Button size="sm" className="h-8 text-xs gap-1.5 ml-auto" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
            <p className="text-2xl font-bold">{fmtDuration(totalMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Sessions</p>
            <p className="text-2xl font-bold">{filteredLogs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Unique Clients</p>
            <p className="text-2xl font-bold">{uniqueClients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Avg per Session</p>
            <p className="text-2xl font-bold">{fmtDuration(Math.round(avgPerSession))}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hours by Client (Top 8)</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClient} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`, "Hours"]} />
                <Bar dataKey="hours" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Hours by Team Member</CardTitle>
          </CardHeader>
          <CardContent className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMember} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}h`, "Hours"]} />
                <Bar dataKey="hours" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detailed Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No time logs for this range.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-xs">{log.tasks?.clients?.name || "-"}</TableCell>
                    <TableCell className="text-xs max-w-[140px] truncate">{log.tasks?.title || "-"}</TableCell>
                    <TableCell className="text-xs">
                      {log.tasks?.service_type ? (
                        <Badge variant="outline" className="text-xs">
                          {log.tasks.service_type.replace(/_/g, " ")}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="text-xs">{log.profiles?.full_name || "-"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {fmtDuration(log.duration_minutes || 0)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {log.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
