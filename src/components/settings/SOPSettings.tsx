import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit2, Plus, BookOpen, Trash2 } from "lucide-react";

const SERVICE_TYPES = [
  { value: "seo", label: "SEO" },
  { value: "google_ads", label: "Google Ads" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "social_media", label: "Social Media" },
  { value: "web_dev", label: "Web Development" },
  { value: "email_marketing", label: "Email Marketing" },
  { value: "other", label: "Other" },
];

interface SOPForm {
  id?: string;
  service_type: string;
  task_template_name: string;
  title: string;
  content: string;
  video_url: string;
}

const EMPTY_FORM: SOPForm = {
  service_type: "seo",
  task_template_name: "",
  title: "",
  content: "",
  video_url: "",
};

export function SOPSettings() {
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; sop: SOPForm }>({ open: false, sop: EMPTY_FORM });
  const [filterService, setFilterService] = useState("all");

  const { data: sops = [], isLoading } = useQuery({
    queryKey: ["sop-guides-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sop_guides").select("*").order("service_type").order("title");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = filterService === "all" ? sops : sops.filter((s: any) => s.service_type === filterService);

  const saveMutation = useMutation({
    mutationFn: async (form: SOPForm) => {
      if (form.id) {
        const { error } = await supabase.from("sop_guides").update({
          service_type: form.service_type,
          task_template_name: form.task_template_name,
          title: form.title,
          content: form.content,
          video_url: form.video_url || null,
        }).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sop_guides").insert({
          service_type: form.service_type,
          task_template_name: form.task_template_name,
          title: form.title,
          content: form.content,
          video_url: form.video_url || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sop-guides-list"] });
      queryClient.invalidateQueries({ queryKey: ["sop-guide"] });
      toast.success("SOP saved");
      setDialog({ open: false, sop: EMPTY_FORM });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sop_guides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sop-guides-list"] });
      toast.success("SOP deleted");
    },
  });

  const openEdit = (sop: any) => setDialog({
    open: true,
    sop: { id: sop.id, service_type: sop.service_type, task_template_name: sop.task_template_name, title: sop.title, content: sop.content, video_url: sop.video_url || "" },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>SOP Guides</CardTitle>
            <CardDescription>Standard Operating Procedures shown to team members inside task detail panels.</CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {SERVICE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" className="gap-1.5" onClick={() => setDialog({ open: true, sop: { ...EMPTY_FORM } })}>
              <Plus className="h-3.5 w-3.5" /> New SOP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-40 bg-muted/20 animate-pulse rounded" />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No SOPs found.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((sop: any) => (
                <div key={sop.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card group hover:bg-muted/20 transition-colors">
                  <BookOpen className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{sop.title}</span>
                      <Badge variant="outline" className="text-xs capitalize">{sop.service_type.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{sop.content.substring(0, 80)}…</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(sop)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => {
                      if (confirm("Delete this SOP?")) deleteMutation.mutate(sop.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={dialog.open} onOpenChange={(open) => { if (!open) setDialog({ open: false, sop: EMPTY_FORM }); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialog.sop.id ? "Edit SOP" : "New SOP Guide"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Service Type</label>
                <Select value={dialog.sop.service_type} onValueChange={(v) => setDialog({ ...dialog, sop: { ...dialog.sop, service_type: v } })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Task Template Name (internal key)</label>
                <Input className="mt-1" placeholder="e.g. backlink_building" value={dialog.sop.task_template_name} onChange={(e) => setDialog({ ...dialog, sop: { ...dialog.sop, task_template_name: e.target.value } })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input className="mt-1" placeholder="e.g. SEO Backlink Building" value={dialog.sop.title} onChange={(e) => setDialog({ ...dialog, sop: { ...dialog.sop, title: e.target.value } })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Content (Markdown supported — use ## headings, **bold**, - bullets, 1. numbered)</label>
              <Textarea
                className="mt-1 font-mono text-xs"
                rows={12}
                placeholder="## How to do this task..."
                value={dialog.sop.content}
                onChange={(e) => setDialog({ ...dialog, sop: { ...dialog.sop, content: e.target.value } })}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Video URL (optional)</label>
              <Input className="mt-1" placeholder="https://www.loom.com/share/..." value={dialog.sop.video_url} onChange={(e) => setDialog({ ...dialog, sop: { ...dialog.sop, video_url: e.target.value } })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, sop: EMPTY_FORM })}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(dialog.sop)} disabled={!dialog.sop.title || !dialog.sop.content || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving..." : "Save SOP"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
