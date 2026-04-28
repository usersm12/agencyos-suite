import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, Plus, Trash2, TrendingUp, Link2, FileText, Share2 } from "lucide-react";
import { format } from "date-fns";

interface Props {
  taskId: string;
  serviceType: string;
  targetCount?: number | null;
}

// ─── Row types ──────────────────────────────────────────────────────────────

interface BacklinkRow {
  source_url: string;
  target_url: string;
  da: number | string;
  anchor_text: string;
  dofollow: boolean;
  date_built: string;
  status: string;
}

interface ArticleRow {
  title: string;
  url: string;
  word_count: number | string;
  publish_date: string;
  keywords: string;
}

interface SocialPostRow {
  platform: string;
  post_url: string;
  post_type: string;
  publish_date: string;
  likes: number | string;
  comments: number | string;
  reach: number | string;
}

const emptyBacklink = (): BacklinkRow => ({
  source_url: "", target_url: "", da: "", anchor_text: "",
  dofollow: true, date_built: format(new Date(), "yyyy-MM-dd"), status: "live",
});

const emptyArticle = (): ArticleRow => ({
  title: "", url: "", word_count: "", publish_date: format(new Date(), "yyyy-MM-dd"), keywords: "",
});

const emptySocialPost = (): SocialPostRow => ({
  platform: "", post_url: "", post_type: "", publish_date: format(new Date(), "yyyy-MM-dd"),
  likes: "", comments: "", reach: "",
});

// ─── Progress bar helper ─────────────────────────────────────────────────────

