import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface Service {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface TaskTemplate {
  id: string;
  service_id: string;
  template_name: string;
  deliverable_fields: any;
  sort_order: number;
}

interface GoalType {
  id: string;
  service_id: string;
  goal_name: string;
  goal_config: any;
}

export default function ServicesMaster() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [goalTypes, setGoalTypes] = useState<GoalType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");

  const isOwner = profile?.role === "owner";

  const fetchData = async () => {
    setLoading(true);
    const [sRes, tRes, gRes] = await Promise.all([
      supabase.from("services").select("*").order("name"),
      supabase.from("service_task_templates").select("*").order("sort_order"),
      supabase.from("service_goal_types").select("*").order("goal_name"),
    ]);
    setServices(sRes.data || []);
    setTemplates(tRes.data || []);
    setGoalTypes(gRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveService = async () => {
    if (!formName.trim()) return;

    if (editingService) {
      const { error } = await supabase
        .from("services")
        .update({ name: formName, description: formDesc || null })
        .eq("id", editingService.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Service updated");
    } else {
      const { error } = await supabase
        .from("services")
        .insert({ name: formName, description: formDesc || null });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Service added");
    }
    setDialogOpen(false);
    setEditingService(null);
    setFormName("");
    setFormDesc("");
    fetchData();
  };

  const handleToggleActive = async (service: Service) => {
    const { error } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    fetchData();
  };

  const handleDeleteService = async (id: string) => {
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Service deleted");
    fetchData();
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setFormName(service.name);
    setFormDesc(service.description || "");
    setDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingService(null);
    setFormName("");
    setFormDesc("");
    setDialogOpen(true);
  };

  // Task template management
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateServiceId, setTemplateServiceId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateFields, setTemplateFields] = useState("");

  const handleAddTemplate = async () => {
    if (!templateName.trim()) return;
    let fields: string[] = [];
    try {
      fields = templateFields.split(",").map((f) => f.trim()).filter(Boolean);
    } catch {}
    const { error } = await supabase.from("service_task_templates").insert({
      service_id: templateServiceId,
      template_name: templateName,
      deliverable_fields: fields,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Template added");
    setTemplateDialogOpen(false);
    setTemplateName("");
    setTemplateFields("");
    fetchData();
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from("service_task_templates").delete().eq("id", id);
    fetchData();
  };

  // Goal type management
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalServiceId, setGoalServiceId] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalConfig, setGoalConfig] = useState("");

  const handleAddGoal = async () => {
    if (!goalName.trim()) return;
    let config = {};
    try {
      config = goalConfig ? JSON.parse(goalConfig) : {};
    } catch {
      toast.error("Invalid JSON config");
      return;
    }
    const { error } = await supabase.from("service_goal_types").insert({
      service_id: goalServiceId,
      goal_name: goalName,
      goal_config: config,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Goal type added");
    setGoalDialogOpen(false);
    setGoalName("");
    setGoalConfig("");
    fetchData();
  };

  const handleDeleteGoal = async (id: string) => {
    await supabase.from("service_goal_types").delete().eq("id", id);
    fetchData();
  };

  if (!isOwner) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Only owners can manage services.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading services...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Services Master</h2>
          <p className="text-sm text-muted-foreground">
            Manage the services your agency offers. Each service drives task templates and goal types.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add Service"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. SEO" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Describe this service..." />
              </div>
              <Button onClick={handleSaveService} className="w-full">
                {editingService ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No services yet. Add your first service to get started.
          </CardContent>
        </Card>
      )}

      {services.map((service) => {
        const serviceTemplates = templates.filter((t) => t.service_id === service.id);
        const serviceGoals = goalTypes.filter((g) => g.service_id === service.id);
        const isExpanded = expandedService === service.id;

        return (
          <Card key={service.id} className="animate-fade-in">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpandedService(isExpanded ? null : service.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <div>
                    <CardTitle className="text-base">{service.name}</CardTitle>
                    {service.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{service.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={service.is_active ? "default" : "secondary"}>
                    {service.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Switch checked={service.is_active} onCheckedChange={() => handleToggleActive(service)} />
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(service)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteService(service.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                <Separator />
                {/* Task Templates */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Task Templates</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTemplateServiceId(service.id);
                        setTemplateName("");
                        setTemplateFields("");
                        setTemplateDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {serviceTemplates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No templates yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {serviceTemplates.map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                          <div>
                            <span className="text-sm">{t.template_name}</span>
                            {Array.isArray(t.deliverable_fields) && t.deliverable_fields.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({(t.deliverable_fields as string[]).join(", ")})
                              </span>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTemplate(t.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Goal Types */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Goal Types</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setGoalServiceId(service.id);
                        setGoalName("");
                        setGoalConfig("");
                        setGoalDialogOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add
                    </Button>
                  </div>
                  {serviceGoals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No goal types yet.</p>
                  ) : (
                    <div className="space-y-1">
                      {serviceGoals.map((g) => (
                        <div key={g.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                          <span className="text-sm">{g.goal_name}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteGoal(g.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Task Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Monthly Keyword Research" />
            </div>
            <div className="space-y-2">
              <Label>Deliverable Fields (comma-separated)</Label>
              <Input value={templateFields} onChange={(e) => setTemplateFields(e.target.value)} placeholder="e.g. Report URL, Keyword Count, Notes" />
            </div>
            <Button onClick={handleAddTemplate} className="w-full">Add Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Goal Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Name</Label>
              <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="e.g. Traffic Target" />
            </div>
            <div className="space-y-2">
              <Label>Config (JSON, optional)</Label>
              <Textarea value={goalConfig} onChange={(e) => setGoalConfig(e.target.value)} placeholder='e.g. {"unit": "visitors/month", "min": 0}' />
            </div>
            <Button onClick={handleAddGoal} className="w-full">Add Goal Type</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
