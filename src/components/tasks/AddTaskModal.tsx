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
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { sendPushToUsers } from "@/lib/pushNotify";

const addTaskSchema = z.object({
  title: z.string().min(2, "Title is required"),
  client_id: z.string().min(1, "Client is required"),
  property_id: z.string().optional(),
  service_subtype_id: z.string().optional(),
  assigned_to: z.string().optional(),
  due_date: z.date().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  description: z.string().optional(),
  needs_approval: z.boolean().default(false),
  target_count: z.number().int().positive().optional(),
  estimated_h: z.number().int().min(0).optional(),
  estimated_m: z.number().int().min(0).max(59).optional(),
});

type AddTaskFormValues = z.infer<typeof addTaskSchema>;

// Kept for backward-compat imports — logic is now driven by subtype.is_count_based
export const COUNT_BASED_SERVICES = ["Backlinks", "Content Writing", "Social Media"];

function getAutoSubtasks(serviceType: string): string[] {
  switch (serviceType) {
    case "Backlinks":
      return ["Research target sites", "Send outreach emails", "Follow up on leads", "Verify links are live", "Log all links in deliverables"];
    case "Content Writing":
      return ["Keyword research for articles", "Write draft articles", "Get client approval", "Publish articles", "Submit URLs to Search Console"];
    case "On-Page SEO":
      return ["Audit title tags & meta descriptions", "Fix heading structure", "Add internal links", "Optimise images & alt text", "Submit updated URLs"];
    case "Technical SEO":
      return ["Run site crawl", "Fix broken links", "Check Core Web Vitals", "Update XML sitemap", "Document fixes"];
    case "Social Media":
      return ["Plan content calendar", "Create all visuals & captions", "Get client approval", "Schedule & publish posts", "Log post URLs & metrics"];
    case "Google Ads":
      return ["Review search terms & add negatives", "Check Quality Scores", "Review budget pacing", "Optimise bids & audiences", "Prepare client report"];
    case "Meta Ads":
      return ["Check ROAS & creative fatigue", "Refresh underperforming creatives", "Review audience performance", "Adjust budgets", "Prepare client report"];
    case "Web Development":
      return ["Client brief received", "Design approved", "Development complete", "Testing done", "Client sign-off"];
    default:
      return [];
  }
}

export function AddTaskModal() {
  const [open, setOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const form = useForm<AddTaskFormValues>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: { title: "", client_id: "", property_id: undefined, service_subtype_id: undefined, assigned_to: undefined, priority: "medium", description: "", needs_approval: false, target_count: undefined, estimated_h: undefined, estimated_m: undefined },
  });

  const selectedClientId = form.watch("client_id");

  const { data: clients = [] } = useQuery({
    queryKey: ["task-modal-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, is_multisite")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    refetchOnMount: "always",
  });

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const { data: properties = [] } = useQuery({
    queryKey: ["task-modal-properties", selectedClientId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_properties_for_client", {
        p_client_id: selectedClientId,
      });
      if (error) throw error;
      return (data as Array<{ id: string; name: string; is_primary: boolean }>) || [];
    },
    enabled: !!selectedClientId && !!selectedClient?.is_multisite,
  });

  const { data: team } = useQuery({
    queryKey: ["team-dropdown"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-and-subtypes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, service_subtypes(id, name, slug, is_count_based, sort_order)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; service_subtypes: Array<{ id: string; name: string; slug: string; is_count_based: boolean; sort_order: number }> }>;
    },
    enabled: open,
  });

  const selectedSubtypeId = form.watch("service_subtype_id");
  const availableSubtypes = services.find(s => s.id === selectedServiceId)?.service_subtypes
    ?.slice().sort((a, b) => a.sort_order - b.sort_order) || [];
  const selectedSubtype = availableSubtypes.find(st => st.id === selectedSubtypeId);
  const isCountBased = !!selectedSubtype?.is_count_based;

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) { form.reset(); setSelectedServiceId(undefined); }
  }

  async function onSubmit(data: AddTaskFormValues) {
    try {
      const { data: newTask, error } = await supabase
        .from("tasks")
        .insert({
          title: data.title,
          client_id: data.client_id,
          property_id: data.property_id || null,
          service_subtype_id: data.service_subtype_id || null,
          // Keep service_type text in sync for backward compat
          service_type: selectedSubtype?.name || null,
          assigned_to: data.assigned_to || null,
          due_date: data.due_date ? format(data.due_date, "yyyy-MM-dd") : null,
          priority: data.priority,
          description: data.description || null,
          needs_approval: data.needs_approval,
          target_count: data.target_count || null,
          estimated_minutes: ((data.estimated_h || 0) * 60 + (data.estimated_m || 0)) || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Notify + push the assignee (if not the creator)
      if (newTask && data.assigned_to && data.assigned_to !== profile?.id) {
        const clientName = clients.find((c) => c.id === data.client_id)?.name || "";
        const notifBody = data.title + (clientName ? ` · ${clientName}` : "");
        supabase.from("notifications").insert({
          user_id: data.assigned_to,
          type: "task_assigned",
          title: "New task assigned to you",
          body: notifBody,
          task_id: newTask.id,
        }).then(() => {});
        sendPushToUsers([data.assigned_to], "New task assigned to you", notifBody, `/tasks?open=${newTask.id}`);
      }

      if (newTask && selectedSubtype?.name) {
        const autoSubtasks = getAutoSubtasks(selectedSubtype.name);
        if (autoSubtasks.length > 0) {
          await supabase.from("subtasks").insert(
            autoSubtasks.map((title) => ({ parent_task_id: newTask.id, title, status: "not_started", priority: "medium", created_by: profile?.id || null }))
          );
        }
      }

      toast.success("Task created successfully");
      handleOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      queryClient.invalidateQueries({ queryKey: ["subtask-counts"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Task</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Add a new task, assign it to a team member, and set a deadline.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Task Title *</FormLabel>
                <FormControl><Input placeholder="E.g., Complete Monthly SEO Audit" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client */}
              <FormField control={form.control} name="client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Client *</FormLabel>
                  <Select value={field.value} onValueChange={(val) => {
                    field.onChange(val);
                    form.setValue("property_id", undefined); // reset property on client change
                  }}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Property — only for multisite clients */}
              {selectedClient?.is_multisite && (
                <FormField control={form.control} name="property_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}{p.is_primary ? " ★" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

              {/* Step 1: Parent service */}
              <FormItem>
                <FormLabel>Service</FormLabel>
                <Select
                  value={selectedServiceId ?? ""}
                  onValueChange={(v) => {
                    const val = v === "__none__" ? undefined : v;
                    setSelectedServiceId(val);
                    form.setValue("service_subtype_id", undefined);
                    form.setValue("target_count", undefined);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormItem>

              {/* Step 2: Subtype (filtered by selected service) */}
              {selectedServiceId && selectedServiceId !== "__none__" && (
                <FormField control={form.control} name="service_subtype_id" render={({ field }) => (
                  <FormItem>
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

              {/* Assign To */}
              <FormField control={form.control} name="assigned_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Assign To</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {team?.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name || "Unnamed"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Due Date */}
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem className="flex flex-col mt-2.5">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                          {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Priority */}
              <FormField control={form.control} name="priority" render={({ field }) => (
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
              )} />

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
            </div>

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description / Notes</FormLabel>
                <FormControl>
                  <Textarea className="min-h-[100px]" placeholder="Add context or instructions..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="needs_approval" render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <FormLabel className="text-sm font-medium">Requires approval to complete</FormLabel>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assignee must submit for manager approval before marking this task done.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
