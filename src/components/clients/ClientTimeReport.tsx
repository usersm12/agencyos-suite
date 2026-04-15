import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfMonth, endOfMonth } from "date-fns";

interface ClientTimeReportProps {
  clientId: string;
  monthlyRetainer?: number;
  currency?: string;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function ClientTimeReport({ clientId, monthlyRetainer, currency }: ClientTimeReportProps) {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const { data: timeLogs = [], isLoading } = useQuery({
    queryKey: ["client-time-logs", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*, profiles(full_name), tasks(title, service_type)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const thisMonthLogs = useMemo(() => timeLogs.filter((l: any) => {
    const d = new Date(l.created_at);
    return d >= new Date(monthStart) && d <= new Date(monthEnd);
  }), [timeLogs]);

  const totalMinutesThisMonth = useMemo(() =>
    thisMonthLogs.reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0),
    [thisMonthLogs]);

  // Hours by team member
  const byMember = useMemo(() => {
    const map: Record<string, { name: string; minutes: number }> = {};
    thisMonthLogs.forEach((l: any) => {
      const name = l.profiles?.full_name || "Unknown";
      if (!map[name]) map[name] = { name, minutes: 0 };
      map[name].minutes += l.duration_minutes || 0;
    });
    return Object.values(map).map((v) => ({ name: v.name, hours: parseFloat((v.minutes / 60).toFixed(1)) }));
  }, [thisMonthLogs]);

  // Hours by service type
  const byService = useMemo(() => {
    const map: Record<string, number> = {};
    thisMonthLogs.forEach((l: any) => {
      const type = l.tasks?.service_type || "Other";
      map[type] = (map[type] || 0) + (l.duration_minutes || 0);
    });
    return Object.entries(map).map(([name, minutes]) => ({
      name: name.replace(/_/g, " "),
      value: parseFloat((minutes / 60).toFixed(1)),
    }));
  }, [thisMonthLogs]);

  // Profitability: estimate hourly rate covered by retainer
  const totalHoursThisMonth = totalMinutesThisMonth / 60;
  const estimatedCoveredHours = monthlyRetainer ? monthlyRetainer / 50 : null; // assume $50/hr default
  const isOverRetainer = estimatedCoveredHours !== null && totalHoursThisMonth > estimatedCoveredHours;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">This Month</p>
            </div>
            <p className="text-2xl font-bold">{fmtDuration(totalMinutesThisMonth)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{thisMonthLogs.length} sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">All Time</p>
            </div>
            <p className="text-2xl font-bold">{fmtDuration(timeLogs.reduce((s: number, l: any) => s + l.duration_minutes, 0))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{timeLogs.length} total sessions</p>
          </CardContent>
        </Card>
        {estimatedCoveredHours !== null && (
          <Card className={isOverRetainer ? "border-red-200 bg-red-50/30" : ""}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                {isOverRetainer
                  ? <AlertTriangle className="h-4 w-4 text-red-500" />
                  : <TrendingUp className="h-4 w-4 text-green-500" />}
                <p className="text-xs text-muted-foreground">Retainer vs Logged</p>
              </div>
              <p className={`text-sm font-semibold ${isOverRetainer ? "text-red-600" : "text-green-600"}`}>
                {totalHoursThisMonth.toFixed(1)}h logged / ~{estimatedCoveredHours.toFixed(0)}h covered
              </p>
              {isOverRetainer && (
                <p className="text-xs text-red-500 mt-0.5">
                  Over by {(totalHoursThisMonth - estimatedCoveredHours).toFixed(1)}h
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      {thisMonthLogs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byMember.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hours by Team Member</CardTitle></CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byMember} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v}h`, "Hours"]} />
                    <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {byService.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Hours by Service Type</CardTitle></CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byService} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${value}h`}>
                      {byService.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [`${v}h`, ""]} />
                    <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Log table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Time Log — {format(now, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-20 animate-pulse bg-muted/20 m-4 rounded" />
          ) : thisMonthLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No time logged this month.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Team Member</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {thisMonthLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), "MMM d")}</TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">{log.tasks?.title || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {log.profiles?.full_name?.substring(0, 2).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{log.profiles?.full_name || "Unknown"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">{fmtDuration(log.duration_minutes)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">{log.notes || "-"}</TableCell>
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
