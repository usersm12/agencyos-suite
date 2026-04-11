import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MoreHorizontal, Calendar, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface TasksListProps {
  tasks: any[];
  onTaskClick?: (id: string) => void;
}

export function TasksList({ tasks, onTaskClick }: TasksListProps) {
  const queryClient = useQueryClient();
  
  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
      try {
        const { error } = await supabase.from('tasks').delete().eq('id', taskId);
        if (error) throw error;
        toast.success("Task deleted successfully");
        queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
      } catch (err: any) {
        toast.error(err.message || "Failed to delete task");
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in_progress": return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Progress</Badge>;
      case "completed": return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Completed</Badge>;
      case "blocked": return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Blocked</Badge>;
      case "overdue": return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Overdue</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">Not Started</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high": return <Badge variant="outline" className="border-red-200 text-red-700 bg-red-50">High</Badge>;
      case "medium": return <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50">Medium</Badge>;
      default: return <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Low</Badge>;
    }
  };

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Task Name</TableHead>
            <TableHead>Client & Service</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
            
            return (
              <TableRow key={task.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick?.(task.id)}>
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <span>{task.title}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{task.projects?.clients?.name || 'No Client'}</span>
                    <span className="text-xs text-muted-foreground">{task.projects?.name || 'No Project'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {task.profiles?.full_name ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {task.profiles.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.profiles.full_name}</span>
                    </div>
                  ) : (
                    <span className="text-sm italic text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell>
                  {task.due_date ? (
                    <div className={`flex items-center gap-1.5 text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                      {isOverdue ? <AlertCircle className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                      {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground opacity-50">-</span>
                  )}
                </TableCell>
                <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                <TableCell>{getStatusBadge(task.status)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onTaskClick?.(task.id)}>View Details</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={(e) => handleDeleteTask(task.id, e)}>
                        <Trash2 className="w-3 h-3 mr-2" /> Delete Task
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
