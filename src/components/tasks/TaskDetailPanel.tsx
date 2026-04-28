import { useState, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CheckCircle2, Globe, ShieldCheck, ShieldX, Clock4, Flag, Pencil, Trash2, BookOpen, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { COUNT_BASED_SERVICES } from "./AddTaskModal";
import { sendPushToUsers } from "@/lib/pushNotify";
import { TaskEditModal } from "./TaskEditModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TaskDeliverablesForm } from "./TaskDeliverablesForm";
import { TaskComments } from "./TaskComments";
import { TaskChecklist } from "./TaskChecklist";
import { SOPGuide } from "./SOPGuide";
import { TaskAttachments } from "./TaskAttachments";
import { TimeTracker } from "./TimeTracker";
import { TaskTimeBar } from "./TaskTimeBar";
import { SubtasksSection } from "./SubtasksSection";
import { WebProjectTab } from "@/components/webproject/WebProjectTab";

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const isManagerOrOwner = profile?.role === "manager" || profile?.role === "owner";
  const [openSubtasksCount, setOpenSubtasksCount] = useState(0);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [approvalPending, setApprovalPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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
    if (newStatus === "completed" && openSubtasksCount > 0) {
      toast.warning(
        `${openSubtasksCount} subtask${openSubtasksCount > 1 ? "s" : ""} still open. Complete them first.`
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

  const handleSubmitForApproval = async () => {
    if (!taskId) return;
    setApprovalPending(true);
    try {
      const { data, error } = await supabase.rpc("request_task_approval", { p_task_id: taskId });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Submitted for approval — manager has been notified");
      // Fire web push to notified managers/owners
      const notified: string[] = (data as any)?.notified_users ?? [];
      if (notified.length) {
        sendPushToUsers(notified, (data as any).title, (data as any).body, `/tasks?open=${taskId}`);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit for approval");
    } finally {
      setApprovalPending(false);
    }
  };

  const handleResolveApproval = async (approved: boolean) => {
    if (!taskId) return;
    setApprovalPending(true);
    try {
      const { data, error } = await supabase.rpc("resolve_task_approval", {
        p_task_id: taskId,
        p_approved: approved,
        p_reason: approved ? null : (rejectReason.trim() || null),
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(approved ? "Task approved ✓" : "Task sent back for revision");
      setShowRejectBox(false);
      setRejectReason("");
      const notified: string[] = (data as any)?.notified_users ?? [];
      if (notified.length) {
        sendPushToUsers(notified, (data as any).title, (data as any).body, `/tasks?open=${taskId}`);
      }
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve approval");
    } finally {
      setApprovalPending(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleNeedsApproval = async (checked: boolean) => {
    if (!taskId) return;
    try {
      const { error } = await supabase.from("tasks").update({ needs_approval: checked }).eq("id", taskId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  if (!taskId) return null;

  const clientId = task?.client_id || null;

  return (
    <>
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
                {/* Action buttons — Edit + Delete for managers/owners; SOP always */}
                <div className="flex items-center gap-1 shrink-0 mt-1">
                  {task.service_type && <SOPGuide serviceType={task.service_type} />}
                  {isManagerOrOwner && (
                    <>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Edit task"
                        onClick={() => setEditOpen(true)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" title="Delete task">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete task?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "<strong>{task.title}</strong>" and all its subtasks, comments, and attachments. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={handleDeleteTask}
                              disabled={deleting}
                            >
                              {deleting ? "Deleting…" : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            </SheetHeader>

            {/* ── Metadata strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 bg-muted/30 p-4 rounded-lg border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                {task.status === "pending_approval" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded-md">
                    <Clock4 className="w-3 h-3" /> Pending Approval
                  </span>
                ) : (
                  <Select value={task.status} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-8 text-xs font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_started">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="completed">
                        {openSubtasksCount > 0 ? `Complete (${openSubtasksCount} open)` : "Completed"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {openSubtasksCount > 0 && task.status !== "pending_approval" && (
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

            {/* ── Time Bar — always visible ── */}
            <div className="mb-4">
              <TaskTimeBar
                taskId={task.id}
                clientId={(task as any).client_id}
                estimatedMinutes={(task as any).estimated_minutes}
              />
            </div>

            {/* ── Approval controls ── */}
            {/* Needs-approval toggle — anyone can flag */}
            <div className="flex items-center justify-between rounded-lg border px-4 py-2.5 mb-4 bg-muted/20">
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">Requires approval to complete</span>
              </div>
              <Switch
                checked={!!task.needs_approval}
                onCheckedChange={handleToggleNeedsApproval}
                disabled={task.status === "pending_approval"}
              />
            </div>

            {/* Submit for approval — shown when needs_approval=true and status=in_progress */}
            {task.needs_approval && task.status === "in_progress" && !isManagerOrOwner && (
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This task needs manager approval before it can be marked complete.
                </p>
                <Button
                  size="sm"
                  className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={handleSubmitForApproval}
                  disabled={approvalPending}
                >
                  Submit for Approval
                </Button>
              </div>
            )}

            {/* Manager can also submit (on behalf) */}
            {task.needs_approval && task.status === "in_progress" && isManagerOrOwner && (
              <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Task flagged for approval. Submit when work is ready.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-400 text-amber-700"
                  onClick={handleSubmitForApproval}
                  disabled={approvalPending}
                >
                  Submit for Approval
                </Button>
              </div>
            )}

            {/* Pending approval — shown to everyone; action buttons for managers */}
            {task.status === "pending_approval" && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/10 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2">
                  <Clock4 className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex-1">
                    Awaiting manager approval
                  </p>
                  {isManagerOrOwner && !showRejectBox && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => handleResolveApproval(true)}
                        disabled={approvalPending}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                        onClick={() => setShowRejectBox(true)}
                        disabled={approvalPending}
                      >
                        <ShieldX className="w-3.5 h-3.5" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
                {isManagerOrOwner && showRejectBox && (
                  <div className="px-4 pb-3 border-t border-amber-200 pt-3 space-y-2">
                    <Textarea
                      placeholder="Reason for rejection (optional)…"
                      className="h-20 text-sm"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setShowRejectBox(false); setRejectReason(""); }}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => handleResolveApproval(false)}
                        disabled={approvalPending}
                      >
                        Send Back
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Rejection reason — shown after rejection */}
            {task.rejection_reason && task.status === "in_progress" && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 flex items-start gap-2">
                <ShieldX className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">Rejected — needs revision</p>
                  <p className="text-xs text-red-600 mt-0.5">{task.rejection_reason}</p>
                </div>
              </div>
            )}

            {/* ── 3-Tab layout for all tasks ── */}
            {(() => {
              const isCountBased = !!task.service_type && COUNT_BASED_SERVICES.includes(task.service_type);
              const isWebDev = task.service_type?.toLowerCase() === "web development";

              // Shared Work tab content
              const workTabContent = (
                <div className="space-y-6">
                  {/* Description — only show if it has content */}
                  {task.description && (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Description</h4>
                        <div className="bg-muted/10 border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                          {task.description}
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Deliverables — top for count-based, present for all with a service */}
                  {task.service_type && (
                    <>
                      <div>
                        <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          Deliverables
                        </h4>
                        <TaskDeliverablesForm taskId={task.id} serviceType={task.service_type} targetCount={(task as any).target_count} />
                      </div>
                      <Separator />
                    </>
                  )}

                  {/* Subtasks */}
                  <SubtasksSection taskId={task.id} onOpenCountChange={handleSubtaskCount} />

                  <Separator />

                  {/* Process Guide — SOP checklist, collapsed by default */}
                  <div>
                    <button
                      className="flex items-center gap-2 w-full text-left"
                      onClick={() => setGuideOpen((v) => !v)}
                    >
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex-1">
                        Process Guide
                      </span>
                      {task.service_type && <SOPGuide serviceType={task.service_type} />}
                      {guideOpen
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {guideOpen && (
                      <div className="mt-3">
                        <TaskChecklist taskId={task.id} serviceType={task.service_type} />
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <Tabs defaultValue={isWebDev ? "web" : "work"} className="w-full">
                  <TabsList className={`mb-4 w-full grid ${isWebDev ? "grid-cols-4" : "grid-cols-3"}`}>
                    {isWebDev && (
                      <TabsTrigger value="web" className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" /> Web
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="work">Work</TabsTrigger>
                    <TabsTrigger value="activity">Activity</TabsTrigger>
                    <TabsTrigger value="files" className="flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5" /> Files & Time
                    </TabsTrigger>
                  </TabsList>

                  {/* Web Project tab — Web Dev only */}
                  {isWebDev && (
                    <TabsContent value="web">
                      <WebProjectTab taskId={task.id} clientId={clientId} />
                    </TabsContent>
                  )}

                  {/* Work tab */}
                  <TabsContent value="work">
                    {workTabContent}
                  </TabsContent>

                  {/* Activity tab — comments full height, no scrolling past other sections */}
                  <TabsContent value="activity">
                    <div className="h-[520px] flex flex-col">
                      <TaskComments taskId={task.id} />
                    </div>
                  </TabsContent>

                  {/* Files & Time tab */}
                  <TabsContent value="files" className="space-y-6">
                    <TimeTracker taskId={task.id} clientId={clientId} />
                    <Separator />
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                        <Paperclip className="w-4 h-4" /> Attachments
                      </h4>
                      <TaskAttachments taskId={task.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              );
            })()}
          </>
        ) : null}
      </SheetContent>
    </Sheet>

    {/* Edit modal — mounted outside Sheet to avoid stacking context issues */}
    {task && (
      <TaskEditModal
        task={task}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    )}
    </>
  );
}
