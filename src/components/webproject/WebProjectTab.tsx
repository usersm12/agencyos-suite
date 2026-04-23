import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Rocket, CheckCircle2, Circle, Clock } from "lucide-react";
import { WebPhaseDetail } from "./WebPhaseDetail";
import { differenceInDays } from "date-fns";

const PHASE_NAMES = [
  "Discovery & Client Onboarding",
  "Strategy & Design Planning",
  "Content Preparation",
  "Development & Integration",
  "Testing & Quality Assurance",
  "Launch & Handover",
];

interface Props {
  taskId: string;
  clientId: string | null;
}

export function WebProjectTab({ taskId, clientId }: Props) {
  const queryClient = useQueryClient();
  const [activePhase, setActivePhase] = useState(1);
  const [initializing, setInitializing] = useState(false);

  const phasesKey = ["web-phases", taskId];
  const itemsKey = ["web-items", taskId];

  const { data: phases = [], isLoading: loadingPhases } = useQuery({
    queryKey: phasesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("web_project_phases")
        .select("*")
        .eq("task_id", taskId)
        .order("phase_number");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allItems = [], isLoading: loadingItems } = useQuery({
    queryKey: itemsKey,
    queryFn: async () => {
      if (phases.length === 0) return [];
      const phaseIds = phases.map((p: any) => p.id);
      const { data, error } = await supabase
        .from("web_phase_checklist_items")
        .select("*")
        .in("phase_id", phaseIds)
        .order("position");
      if (error) throw error;
      return data || [];
    },
    enabled: phases.length > 0,
  });

  // Auto-set active phase to current in_progress phase
  useEffect(() => {
    if (phases.length > 0) {
      const inProgress = phases.find((p: any) => p.status === "in_progress");
      const firstNotStarted = phases.find((p: any) => p.status === "not_started");
      const lastCompleted = [...phases].reverse().find((p: any) => p.status === "completed");
      if (inProgress) setActivePhase(inProgress.phase_number);
      else if (firstNotStarted) setActivePhase(firstNotStarted.phase_number);
      else if (lastCompleted) setActivePhase(lastCompleted.phase_number);
    }
  }, [phases.length]);

  // Auto-flag stale phases
  useEffect(() => {
    if (phases.length === 0 || !clientId) return;
    phases.forEach(async (phase: any) => {
      if (phase.status === "in_progress" && phase.started_at) {
        const daysIn = differenceInDays(new Date(), new Date(phase.started_at));
        const phaseItems = allItems.filter((i: any) => i.phase_id === phase.id);
        const pendingRequired = phaseItems.filter((i: any) => i.priority === "required" && i.status === "pending");

        if (daysIn > 14) {
          await supabase.from("flags").upsert({
            client_id: clientId,
            title: `Web Phase ${phase.phase_number} in progress for ${daysIn} days`,
            description: `Phase ${phase.phase_number} (${phase.phase_name}) has been in progress for over 14 days.`,
            priority: "medium",
            status: "open",
          }, { onConflict: "client_id,title", ignoreDuplicates: true });
        }
        if (daysIn > 7 && pendingRequired.length > 0) {
          await supabase.from("flags").upsert({
            client_id: clientId,
            title: `Web Phase ${phase.phase_number}: ${pendingRequired.length} required items pending after 7+ days`,
            description: `Phase ${phase.phase_number} has ${pendingRequired.length} required item(s) still pending.`,
            priority: "high",
            status: "open",
          }, { onConflict: "client_id,title", ignoreDuplicates: true });
        }
      }
    });
  }, [phases, allItems, clientId]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: phasesKey });
    queryClient.invalidateQueries({ queryKey: itemsKey });
  };

  const initializeProject = async () => {
    setInitializing(true);
    try {
      // Fetch templates
      const { data: templates, error: tErr } = await supabase
        .from("web_phase_item_templates")
        .select("*")
        .order("phase_number")
        .order("position");
      if (tErr) throw tErr;

      // Create 6 phases
      const phaseInserts = PHASE_NAMES.map((name, i) => ({
        task_id: taskId,
        phase_number: i + 1,
        phase_name: name,
        status: i === 0 ? "in_progress" : "not_started",
        started_at: i === 0 ? new Date().toISOString() : null,
      }));
      const { data: newPhases, error: phErr } = await supabase
        .from("web_project_phases")
        .insert(phaseInserts)
        .select();
      if (phErr) throw phErr;

      // Create checklist items from templates
      const itemInserts = (templates || []).map((t: any) => {
        const phase = newPhases!.find((p: any) => p.phase_number === t.phase_number);
        return {
          phase_id: phase!.id,
          category: t.category,
          item_text: t.item_text,
          priority: t.priority,
          position: t.position,
          status: "pending",
        };
      });
      const { error: iErr } = await supabase.from("web_phase_checklist_items").insert(itemInserts);
      if (iErr) throw iErr;

      toast.success("Web project initialized with all 6 phases!");
      refetchAll();
    } catch (e: any) {
      toast.error(e.message || "Failed to initialize project");
    } finally {
      setInitializing(false);
    }
  };

  if (loadingPhases) {
    return <div className="h-32 bg-muted/20 animate-pulse rounded-xl" />;
  }

  // Not initialized
  if (phases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-xl bg-muted/10 text-center">
        <Rocket className="w-10 h-10 text-primary/40 mb-3" />
        <h3 className="font-semibold text-lg mb-1">Start Web Project Tracking</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-xs">
          Initialize the 6-phase checklist with all deliverable items pre-populated from your agency templates.
        </p>
        <Button onClick={initializeProject} disabled={initializing} className="gap-2">
          {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          {initializing ? "Initializing..." : "Initialize Web Project"}
        </Button>
      </div>
    );
  }

  const completedPhases = phases.filter((p: any) => p.status === "completed").length;
  const totalProgress = Math.round((completedPhases / 6) * 100);
  const activePhaseData = phases.find((p: any) => p.phase_number === activePhase);
  const activeItems = allItems.filter((i: any) => i.phase_id === activePhaseData?.id);

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4 border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Overall Project Progress</span>
          <span className="text-sm font-bold text-primary">{totalProgress}%</span>
        </div>
        <Progress value={totalProgress} className="h-2 mb-1" />
        <p className="text-xs text-muted-foreground">{completedPhases} of 6 phases complete</p>
      </div>

      {/* Phase stepper */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {phases.map((phase: any) => {
          const phaseItems = allItems.filter((i: any) => i.phase_id === phase.id);
          const received = phaseItems.filter((i: any) => i.status === "received").length;
          const active = phaseItems.filter((i: any) => i.status !== "not_applicable").length;
          const pct = active > 0 ? Math.round((received / active) * 100) : 0;
          const isSelected = activePhase === phase.phase_number;

          return (
            <button
              key={phase.id}
              onClick={() => setActivePhase(phase.phase_number)}
              className={`flex flex-col items-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="relative mb-1">
                {phase.status === "completed" ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : phase.status === "in_progress" ? (
                  <div className="w-6 h-6 rounded-full border-2 border-blue-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                  </div>
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">P{phase.phase_number}</span>
              <span className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                {phase.phase_name.split(" ").slice(0, 2).join(" ")}
              </span>
              {phase.status !== "not_started" && (
                <span className={`text-[9px] font-bold mt-1 ${pct === 100 ? "text-green-600" : "text-primary"}`}>
                  {pct}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active phase detail */}
      {activePhaseData && !loadingItems && (
        <WebPhaseDetail
          phase={activePhaseData}
          items={activeItems}
          taskId={taskId}
          onUpdate={refetchAll}
        />
      )}
      {loadingItems && <div className="h-24 bg-muted/20 animate-pulse rounded-xl" />}
    </div>
  );
}
