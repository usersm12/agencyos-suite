import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckSquare, Circle, Trash2, Plus, CalendarIcon, UserCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Props {
  taskId: string;
  onOpenCountChange?: (count: number) => void;
}

const STATUS_CYCLE: Record<string, string> = {
  not_started: "in_progress",
  in_progress: "completed",
  completed: "not_started",
};

export function SubtasksSection({ taskId, onOpenCountChange }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ["subtasks", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subtasks")
        .select("*, profiles!subtasks_assigned_to_fkey(id, full_name)")
        .eq("parent_task_id", taskId)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!taskId,
  });

  const list = subtasks as any[];
  const completed = list.filter((s) => s.status === "completed").length;
  const openCount = list.filter((s) => s.status !== "completed").length;
  const progress = list.length > 0 ? Math.round((completed / list.length) * 100) : 0;

  useEffect(() => {
    onOpenCountChange?.(openCount);
  }, [openCount, onOpenCountChange]);

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      if (!profile) throw new Error("Not logged in");
      const { error } = await supabase.from("subtasks").insert({
        parent_task_id: taskId,
        title,
        status: "not_started",
        priority: "medium",
        created_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["subtasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["subtask-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const patchSubtask = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("subtasks").update(patch).eq("id", id);
      if (error) throw error;
      // Notify assigned user (non-blocking)
      if (patch.assigned_to && patch.assigned_to !== profile?.id) {
        supabase.from("notifications").insert({
          user_id: patch.assigned_to,
          type: "subtask_assigned",
          title: "Subtask assigned to you",
          body: list.find((s) => s.id === id)?.title || "A subtask was assigned to you",
          task_id: taskId,
        }).then(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["subtask-counts"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["subtask-counts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusIcon = (status: string) => {
    if (status === "completed")
      return <CheckSquare className="w-4 h-4 text-green-500 shrink-0" />;
    if (status === "in_progress")
      return (
        <div className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        </div>
      );
    return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />;
  };

  const handleAdd = () => {
    if (!newTitle.trim() || addSubtask.isPending) return;
    addSubtask.mutate(newTitle.trim());
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-foreground" />
        <h4 className="text-sm font-semibold">Subtasks</h4>
        {list.length > 0 && (
          <Badge variant="outline" className="text-xs font-mono">
            {completed}/{list.length}
          </Badge>
        )}
      </div>

      {/* Progress */}
      {list.length > 0 && (
        <div className="space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {completed} of {list.length} subtasks complete
          </p>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="h-10 bg-muted/20 animate-pulse rounded" />
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {list.map((st) => (
            <div
              key={st.id}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-card group hover:bg-muted/20 transition-colors"
            >
              {/* Status toggle */}
              <button
                onClick={() =>
                  patchSubtask.mutate({
                    id: st.id,
                    patch: { status: STATUS_CYCLE[st.status] || "not_started" },
                  })
                }
                className="shrink-0 focus:outline-none"
                title="Click to cycle status"
              >
                {statusIcon(st.status)}
              </button>

              {/* Title */}
              <span
                className={`flex-1 text-sm min-w-0 truncate ${
                  st.status === "completed" ? "line-through text-muted-foreground" : ""
                }`}
              >
                {st.title}
              </span>

              {/* Status badge */}
              {st.status !== "not_started" && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                    st.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {st.status === "completed" ? "Done" : "In Progress"}
                </span>
              )}

              {/* Assignee picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="shrink-0 focus:outline-none"
                    title={st.profiles?.full_name || "Assign"}
                  >
                    {st.profiles?.full_name ? (
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                          {st.profiles.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <UserCircle className="w-4 h-4 text-muted-foreground/40" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="end">
                  <button
                    className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted"
                    onClick={() =>
                      patchSubtask.mutate({ id: st.id, patch: { assigned_to: null } })
                    }
                  >
                    Unassigned
                  </button>
                  {(profiles as any[]).map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
                      onClick={() =>
                        patchSubtask.mutate({ id: st.id, patch: { assigned_to: p.id } })
                      }
                    >
                      <Avatar className="h-4 w-4">
                        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                          {p.full_name?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{p.full_name}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              {/* Due date */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground shrink-0 min-w-[36px]"
                    title="Set due date"
                  >
                    <CalendarIcon className="w-3 h-3" />
                    {st.due_date
                      ? format(new Date(st.due_date + "T00:00:00"), "MMM d")
                      : ""}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="end">
                  <p className="text-xs text-muted-foreground mb-1.5">Due date</p>
                  <Input
                    type="date"
                    className="h-7 text-xs"
                    defaultValue={st.due_date || ""}
                    onChange={(e) =>
                      patchSubtask.mutate({
                        id: st.id,
                        patch: { due_date: e.target.value || null },
                      })
                    }
                  />
                  {st.due_date && (
                    <button
                      className="mt-1 text-xs text-red-500 hover:text-red-700 w-full text-left px-1"
                      onClick={() =>
                        patchSubtask.mutate({ id: st.id, patch: { due_date: null } })
                      }
                    >
                      Clear date
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Delete */}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 shrink-0"
                onClick={() => deleteSubtask.mutate(st.id)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}

          {list.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground italic">
              No subtasks yet — add one below
            </div>
          )}
        </div>
      )}

      {/* Add new subtask */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Add subtask… press Enter"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2 shrink-0"
          onClick={handleAdd}
          disabled={!newTitle.trim() || addSubtask.isPending}
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
