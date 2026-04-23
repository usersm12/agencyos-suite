import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Globe, AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";

export function WebProjectsPanel() {
  const navigate = useNavigate();

  const { data: projects = [] } = useQuery({
    queryKey: ["web-projects-panel"],
    queryFn: async () => {
      // Get all web tasks that are not completed
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, project_id, projects!inner(client_id, clients(id, name))")
        .ilike("service_type", "%web%")
        .neq("status", "completed");

      if (!tasks || tasks.length === 0) return [];

      const taskIds = tasks.map((t) => t.id);

      const { data: phases } = await supabase
        .from("web_project_phases")
        .select("*")
        .in("task_id", taskIds)
        .order("phase_number");

      if (!phases || phases.length === 0) return [];

      const phaseIds = phases.map((p) => p.id);
      const { data: items } = await supabase
        .from("web_phase_checklist_items")
        .select("phase_id, priority, status")
        .in("phase_id", phaseIds);

      return tasks.map((task) => {
        const taskPhases = phases.filter((p) => p.task_id === task.id);
        if (taskPhases.length === 0) return null;

        const currentPhase =
          taskPhases.find((p) => p.status === "in_progress") ||
          taskPhases.find((p) => p.status === "not_started") ||
          taskPhases[taskPhases.length - 1];

        const completed = taskPhases.filter((p) => p.status === "completed").length;
        const progressPct = Math.round((completed / 6) * 100);

        const taskPhaseIds = taskPhases.map((p) => p.id);
        const taskItems = (items || []).filter((i) => taskPhaseIds.includes(i.phase_id));
        const pendingRequired = taskItems.filter(
          (i) => i.priority === "required" && i.status === "pending"
        ).length;

        const startedAt = taskPhases.find((p) => p.started_at)?.started_at;
        const daysSinceStart = startedAt
          ? differenceInDays(new Date(), new Date(startedAt))
          : 0;

        const client = (task.projects as any)?.clients;

        return {
          taskId: task.id,
          taskTitle: task.title,
          clientId: client?.id,
          clientName: client?.name || "Unknown Client",
          currentPhase,
          progressPct,
          pendingRequired,
          daysSinceStart,
          completedPhases: completed,
        };
      }).filter(Boolean);
    },
  });

  if (projects.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 pb-3">
        <Globe className="w-5 h-5 text-primary" />
        <CardTitle className="text-base">Active Web Projects</CardTitle>
        <Badge variant="secondary" className="ml-auto">{projects.length}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {projects.map((p: any) => (
            <div
              key={p.taskId}
              className="px-5 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${p.clientId}`)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm truncate">{p.clientName}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 shrink-0"
                  >
                    Phase {p.currentPhase?.phase_number}/6
                  </Badge>
                </div>
                <div className="flex items-center gap-3 ml-3 shrink-0">
                  {p.pendingRequired > 0 ? (
                    <span className="flex items-center gap-1 text-[11px] text-red-600 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {p.pendingRequired} pending
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      All received
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    {p.daysSinceStart}d
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={p.progressPct} className="h-1.5 flex-1" />
                <span className="text-[11px] font-mono text-muted-foreground w-8 text-right">
                  {p.progressPct}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                {p.currentPhase?.phase_name}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
