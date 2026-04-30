import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2,
  Hash, Target, Layers,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface Subtype {
  id: string;
  service_id: string;
  name: string;
  slug: string;
  is_count_based: boolean;
  description: string | null;
  sort_order: number;
}

interface GoalType {
  id: string;
  service_subtype_id: string | null;
  service_id: string | null;
  goal_name: string;
  goal_config: Record<string, unknown>;
}

// ─── Slug generator ───────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ServicesMaster() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const canManage = profile?.role === "owner" || profile?.role === "manager";

  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [expandedSubtype, setExpandedSubtype] = useState<string | null>(null);

  // ── Service dialog ─────────────────────────────────────────────────────────
  const [svcDialog, setSvcDialog]       = useState(false);
  const [editSvc, setEditSvc]           = useState<Service | null>(null);
  const [svcName, setSvcName]           = useState("");
  const [svcDesc, setSvcDesc]           = useState("");

  // ── Subtype dialog ─────────────────────────────────────────────────────────
  const [stDialog, setStDialog]         = useState(false);
  const [editSt, setEditSt]             = useState<Subtype | null>(null);
  const [stServiceId, setStServiceId]   = useState("");
  const [stName, setStName]             = useState("");
  const [stSlug, setStSlug]             = useState("");
  const [stDesc, setStDesc]             = useState("");
  const [stCountBased, setStCountBased] = useState(false);
  const [slugManual, setSlugManual]     = useState(false);

  // ── Goal type dialog ───────────────────────────────────────────────────────
  const [goalDialog, setGoalDialog]     = useState(false);
  const [editGoal, setEditGoal]         = useState<GoalType | null>(null);
  const [goalSubtypeId, setGoalSubtypeId] = useState("");
  const [goalName, setGoalName]         = useState("");
  const [goalUnit, setGoalUnit]         = useState("");

  // ── Delete confirm ─────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<{ type: "service" | "subtype" | "goal"; id: string; label: string } | null>(null);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["services-master"],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").order("name");
      if (error) throw error;
      return data as Service[];
    },
  });

  const { data: subtypes = [] } = useQuery({
    queryKey: ["service-subtypes-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_subtypes").select("*").order("sort_order");
      if (error) throw error;
      return data as Subtype[];
    },
  });

  const { data: goalTypes = [] } = useQuery({
    queryKey: ["service-goal-types-master"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_goal_types").select("*").order("goal_name");
      if (error) throw error;
      return data as GoalType[];
    },
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["services-master"] });
    qc.invalidateQueries({ queryKey: ["service-subtypes-master"] });
    qc.invalidateQueries({ queryKey: ["service-goal-types-master"] });
    qc.invalidateQueries({ queryKey: ["services-and-subtypes"] });
  }

  // ─── Service CRUD ─────────────────────────────────────────────────────────

  function openNewService() {
    setEditSvc(null); setSvcName(""); setSvcDesc(""); setSvcDialog(true);
  }
  function openEditService(s: Service) {
    setEditSvc(s); setSvcName(s.name); setSvcDesc(s.description || ""); setSvcDialog(true);
  }

  async function saveService() {
    if (!svcName.trim()) return;
    const payload = { name: svcName.trim(), description: svcDesc.trim() || null };
    const { error } = editSvc
      ? await supabase.from("services").update(payload).eq("id", editSvc.id)
      : await supabase.from("services").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editSvc ? "Service updated" : "Service added");
    setSvcDialog(false);
    invalidate();
  }

  async function toggleServiceActive(s: Service) {
    const { error } = await supabase.from("services").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) toast.error(error.message);
    else invalidate();
  }

  // ─── Subtype CRUD ─────────────────────────────────────────────────────────

  function openNewSubtype(serviceId: string) {
    setEditSt(null);
    setStServiceId(serviceId);
    setStName(""); setStSlug(""); setStDesc("");
    setStCountBased(false); setSlugManual(false);
    setStDialog(true);
  }
  function openEditSubtype(st: Subtype) {
    setEditSt(st);
    setStServiceId(st.service_id);
    setStName(st.name); setStSlug(st.slug); setStDesc(st.description || "");
    setStCountBased(st.is_count_based); setSlugManual(true);
    setStDialog(true);
  }
  function handleStNameChange(val: string) {
    setStName(val);
    if (!slugManual) setStSlug(toSlug(val));
  }

  async function saveSubtype() {
    if (!stName.trim() || !stSlug.trim()) return;
    const payload = {
      service_id: stServiceId,
      name: stName.trim(),
      slug: stSlug.trim(),
      is_count_based: stCountBased,
      description: stDesc.trim() || null,
    };
    const { error } = editSt
      ? await supabase.from("service_subtypes").update(payload).eq("id", editSt.id)
      : await supabase.from("service_subtypes").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editSt ? "Subtype updated" : "Subtype added");
    setStDialog(false);
    invalidate();
  }

  // ─── Goal type CRUD ───────────────────────────────────────────────────────

  function openNewGoal(subtypeId: string) {
    setEditGoal(null);
    setGoalSubtypeId(subtypeId);
    setGoalName(""); setGoalUnit("");
    setGoalDialog(true);
  }
  function openEditGoal(g: GoalType) {
    setEditGoal(g);
    setGoalSubtypeId(g.service_subtype_id || "");
    setGoalName(g.goal_name);
    const cfg = g.goal_config as any;
    setGoalUnit(cfg?.unit || "");
    setGoalDialog(true);
  }

  async function saveGoal() {
    if (!goalName.trim()) return;
    const config: Record<string, unknown> = {};
    if (goalUnit.trim()) config.unit = goalUnit.trim();

    const payload = {
      service_subtype_id: goalSubtypeId || null,
      service_id: null,   // goals are now at subtype level
      goal_name: goalName.trim(),
      goal_config: config,
    };
    const { error } = editGoal
      ? await supabase.from("service_goal_types").update(payload).eq("id", editGoal.id)
      : await supabase.from("service_goal_types").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editGoal ? "Goal type updated" : "Goal type added");
    setGoalDialog(false);
    invalidate();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { type, id } = deleteTarget;
    const table =
      type === "service"  ? "services"            :
      type === "subtype"  ? "service_subtypes"     :
                            "service_goal_types";
    const { error } = await supabase.from(table as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); invalidate(); }
    setDeleteTarget(null);
  }

  // ─── Guard ────────────────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Only managers and owners can manage services.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <div className="h-40 rounded-xl bg-muted animate-pulse" />;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Services &amp; Subtypes</h2>
          <p className="text-sm text-muted-foreground">
            Define the services your agency offers and the specific subtypes used in tasks and goals.
          </p>
        </div>
        <Button size="sm" onClick={openNewService}>
          <Plus className="h-4 w-4 mr-1" /> Add Service
        </Button>
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No services yet. Add your first service to get started.
          </CardContent>
        </Card>
      )}

      {/* Service list */}
      {services.map((svc) => {
        const svcSubtypes = subtypes.filter(st => st.service_id === svc.id);
        const isExpanded  = expandedService === svc.id;

        return (
          <Card key={svc.id}>
            {/* Service header */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                  onClick={() => setExpandedService(isExpanded ? null : svc.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <CardTitle className="text-base">{svc.name}</CardTitle>
                  {svc.description && (
                    <span className="text-sm text-muted-foreground truncate hidden sm:block">
                      — {svc.description}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {svcSubtypes.length} subtype{svcSubtypes.length !== 1 ? "s" : ""}
                  </Badge>
                </button>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <Switch
                    checked={svc.is_active}
                    onCheckedChange={() => toggleServiceActive(svc)}
                    className="scale-90"
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditService(svc)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setDeleteTarget({ type: "service", id: svc.id, label: svc.name })}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* Expanded: subtypes */}
            {isExpanded && (
              <CardContent className="pt-0 space-y-3">
                <Separator />

                {svcSubtypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No subtypes yet. Add subtypes to enable task assignment and goal tracking.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {svcSubtypes.map((st) => {
                      const stGoals     = goalTypes.filter(g => g.service_subtype_id === st.id);
                      const stExpanded  = expandedSubtype === st.id;

                      return (
                        <div key={st.id} className="rounded-lg border bg-muted/20">
                          {/* Subtype row */}
                          <div className="flex items-center justify-between px-3 py-2.5">
                            <button
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                              onClick={() => setExpandedSubtype(stExpanded ? null : st.id)}
                            >
                              {stExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-sm font-medium">{st.name}</span>
                              <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:block">
                                {st.slug}
                              </code>
                              {st.is_count_based && (
                                <Badge className="bg-blue-100 text-blue-700 text-[10px] gap-1 shrink-0">
                                  <Hash className="w-2.5 h-2.5" /> count-based
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground shrink-0">
                                {stGoals.length} goal{stGoals.length !== 1 ? "s" : ""}
                              </span>
                            </button>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditSubtype(st)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6"
                                onClick={() => setDeleteTarget({ type: "subtype", id: st.id, label: st.name })}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                          </div>

                          {/* Expanded: goal types */}
                          {stExpanded && (
                            <div className="border-t px-4 py-3 space-y-2 bg-background/60 rounded-b-lg">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                  <Target className="w-3 h-3" /> Goal Types
                                </p>
                                <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={() => openNewGoal(st.id)}>
                                  <Plus className="h-3 w-3" /> Add Goal
                                </Button>
                              </div>

                              {stGoals.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No goal types yet. Add goals to track performance targets for this subtype.
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  {stGoals.map(g => {
                                    const cfg = g.goal_config as any;
                                    return (
                                      <div key={g.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/50">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm">{g.goal_name}</span>
                                          {cfg?.unit && (
                                            <span className="text-xs text-muted-foreground">({cfg.unit})</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditGoal(g)}>
                                            <Pencil className="h-3 w-3" />
                                          </Button>
                                          <Button
                                            variant="ghost" size="icon" className="h-6 w-6"
                                            onClick={() => setDeleteTarget({ type: "goal", id: g.id, label: g.goal_name })}
                                          >
                                            <Trash2 className="h-3 w-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => openNewSubtype(svc.id)}>
                  <Layers className="h-3.5 w-3.5" /> Add Subtype
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ── Dialogs ── */}

      {/* Service dialog */}
      <Dialog open={svcDialog} onOpenChange={setSvcDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editSvc ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={svcName} onChange={e => setSvcName(e.target.value)} placeholder="e.g. SEO" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={svcDesc} onChange={e => setSvcDesc(e.target.value)} placeholder="Brief description…" className="min-h-[70px]" />
            </div>
            <Button className="w-full" onClick={saveService}>
              {editSvc ? "Update Service" : "Create Service"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subtype dialog */}
      <Dialog open={stDialog} onOpenChange={setStDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editSt ? "Edit Subtype" : "Add Subtype"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={stName}
                onChange={e => handleStNameChange(e.target.value)}
                placeholder="e.g. Backlinks"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input
                value={stSlug}
                onChange={e => { setStSlug(e.target.value); setSlugManual(true); }}
                placeholder="e.g. backlinks"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Used internally to match tasks and SOPs. Lowercase, underscores only.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={stDesc} onChange={e => setStDesc(e.target.value)} placeholder="Brief description…" />
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Count-based</p>
                <p className="text-xs text-muted-foreground">Tracks a monthly numeric target (e.g. 20 backlinks)</p>
              </div>
              <Switch checked={stCountBased} onCheckedChange={setStCountBased} />
            </div>
            <Button className="w-full" onClick={saveSubtype}>
              {editSt ? "Update Subtype" : "Add Subtype"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal type dialog */}
      <Dialog open={goalDialog} onOpenChange={setGoalDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editGoal ? "Edit Goal Type" : "Add Goal Type"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Goal Name *</Label>
              <Input value={goalName} onChange={e => setGoalName(e.target.value)} placeholder="e.g. Monthly Link Target" />
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Input value={goalUnit} onChange={e => setGoalUnit(e.target.value)} placeholder="e.g. links/month, articles, posts" />
            </div>
            <Button className="w-full" onClick={saveGoal}>
              {editGoal ? "Update Goal Type" : "Add Goal Type"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "service"
                ? "This will also delete all subtypes and goal types under this service."
                : deleteTarget?.type === "subtype"
                ? "This will also delete all goal types under this subtype."
                : "This goal type will be removed and cannot be recovered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