function ProgressHeader({ icon: Icon, label, done, target, color = "bg-primary" }: {
  icon: React.ElementType; label: string; done: number; target?: number | null; color?: string;
}) {
  const pct = target && target > 0 ? Math.min(Math.round((done / target) * 100), 100) : null;
  return (
    <div className="flex items-start justify-between gap-4 pb-2 border-b mb-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <span className="font-semibold text-sm">{label}</span>
      </div>
      <div className="text-right shrink-0">
        {target ? (
          <>
            <p className="text-lg font-bold leading-none">
              {done} <span className="text-sm font-normal text-muted-foreground">/ {target}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{pct}% complete</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{done} logged</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function TaskDeliverablesForm({ taskId, serviceType, targetCount }: Props) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>({});

  const { data: deliverables, isLoading } = useQuery({
    queryKey: ["task_service_deliverables", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_deliverables")
        .select("*")
        .eq("task_id", taskId)
        .eq("deliverable_name", "Service Data")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  useEffect(() => {
    if (deliverables?.data) {
      setFormData(deliverables.data as Record<string, unknown>);
    }
  }, [deliverables]);

  const saveDeliverables = useMutation({
    mutationFn: async () => {
      const payload = {
        task_id: taskId,
        deliverable_name: "Service Data",
        deliverable_type: serviceType.toLowerCase(),
        status: "completed",
        data: formData as import("@/integrations/supabase/types").Json,
      };
      if (deliverables?.id) {
        const { error } = await supabase
          .from("task_deliverables")
          .update({ data: formData as import("@/integrations/supabase/types").Json, deliverable_type: serviceType.toLowerCase() })
          .eq("id", deliverables.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("task_deliverables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Deliverables saved");
      queryClient.invalidateQueries({ queryKey: ["task_service_deliverables", taskId] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to save deliverables"),
  });

  const handleChange = (key: string, value: any) =>
    setFormData((prev: any) => ({ ...prev, [key]: value }));

  // ── Backlinks ────────────────────────────────────────────────────────────
  const backlinks: BacklinkRow[] = formData.backlinks || [];
  const setBacklinks = (rows: BacklinkRow[]) => handleChange("backlinks", rows);
  const addBacklink = () => setBacklinks([...backlinks, emptyBacklink()]);
  const removeBacklink = (i: number) => setBacklinks(backlinks.filter((_, idx) => idx !== i));
  const updateBacklink = (i: number, field: keyof BacklinkRow, val: any) => {
    const updated = [...backlinks];
    (updated[i] as any)[field] = val;
    setBacklinks(updated);
  };

  // ── Articles ─────────────────────────────────────────────────────────────
  const articles: ArticleRow[] = formData.articles || [];
  const setArticles = (rows: ArticleRow[]) => handleChange("articles", rows);
  const addArticle = () => setArticles([...articles, emptyArticle()]);
  const removeArticle = (i: number) => setArticles(articles.filter((_, idx) => idx !== i));
  const updateArticle = (i: number, field: keyof ArticleRow, val: any) => {
    const updated = [...articles];
    (updated[i] as any)[field] = val;
    setArticles(updated);
  };

  // ── Social posts ─────────────────────────────────────────────────────────
  const posts: SocialPostRow[] = formData.posts || [];
  const setPosts = (rows: SocialPostRow[]) => handleChange("posts", rows);
  const addPost = () => setPosts([...posts, emptySocialPost()]);
  const removePost = (i: number) => setPosts(posts.filter((_, idx) => idx !== i));
  const updatePost = (i: number, field: keyof SocialPostRow, val: any) => {
    const updated = [...posts];
    (updated[i] as any)[field] = val;
    setPosts(updated);
  };

  // ─── Render per service type ─────────────────────────────────────────────
  const renderForm = () => {
    const svc = serviceType?.toLowerCase();

    // ── BACKLINKS ─────────────────────────────────────────────────────────
    if (svc === "backlinks") {
      const liveCount = backlinks.filter((r) => r.status === "live").length;
      return (
        <div className="space-y-4">
          <ProgressHeader icon={Link2} label="Backlink Log" done={liveCount} target={targetCount} />

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addBacklink} className="gap-1">
              <Plus className="w-3 h-3" /> Add Backlink
            </Button>
          </div>

          {backlinks.length > 0 && (
            <div className="space-y-3">
              {backlinks.map((row, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-lg bg-card relative">
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Source URL (where the link lives)</Label>
                    <Input value={row.source_url} onChange={(e) => updateBacklink(i, "source_url", e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Target URL (your client's page)</Label>
                    <Input value={row.target_url} onChange={(e) => updateBacklink(i, "target_url", e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Domain Authority (DA)</Label>
                    <Input type="number" value={row.da} onChange={(e) => updateBacklink(i, "da", e.target.value)} placeholder="0–100" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Anchor Text</Label>
                    <Input value={row.anchor_text} onChange={(e) => updateBacklink(i, "anchor_text", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Date Built</Label>
                    <Input type="date" value={row.date_built} onChange={(e) => updateBacklink(i, "date_built", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Status</Label>
                    <Select value={row.status} onValueChange={(v) => updateBacklink(i, "status", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">✅ Live</SelectItem>
                        <SelectItem value="pending">⏳ Pending</SelectItem>
                        <SelectItem value="rejected">❌ Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <Switch checked={row.dofollow} onCheckedChange={(c) => updateBacklink(i, "dofollow", c)} />
                      <Label className="text-[10px]">DoFollow</Label>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive ml-auto" onClick={() => removeBacklink(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {backlinks.length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <span>Total logged: <strong>{backlinks.length}</strong></span>
              <span className="text-green-600">Live: <strong>{liveCount}</strong></span>
              <span className="text-amber-600">Pending: <strong>{backlinks.filter((r) => r.status === "pending").length}</strong></span>
              <span className="text-red-500">Rejected: <strong>{backlinks.filter((r) => r.status === "rejected").length}</strong></span>
              {backlinks.length > 0 && (
                <span>Avg DA: <strong>{Math.round(backlinks.reduce((s, r) => s + (Number(r.da) || 0), 0) / backlinks.length)}</strong></span>
              )}
            </div>
          )}
          {targetCount && (
            <Progress value={Math.min(Math.round((liveCount / targetCount) * 100), 100)} className="h-2" />
          )}
        </div>
      );
    }

    // ── CONTENT WRITING ───────────────────────────────────────────────────
    if (svc === "content writing") {
      const publishedCount = articles.filter((a) => !!a.url).length;
      return (
        <div className="space-y-4">
          <ProgressHeader icon={FileText} label="Articles Published" done={publishedCount} target={targetCount} />

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addArticle} className="gap-1">
              <Plus className="w-3 h-3" /> Add Article
            </Button>
          </div>

          {articles.length > 0 && (
            <div className="space-y-3">
              {articles.map((row, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-card">
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Article Title</Label>
                    <Input value={row.title} onChange={(e) => updateArticle(i, "title", e.target.value)} placeholder="e.g. 10 Best SEO Tips for 2025" className="h-8 text-xs" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-[10px]">Published URL (fill in once live)</Label>
                    <Input value={row.url} onChange={(e) => updateArticle(i, "url", e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Target Keywords</Label>
                    <Input value={row.keywords} onChange={(e) => updateArticle(i, "keywords", e.target.value)} placeholder="e.g. seo tips, on-page seo" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Word Count</Label>
                    <Input type="number" value={row.word_count} onChange={(e) => updateArticle(i, "word_count", e.target.value)} placeholder="e.g. 1500" className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Publish Date</Label>
                    <Input type="date" value={row.publish_date} onChange={(e) => updateArticle(i, "publish_date", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeArticle(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {articles.length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <span>Total written: <strong>{articles.length}</strong></span>
              <span className="text-green-600">Published: <strong>{publishedCount}</strong></span>
              <span className="text-amber-600">Pending publish: <strong>{articles.filter((a) => !a.url).length}</strong></span>
            </div>
          )}
          {targetCount && (
            <Progress value={Math.min(Math.round((publishedCount / targetCount) * 100), 100)} className="h-2" />
          )}
        </div>
      );
    }

    // ── SOCIAL MEDIA ──────────────────────────────────────────────────────
    if (svc === "social media") {
      const totalReach = posts.reduce((s, r) => s + (Number(r.reach) || 0), 0);
      return (
        <div className="space-y-4">
          <ProgressHeader icon={Share2} label="Posts Published" done={posts.length} target={targetCount} />

          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addPost} className="gap-1">
              <Plus className="w-3 h-3" /> Add Post
            </Button>
          </div>

          {posts.length > 0 && (
            <div className="space-y-3">
              {posts.map((row, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-[10px]">Platform</Label>
                    <Select value={row.platform} onValueChange={(v) => updatePost(i, "platform", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {["Instagram", "Facebook", "LinkedIn", "Twitter/X", "TikTok", "YouTube"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Post Type</Label>
                    <Select value={row.post_type} onValueChange={(v) => updatePost(i, "post_type", v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        {["Image", "Video", "Carousel", "Reel", "Story", "Text"].map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px]">Publish Date</Label>
                    <Input type="date" value={row.publish_date} onChange={(e) => updatePost(i, "publish_date", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Post URL</Label>
                    <Input value={row.post_url} onChange={(e) => updatePost(i, "post_url", e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Likes</Label>
                    <Input type="number" value={row.likes} onChange={(e) => updatePost(i, "likes", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Comments</Label>
                    <Input type="number" value={row.comments} onChange={(e) => updatePost(i, "comments", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-[10px]">Reach</Label>
                    <Input type="number" value={row.reach} onChange={(e) => updatePost(i, "reach", e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePost(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <span>Total Posts: <strong>{posts.length}</strong></span>
              <span>Total Reach: <strong>{totalReach.toLocaleString()}</strong></span>
              {["Instagram", "Facebook", "LinkedIn", "TikTok"].map((p) => {
                const n = posts.filter((r) => r.platform === p).length;
                return n > 0 ? <span key={p}>{p}: <strong>{n}</strong></span> : null;
              })}
            </div>
          )}
          {targetCount && (
            <Progress value={Math.min(Math.round((posts.length / targetCount) * 100), 100)} className="h-2" />
          )}
        </div>
      );
    }

    // ── ON-PAGE SEO ───────────────────────────────────────────────────────
    if (svc === "on-page seo") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Keyword Rankings & On-Page Updates</span>
          </div>
          <div>
            <Label>Pages Optimised This Month</Label>
            <Textarea
              placeholder="List the URLs you worked on, one per line..."
              value={formData.pages_optimised || ""}
              onChange={(e) => handleChange("pages_optimised", e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div>
            <Label>Keyword Ranking Updates</Label>
            <Textarea
              placeholder="e.g. 'best seo agency' moved from #12 to #8..."
              value={formData.keyword_updates || ""}
              onChange={(e) => handleChange("keyword_updates", e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <div>
            <Label>Internal Links Added</Label>
            <Input
              type="number"
              value={formData.internal_links || ""}
              onChange={(e) => handleChange("internal_links", e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={formData.notes || ""}
              onChange={(e) => handleChange("notes", e.target.value)}
              className="min-h-[60px]"
            />
          </div>
        </div>
      );
    }

    // ── TECHNICAL SEO ─────────────────────────────────────────────────────
    if (svc === "technical seo") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Technical Audit Results</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Broken Links Fixed</Label>
              <Input type="number" value={formData.broken_links_fixed || ""} onChange={(e) => handleChange("broken_links_fixed", e.target.value)} />
            </div>
            <div>
              <Label>Page Speed Score (Mobile)</Label>
              <Input type="number" min={0} max={100} value={formData.speed_mobile || ""} onChange={(e) => handleChange("speed_mobile", e.target.value)} placeholder="0–100" />
            </div>
            <div>
              <Label>Page Speed Score (Desktop)</Label>
              <Input type="number" min={0} max={100} value={formData.speed_desktop || ""} onChange={(e) => handleChange("speed_desktop", e.target.value)} placeholder="0–100" />
            </div>
            <div>
              <Label>Crawl Errors Found</Label>
              <Input type="number" value={formData.crawl_errors || ""} onChange={(e) => handleChange("crawl_errors", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Issues Found & Fixed</Label>
            <Textarea
              placeholder="Describe the technical issues discovered and resolved..."
              value={formData.issues_fixed || ""}
              onChange={(e) => handleChange("issues_fixed", e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>
      );
    }

    // ── GOOGLE ADS ────────────────────────────────────────────────────────
    if (svc === "google ads") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Google Ads Performance</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CTR (%)</Label>
              <Input type="number" step="0.01" value={formData.ctr || ""} onChange={(e) => handleChange("ctr", e.target.value)} placeholder="e.g. 3.5" />
            </div>
            <div>
              <Label>CPC ($)</Label>
              <Input type="number" step="0.01" value={formData.cpc || ""} onChange={(e) => handleChange("cpc", e.target.value)} placeholder="e.g. 1.20" />
            </div>
            <div>
              <Label>Conversions</Label>
              <Input type="number" value={formData.conversions || ""} onChange={(e) => handleChange("conversions", e.target.value)} />
            </div>
            <div>
              <Label>Total Spend ($)</Label>
              <Input type="number" step="0.01" value={formData.spend || ""} onChange={(e) => handleChange("spend", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>ROAS</Label>
              <Input type="number" step="0.01" value={formData.roas || ""} onChange={(e) => handleChange("roas", e.target.value)} placeholder="e.g. 4.2" />
            </div>
          </div>
          <div>
            <Label>Key Observations</Label>
            <Textarea value={formData.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="min-h-[80px]" placeholder="Campaign highlights, negatives added, test results..." />
          </div>
        </div>
      );
    }

    // ── META ADS ──────────────────────────────────────────────────────────
    if (svc === "meta ads") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Meta Ads Performance</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ROAS</Label>
              <Input type="number" step="0.01" value={formData.roas || ""} onChange={(e) => handleChange("roas", e.target.value)} placeholder="e.g. 4.2" />
            </div>
            <div>
              <Label>CPL ($)</Label>
              <Input type="number" step="0.01" value={formData.cpl || ""} onChange={(e) => handleChange("cpl", e.target.value)} placeholder="e.g. 12.50" />
            </div>
            <div>
              <Label>CTR (%)</Label>
              <Input type="number" step="0.01" value={formData.ctr || ""} onChange={(e) => handleChange("ctr", e.target.value)} placeholder="e.g. 2.1" />
            </div>
            <div>
              <Label>Total Spend ($)</Label>
              <Input type="number" step="0.01" value={formData.spend || ""} onChange={(e) => handleChange("spend", e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Best Performing Creative URL</Label>
              <Input value={formData.best_creative_url || ""} onChange={(e) => handleChange("best_creative_url", e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={formData.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="min-h-[80px]" placeholder="Creative fatigue, audience insights, what to test next..." />
          </div>
        </div>
      );
    }

    // ── WEB DEVELOPMENT ───────────────────────────────────────────────────
    if (svc === "web development") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <TrendingUp className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Web Development Update</span>
          </div>
          <div>
            <Label>Staging / Preview URL</Label>
            <Input value={formData.staging_url || ""} onChange={(e) => handleChange("staging_url", e.target.value)} placeholder="https://staging.clientsite.com" />
          </div>
          <div className="flex items-center space-x-2">
            <Switch checked={formData.completed_on_time || false} onCheckedChange={(checked) => handleChange("completed_on_time", checked)} />
            <Label>Completed on time</Label>
          </div>
          <div>
            <Label>Progress Notes</Label>
            <Textarea value={formData.notes || ""} onChange={(e) => handleChange("notes", e.target.value)} className="min-h-[100px]" placeholder="What's done, what's outstanding, blockers..." />
          </div>
        </div>
      );
    }

    // ── DEFAULT ───────────────────────────────────────────────────────────
    return (
      <div className="space-y-4">
        <div>
          <Label>Notes</Label>
          <Textarea
            value={formData.notes || ""}
            onChange={(e) => handleChange("notes", e.target.value)}
            className="min-h-[100px]"
            placeholder="Enter deliverable notes..."
          />
        </div>
      </div>
    );
  };

  if (isLoading) return <div className="animate-pulse h-32 bg-muted rounded" />;

  return (
    <div className="space-y-4 bg-muted/20 border rounded-lg p-5">
      {renderForm()}
      <div className="flex justify-end pt-2">
        <Button onClick={() => saveDeliverables.mutate()} disabled={saveDeliverables.isPending} className="gap-2">
          <Save className="w-4 h-4" /> Save Deliverables
        </Button>
      </div>
    </div>
  );
}
