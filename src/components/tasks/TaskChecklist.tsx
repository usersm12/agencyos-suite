import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, GripVertical, ListChecks, ChevronDown, ChevronRight } from "lucide-react";

// Default checklist templates keyed by service_type
const CHECKLIST_TEMPLATES: Record<string, string[]> = {
  seo_backlink: [
    "Research target websites in your niche",
    "Check site DA/PA using Moz or Ahrefs",
    "Send personalised outreach email",
    "Follow up after 3-5 days if no response",
    "Confirm link is live on the page",
    "Verify DoFollow status",
    "Log URL, DA, PA, anchor text in backlink log",
    "Screenshot the live link for records",
  ],
  seo_keywords: [
    "Export rankings from Search Console",
    "Compare vs previous month positions",
    "Flag any keywords dropped more than 5 positions",
    "Identify new ranking opportunities",
    "Update keyword tracking spreadsheet",
    "Note any Google algorithm updates this month",
  ],
  seo_technical: [
    "Run Screaming Frog or similar crawler",
    "Check for broken links (4xx errors)",
    "Check page speed on mobile and desktop",
    "Check Core Web Vitals in Search Console",
    "Check for duplicate meta titles/descriptions",
    "Check XML sitemap is updated",
    "Check robots.txt is correct",
    "Fix critical issues found",
    "Document all issues found and fixed",
  ],
  seo_content: [
    "Confirm target keyword and search intent",
    "Check word count vs top ranking competitors",
    "Optimise title tag and meta description",
    "Add internal links to relevant pages",
    "Add external links to authority sources",
    "Optimise images with alt text",
    "Check page loads correctly on mobile",
    "Submit URL to Google Search Console",
  ],
  google_ads: [
    "Check overall campaign performance vs targets",
    "Review search terms report for negatives",
    "Check Quality Scores across ad groups",
    "Review auction insights vs competitors",
    "Check budget pacing — on track?",
    "Review landing page performance",
    "Update negative keyword list",
    "Document wins and issues for client report",
  ],
  meta_ads: [
    "Review ROAS vs target",
    "Check frequency — is it too high?",
    "Review audience overlap",
    "Check creative fatigue on top ads",
    "Review placement performance",
    "Check pixel is firing correctly",
    "Update lookalike audiences if needed",
    "Document performance for client report",
  ],
  social_media: [
    "Confirm content calendar is approved by client",
    "Schedule all posts for the month",
    "Check all images are correct dimensions",
    "Verify all captions are proofread",
    "Confirm hashtag strategy is applied",
    "Check all links in bio/posts are working",
    "Monitor first 24hr engagement on each post",
    "Log all post URLs and metrics in system",
  ],
  web_dev: [
    "Collect all brand assets from client",
    "Confirm sitemap and page structure",
    "Set up staging environment",
    "Get design approval before development",
    "Test on Chrome, Firefox, Safari, Edge",
    "Test on mobile (iOS and Android)",
    "Run GTmetrix/PageSpeed test — score 80+",
    "Check all forms are working",
    "Check SSL certificate is active",
    "Submit sitemap to Google Search Console",
    "Hand over login credentials to client",
  ],
};

interface TaskChecklistProps {
  taskId: string;
  serviceType?: string | null;
}

export function TaskChecklist({ taskId, serviceType }: TaskChecklistProps) {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [newItemText, setNewItemText] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklists")
        .select("*")
        .eq("task_id", taskId)
        .order("position");
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-populate from template on first load if empty
  const populateMutation = useMutation({
    mutationFn: async (templateItems: string[]) => {
      const { error } = await supabase.from("task_checklists").insert(
        templateItems.map((text, i) => ({
          task_id: taskId,
          item_text: text,
          is_completed: false,
          position: i,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  useEffect(() => {
    if (!isLoading && items.length === 0 && serviceType) {
      const template = CHECKLIST_TEMPLATES[serviceType];
      if (template) populateMutation.mutate(template);
    }
  }, [isLoading, items.length, serviceType]);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase.from("task_checklists").update({ is_completed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  const addMutation = useMutation({
    mutationFn: async (text: string) => {
      const maxPos = items.length > 0 ? Math.max(...items.map((i: any) => i.position)) + 1 : 0;
      const { error } = await supabase.from("task_checklists").insert({
        task_id: taskId,
        item_text: text,
        is_completed: false,
        position: maxPos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] });
      setNewItemText("");
      setTimeout(() => addInputRef.current?.focus(), 50);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered: { id: string; position: number }[]) => {
      for (const item of reordered) {
        await supabase.from("task_checklists").update({ position: item.position }).eq("id", item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  const handleDragStart = (id: string) => { dragItemId.current = id; };
  const handleDragOver = (e: React.DragEvent, id: string) => { e.preventDefault(); setDragOverId(id); };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const fromId = dragItemId.current;
    if (!fromId || fromId === targetId) { setDragOverId(null); return; }
    const fromIndex = items.findIndex((i: any) => i.id === fromId);
    const toIndex = items.findIndex((i: any) => i.id === targetId);
    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    reorderMutation.mutate(reordered.map((item: any, idx) => ({ id: item.id, position: idx })));
    setDragOverId(null);
    dragItemId.current = null;
  };

  const completed = items.filter((i: any) => i.is_completed).length;
  const total = items.length;
  const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <button
        className="flex items-center gap-2 w-full text-left mb-3"
        onClick={() => setCollapsed(!collapsed)}
      >
        <ListChecks className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-sm flex-1">Checklist</h4>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">{completed} of {total}</span>
        )}
        {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="space-y-2">
          {total > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <Progress value={progressPct} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground shrink-0">{progressPct}%</span>
            </div>
          )}

          {isLoading ? (
            <div className="h-16 bg-muted/20 animate-pulse rounded" />
          ) : (
            <div className="space-y-1">
              {items.map((item: any) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={() => setDragOverId(null)}
                  className={`flex items-center gap-2 group rounded-lg px-2 py-1.5 transition-colors ${dragOverId === item.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/40"}`}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 cursor-grab shrink-0 opacity-0 group-hover:opacity-100" />
                  <Checkbox
                    id={`check-${item.id}`}
                    checked={item.is_completed}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: item.id, is_completed: !!checked })}
                    className="shrink-0"
                  />
                  <label
                    htmlFor={`check-${item.id}`}
                    className={`flex-1 text-sm cursor-pointer select-none transition-colors ${item.is_completed ? "line-through text-muted-foreground" : ""}`}
                  >
                    {item.item_text}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 shrink-0"
                    onClick={() => deleteMutation.mutate(item.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add new item */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dashed">
            <div className="w-3.5 shrink-0" />
            <div className="w-4 shrink-0" />
            <Input
              ref={addInputRef}
              placeholder="Add checklist item... (Enter to save)"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItemText.trim()) addMutation.mutate(newItemText.trim());
              }}
              className="h-7 text-sm border-0 bg-transparent px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
