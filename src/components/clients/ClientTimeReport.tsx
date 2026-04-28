import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, TrendingUp, AlertTriangle, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

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

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ClientTimeReport({ clientId, monthlyRetainer, currency }: ClientTimeReportProps) {
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<string>(toDateStr(startOfMonth(now)));
  const [dateTo, setDateTo] = useState<string>(toDateStr(endOfMonth(now)));
  const [selectedMember, setSelectedMember] = useState<string>("all");

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

  // Quick range helpers
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
  function applyAllTime() {
    setDateFrom("");
    setDateTo("");
  }

  // Unique members from all logs
  const memberOptions = useMemo(() => {
    const map: Record<string, string> = {};
    timeLogs.forEach((l: any) => {
      const name = l.profiles?.full_name || "Unknown";
      const id = l.user_id || name;
      map[id] = name;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [timeLogs]);

  // Filtered logs (client-side)
  const filteredLogs = useMemo(() => {
    return timeLogs.filter((l: any) => {
      const d = new Date(l.created_at);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;
      if (selectedMember !== "all") {
        const memberId = l.user_id || (l.profiles?.full_name || "Unknown");
        if (memberId !== selectedMember) return false;
      }
      return true;
    });
  }, [timeLogs, dateFrom, dateTo, selectedMember]);

  const totalMinutes = useMemo(
    () => filteredLogs.reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0),
    [filteredLogs]
  );

  const totalHours = totalMinutes / 60;
  const estimatedCoveredHours = monthlyRetainer ? monthlyRetainer / 50 : null;
  const isOverRetainer = estimatedCoveredHours !== null && totalHours > estimatedCoveredHours;

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

  // Hours by service type
  const byService = useMemo(() => {
    const map: Record<string, number> = {};
    filteredLogs.forEach((l: any) => {
      const type = l.tasks?.service_type || "Other";
      map[type] = (map[type] || 0) + (l.duration_minutes || 0);
    });
    return Object.entries(map).map(([name, minutes]) => ({
      name: name.replace(/_/g, " "),
      value: parseFloat((minutes / 60).toFixed(1)),
    }));
  }, [filteredLogs]);

  // CSV export
  function handleExportCSV() {
    const headers = ["Date", "Client", "Task", "Service Type", "Team Member", "Duration (mins)", "Notes"];
    const rows = filteredLogs.map((l: any) => [
      format(new Date(l.created_at), "yyyy-MM-dd"),
      "", // client name not in this query — leave blank or add if needed
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
    a.download = `time-report-${format(now, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
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
              <span className="text-xs text-muted-foreground">Team Member</span>
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {memberOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyThisMonth}>This Month</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyLastMonth}>Last Month</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyLast3Months}>Last 3 Months</Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={applyAllTime}>All Time</Button>
            </div>
            <Button size="sm" variant="default" className="h-8 text-xs gap-1.5 ml-auto" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
            <p className="text-2xl font-bold">{fmtDuration(totalMinutes)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredLogs.length} sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">All Time</p>
            </div>
            <p className="text-2xl font-bold">{fmtDuration(timeLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0))}</p>
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
                {totalHours.toFixed(1)}h logged / ~{estimatedCoveredHours.toFixed(0)}h covered
              </p>
              {isOverRetainer && (
                <p className="text-xs text-red-500 mt-0.5">
                  Over by {(totalHours - estimatedCoveredHours).toFixed(1)}h
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      {filteredLogs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byMember.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hours by Team Member</CardTitle>
              </CardHeader>
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Hours by Service Type</CardTitle>
              </CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byService}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ value }) => `${value}h`}
                    >
                      {byService.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
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
          <CardTitle className="text-sm">Time Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="h-20 animate-pulse bg-muted/20 m-4 rounded" />
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No time logged for this range.</p>
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
                {filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), "MMM d, yyyy")}</TableCell>
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
                      <Badge variant="secondary" className="font-mono text-xs">
                        {fmtDuration(log.duration_minutes)}
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
