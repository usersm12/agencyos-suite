import { useEffect, useState } from "react";
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

const schema = z.object({
  title:              z.string().min(1, "Title is required"),
  client_id:          z.string().optional(),
  assigned_to:        z.string().optional(),
  priority:           z.enum(["low", "medium", "high"]),
  due_date:           z.string().optional(),
  service_subtype_id: z.string().optional(),
  description:        z.string().optional(),
  needs_approval:     z.boolean().default(false),
  target_count:       z.number().int().positive().optional(),
  estimated_h:        z.number().int().min(0).optional(),
  estimated_m:        z.number().int().min(0).max(59).optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  task: any;
  open: boolean;
  onClose: () => void;
}

export function TaskEditModal({ task, open, onClose }: Props) {
  const queryClient = useQueryClient();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "", client_id: "none", assigned_to: "none", priority: "medium",
      due_date: "", service_subtype_id: undefined, description: "",
      needs_approval: false, target_count: undefined,
      estimated_h: undefined, estimated_m: undefined,
    },
  });

  // Load services + subtypes
  const { data: services = [] } = useQuery({
    queryKey: ["services-and-subtypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, service_subtypes(id, name, slug, is_count_based, sort_order)")
        .eq("is_active", true).order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; service_subtypes: Array<{ id: string; name: string; slug: string; is_count_based: boolean; sort_order: number }> }>;
    },
    enabled: open,
  });

  const selectedSubtypeId = form.watch("service_subtype_id");
  const availableSubtypes = services.find(s => s.id === selectedServiceId)?.service_subtypes
    ?.slice().sort((a, b) => a.sort_order - b.sort_order) || [];
  const selectedSubtype = services.flatMap(s => s.service_subtypes).find(st => st.id === selectedSubtypeId);
  const isCountBased = !!selectedSubtype?.is_count_based;

  // Populate from task whenever modal opens
  useEffect(() => {
    if (task && open) {
      // Resolve parent service from subtype
      const subtypeId = task.service_subtype_id ?? undefined;
      if (subtypeId && services.length > 0) {
        const parentSvc = services.find(s => s.service_subtypes.some(st => st.id === subtypeId));
        if (parentSvc) setSelectedServiceId(parentSvc.id);
      }
      form.reset({
        title:              task.title ?? "",
        client_id:          task.client_id ?? "none",
        assigned_to:        task.assigned_to ?? "none",
        priority:           task.priority ?? "medium",
        due_date:           task.due_date ? String(task.due_date).split("T")[0] : "",
        service_subtype_id: subtypeId,
        description:        task.description ?? "",
        needs_approval:     task.needs_approval ?? false,
        target_count:       task.target_count ?? undefined,
        estimated_h:        task.estimated_minutes ? Math.floor(task.estimated_minutes / 60) : undefined,
        estimated_m:        task.estimated_minutes ? task.estimated_minutes % 60 : undefined,
      });
    }
  }, [task, open, services]); // eslint-disable-line react-hooks/exhaustive-deps

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
          title:              values.title,
          client_id:          none(values.client_id),
          assigned_to:        none(values.assigned_to),
          priority:           values.priority,
          due_date:           values.due_date || null,
          service_subtype_id: values.service_subtype_id || null,
          service_type:       selectedSubtype?.name || null,
          description:        values.description || null,
          needs_approval:     values.needs_approval,
          target_count:       values.target_count || null,
          estimated_minutes:  ((values.estimated_h || 0) * 60 + (values.estimated_m || 0)) || null,
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

              {/* Step 1: Parent service */}
              <FormItem className="md:col-span-2">
                <FormLabel>Service</FormLabel>
                <Select
                  value={selectedServiceId}
                  onValueChange={(v) => {
                    setSelectedServiceId(v);
                    form.setValue("service_subtype_id", undefined);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>

              {/* Step 2: Subtype */}
              {selectedServiceId && selectedServiceId !== "none" && (
                <FormField control={form.control} name="service_subtype_id" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Subtype</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a subtype" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableSubtypes.map(st => (
                          <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {/* Target count — only for count-based subtypes */}
            {isCountBased && (
              <FormField control={form.control} name="target_count" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Target ({selectedSubtype?.name})</FormLabel>
                  <FormControl>
                    <Input
                      type="number" min={1} placeholder="e.g. 20"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {/* Estimated time — hours + minutes */}
            <FormItem>
              <FormLabel>Estimated Time</FormLabel>
              <div className="flex items-center gap-2">
                <FormField control={form.control} name="estimated_h" render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="number" min={0} placeholder="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          className="pr-8"
                        />
                      </FormControl>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">h</span>
                    </div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="estimated_m" render={({ field }) => (
                  <FormItem className="flex-1 space-y-0">
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="number" min={0} max={59} placeholder="0"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          className="pr-8"
                        />
                      </FormControl>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">m</span>
                    </div>
                  </FormItem>
                )} />
              </div>
            </FormItem>

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
