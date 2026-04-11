import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LayoutList, LayoutGrid } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// We'll construct these components next
import { TasksList } from "@/components/tasks/TasksList";
import { TasksKanban } from "@/components/tasks/TasksKanban";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

export default function TasksPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          projects (name, client_id, clients (name)),
          profiles!tasks_assigned_to_fkey (full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const filteredTasks = tasks?.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (t.projects as any)?.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage deliverables, track status, and organize your queue.</p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as typeof view)}>
            <ToggleGroupItem value="list" aria-label="Toggle list view"><LayoutList className="h-4 w-4" /></ToggleGroupItem>
            <ToggleGroupItem value="kanban" aria-label="Toggle kanban view"><LayoutGrid className="h-4 w-4" /></ToggleGroupItem>
          </ToggleGroup>
          <AddTaskModal />
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search tasks or clients..." 
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-40 bg-card rounded-xl border animate-pulse" />
      ) : filteredTasks.length > 0 ? (
        view === "list" ? (
          <TasksList tasks={filteredTasks} onTaskClick={setSelectedTaskId} />
        ) : (
          <TasksKanban tasks={filteredTasks} onTaskClick={setSelectedTaskId} />
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-xl bg-card/50">
          <h3 className="text-lg font-semibold mt-4">No tasks found</h3>
          <p className="text-muted-foreground text-sm mt-1 mb-4">You have an empty queue!</p>
          <AddTaskModal />
        </div>
      )}
      
      <TaskDetailPanel taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}
