import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, ExternalLink, ChevronDown, ChevronRight, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";

interface Props {
  clientId: string;
  serviceType: "Backlinks" | "Social Media" | "Content Writing" | "Google Ads" | "Meta Ads" | "On-Page SEO" | "Technical SEO";
}

// ─── helpers ────────────────────────────────────────────────────────────────

function trunc(url: string, max = 45) {
  if (!url) return "";
  try { const u = new URL(url); return (u.hostname + u.pathname).slice(0, max) + (url.length > max ? "…" : ""); }
  catch { return url.slice(0, max) + (url.length > max ? "…" : ""); }
}

const STATUS_CLASSES: Record<string, string> = {
  live: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  not_started: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  blocked: "bg-red-100 text-red-700",
  pending_approval: "bg-amber-100 text-amber-700",
};

const PLATFORM_CLASSES: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  twitter: "bg-sky-100 text-sky-700",
  "twitter/x": "bg-sky-100 text-sky-700",
  linkedin: "bg-blue-100 text-blue-800",
  tiktok: "bg-purple-100 text-purple-700",
  youtube: "bg-red-100 text-red-700",
};

function TaskStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-600"} text-[10px] capitalize`}>
      {status?.replace(/_/g, " ") ?? "unknown"}
    </Badge>
  );
}

// ─── Collapsible task group ──────────────────────────────────────────────────

