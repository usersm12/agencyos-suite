import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";
import { Trash2, CheckCircle2, UserPlus, Flag, CalendarIcon, Download, X } from "lucide-react";

interface BulkActionToolbarProps {
  selectedIds: string[];
  tasks: any[];
  onClearSelection: () => void;
}

export function BulkActionToolbar({ selectedIds, tasks, onClearSelection }: BulkActionToolbarProps) {
  const queryClient = useQueryClient();
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const { data: team } = useQuery({
    queryKey: ['profiles-assign'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name').order('full_name');
      if (error) throw error;
      return data || [];
    }
  });

  const handleBulkAction = async (action: () => Promise<void>) => {
    try {
      await action();
      queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard_metrics'] });
      onClearSelection();
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed");
    }
  };

  const deleteSelected = async () => {
    if (window.confirm(`Delete ${selectedIds.length} tasks? This cannot be undone.`)) {
      await handleBulkAction(async () => {
        const { error } = await supabase.from('tasks').delete().in('id', selectedIds);
        if (error) throw error;
        toast.success(`Deleted ${selectedIds.length} tasks`);
      });
    }
  };

  const updateStatus = async (status: string) => {
    await handleBulkAction(async () => {
      const { error } = await supabase.from('tasks').update({ status }).in('id', selectedIds);
      if (error) throw error;
      toast.success(`Updated status for ${selectedIds.length} tasks`);
    });
  };

  const updatePriority = async (priority: string) => {
    await handleBulkAction(async () => {
      const { error } = await supabase.from('tasks').update({ priority }).in('id', selectedIds);
      if (error) throw error;
      toast.success(`Updated priority for ${selectedIds.length} tasks`);
    });
  };

  const updateAssignee = async (userId: string | null) => {
    await handleBulkAction(async () => {
      const { error } = await supabase.from('tasks').update({ assigned_to: userId }).in('id', selectedIds);
      if (error) throw error;
      toast.success(`Updated assignee for ${selectedIds.length} tasks`);
    });
  };

  const updateDueDate = async (date: Date | undefined) => {
    if (!date) return;
    setIsDatePickerOpen(false);
    await handleBulkAction(async () => {
      const formatted = format(date, 'yyyy-MM-dd');
      const { error } = await supabase.from('tasks').update({ due_date: formatted }).in('id', selectedIds);
      if (error) throw error;
      toast.success(`Updated due date for ${selectedIds.length} tasks`);
    });
  };

  const exportCsv = () => {
    const selectedTasks = tasks.filter(t => selectedIds.includes(t.id));
    if (!selectedTasks.length) return;

    const headers = ['Title', 'Client', 'Service Type', 'Assignee', 'Due Date', 'Priority', 'Status', 'Created Date'];
    const escapeCsv = (str: any) => `"${String(str || '').replace(/"/g, '""')}"`;
    
    const rows = selectedTasks.map(t => [
      escapeCsv(t.title),
      escapeCsv(t.clients?.name),
      escapeCsv(t.service_type || 'N/A'),
      escapeCsv(t.profiles?.full_name),
      escapeCsv(t.due_date ? format(new Date(t.due_date), 'yyyy-MM-dd') : ''),
      escapeCsv(t.priority),
      escapeCsv(t.status),
      escapeCsv(format(new Date(t.created_at), 'yyyy-MM-dd'))
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedTasks.length} tasks to CSV`);
    onClearSelection();
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center justify-between shadow-lg sticky top-4 z-50 animate-in fade-in slide-in-from-top-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 font-medium">
          <span className="bg-primary-foreground/20 px-2 py-0.5 rounded text-sm">{selectedIds.length}</span>
          <span>Selected</span>
        </div>
        
        <div className="h-4 w-px bg-primary-foreground/30 mx-2" />

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
                <CheckCircle2 className="w-4 h-4 mr-2" /> Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateStatus('not_started')}>Not Started</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('in_progress')}>In Progress</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('completed')}>Completed</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('blocked')}>Blocked</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus('overdue')}>Overdue</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
                <UserPlus className="w-4 h-4 mr-2" /> Reassign
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updateAssignee(null)} className="italic text-muted-foreground">Unassigned</DropdownMenuItem>
              <DropdownMenuSeparator />
              {team?.map(member => (
                <DropdownMenuItem key={member.id} onClick={() => updateAssignee(member.id)}>{member.full_name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
                <Flag className="w-4 h-4 mr-2" /> Priority
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => updatePriority('high')} className="text-red-600 font-medium">High</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updatePriority('medium')} className="text-orange-600 font-medium">Medium</DropdownMenuItem>
              <DropdownMenuItem onClick={() => updatePriority('low')} className="text-green-600 font-medium">Low</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
                <CalendarIcon className="w-4 h-4 mr-2" /> Due Date
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" onSelect={updateDueDate} initialFocus />
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="sm" onClick={exportCsv} className="text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>

          <Button variant="ghost" size="sm" onClick={deleteSelected} className="text-red-300 hover:bg-red-900/40 hover:text-red-200 ml-2">
            <Trash2 className="w-4 h-4 mr-2" /> Delete
          </Button>
        </div>
      </div>

      <Button variant="ghost" size="icon" onClick={onClearSelection} className="text-primary-foreground/70 hover:bg-primary-foreground/20 hover:text-primary-foreground rounded-full h-8 w-8">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
