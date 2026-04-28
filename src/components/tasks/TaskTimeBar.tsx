import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Timer, Square, Clock } from "lucide-react";
import { toast } from "sonner";

interface TaskTimeBarProps {
  taskId: string;
  clientId?: string | null;
  estimatedMinutes?: number | null;
}

const TIMER_KEY = (taskId: string) => `timer_start_${taskId}`;

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? `${h}h` : null,
    `${String(m).padStart(2, "0")}m`,
    `${String(s).padStart(2, "0")}s`,
  ]
    .filter(Boolean)
    .join(" ");
}

export function TaskTimeBar({ taskId, clientId, estimatedMinutes }: TaskTimeBarProps) {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user.id)
        .single();
      return data;
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["time-logs", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_logs")
        .select("duration_minutes")
        .eq("task_id", taskId);
      if (error) throw error;
      return data || [];
    },
  });

  // Restore running timer from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TIMER_KEY(taskId));
    if (stored) {
      const startedAt = Number(stored);
      startedAtRef.current = startedAt;
      const secondsElapsed = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(secondsElapsed);
      setTimerRunning(true);
    }
  }, [taskId]);

  // Tick every second
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const logMutation = useMutation({
    mutationFn: async (params: { durationMinutes: number; startedAt: Date; endedAt: Date }) => {
      const { error } = await supabase.from("time_logs").insert({
        task_id: taskId,
        client_id: clientId || null,
        user_id: profile?.id || null,
        started_at: params.startedAt.toISOString(),
        ended_at: params.endedAt.toISOString(),
        duration_minutes: params.durationMinutes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      toast.success("Time logged ✓");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startTimer = () => {
    const now = Date.now();
    localStorage.setItem(TIMER_KEY(taskId), String(now));
    startedAtRef.current = now;
    setElapsed(0);
    setTimerRunning(true);
  };

  const stopTimer = () => {
    localStorage.removeItem(TIMER_KEY(taskId));
    setTimerRunning(false);
    const startedAt = startedAtRef.current
      ? new Date(startedAtRef.current)
      : new Date(Date.now() - elapsed * 1000);
    const endedAt = new Date();
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    logMutation.mutate({ durationMinutes, startedAt, endedAt });
    setElapsed(0);
    startedAtRef.current = null;
  };

  const totalTrackedMinutes = logs.reduce(
    (sum: number, l: any) => sum + (l.duration_minutes || 0),
    0
  );

  const pct =
    estimatedMinutes && estimatedMinutes > 0
      ? Math.min(Math.round((totalTrackedMinutes / estimatedMinutes) * 100), 100)
      : null;

  const isOverBudget =
    estimatedMinutes && totalTrackedMinutes > estimatedMinutes;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/40 border rounded-lg">
      {/* Clock icon */}
      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />

      {/* Time info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tracked */}
          <span
            className={`text-sm font-semibold tabular-nums ${
              isOverBudget ? "text-red-600" : "text-foreground"
            }`}
          >
            {timerRunning ? (
              <span className="text-primary font-mono">{fmtElapsed(elapsed)}</span>
            ) : (
              fmtDuration(totalTrackedMinutes)
            )}
          </span>

          {/* Separator + allocated */}
          {estimatedMinutes ? (
            <>
              <span className="text-muted-foreground text-xs">/</span>
              <span className="text-xs text-muted-foreground">
                {fmtDuration(estimatedMinutes)} allocated
              </span>
              {pct !== null && (
                <span
                  className={`text-xs font-medium ${
                    isOverBudget
                      ? "text-red-500"
                      : pct >= 80
                      ? "text-amber-500"
                      : "text-muted-foreground"
                  }`}
                >
                  {isOverBudget ? "⚠ over budget" : `${pct}%`}
                </span>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">tracked</span>
          )}
        </div>

        {/* Progress bar — only when allocated time is set */}
        {estimatedMinutes && pct !== null && (
          <Progress
            value={pct}
            className={`h-1 mt-1 ${isOverBudget ? "[&>div]:bg-red-500" : pct >= 80 ? "[&>div]:bg-amber-500" : ""}`}
          />
        )}
      </div>

      {/* Timer button */}
      {timerRunning ? (
        <Button
          size="sm"
          variant="destructive"
          className="gap-1.5 h-7 text-xs shrink-0"
          onClick={stopTimer}
          disabled={logMutation.isPending}
        >
          <Square className="w-3 h-3" />
          Stop & Log
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-7 text-xs shrink-0 border-primary/30 text-primary hover:bg-primary/5"
          onClick={startTimer}
        >
          <Timer className="w-3 h-3" />
          Start Timer
        </Button>
      )}
    </div>
  );
}