function TaskGroup({ task, onOpen }: { task: any; onOpen: (id: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const deliverable = task.task_deliverables?.[0];
  const data = deliverable?.data ?? {};

  const backlinks: any[] = data.backlinks ?? [];
  const articles: any[] = data.articles ?? [];
  const posts: any[] = data.posts ?? [];

  const liveBacklinks = backlinks.filter((b) => b.status === "live").length;
  const publishedArticles = articles.filter((a) => !!a.url).length;
  const target = task.target_count ?? null;

  // Determine progress count for this task
  let done = 0;
  let rows: any[] = [];
  if (task.service_type === "Backlinks") { done = liveBacklinks; rows = backlinks; }
  else if (task.service_type === "Content Writing") { done = publishedArticles; rows = articles; }
  else if (task.service_type === "Social Media") { done = posts.length; rows = posts; }

  const pct = target ? Math.min(Math.round((done / target) * 100), 100) : null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Task header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{task.title}</span>
            <TaskStatusBadge status={task.status} />
            {task.due_date && (
              <span className="text-xs text-muted-foreground">
                Due {format(new Date(task.due_date), "MMM d, yyyy")}
              </span>
            )}
          </div>
          {/* Progress bar */}
          {target !== null && (
            <div className="flex items-center gap-2 mt-1.5">
              <Progress
                value={pct ?? 0}
                className={`h-1.5 flex-1 max-w-[200px] ${pct !== null && pct >= 100 ? "[&>div]:bg-green-500" : pct !== null && pct >= 80 ? "[&>div]:bg-amber-500" : ""}`}
              />
              <span className="text-xs text-muted-foreground tabular-nums">
                {done} / {target} {pct !== null ? `(${pct}%)` : ""}
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 h-7 text-xs shrink-0"
          onClick={(e) => { e.stopPropagation(); onOpen(task.id); }}
        >
          <ArrowUpRight className="w-3.5 h-3.5" /> Open task
        </Button>
      </button>

      {/* Rows */}
      {expanded && rows.length > 0 && (
        <div className="overflow-x-auto">
          {task.service_type === "Backlinks" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="text-xs">Source URL</TableHead>
                  <TableHead className="text-xs">Target URL</TableHead>
                  <TableHead className="text-xs">DA</TableHead>
                  <TableHead className="text-xs">Anchor Text</TableHead>
                  <TableHead className="text-xs">Date Built</TableHead>
                  <TableHead className="text-xs">DoFollow</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backlinks.map((bl, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell>
                      {bl.source_url
                        ? <a href={bl.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">{trunc(bl.source_url)} <ExternalLink className="w-2.5 h-2.5 inline shrink-0" /></a>
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {bl.target_url
                        ? <a href={bl.target_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{trunc(bl.target_url)}</a>
                        : "—"}
                    </TableCell>
                    <TableCell>{bl.da || "—"}</TableCell>
                    <TableCell className="max-w-[120px] truncate">{bl.anchor_text || "—"}</TableCell>
                    <TableCell>{bl.date_built ? format(new Date(bl.date_built), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>{bl.dofollow ? <span className="text-green-600 font-medium">Yes</span> : <span className="text-muted-foreground">No</span>}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_CLASSES[bl.status] ?? "bg-gray-100 text-gray-600"} text-[10px]`}>
                        {bl.status || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {task.service_type === "Content Writing" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Published URL</TableHead>
                  <TableHead className="text-xs">Keywords</TableHead>
                  <TableHead className="text-xs">Word Count</TableHead>
                  <TableHead className="text-xs">Publish Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((a, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell className="max-w-[160px] truncate font-medium">{a.title || "—"}</TableCell>
                    <TableCell>
                      {a.url
                        ? <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">{trunc(a.url)} <ExternalLink className="w-2.5 h-2.5 inline shrink-0" /></a>
                        : <span className="text-muted-foreground italic">Not published yet</span>}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate">{a.keywords || "—"}</TableCell>
                    <TableCell>{a.word_count ? Number(a.word_count).toLocaleString() : "—"}</TableCell>
                    <TableCell>{a.publish_date ? format(new Date(a.publish_date), "MMM d, yyyy") : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {task.service_type === "Social Media" && (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/10">
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs">Post URL</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Publish Date</TableHead>
                  <TableHead className="text-xs">Likes</TableHead>
                  <TableHead className="text-xs">Comments</TableHead>
                  <TableHead className="text-xs">Reach</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((p, i) => (
                  <TableRow key={i} className="text-xs">
                    <TableCell>
                      <Badge className={`${PLATFORM_CLASSES[p.platform?.toLowerCase()] ?? "bg-gray-100 text-gray-600"} text-[10px] capitalize`}>
                        {p.platform || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {p.post_url
                        ? <a href={p.post_url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">{trunc(p.post_url)} <ExternalLink className="w-2.5 h-2.5 inline shrink-0" /></a>
                        : "—"}
                    </TableCell>
                    <TableCell className="capitalize">{p.post_type || "—"}</TableCell>
                    <TableCell>{p.publish_date ? format(new Date(p.publish_date), "MMM d, yyyy") : "—"}</TableCell>
                    <TableCell>{p.likes ? Number(p.likes).toLocaleString() : "—"}</TableCell>
                    <TableCell>{p.comments ? Number(p.comments).toLocaleString() : "—"}</TableCell>
                    <TableCell>{p.reach ? Number(p.reach).toLocaleString() : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {expanded && rows.length === 0 && (
        <div className="px-4 py-3 text-xs text-muted-foreground italic border-t">
          No deliverables logged yet —{" "}
          <button className="text-primary underline" onClick={() => onOpen(task.id)}>open task to add</button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ClientDeliverablesSummary({ clientId, serviceType }: Props) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["client-deliverables", clientId, serviceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, target_count, service_type, task_deliverables(data, deliverable_type, deliverable_name)")
        .eq("client_id", clientId)
        .eq("service_type", serviceType)
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Filter to only tasks that have saved deliverables OR that exist (show all tasks even if no deliverables logged yet)
      return (data || []).map((t: any) => ({
        ...t,
        task_deliverables: (t.task_deliverables || []).filter((d: any) => d.deliverable_name === "Service Data"),
      }));
    },
  });

  // Aggregate summary numbers
  const summary = useMemo(() => {
    let totalBacklinks = 0, liveBacklinks = 0, pendingBacklinks = 0;
    const daValues: number[] = [];
    let totalArticles = 0, publishedArticles = 0;
    let totalPosts = 0, totalReach = 0;

    tasks.forEach((task: any) => {
      const data = task.task_deliverables?.[0]?.data ?? {};
      if (serviceType === "Backlinks") {
        const bls: any[] = data.backlinks ?? [];
        totalBacklinks += bls.length;
        liveBacklinks += bls.filter((b) => b.status === "live").length;
        pendingBacklinks += bls.filter((b) => b.status === "pending").length;
        bls.forEach((b) => { const n = Number(b.da); if (!isNaN(n) && n > 0) daValues.push(n); });
      } else if (serviceType === "Content Writing") {
        const arts: any[] = data.articles ?? [];
        totalArticles += arts.length;
        publishedArticles += arts.filter((a) => !!a.url).length;
      } else if (serviceType === "Social Media") {
        const ps: any[] = data.posts ?? [];
        totalPosts += ps.length;
        totalReach += ps.reduce((s, p) => s + (Number(p.reach) || 0), 0);
      }
    });

    const avgDa = daValues.length > 0 ? Math.round(daValues.reduce((a, b) => a + b, 0) / daValues.length) : 0;
    return { totalBacklinks, liveBacklinks, pendingBacklinks, avgDa, totalArticles, publishedArticles, totalPosts, totalReach };
  }, [tasks, serviceType]);

  // CSV export
  const handleExport = () => {
    const rows: string[][] = [];
    tasks.forEach((task: any) => {
      const data = task.task_deliverables?.[0]?.data ?? {};
      if (serviceType === "Backlinks") {
        (data.backlinks ?? []).forEach((bl: any) => {
          rows.push([task.title, bl.source_url ?? "", bl.target_url ?? "", String(bl.da ?? ""), bl.anchor_text ?? "", bl.date_built ?? "", bl.status ?? ""]);
        });
      } else if (serviceType === "Content Writing") {
        (data.articles ?? []).forEach((a: any) => {
          rows.push([task.title, a.title ?? "", a.url ?? "", a.keywords ?? "", String(a.word_count ?? ""), a.publish_date ?? ""]);
        });
      } else if (serviceType === "Social Media") {
        (data.posts ?? []).forEach((p: any) => {
          rows.push([task.title, p.platform ?? "", p.post_url ?? "", p.post_type ?? "", p.publish_date ?? "", String(p.reach ?? ""), String(p.likes ?? "")]);
        });
      }
    });

    const headers = serviceType === "Backlinks"
      ? ["Task", "Source URL", "Target URL", "DA", "Anchor Text", "Date Built", "Status"]
      : serviceType === "Content Writing"
      ? ["Task", "Title", "Published URL", "Keywords", "Word Count", "Publish Date"]
      : ["Task", "Platform", "Post URL", "Post Type", "Publish Date", "Reach", "Likes"];

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${serviceType.toLowerCase().replace(" ", "-")}-${clientId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasTasks = tasks.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {serviceType === "Backlinks" && "Backlinks"}
                {serviceType === "Content Writing" && "Articles Published"}
                {serviceType === "Social Media" && "Social Media Posts"}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                All data is logged inside tasks — click "Open task" to add or edit entries
              </p>
            </div>
            {hasTasks && (
              <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" /> Export CSV
              </Button>
            )}
          </div>

          {/* Aggregate summary */}
          {hasTasks && !isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {serviceType === "Backlinks" && (
                <>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{summary.totalBacklinks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Logged</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{summary.liveBacklinks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Live</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{summary.pendingBacklinks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{summary.avgDa}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Avg DA</p>
                  </div>
                </>
              )}
              {serviceType === "Content Writing" && (
                <>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{summary.totalArticles}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Written</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{summary.publishedArticles}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Published</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold text-amber-600">{summary.totalArticles - summary.publishedArticles}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pending Publish</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{tasks.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Active Tasks</p>
                  </div>
                </>
              )}
              {serviceType === "Social Media" && (
                <>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{summary.totalPosts}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Posts</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{summary.totalReach.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Reach</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{tasks.length}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Active Tasks</p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {isLoading ? (
            <div className="h-24 animate-pulse bg-muted/20 rounded-lg" />
          ) : !hasTasks ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-muted-foreground">No {serviceType} tasks for this client yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a task with service type "{serviceType}" and log your work inside the task — it will appear here automatically.
              </p>
            </div>
          ) : (
            tasks.map((task: any) => (
              <TaskGroup key={task.id} task={task} onOpen={setOpenTaskId} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Task detail panel */}
      <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </>
  );
}
