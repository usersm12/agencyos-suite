import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Globe } from "lucide-react";
import { TaskDeliverablesForm } from "./TaskDeliverablesForm";
import { TaskComments } from "./TaskComments";
import { TaskChecklist } from "./TaskChecklist";
import { SOPGuide } from "./SOPGuide";
import { TaskAttachments } from "./TaskAttachments";
import { TimeTracker } from "./TimeTracker";
import { SubtasksSection } from "./SubtasksSection";
import { WebProjectTab } from "@/components/webproject/WebProjectTab";

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const [openSubtasksCount, setOpenSubtasksCount] = useState(0);

  const handleSubtaskCount = useCallback((count: number) => {
    setOpenSubtasksCount(count);
  }, []);

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          clients (name),
          profiles!tasks_assigned_to_fkey (full_name)
        `)
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const handleStatusChange = async (newStatus: string) => {
    if (!taskId) return;
    // Block completion if there are open subtasks
    if (newStatus === "completed" && openSubtasksCount > 0) {
      toast.warning(
        `${openSubtasksCount} subtask${openSubtasksCount > 1 ? "s" : ""} still open. Complete them first or mark them not applicable.`
      );
      return;
    }
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);
      if (error) throw error;
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  if (!taskId) return null;

  const clientId = task?.client_id || null;

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto outline-none">
        {isLoading ? (
          <div className="space-y-4 animate-pulse mt-6">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-64 bg-muted rounded w-full mt-8" />
          </div>
        ) : task ? (
          <>
            {/* ── Task Header ── */}
            <SheetHeader className="mb-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {(task.clients as any)?.name || "No Client"}
                    </span>
                  </div>
                  <SheetTitle className="text-2xl leading-tight">{task.title}</SheetTitle>
                </div>
                {/* SOP button — always visible in top-right of header */}
                {task.service_type && (
                  <div className="shrink-0 mt-1">
                    <SOPGuide serviceType={task.service_type} />
                  </div>
                )}
              </div>
            </SheetHeader>

            {/* ── Metadata strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 bg-muted/30 p-4 rounded-lg border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="completed">
                      {openSubtasksCount > 0
                        ? `Complete (${openSubtasksCount} subtasks open)`
                        : "Completed"}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {openSubtasksCount > 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    ⚠ {openSubtasksCount} open subtask{openSubtasksCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <Badge
                  variant={
                    task.priority === "high"
                      ? "destructive"
                      : task.priority === "medium"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {task.priority?.toUpperCase() || "MEDIUM"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <div className="flex items-center text-sm font-medium">
                  {task.due_date
                    ? format(new Date(task.due_date), "MMM d, yyyy")
                    : "-"}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                <div className="flex items-center gap-2">
                  {(task.profiles as any)?.full_name ? (
                    <>
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {(task.profiles as any).full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[80px]">
                        {(task.profiles as any).full_name}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm italic">Unassigned</span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Content — Web tasks get a tab bar, others are linear ── */}
            {task.service_type?.toLowerCase().includes("web") ? (
              <Tabs defaultValue="web" className="w-full">
                <TabsList className="mb-4 w-full">
                  <TabsTrigger value="web" className="flex items-center gap-1.5 flex-1">
                    <Globe className="w-3.5 h-3.5" /> Web Project
                  </TabsTrigger>
                  <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                  <TabsTrigger value="comments" className="flex-1">Comments</TabsTrigger>
                </TabsList>

                <TabsContent value="web">
                  <WebProjectTab taskId={task.id} clientId={clientId} />
                </TabsContent>

                <TabsContent value="details" className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Description / Notes</h4>
                    <div className="bg-muted/10 border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                      {task.description || "No description provided."}
                    </div>
                  </div>
                  <Separator />
                  <SubtasksSection taskId={task.id} onOpenCountChange={handleSubtaskCount} />
                  <Separator />
                  <TaskChecklist taskId={task.id} serviceType={task.service_type} />
                  <Separator />
                  <TimeTracker taskId={task.id} clientId={clientId} />
                  <Separator />
                  <TaskAttachments taskId={task.id} />
                  <Separator />
                  <div>
                    <h4 className="flex items-center gap-2 text-md font-semibold mb-4">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      Deliverables
                    </h4>
                    <TaskDeliverablesForm taskId={task.id} serviceType={task.service_type} />
                  </div>
                </TabsContent>

                <TabsContent value="comments">
                  <div className="h-[400px] border rounded-lg p-4 bg-muted/10">
                    <TaskComments taskId={task.id} />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Description / Notes</h4>
                  <div className="bg-muted/10 border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description || "No description provided."}
                  </div>
                </div>

                <Separator />

                {/* Subtasks */}
                <SubtasksSection taskId={task.id} onOpenCountChange={handleSubtaskCount} />

                <Separator />

                {/* Checklist */}
                <TaskChecklist taskId={task.id} serviceType={task.service_type} />

                <Separator />

                {/* Time Tracker */}
                <TimeTracker taskId={task.id} clientId={clientId} />

                <Separator />

                {/* Attachments */}
                <TaskAttachments taskId={task.id} />

                <Separator />

                {/* Deliverables */}
                <div>
                  <h4 className="flex items-center gap-2 text-md font-semibold mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Deliverables
                  </h4>
                  {task.service_type ? (
                    <TaskDeliverablesForm taskId={task.id} serviceType={task.service_type} />
                  ) : (
                    <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                      No service type defined for this task.
                    </div>
                  )}
                </div>

                <Separator />

                {/* Comments */}
                <div>
                  <h4 className="font-semibold mb-4">Comments</h4>
                  <div className="h-[400px] border rounded-lg p-4 bg-muted/10">
                    <TaskComments taskId={task.id} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
