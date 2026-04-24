import { useState } from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Calendar, AlertCircle, Trash2, BookOpen, CheckCircle, XCircle, Clock, Layers, Timer, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent
} from "@/components/ui/context-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

const TIMER_KEY = (taskId: string) => `timer_start_${taskId}`;

function useTaskTimer(taskId: string) {
  const running = !!localStorage.getItem(TIMER_KEY(taskId));
  const start = () => localStorage.setItem(TIMER_KEY(taskId), String(Date.now()));
  const stop = async (profileId: string | null, clientId: string | null) => {
    const stored = localStorage.getItem(TIMER_KEY(taskId));
    localStorage.removeItem(TIMER_KEY(taskId));
    const elapsed = stored ? Math.floor((Date.now() - Number(stored)) / 1000) : 60;
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    await supabase.from("time_logs").insert({
      task_id: taskId, client_id: clientId || null,
      user_id: profileId || null,
      started_at: stored ? new Date(Number(stored)).toISOString() : null,
      ended_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
    });
  };
  return { running, start, stop };
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface TasksListProps {
  tasks: any[];
  onTaskClick?: (id: string) => void;
  selectedIds?: string[];
  onSelectIds?: (ids: string[]) => void;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
];
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

function TaskRowTimer({ taskId, clientId }: { taskId: string; clientId: string | null }) {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(!!localStorage.getItem(TIMER_KEY(taskId)));

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: totalMinutes = 0 } = useQuery({
    queryKey: ["task-time-total", taskId],
    queryFn: async () => {
      const { data } = await supabase.from("time_logs").select("duration_minutes").eq("task_id", taskId);
      return (data || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
    },
  });

  const handleTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (running) {
      const stored = localStorage.getItem(TIMER_KEY(taskId));
      localStorage.removeItem(TIMER_KEY(taskId));
      setRunning(false);
      const elapsed = stored ? Math.floor((Date.now() - Number(stored)) / 1000) : 60;
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));
      await supabase.from("time_logs").insert({
        task_id: taskId, client_id: clientId || null,
        user_id: profile?.id || null,
        started_at: stored ? new Date(Number(stored)).toISOString() : null,
        ended_at: new Date().toISOString(),
        duration_minutes: durationMinutes,
      });
      queryClient.invalidateQueries({ queryKey: ["task-time-total", taskId] });
      queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
      toast.success(`Logged ${fmtDuration(durationMinutes)}`);
    } else {
      localStorage.setItem(TIMER_KEY(taskId), String(Date.now()));
      setRunning(true);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {totalMinutes > 0 && (
        <span className="text-[10px] font-mono text-muted-foreground">{fmtDuration(totalMinutes)}</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className={`h-6 w-6 p-0 ${running ? "text-red-500" : "text-muted-foreground hover:text-primary"}`}
        onClick={handleTimer}
        title={running ? "Stop timer" : "Start timer"}
      >
        {running ? <Square className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function TasksList({ tasks, onTaskClick, selectedIds = [], onSelectIds }: TasksListProps) {
  const queryClient = useQueryClient();
  const [logDrawer, setLogDrawer] = useState<{ open: boolean; task: any | null }>({ open: false, task: null });
  const [logNote, setLogNote] = useState("");
  const [logHours, setLogHours] = useState("");

  // Inline editing state: { taskId, field }
  const [editing, setEditing] = useState<{ taskId: string; field: string } | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  // Subtask counts for all visible tasks (single batch query)
  const taskIds = tasks.map((t) => t.id);
  const { data: subtaskCounts = {} } = useQuery({
    queryKey: ["subtask-counts", taskIds.join(",")],
    queryFn: async () => {
      if (taskIds.length === 0) return {};
      const { data } = await supabase
        .from("subtasks")
        .select("parent_task_id, status")
        .in("parent_task_id", taskIds);
      const counts: Record<string, { total: number; open: number }> = {};
      (data || []).forEach((s: any) => {
        if (!counts[s.parent_task_id])
          counts[s.parent_task_id] = { total: 0, open: 0 };
        counts[s.parent_task_id].total++;
        if (s.status !== "completed") counts[s.parent_task_id].open++;
      });
      return counts;
    },
    enabled: taskIds.length > 0,
  });

  const patchTask = async (taskId: string, patch: Record<string, any>) => {
    const { error } = await supabase.from("tasks").update(patch).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
  };

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Delete this task? This cannot be undone.")) {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) { toast.error(error.message); return; }
      toast.success("Task deleted");
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 cursor-pointer">Pending</Badge>;
      case "in_progress": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 cursor-pointer">In Progress</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 cursor-pointer">Completed</Badge>;
      case "blocked": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 cursor-pointer">Blocked</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 cursor-pointer">Not Started</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50 cursor-pointer">High</Badge>;
      case "medium": return <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 cursor-pointer">Medium</Badge>;
      default: return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 cursor-pointer">Low</Badge>;
    }
  };

  const stopAndEdit = (e: React.MouseEvent, taskId: string, field: string) => {
    e.stopPropagation();
    setEditing({ taskId, field });
  };

  return (
    <>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] text-center">
                <Checkbox
                  checked={tasks.length > 0 && selectedIds.length === tasks.length}
                  onClick={(e) => e.stopPropagation()}
                  onCheckedChange={(checked) => onSelectIds?.(checked ? tasks.map((t) => t.id) : [])}
                />
              </TableHead>
              <TableHead className="w-[30%]">Task Name</TableHead>
              <TableHead>Client & Service</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"><Clock className="h-3.5 w-3.5" /></TableHead>
              <TableHead className="text-right w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

              return (
                <ContextMenu key={task.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 group"
                      onClick={() => onTaskClick?.(task.id)}
                    >
                      {/* Checkbox */}
                      <TableCell className="w-[40px] text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(task.id)}
                          onCheckedChange={(checked) =>
                            onSelectIds?.(checked ? [...selectedIds, task.id] : selectedIds.filter((id) => id !== task.id))
                          }
                        />
                      </TableCell>

                      {/* Title */}
                      <TableCell className="font-medium">
                        {editing?.taskId === task.id && editing.field === "title" ? (
                          <Input
                            autoFocus
                            defaultValue={task.title}
                            className="h-7 text-sm"
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => { patchTask(task.id, { title: e.target.value }); setEditing(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { patchTask(task.id, { title: (e.target as HTMLInputElement).value }); setEditing(null); }
                              if (e.key === "Escape") setEditing(null);
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span onDoubleClick={(e) => stopAndEdit(e, task.id, "title")} title="Double-click to edit">{task.title}</span>
                            {(subtaskCounts as any)[task.id] && (
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                  (subtaskCounts as any)[task.id].open > 0
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-green-50 text-green-700 border-green-200"
                                }`}
                                title={`${(subtaskCounts as any)[task.id].open} open, ${(subtaskCounts as any)[task.id].total} total subtasks`}
                              >
                                {(subtaskCounts as any)[task.id].total} subtask{(subtaskCounts as any)[task.id].total !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Client */}
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{task.projects?.clients?.name || "No Client"}</span>
                          <span className="text-xs text-muted-foreground">{task.projects?.name || "No Project"}</span>
                        </div>
                      </TableCell>

                      {/* Assignee — click to edit */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {editing?.taskId === task.id && editing.field === "assignee" ? (
                          <Select
                            defaultValue={task.assigned_to || "unassigned"}
                            onValueChange={(v) => { patchTask(task.id, { assigned_to: v === "unassigned" ? null : v }); setEditing(null); }}
                            open
                            onOpenChange={(open) => { if (!open) setEditing(null); }}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {profiles?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div
                            className="flex items-center gap-2 cursor-pointer rounded px-1 hover:bg-muted/60 transition-colors"
                            onClick={(e) => stopAndEdit(e, task.id, "assignee")}
                            title="Click to change assignee"
                          >
                            {task.profiles?.full_name ? (
                              <>
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                    {task.profiles.full_name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm">{task.profiles.full_name}</span>
                              </>
                            ) : (
                              <span className="text-sm italic text-muted-foreground">Unassigned</span>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Due Date — click to edit */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Popover open={datePickerOpen === task.id} onOpenChange={(open) => setDatePickerOpen(open ? task.id : null)}>
                          <PopoverTrigger asChild>
                            <div
                              className={`flex items-center gap-1.5 text-sm cursor-pointer rounded px-1 hover:bg-muted/60 transition-colors ${isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                              title="Click to change due date"
                            >
                              {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                              {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : <span className="opacity-50">Set date</span>}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-3" align="start">
                            <p className="text-xs text-muted-foreground mb-2">Change due date</p>
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              defaultValue={task.due_date ? task.due_date.split("T")[0] : ""}
                              onChange={(e) => {
                                patchTask(task.id, { due_date: e.target.value || null });
                                setDatePickerOpen(null);
                              }}
                            />
                            {task.due_date && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full mt-1 text-red-500 h-7"
                                onClick={() => { patchTask(task.id, { due_date: null }); setDatePickerOpen(null); }}
                              >
                                Clear date
                              </Button>
                            )}
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      {/* Priority — click to cycle */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {editing?.taskId === task.id && editing.field === "priority" ? (
                          <Select
                            defaultValue={task.priority || "low"}
                            onValueChange={(v) => { patchTask(task.id, { priority: v }); setEditing(null); }}
                            open
                            onOpenChange={(open) => { if (!open) setEditing(null); }}
                          >
                            <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div onClick={(e) => stopAndEdit(e, task.id, "priority")}>
                            {getPriorityBadge(task.priority)}
                          </div>
                        )}
                      </TableCell>

                      {/* Status — click to change */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {editing?.taskId === task.id && editing.field === "status" ? (
                          <Select
                            defaultValue={task.status}
                            onValueChange={(v) => { patchTask(task.id, { status: v }); setEditing(null); }}
                            open
                            onOpenChange={(open) => { if (!open) setEditing(null); }}
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div onClick={(e) => stopAndEdit(e, task.id, "status")}>
                            {getStatusBadge(task.status)}
                          </div>
                        )}
                      </TableCell>

                      {/* Time badge + quick timer */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <TaskRowTimer taskId={task.id} clientId={(task.projects as any)?.client_id || null} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); setLogDrawer({ open: true, task }); setLogNote(""); setLogHours(""); }}
                            title="Quick log"
                          >
                            <BookOpen className="h-3.5 w-3.5 mr-1" /> Log
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onTaskClick?.(task.id)}>View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setLogDrawer({ open: true, task }); setLogNote(""); setLogHours(""); }}>
                                <BookOpen className="w-3 h-3 mr-2" /> Quick Log
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {STATUS_OPTIONS.map((s) => (
                                <DropdownMenuItem key={s.value} onClick={() => patchTask(task.id, { status: s.value })}>
                                  Mark as {s.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeleteTask(task.id, e)}>
                                <Trash2 className="w-3 h-3 mr-2" /> Delete Task
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>

                  {/* Right-click context menu */}
                  <ContextMenuContent className="w-56">
                    <ContextMenuItem onClick={() => onTaskClick?.(task.id)}>
                      <Layers className="mr-2 h-4 w-4" /> View Details
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => { setLogDrawer({ open: true, task }); setLogNote(""); setLogHours(""); }}>
                      <BookOpen className="mr-2 h-4 w-4" /> Quick Log
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuSub>
                      <ContextMenuSubTrigger><Clock className="mr-2 h-4 w-4" /> Change Status</ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {STATUS_OPTIONS.map((s) => (
                          <ContextMenuItem key={s.value} onClick={() => patchTask(task.id, { status: s.value })}>
                            {s.label}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger>Change Priority</ContextMenuSubTrigger>
                      <ContextMenuSubContent>
                        {PRIORITY_OPTIONS.map((p) => (
                          <ContextMenuItem key={p.value} onClick={() => patchTask(task.id, { priority: p.value })}>
                            {p.label}
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={() => patchTask(task.id, { status: "completed" })}>
                      <CheckCircle className="mr-2 h-4 w-4 text-green-600" /> Mark Complete
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-red-600"
                      onClick={() => {
                        if (window.confirm("Delete this task?")) {
                          supabase.from("tasks").delete().eq("id", task.id).then(({ error }) => {
                            if (error) toast.error(error.message);
                            else { toast.success("Task deleted"); queryClient.invalidateQueries({ queryKey: ["tasks-list"] }); }
                          });
                        }
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Delete Task
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Quick Log Drawer */}
      <Sheet open={logDrawer.open} onOpenChange={(open) => setLogDrawer({ open, task: logDrawer.task })}>
        <SheetContent side="right" className="w-[380px] sm:w-[420px]">
          <SheetHeader>
            <SheetTitle className="text-base">Quick Log — {logDrawer.task?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <p className="text-sm font-medium mb-1.5">Time Spent (hours)</p>
              <Input
                type="number"
                placeholder="e.g. 1.5"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Note</p>
              <Textarea
                placeholder="What did you work on?"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                rows={4}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Update Status</p>
              <Select
                defaultValue={logDrawer.task?.status}
                onValueChange={(v) => {
                  if (logDrawer.task) patchTask(logDrawer.task.id, { status: v });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                toast.success(`Logged ${logHours ? logHours + "h" : ""} — ${logNote || "no note"}`);
                setLogDrawer({ open: false, task: null });
              }}
            >
              Save Log
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
