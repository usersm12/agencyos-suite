import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Globe, AlertTriangle, Calendar } from "lucide-react";
import { differenceInDays, format } from "date-fns";

interface Props {
  clientId: string;
}

export function WebProjectMiniCard({ clientId }: Props) {
  const { data } = useQuery({
    queryKey: ["web-project-summary", clientId],
    queryFn: async () => {
      // Find web dev tasks for this client
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, created_at, projects!inner(client_id)")
        .ilike("service_type", "%web%")
        .eq("projects.client_id", clientId)
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tasks || tasks.length === 0) return null;
      const task = tasks[0];

      const { data: phases } = await supabase
        .from("web_project_phases")
        .select("*")
        .eq("task_id", task.id)
        .order("phase_number");

      if (!phases || phases.length === 0) return null;

      const phaseIds = phases.map((p) => p.id);
      const { data: items } = await supabase
        .from("web_phase_checklist_items")
        .select("phase_id, priority, status")
        .in("phase_id", phaseIds);

      const currentPhase = phases.find((p) => p.status === "in_progress")
        || phases.find((p) => p.status === "not_started")
        || phases[phases.length - 1];
      const completed = phases.filter((p) => p.status === "completed").length;
      const progressPct = Math.round((completed / 6) * 100);

      const pendingRequired = (items || []).filter(
        (i) => i.priority === "required" && i.status === "pending"
      ).length;

      const startedAt = phases.find((p) => p.started_at)?.started_at;
      const daysSinceStart = startedAt ? differenceInDays(new Date(), new Date(startedAt)) : 0;

      return { task, currentPhase, progressPct, pendingRequired, daysSinceStart, completedPhases: completed };
    },
  });

  if (!data) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Web Project</span>
        </div>
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
          Phase {data.currentPhase?.phase_number}/6
        </Badge>
      </div>

      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span className="font-medium text-foreground truncate max-w-[200px]">{data.currentPhase?.phase_name}</span>
          <span>{data.progressPct}%</span>
        </div>
        <Progress value={data.progressPct} className="h-1.5" />
      </div>

      <div className="flex items-center gap-4 text-xs">
        {data.pendingRequired > 0 ? (
          <span className="flex items-center gap-1 text-red-600 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {data.pendingRequired} required pending
          </span>
        ) : (
          <span className="text-green-600 font-medium">All required items received</span>
        )}
        <span className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {data.daysSinceStart}d active
        </span>
      </div>
    </div>
  );
}
