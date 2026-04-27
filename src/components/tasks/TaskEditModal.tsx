import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

const schema = z.object({
  title:           z.string().min(1, "Title is required"),
  client_id:       z.string().optional(),
  assigned_to:     z.string().optional(),
  priority:        z.enum(["low", "medium", "high"]),
  due_date:        z.string().optional(),
  service_type:    z.string().optional(),
  description:     z.string().optional(),
  needs_approval:  z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  task: any;
  open: boolean;
  onClose: () => void;
}

const SERVICES = ["SEO", "Google Ads", "Meta Ads", "Social Media", "Web Development"];

export function TaskEditModal({ task, open, onClose }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", client_id: "none", assigned_to: "none", priority: "medium",
      due_date: "", service_type: "none", description: "", needs_approval: false,
    },
  });

  // Populate from task whenever modal opens
  useEffect(() => {
    if (task && open) {
      form.reset({
        title:          task.title ?? "",
        client_id:      task.client_id ?? "none",
        assigned_to:    task.assigned_to ?? "none",
        priority:       task.priority ?? "medium",
        due_date:       task.due_date ? String(task.due_date).split("T")[0] : "",
        service_type:   task.service_type ?? "none",
        description:    task.description ?? "",
        needs_approval: task.needs_approval ?? false,
      });
    }
  }, [task, open, form]);

  const { data: clients = [] } = useQuery({
    queryKey: ["edit-task-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: team = [] } = useQuery({
    queryKey: ["edit-task-team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  async function onSubmit(values: FormValues) {
    try {
      const none = (v?: string) => (!v || v === "none" ? null : v);
      const { error } = await supabase
        .from("tasks")
        .update({
          title:          values.title,
          client_id:      none(values.client_id),
          assigned_to:    none(values.assigned_to),
          priority:       values.priority,
          due_date:       values.due_date || null,
          service_type:   none(values.service_type),
          description:    values.description || null,
          needs_approval: values.needs_approval,
        })
        .eq("id", task.id);

      if (error) throw error;
      toast.success("Task updated");
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">

            {/* Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Task Title *</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client */}
              <FormField control={form.control} name="client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="No client" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {/* Assignee */}
              <FormField control={form.control} name="assigned_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned To</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {team.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name || "Unnamed"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {/* Priority */}
              <FormField control={form.control} name="priority" render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              {/* Due date */}
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Service type */}
              <FormField control={form.control} name="service_type" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Service Type</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SERVICES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            {/* Description */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description / Notes</FormLabel>
                <FormControl>
                  <Textarea className="min-h-[80px]" placeholder="Add context or instructions…" {...field} />
                </FormControl>
              </FormItem>
            )} />

            {/* Needs approval toggle */}
            <FormField control={form.control} name="needs_approval" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <FormLabel className="text-sm font-medium">Requires approval to complete</FormLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assignee must submit for manager approval before marking this done.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
