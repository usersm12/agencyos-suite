import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function autoGenerateFlags() {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // 1. Check overdue tasks
  const { data: overdueTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, project_id, projects(client_id, clients(name))')
    .lt('due_date', todayStr)
    .neq('status', 'completed');

  if (overdueTasks) {
    for (const task of overdueTasks) {
      const dueDate = new Date(task.due_date!);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const clientId = (task.projects as any)?.client_id;
      if (!clientId) continue;

      const priority = daysOverdue >= 3 ? 'high' : 'medium';
      const title = `Task "${task.title}" overdue by ${daysOverdue} day(s)`;

      // Check if flag already exists
      const { data: existing } = await supabase
        .from('flags')
        .select('id')
        .eq('client_id', clientId)
        .eq('title', title)
        .eq('status', 'open')
        .maybeSingle();

      if (!existing) {
        await supabase.from('flags').insert({
          client_id: clientId,
          title,
          description: `Task is ${daysOverdue} days past due date of ${format(dueDate, 'MMM d, yyyy')}.`,
          priority,
          status: 'open',
        });
      }
    }
  }

  // 2. Clients with 0 completed tasks this month
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
  const { data: clients } = await supabase.from('clients').select('id, name').eq('status', 'active');
  if (clients) {
    for (const client of clients) {
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', client.id);
      
      if (!projects || projects.length === 0) continue;
      const projectIds = projects.map(p => p.id);

      const { count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .in('project_id', projectIds)
        .eq('status', 'completed')
        .gte('updated_at', monthStart);

      if ((count || 0) === 0) {
        const title = `${client.name}: No tasks completed this month`;
        const { data: existing } = await supabase
          .from('flags')
          .select('id')
          .eq('client_id', client.id)
          .eq('title', title)
          .eq('status', 'open')
          .maybeSingle();

        if (!existing) {
          await supabase.from('flags').insert({
            client_id: client.id,
            title,
            description: `No tasks have been marked completed for ${client.name} since ${format(new Date(monthStart), 'MMM d')}.`,
            priority: 'medium',
            status: 'open',
          });
        }
      }
    }
  }
}

export default function FlagsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [resolvingFlag, setResolvingFlag] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  // Auto-generate flags on page load
  useEffect(() => {
    autoGenerateFlags().then(() => {
      queryClient.invalidateQueries({ queryKey: ['flags-list'] });
      queryClient.invalidateQueries({ queryKey: ['open-flags-count'] });
    });
  }, []);

  const { data: flags, isLoading } = useQuery({
    queryKey: ['flags-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flags')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return 0;
      });
    }
  });

  const filteredFlags = flags?.filter(f => {
    const matchesSearch = !searchQuery || 
      f.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.clients as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || f.priority === severityFilter;
    const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  }) || [];

  const handleResolve = async () => {
    if (!resolvingFlag) return;
    try {
      const resolvedDesc = resolvingFlag.description + (resolutionNote ? `\n\nResolution: ${resolutionNote}` : '');
      const { error } = await supabase
        .from('flags')
        .update({ status: 'resolved', description: resolvedDesc })
        .eq('id', resolvingFlag.id);

      if (error) throw error;
      toast.success("Flag marked as resolved");
      setResolvingFlag(null);
      setResolutionNote("");
      queryClient.invalidateQueries({ queryKey: ['flags-list'] });
      queryClient.invalidateQueries({ queryKey: ['open-flags-count'] });
    } catch (err: any) {
      toast.error("Failed to resolve flag");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Flags</h1>
          <p className="text-muted-foreground mt-1">Monitor alerts, SLA breaches, and critical system warnings.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search flags..." 
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="high">Critical</SelectItem>
            <SelectItem value="medium">Warning</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl border animate-pulse bg-muted/20" />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-[30%]">Issue</TableHead>
                <TableHead>Days Open</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags.map((flag) => (
                <TableRow key={flag.id} className={flag.status === 'resolved' ? "opacity-60 bg-muted/30" : ""}>
                  <TableCell>
                    <Badge variant={flag.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                      {flag.priority === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {flag.priority === 'high' ? 'Critical' : 'Warning'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-sm">{(flag.clients as any)?.name || 'System Wide'}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{flag.description}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {formatDistanceToNow(new Date(flag.created_at))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {flag.status === 'resolved' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Resolved
                      </Badge>
                    ) : (
                      <Badge variant="outline">Open</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {flag.status !== 'resolved' ? (
                      <Button size="sm" variant="outline" onClick={() => setResolvingFlag(flag)}>
                        Resolve
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled className="text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Closed
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredFlags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No flags found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!resolvingFlag} onOpenChange={(open) => !open && setResolvingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>
              Mark this issue as resolved. Optionally, leave a note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-sm">
                <span className="font-semibold text-destructive uppercase text-xs">Issue:</span>
                <p className="mt-1 font-medium text-destructive">{resolvingFlag?.title}</p>
             </div>
             
             <div className="space-y-2">
               <Label>Resolution Note</Label>
               <Textarea 
                 placeholder="Describe what was done to fix this..." 
                 value={resolutionNote}
                 onChange={(e) => setResolutionNote(e.target.value)}
                 className="min-h-[100px]"
               />
             </div>
          </div>
          <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={() => setResolvingFlag(null)}>Cancel</Button>
             <Button onClick={handleResolve}>Complete Resolution</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
