import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TasksKanbanProps {
  tasks: any[];
  onTaskClick?: (id: string) => void;
}

export function TasksKanban({ tasks, onTaskClick }: TasksKanbanProps) {
  const queryClient = useQueryClient();
  const columns = [
    { id: "not_started", title: "Not Started", color: "bg-gray-100 dark:bg-gray-800" },
    { id: "in_progress", title: "In Progress", color: "bg-blue-50 dark:bg-blue-900/20" },
    { id: "blocked", title: "Blocked", color: "bg-red-50 dark:bg-red-900/20" },
    { id: "completed", title: "Completed", color: "bg-green-50 dark:bg-green-900/20" },
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "text-red-700 bg-red-100";
      case "medium": return "text-orange-700 bg-orange-100";
      case "low": return "text-green-700 bg-green-100";
      default: return "bg-gray-100";
    }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    
    // Optimistic UI could be implemented here, but simple mutation wrapper is enough for v1
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: statusId })
        .eq('id', taskId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
    } catch (err: any) {
      toast.error("Failed to update task status");
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const columnTasks = tasks.filter(t => t.status === col.id);
        
        return (
          <div 
            key={col.id} 
            className={`rounded-xl p-4 min-h-[500px] border border-dashed ${col.color}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{col.title}</h3>
              <Badge variant="secondary">{columnTasks.length}</Badge>
            </div>
            
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <div 
                  key={task.id} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onClick={() => onTaskClick?.(task.id)}
                  className="bg-card p-3 rounded-lg shadow-sm border cursor-grab hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-medium text-muted-foreground truncate pr-2">
                      {task.clients?.name || 'No Client'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority?.toUpperCase() || 'MEDIUM'}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-semibold mb-3 leading-snug">{task.title}</h4>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {task.profiles?.full_name ? (
                        <div className="flex items-center gap-1.5">
                           <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] border">
                             {task.profiles.full_name.substring(0, 1)}
                           </div>
                        </div>
                      ) : (
                        <span className="italic">Unassigned</span>
                      )}
                    </div>
                    {task.due_date && (
                      <div className={`flex items-center gap-1 ${new Date(task.due_date) < new Date() && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}`}>
                        {new Date(task.due_date) < new Date() && task.status !== 'completed' ? <AlertCircle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                        {format(new Date(task.due_date), 'MMM d')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {columnTasks.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground italic opacity-50">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
