import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface TimeTrackerProps {
  taskId: string;
  clientId?: string | null;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function TimeTracker({ taskId, clientId }: TimeTrackerProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(true);
  const [showManual, setShowManual] = useState(false);

  // Manual log state
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualHours, setManualHours] = useState("");
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualNote, setManualNote] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id, full_name").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["time-logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("*, profiles(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const logMutation = useMutation({
    mutationFn: async (params: { durationMinutes: number; notes?: string; startedAt?: Date; endedAt?: Date }) => {
      const { error } = await supabase.from("time_logs").insert({
        task_id: taskId,
        client_id: clientId || null,
        user_id: profile?.id || null,
        started_at: params.startedAt?.toISOString() || null,
        ended_at: params.endedAt?.toISOString() || null,
        duration_minutes: params.durationMinutes,
        notes: params.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast.success("Time logged");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleManualLog = () => {
    const h = Number(manualHours) || 0;
    const m = Number(manualMinutes) || 0;
    const total = h * 60 + m;
    if (total <= 0) { toast.error("Enter at least 1 minute"); return; }
    const dateObj = new Date(manualDate);
    logMutation.mutate({ durationMinutes: total, notes: manualNote || undefined, startedAt: dateObj });
    setManualHours("");
    setManualMinutes("");
    setManualNote("");
    setShowManual(false);
  };

  const totalMinutes = (logs as any[]).reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0);

  return (
    <div>
      <button className="flex items-center gap-2 w-full text-left mb-3" onClick={() => setCollapsed(!collapsed)}>
        <Clock className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-sm flex-1">Time Log</h4>
        {totalMinutes > 0 && (
          <span className="text-xs font-mono text-muted-foreground">{(logs as any[]).length} entr{(logs as any[]).length === 1 ? "y" : "ies"}</span>
        )}
        {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="space-y-3">
          {/* Manual log */}
          <div>
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowManual(!showManual)}
            >
              <Plus className="h-3.5 w-3.5" />
              Log time manually
            </button>

            {showManual && (
              <div className="mt-2 p-3 border rounded-lg space-y-2 bg-muted/20">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" className="h-7 text-xs mt-0.5" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Hours</label>
                    <Input type="number" min="0" placeholder="0" className="h-7 text-xs mt-0.5" value={manualHours} onChange={(e) => setManualHours(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Minutes</label>
                    <Input type="number" min="0" max="59" placeholder="0" className="h-7 text-xs mt-0.5" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)} />
                  </div>
                </div>
                <Textarea
                  placeholder="Notes (optional)"
                  className="text-xs h-16 resize-none"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={handleManualLog} disabled={logMutation.isPending}>Log</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowManual(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Log history */}
          {logs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">History</p>
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-2.5 p-2 rounded-lg border bg-card text-sm">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {log.profiles?.full_name?.substring(0, 2).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-xs text-primary">{fmtDuration(log.duration_minutes)}</span>
                      <span className="text-xs text-muted-foreground">{log.profiles?.full_name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground ml-auto shrink-0">
                        {format(new Date(log.created_at), "MMM d")}
                      </span>
                    </div>
                    {log.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
