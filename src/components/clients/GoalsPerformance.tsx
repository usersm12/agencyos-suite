import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, AlertCircle, Hash } from "lucide-react";

interface GoalsPerformanceProps {
  clientId: string;
}

interface TargetValue {
  target?: number | string;
  current?: number;
}

export function GoalsPerformance({ clientId }: GoalsPerformanceProps) {
  const queryClient = useQueryClient();
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});

  // ── Fetch active services → subtypes → goal types → client goals ──────────
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["client-goals-subtype", clientId],
    queryFn: async () => {
      // 1. Active services for this client
      const { data: cServices, error: e1 } = await supabase
        .from("client_services")
        .select("service_id, services(id, name)")
        .eq("client_id", clientId)
        .eq("is_active", true);
      if (e1) throw e1;
      if (!cServices?.length) return [];

      const serviceIds = cServices.map((cs: any) => cs.service_id);

      // 2. Subtypes for those services
      const { data: subtypes, error: e2 } = await supabase
        .from("service_subtypes")
        .select("id, service_id, name, slug, is_count_based, sort_order")
        .in("service_id", serviceIds)
        .order("sort_order");
      if (e2) throw e2;
      if (!subtypes?.length) return [];

      const subtypeIds = subtypes.map((st: any) => st.id);

      // 3. Goal types at subtype level
      const { data: goalTypes, error: e3 } = await supabase
        .from("service_goal_types")
        .select("*")
        .in("service_subtype_id", subtypeIds);
      if (e3) throw e3;

      // 4. Client goals (all, then cross-ref)
      const { data: clientGoals, error: e4 } = await supabase
        .from("client_goals")
        .select("*")
        .eq("client_id", clientId);
      if (e4) throw e4;

      // 5. Build grouped structure: service → subtypes → goal types
      return cServices.map((cs: any) => {
        const svcSubtypes = (subtypes || [])
          .filter((st: any) => st.service_id === cs.service_id)
          .map((st: any) => {
            const stGoalTypes = (goalTypes || [])
              .filter((gt: any) => gt.service_subtype_id === st.id)
              .map((gt: any) => {
                const cg = (clientGoals || []).find((g: any) => g.service_goal_type_id === gt.id);
                const tv = cg?.target_value as TargetValue | null;
                return {
                  ...gt,
                  client_goal_id: cg?.id,
                  targetValue: tv?.target ?? "",
                  currentValue: tv?.current ?? 0,
                };
              });
            return { ...st, goalTypes: stGoalTypes };
          });

        return { service: cs.services, subtypes: svcSubtypes };
      }).filter((g: any) => g.subtypes.some((st: any) => st.goalTypes.length > 0));
    },
  });

  // ── Save goal target ───────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ goalTypeId, targetObj }: { goalTypeId: string; targetObj: Record<string, unknown> }) => {
      const { data: existing } = await supabase
        .from("client_goals")
        .select("id, target_value")
        .eq("client_id", clientId)
        .eq("service_goal_type_id", goalTypeId)
        .maybeSingle();

      if (existing) {
        const prev = (typeof existing.target_value === "object" && existing.target_value && !Array.isArray(existing.target_value))
          ? existing.target_value as Record<string, unknown> : {};
        const { error } = await supabase
          .from("client_goals")
          .update({ target_value: { ...prev, ...targetObj } as any })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_goals")
          .insert({ client_id: clientId, service_goal_type_id: goalTypeId, target_value: { current: 0, ...targetObj } as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-goals-subtype", clientId] });
      toast.success("Goal saved");
      setGoalInputs({});
    },
    onError: (err: any) => toast.error("Failed to save goal: " + err.message),
  });

  function handleSave(goalTypeId: string) {
    const val = goalInputs[goalTypeId];
    if (!val) return;
    const num = Number(val);
    saveMutation.mutate({
      goalTypeId,
      targetObj: isNaN(num) ? { target: val } : { target: num },
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="h-40 bg-card rounded-xl border animate-pulse" />;

  if (groups.length === 0) {
    return (
      <div className="p-6 bg-card border rounded-xl text-center space-y-2">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
        <h3 className="font-semibold text-lg">No Goals Configured</h3>
        <p className="text-sm text-muted-foreground">
          Assign active services to this client, then add goal types under each service subtype in Settings → Services Master.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(groups as any[]).map((group: any) => (
        <Card key={group.service?.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{group.service?.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {(group.subtypes as any[]).map((st: any) => {
              if (st.goalTypes.length === 0) return null;
              return (
                <div key={st.id}>
                  {/* Subtype header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-semibold">{st.name}</span>
                    {st.is_count_based && (
                      <Badge className="bg-blue-100 text-blue-700 text-[10px] gap-1 h-4">
                        <Hash className="w-2.5 h-2.5" /> count-based
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-4 pl-3 border-l-2 border-muted">
                    {(st.goalTypes as any[]).map((gt: any) => {
                      const isEditing  = goalInputs[gt.id] !== undefined;
                      const display    = isEditing ? goalInputs[gt.id] : String(gt.targetValue);
                      const isNumeric  = typeof gt.targetValue === "number" && gt.targetValue > 0;
                      const percent    = isNumeric ? Math.min((gt.currentValue / (gt.targetValue as number)) * 100, 100) : 0;
                      const cfg        = gt.goal_config as any;

                      let barColor = "bg-primary";
                      if (isNumeric) {
                        if (percent >= 100) barColor = "bg-green-500";
                        else if (percent >= 70) barColor = "bg-amber-500";
                        else barColor = "bg-red-500";
                      }

                      return (
                        <div key={gt.id} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium">{gt.goal_name}</p>
                              {cfg?.unit && (
                                <p className="text-xs text-muted-foreground">{cfg.unit}</p>
                              )}
                              {isNumeric && (
                                <div className="flex items-center gap-2 mt-1.5 max-w-xs">
                                  <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${barColor}`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {gt.currentValue} / {gt.targetValue} ({Math.round(percent)}%)
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-end gap-2">
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] text-muted-foreground uppercase">Target</span>
                                <Input
                                  value={display}
                                  onChange={e => setGoalInputs(p => ({ ...p, [gt.id]: e.target.value }))}
                                  placeholder="Set target…"
                                  className="h-8 w-28 text-right font-mono text-sm"
                                />
                              </div>
                              {isEditing && display !== String(gt.targetValue) && (
                                <Button size="icon" className="h-8 w-8 mb-0.5" onClick={() => handleSave(gt.id)}>
                                  <Save className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
