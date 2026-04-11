import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, AlertCircle } from "lucide-react";

interface GoalsPerformanceProps {
  clientId: string;
}

interface TargetValue {
  target?: number | string;
  current?: number;
  inverse?: boolean;
}

export function GoalsPerformance({ clientId }: GoalsPerformanceProps) {
  const queryClient = useQueryClient();
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});

  const { data: activeServices, isLoading: loadingServices } = useQuery({
    queryKey: ['client_services_with_goals', clientId],
    queryFn: async () => {
      const { data: cServices, error: cServicesError } = await supabase
        .from('client_services')
        .select(`
          service_id,
          services ( name, id )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true);
      
      if (cServicesError) throw cServicesError;

      const serviceIds = cServices?.map(cs => cs.service_id) || [];
      if (serviceIds.length === 0) return [];

      const { data: goalTypes, error: gtError } = await supabase
        .from('service_goal_types')
        .select('*')
        .in('service_id', serviceIds);
      if (gtError) throw gtError;
      
      const { data: clientGoals, error: cgError } = await supabase
        .from('client_goals')
        .select('*')
        .eq('client_id', clientId);
      if (cgError) throw cgError;

      return cServices.map(cs => {
        const matchingGoalTypes = goalTypes.filter(gt => gt.service_id === cs.service_id);
        const mappedTypes = matchingGoalTypes.map(gt => {
          const cGoal = clientGoals.find(cg => cg.service_goal_type_id === gt.id);
          const tv = cGoal?.target_value as TargetValue | null;
          const targetValue = tv?.target || "";
          const currentValue = tv?.current || 0;
          const goalConfig = gt.goal_config as Record<string, unknown> | null;
          return {
            ...gt,
            goal_config_parsed: goalConfig,
            client_goal_id: cGoal?.id,
            targetValue,
            currentValue
          };
        });
        
        return {
          service: cs.services,
          goalTypes: mappedTypes
        };
      });
    }
  });

  const saveGoalMutation = useMutation({
    mutationFn: async ({ serviceGoalTypeId, targetObj }: { serviceGoalTypeId: string, targetObj: Record<string, unknown> }) => {
      const existing = await supabase.from('client_goals')
        .select('id, target_value')
        .eq('client_id', clientId)
        .eq('service_goal_type_id', serviceGoalTypeId)
        .maybeSingle();

      if (existing.data) {
        const prev = (existing.data.target_value as Record<string, unknown>) || {};
        const updatedTarget = { ...prev, ...targetObj };
        const { error } = await supabase
          .from('client_goals')
          .update({ target_value: updatedTarget })
          .eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_goals')
          .insert({
            client_id: clientId,
            service_goal_type_id: serviceGoalTypeId,
            target_value: { current: 0, ...targetObj }
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client_services_with_goals', clientId] });
      toast.success("Goal metrics saved");
      setGoalInputs({});
    },
    onError: (err: any) => toast.error("Failed to save goal: " + err.message)
  });

  const handleInputChange = (goalTypeId: string, val: string) => {
    setGoalInputs(prev => ({ ...prev, [goalTypeId]: val }));
  };

  const handleSaveGoal = (goalTypeId: string) => {
    const val = goalInputs[goalTypeId];
    if (!val) return;
    const num = Number(val);
    const targetPayload = isNaN(num) ? { target: val } : { target: num };
    saveGoalMutation.mutate({ serviceGoalTypeId: goalTypeId, targetObj: targetPayload });
  };

  if (loadingServices) return <div className="p-4 bg-card rounded-xl shadow animate-pulse h-40"></div>;

  if (!activeServices || activeServices.length === 0) {
    return (
      <div className="p-6 bg-card border rounded-xl shadow text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <h3 className="font-semibold text-lg">No Goals Mapped</h3>
        <p className="text-sm text-muted-foreground mt-1">Assign active services to this client in the Overview tab to configure goals.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeServices.map((serviceGroup) => (
        <Card key={serviceGroup.service?.id}>
          <CardHeader>
            <CardTitle className="text-lg">{serviceGroup.service?.name} Goals</CardTitle>
            <CardDescription>Configure service-level KPI targets mapped to execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {serviceGroup.goalTypes.length > 0 ? (
              serviceGroup.goalTypes.map(gt => {
                const isInverse = gt.goal_config_parsed?.inverse === true;
                const isEditing = goalInputs[gt.id] !== undefined;
                const valToDisplay = isEditing ? goalInputs[gt.id] : String(gt.targetValue);
                
                let percent = 0;
                let isNumeric = false;
                if (gt.targetValue && typeof gt.targetValue === 'number' && gt.currentValue !== undefined) {
                   isNumeric = true;
                   percent = (gt.currentValue / (gt.targetValue as number)) * 100;
                }
                const boundedPercent = Math.min(Math.max(percent, 0), 100);
                
                let colorClass = "bg-primary";
                if (isNumeric) {
                  if (isInverse) {
                    if (percent <= 100) colorClass = "bg-green-500";
                    else if (percent <= 125) colorClass = "bg-amber-500";
                    else colorClass = "bg-red-500";
                  } else {
                    if (percent >= 100) colorClass = "bg-green-500";
                    else if (percent >= 75) colorClass = "bg-amber-500";
                    else colorClass = "bg-red-500";
                  }
                }

                return (
                  <div key={gt.id} className="space-y-3 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{gt.goal_name}</p>
                        {isNumeric && (
                          <div className="flex items-center gap-2 mt-1 w-full max-w-sm">
                             <Progress value={boundedPercent} className="h-2 flex-1" />
                             <span className="text-[10px] whitespace-nowrap text-muted-foreground w-12 text-right">{Math.round(percent)}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-muted-foreground uppercase leading-none mb-1">Target</span>
                          <Input 
                            value={valToDisplay}
                            onChange={(e) => handleInputChange(gt.id, e.target.value)}
                            placeholder="Set target..."
                            className="h-8 w-32 text-right font-mono"
                          />
                        </div>
                        {isEditing && valToDisplay !== String(gt.targetValue) && (
                          <Button size="icon" className="h-8 w-8 mt-[14px]" onClick={() => handleSaveGoal(gt.id)}>
                            <Save className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
               <div className="p-4 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                  No goal parameters exist for this service. Configure them in Settings.
               </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
