import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Printer } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("agency");
  const [selectedClient, setSelectedClient] = useState<string>("all");

  const { data: clients } = useQuery({
    queryKey: ['reports-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name, health_score, health_status, industry, monthly_retainer_value').order('name');
      return data || [];
    }
  });

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
    const rows = clients.map(c => [c.name, c.health_score, c.health_status, c.industry || '', c.monthly_retainer_value || 0]);
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
                      <TableCell>${(c.monthly_retainer_value || 0).toLocaleString()}</TableCell>
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
      </Tabs>
    </div>
  );
}
