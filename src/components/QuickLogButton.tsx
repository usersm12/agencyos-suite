import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Link2, Image, CheckSquare, ChevronRight, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type LogType = "backlink" | "social_post" | "task";

const LOG_TYPES: { value: LogType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "backlink", label: "Backlink", icon: Link2, description: "Log a new backlink built" },
  { value: "social_post", label: "Social Post", icon: Image, description: "Log a published or scheduled post" },
  { value: "task", label: "Task", icon: CheckSquare, description: "Add a new task to the queue" },
];

const PLATFORMS = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest"] as const;
const PRIORITIES = ["low", "medium", "high"] as const;

export function QuickLogButton() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [logType, setLogType] = useState<LogType | null>(null);
  const [clientId, setClientId] = useState<string>("");

  // Step 3 fields
  const [fields, setFields] = useState<Record<string, any>>({});

  const { data: clients = [] } = useQuery({
    queryKey: ["quick-log-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      return data;
    },
    enabled: open,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["quick-log-projects", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").eq("client_id", clientId).order("name");
      return data || [];
    },
    enabled: !!clientId && logType === "task",
  });

  const reset = () => {
    setStep(1);
    setLogType(null);
    setClientId("");
    setFields({});
  };

  const handleClose = () => { setOpen(false); reset(); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("No client selected");
      if (logType === "backlink") {
        const { error } = await supabase.from("backlink_log").insert({
          client_id: clientId,
          url: fields.source_url || fields.target_url || "",
          source_url: fields.source_url || null,
          target_url: fields.target_url || null,
          anchor_text: fields.anchor_text || null,
          da_score: fields.da_score ? Number(fields.da_score) : null,
          status: "live",
          logged_by: profile?.id || null,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["backlinks", clientId] });
      } else if (logType === "social_post") {
        const likes = Number(fields.likes) || 0;
        const reach = Number(fields.reach) || 0;
        const comments = Number(fields.comments) || 0;
        const shares = Number(fields.shares) || 0;
        const engRate = reach > 0 ? parseFloat(((likes + comments + shares) / reach * 100).toFixed(2)) : null;
        const { error } = await supabase.from("social_posts").insert({
          client_id: clientId,
          platform: fields.platform || "instagram",
          post_type: fields.post_type || "post",
          caption: fields.caption || null,
          post_url: fields.post_url || null,
          posted_at: fields.posted_at ? new Date(fields.posted_at).toISOString() : new Date().toISOString(),
          status: "published",
          likes,
          reach,
          comments,
          shares,
          engagement_rate: engRate,
          created_by: profile?.id || null,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["social-posts", clientId] });
      } else if (logType === "task") {
        const { error } = await supabase.from("tasks").insert({
          title: fields.title,
          description: fields.description || null,
          project_id: fields.project_id || null,
          priority: fields.priority || "medium",
          status: "not_started",
          due_date: fields.due_date || null,
          service_type: fields.service_type || null,
        });
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["tasks-list"] });
      }
    },
    onSuccess: () => {
      toast.success(`${logType === "backlink" ? "Backlink" : logType === "social_post" ? "Post" : "Task"} logged!`);
      handleClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canSave = () => {
    if (!clientId) return false;
    if (logType === "backlink") return !!(fields.source_url || fields.target_url);
    if (logType === "social_post") return !!fields.platform;
    if (logType === "task") return !!fields.title;
    return false;
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-150"
        title="Quick log"
        aria-label="Quick log"
      >
        <Plus className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">
                Quick Log
                {step > 1 && logType && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    — {LOG_TYPES.find((t) => t.value === logType)?.label}
                  </span>
                )}
              </DialogTitle>
              {/* Step indicator */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground mr-6">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-medium text-[10px] transition-colors ${
                      step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </DialogHeader>

          <div className="mt-2 min-h-[220px]">
            {/* Step 1: Choose type */}
            {step === 1 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">What do you want to log?</p>
                {LOG_TYPES.map((t) => (
                  <button
                    key={t.value}
                    className={`w-full flex items-center gap-3 rounded-lg border p-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 ${logType === t.value ? "border-primary bg-primary/5" : "border-border"}`}
                    onClick={() => { setLogType(t.value); setStep(2); }}
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <t.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto" />
                  </button>
                ))}
              </div>
            )}

            {/* Step 2: Choose client */}
            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Which client is this for?</p>
                <Select value={clientId} onValueChange={(v) => { setClientId(v); setStep(3); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Select a client to continue to details.</p>
              </div>
            )}

            {/* Step 3: Fill fields */}
            {step === 3 && logType === "backlink" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Source URL (linking site)</label>
                  <Input placeholder="https://example.com/page" className="mt-1" value={fields.source_url || ""} onChange={(e) => setFields({ ...fields, source_url: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Target URL (your page)</label>
                  <Input placeholder="https://yoursite.com/page" className="mt-1" value={fields.target_url || ""} onChange={(e) => setFields({ ...fields, target_url: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Anchor Text</label>
                    <Input placeholder="Click here" className="mt-1" value={fields.anchor_text || ""} onChange={(e) => setFields({ ...fields, anchor_text: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">DA Score</label>
                    <Input type="number" placeholder="0–100" className="mt-1" value={fields.da_score || ""} onChange={(e) => setFields({ ...fields, da_score: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && logType === "social_post" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Platform</label>
                    <Select value={fields.platform || "instagram"} onValueChange={(v) => setFields({ ...fields, platform: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Post Type</label>
                    <Select value={fields.post_type || "post"} onValueChange={(v) => setFields({ ...fields, post_type: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["post", "reel", "story", "video", "carousel"].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Caption</label>
                  <Textarea placeholder="Post caption..." className="mt-1" rows={2} value={fields.caption || ""} onChange={(e) => setFields({ ...fields, caption: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Likes</label>
                    <Input type="number" placeholder="0" className="mt-1" value={fields.likes || ""} onChange={(e) => setFields({ ...fields, likes: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Reach</label>
                    <Input type="number" placeholder="0" className="mt-1" value={fields.reach || ""} onChange={(e) => setFields({ ...fields, reach: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Date</label>
                    <Input type="date" className="mt-1" value={fields.posted_at || ""} onChange={(e) => setFields({ ...fields, posted_at: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && logType === "task" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Task Title *</label>
                  <Input placeholder="e.g. Write blog post" className="mt-1" value={fields.title || ""} onChange={(e) => setFields({ ...fields, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <Select value={fields.priority || "medium"} onValueChange={(v) => setFields({ ...fields, priority: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Due Date</label>
                    <Input type="date" className="mt-1" value={fields.due_date || ""} onChange={(e) => setFields({ ...fields, due_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Project</label>
                  <Select value={fields.project_id || ""} onValueChange={(v) => setFields({ ...fields, project_id: v })}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select project (optional)" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Textarea placeholder="Optional details..." className="mt-1" rows={2} value={fields.description || ""} onChange={(e) => setFields({ ...fields, description: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { if (step > 1) setStep((step - 1) as 1 | 2 | 3); else handleClose(); }}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 1 ? "Cancel" : "Back"}
            </Button>

            {step < 3 ? (
              <Button
                size="sm"
                disabled={step === 1 ? !logType : !clientId}
                onClick={() => setStep((step + 1) as 2 | 3)}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={!canSave() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
