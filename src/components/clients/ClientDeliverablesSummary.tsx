import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ClientDeliverablesSummaryProps {
  clientId: string;
  serviceType: "Backlinks" | "Social Media";
}

function truncateUrl(url: string, max = 40): string {
  if (!url) return "";
  if (url.length <= max) return url;
  return url.slice(0, max) + "...";
}

function statusBadgeClass(status: string): string {
  switch ((status || "").toLowerCase()) {
    case "live": return "bg-green-100 text-green-700";
    case "pending": return "bg-amber-100 text-amber-700";
    case "rejected": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function platformBadgeClass(platform: string): string {
  switch ((platform || "").toLowerCase()) {
    case "instagram": return "bg-pink-100 text-pink-700";
    case "facebook": return "bg-blue-100 text-blue-700";
    case "twitter":
    case "x": return "bg-slate-100 text-slate-700";
    case "linkedin": return "bg-sky-100 text-sky-700";
    case "tiktok": return "bg-purple-100 text-purple-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

export function ClientDeliverablesSummary({ clientId, serviceType }: ClientDeliverablesSummaryProps) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["client-deliverables", clientId, serviceType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, due_date, task_deliverables!inner(data, deliverable_type)")
        .eq("client_id", clientId)
        .eq("service_type", serviceType)
        .eq("task_deliverables.deliverable_name", "Service Data");
      if (error) throw error;
      return data || [];
    },
  });

  // Backlinks data
  const backlinkRows = useMemo(() => {
    if (serviceType !== "Backlinks") return [];
    const rows: any[] = [];
    tasks.forEach((task: any) => {
      const deliverables = task.task_deliverables || [];
      deliverables.forEach((d: any) => {
        const backlinks = d.data?.backlinks || [];
        backlinks.forEach((bl: any) => {
          rows.push({ ...bl, taskTitle: task.title });
        });
      });
    });
    return rows;
  }, [tasks, serviceType]);

  const backlinkSummary = useMemo(() => {
    const total = backlinkRows.length;
    const live = backlinkRows.filter((b) => (b.status || "").toLowerCase() === "live").length;
    const pending = backlinkRows.filter((b) => (b.status || "").toLowerCase() === "pending").length;
    const daValues = backlinkRows.map((b) => Number(b.da)).filter((v) => !isNaN(v) && v > 0);
    const avgDa = daValues.length > 0 ? Math.round(daValues.reduce((a, b) => a + b, 0) / daValues.length) : 0;
    return { total, live, pending, avgDa };
  }, [backlinkRows]);

  // Social posts data
  const socialRows = useMemo(() => {
    if (serviceType !== "Social Media") return [];
    const rows: any[] = [];
    tasks.forEach((task: any) => {
      const deliverables = task.task_deliverables || [];
      deliverables.forEach((d: any) => {
        const posts = d.data?.posts || [];
        posts.forEach((p: any) => {
          rows.push({ ...p, taskTitle: task.title });
        });
      });
    });
    return rows;
  }, [tasks, serviceType]);

  const socialSummary = useMemo(() => {
    const total = socialRows.length;
    const totalReach = socialRows.reduce((sum, p) => sum + (Number(p.reach) || 0), 0);
    return { total, totalReach };
  }, [socialRows]);

  const isEmpty =
    serviceType === "Backlinks" ? backlinkRows.length === 0 : socialRows.length === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span>From Tasks</span>
        </CardTitle>
        <CardDescription>Auto-populated from task deliverables</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-20 animate-pulse bg-muted/20 rounded" />
        ) : isEmpty ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No task deliverables found. Log{" "}
            {serviceType === "Backlinks" ? "backlinks inside Backlinks tasks" : "posts inside Social Media tasks"}{" "}
            to see them here.
          </p>
        ) : serviceType === "Backlinks" ? (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{backlinkSummary.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Logged</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{backlinkSummary.live}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Live</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{backlinkSummary.pending}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{backlinkSummary.avgDa}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Avg DA</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source URL</TableHead>
                    <TableHead>Target URL</TableHead>
                    <TableHead>DA</TableHead>
                    <TableHead>Anchor Text</TableHead>
                    <TableHead>Date Built</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>From Task</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backlinkRows.map((bl: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">
                        {bl.source_url ? (
                          <a
                            href={bl.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                            title={bl.source_url}
                          >
                            {truncateUrl(bl.source_url)}
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {bl.target_url ? (
                          <a
                            href={bl.target_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                            title={bl.target_url}
                          >
                            {truncateUrl(bl.target_url)}
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{bl.da || "-"}</TableCell>
                      <TableCell className="text-xs">{bl.anchor_text || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {bl.date_built ? format(new Date(bl.date_built), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusBadgeClass(bl.status)} text-xs`}>
                          {bl.status || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {bl.taskTitle}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{socialSummary.total}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Posts</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{socialSummary.totalReach.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Reach</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform</TableHead>
                    <TableHead>Post URL</TableHead>
                    <TableHead>Post Type</TableHead>
                    <TableHead>Publish Date</TableHead>
                    <TableHead>Reach</TableHead>
                    <TableHead>From Task</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {socialRows.map((post: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge className={`${platformBadgeClass(post.platform)} text-xs`}>
                          {post.platform || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {post.post_url ? (
                          <a
                            href={post.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:underline"
                            title={post.post_url}
                          >
                            {truncateUrl(post.post_url)}
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{post.post_type || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {post.publish_date ? format(new Date(post.publish_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-xs">{post.reach ? Number(post.reach).toLocaleString() : "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {post.taskTitle}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
