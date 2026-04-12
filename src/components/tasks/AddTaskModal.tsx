import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const addTaskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  project_id: z.string().min(1, "Project is required"),
  service_type: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.date().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  description: z.string().optional(),
});

type AddTaskFormValues = z.infer<typeof addTaskSchema>;

export function AddTaskModal() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<AddTaskFormValues>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: {
      title: "",
      project_id: "",
      service_type: undefined,
      assigned_to: undefined,
      priority: "medium",
      description: "",
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_id, clients(name)')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: projects !== undefined && projects.length === 0
  });

  const displayOptions = projects && projects.length > 0 
    ? projects.map(p => ({
        id: p.id,
        name: `${p.name} ${p.clients?.name ? `(${p.clients.name})` : ''}`,
        type: 'project'
      })) 
    : clients?.map(c => ({
        id: c.id,
        name: c.name,
        type: 'client'
      })) || [];

  const { data: team } = useQuery({
    queryKey: ['team-dropdown'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, full_name');
      if (error) throw error;
      return data;
    }
  });

  const SERVICES_LIST = [
    "SEO",
    "Google Ads",
    "Meta Ads",
    "Social Media",
    "Web Development"
  ];

  async function onSubmit(data: AddTaskFormValues) {
    try {
      let finalProjectId = data.project_id;

      // If we are using clients as the fallback selector, map it to a Project under the hood
      if (projects !== undefined && projects.length === 0) {
        let { data: existingProject } = await supabase
          .from('projects')
          .select('id')
          .eq('client_id', data.project_id)
          .limit(1)
          .maybeSingle();

        if (!existingProject) {
          const clientName = clients?.find(c => c.id === data.project_id)?.name || 'Client';
          const { data: newProject, error: projError } = await supabase
            .from('projects')
            .insert({
              client_id: data.project_id,
              name: `${clientName} Default Project`,
              status: 'active'
            })
            .select('id')
            .single();

          if (projError) throw projError;
          finalProjectId = newProject.id;
        } else {
          finalProjectId = existingProject.id;
        }
      }

      const { error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          project_id: finalProjectId,
          service_type: data.service_type || null,
          assigned_to: data.assigned_to || null,
          due_date: data.due_date ? format(data.due_date, 'yyyy-MM-dd') : null,
          priority: data.priority,
          description: data.description || null,
        });

      if (error) throw error;
      toast.success("Task created successfully");
      setOpen(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task, assign it to a team member, and set a deadline.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Complete Monthly SEO Audit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {displayOptions.map(option => (
                           <SelectItem key={option.id} value={option.id}>
                             {option.name}
                           </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="service_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SERVICES_LIST.map(service => (
                          <SelectItem key={service} value={service}>{service}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {team?.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name || 'Unnamed'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col mt-2.5">
                    <FormLabel>Due Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Notes</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[100px]" placeholder="Add context or instructions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
