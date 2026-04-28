import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

interface ClientTasksSectionProps {
  clientId: string;
}

type StatusFilter = "active" | "completed" | "all";

const ACTIVE_STATUSES = ["not_started", "in_progress", "blocked", "pending_approval"];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "not_started": return "bg-gray-100 text-gray-700";
    case "in_progress": return "bg-blue-100 text-blue-700";
    case "blocked": return "bg-red-100 text-red-700";
    case "pending_approval": return "bg-amber-100 text-amber-700";
    case "completed": return "bg-green-100 text-green-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function priorityBadgeClass(priority: string): string {
  switch (priority) {
    case "high": return "bg-red-100 text-red-700";
    case "medium": return "bg-amber-100 text-amber-700";
    case "low": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

function fmtStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ClientTasksSection({ clientId }: ClientTasksSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["client-tasks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, profiles!tasks_assigned_to_fkey(full_name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filteredTasks = tasks.filter((t: any) => {
    if (statusFilter === "active") return ACTIVE_STATUSES.includes(t.status);
    if (statusFilter === "completed") return t.status === "completed";
    return true;
  });

  return (
    <>
      <div className="space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["active", "completed", "all"] as StatusFilter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={statusFilter === f ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setStatusFilter(f)}
            >
              {f === "active" ? "Active" : f === "completed" ? "Completed" : "All"}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground text-sm">
              No tasks found{statusFilter !== "all" ? ` for "${statusFilter}" filter` : ""}.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task: any) => (
              <Card
                key={task.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setOpenTaskId(task.id)}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Status badge */}
                    <Badge className={`${statusBadgeClass(task.status)} text-xs shrink-0`}>
                      {fmtStatus(task.status)}
                    </Badge>

                    {/* Title */}
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">
                      {task.title}
                    </span>

                    {/* Service type */}
                    {task.service_type && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {task.service_type.replace(/_/g, " ")}
                      </Badge>
                    )}

                    {/* Assignee */}
                    {task.profiles?.full_name && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {task.profiles.full_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{task.profiles.full_name}</span>
                      </div>
                    )}

                    {/* Due date */}
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        Due {format(new Date(task.due_date), "MMM d")}
                      </span>
                    )}

                    {/* Priority */}
                    {task.priority && (
                      <Badge className={`${priorityBadgeClass(task.priority)} text-xs shrink-0`}>
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Task detail panel */}
      {openTaskId && (
        <TaskDetailPanel
          taskId={openTaskId}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </>
  );
}
