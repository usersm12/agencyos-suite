import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, AlertTriangle } from "lucide-react";
import { WebChecklistItemRow } from "./WebChecklistItemRow";
import { useState } from "react";

interface Phase {
  id: string;
  phase_number: number;
  phase_name: string;
  status: "not_started" | "in_progress" | "completed";
  started_at: string | null;
  completed_at: string | null;
}

interface Item {
  id: string;
  phase_id: string;
  category: string;
  item_text: string;
  priority: "required" | "optional";
  status: "pending" | "received" | "not_applicable";
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  position: number;
}

interface Props {
  phase: Phase;
  items: Item[];
  taskId: string;
  onUpdate: () => void;
}

export function WebPhaseDetail({ phase, items, taskId, onUpdate }: Props) {
  const [completing, setCompleting] = useState(false);

  const requiredItems = items.filter((i) => i.priority === "required");
  const pendingRequired = requiredItems.filter((i) => i.status === "pending");
  const receivedCount = items.filter((i) => i.status === "received").length;
  const activeCount = items.filter((i) => i.status !== "not_applicable").length;
  const progressPct = activeCount > 0 ? Math.round((receivedCount / activeCount) * 100) : 0;

  const canComplete = pendingRequired.length === 0 && phase.status !== "completed";

  // Group by category preserving order
  const categories = Array.from(new Set(items.map((i) => i.category)));

  const handleMarkComplete = async () => {
    if (!canComplete) return;
    setCompleting(true);
    try {
      const { error } = await supabase
        .from("web_project_phases")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", phase.id);
      if (error) throw error;
      toast.success(`Phase ${phase.phase_number} marked complete!`);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleStartPhase = async () => {
    if (phase.status !== "not_started") return;
    try {
      const { error } = await supabase
        .from("web_project_phases")
        .update({ status: "in_progress", started_at: new Date().toISOString() })
        .eq("id", phase.id);
      if (error) throw error;
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Phase header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-base">
              Phase {phase.phase_number} — {phase.phase_name}
            </h3>
            {phase.status === "completed" && (
              <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </Badge>
            )}
            {phase.status === "in_progress" && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">In Progress</Badge>
            )}
            {phase.status === "not_started" && (
              <Badge variant="outline" className="text-muted-foreground">Not Started</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
            <span>{receivedCount} of {activeCount} items received</span>
            {pendingRequired.length > 0 && (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="w-3 h-3" />
                {pendingRequired.length} required still pending
              </span>
            )}
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        <div className="shrink-0 flex flex-col gap-2">
          {phase.status === "not_started" && (
            <Button size="sm" variant="outline" onClick={handleStartPhase}>
              Start Phase
            </Button>
          )}
          {phase.status !== "completed" && (
            <Button
              size="sm"
              onClick={handleMarkComplete}
              disabled={!canComplete || completing}
              className={canComplete ? "bg-green-600 hover:bg-green-700" : ""}
              title={!canComplete ? `${pendingRequired.length} required item(s) still pending` : "Mark phase complete"}
            >
              {!canComplete && <Lock className="w-3.5 h-3.5 mr-1" />}
              {completing ? "Saving..." : "Mark Complete"}
            </Button>
          )}
        </div>
      </div>

      {/* Items by category */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category === cat).sort((a, b) => a.position - b.position);
          return (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 px-1">
                {cat}
              </p>
              <div className="border rounded-lg divide-y divide-border/50 bg-card">
                {catItems.map((item) => (
                  <div key={item.id} className="px-3">
                    <WebChecklistItemRow
                      item={item}
                      phaseId={phase.id}
                      taskId={taskId}
                      onUpdate={onUpdate}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
