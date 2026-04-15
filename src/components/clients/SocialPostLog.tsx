import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, ExternalLink, Target, LayoutList, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

interface SocialPostLogProps {
  clientId: string;
}

const PLATFORMS = ["instagram", "facebook", "twitter", "linkedin", "tiktok", "youtube", "pinterest"] as const;
const POST_TYPES = ["post", "reel", "story", "video", "carousel"] as const;
const POST_STATUSES = ["draft", "scheduled", "published", "cancelled"] as const;

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  twitter: "bg-sky-100 text-sky-700",
  linkedin: "bg-blue-100 text-blue-800",
  tiktok: "bg-slate-100 text-slate-700",
  youtube: "bg-red-100 text-red-700",
  pinterest: "bg-rose-100 text-rose-700",
};

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-100 text-green-700 hover:bg-green-100",
  scheduled: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  draft: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  cancelled: "bg-red-100 text-red-700 hover:bg-red-100",
};

const EMPTY_ROW = {
  platform: "instagram" as typeof PLATFORMS[number],
  post_type: "post" as typeof POST_TYPES[number],
  caption: "",
  post_url: "",
  posted_at: "",
  status: "published" as typeof POST_STATUSES[number],
  likes: "",
  comments: "",
  shares: "",
  reach: "",
  impressions: "",
};

// Monthly target defaults per platform
const DEFAULT_TARGETS: Record<string, number> = {
  instagram: 12, facebook: 8, twitter: 20, linkedin: 8, tiktok: 10, youtube: 4, pinterest: 12
};

export function SocialPostLog({ clientId }: SocialPostLogProps) {
  const queryClient = useQueryClient();
  const [activePlatform, setActivePlatform] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [isAdding, setIsAdding] = useState(false);
  const [newRow, setNewRow] = useState({ ...EMPTY_ROW });
  const [targets, setTargets] = useState<Record<string, number>>({ ...DEFAULT_TARGETS });
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["social-posts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (row: typeof EMPTY_ROW) => {
      const likes = Number(row.likes) || 0;
      const comments = Number(row.comments) || 0;
      const shares = Number(row.shares) || 0;
      const reach = Number(row.reach) || 0;
      const engRate = reach > 0 ? parseFloat(((likes + comments + shares) / reach * 100).toFixed(2)) : null;

      const { error } = await supabase.from("social_posts").insert({
        client_id: clientId,
        platform: row.platform,
        post_type: row.post_type,
        caption: row.caption || null,
        post_url: row.post_url || null,
        posted_at: row.posted_at ? new Date(row.posted_at).toISOString() : null,
        status: row.status,
        likes,
        comments,
        shares,
        reach,
        impressions: Number(row.impressions) || 0,
        engagement_rate: engRate,
        created_by: profile?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts", clientId] });
      setNewRow({ ...EMPTY_ROW });
      setIsAdding(false);
      toast.success("Post logged");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts", clientId] });
      toast.success("Post removed");
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") addMutation.mutate(newRow);
    if (e.key === "Escape") { setIsAdding(false); setNewRow({ ...EMPTY_ROW }); }
  };

  const filtered = activePlatform === "all" ? posts : posts.filter((p) => p.platform === activePlatform);

  // This month stats
  const now = new Date();
  const thisMonthPosts = posts.filter((p) => {
    const d = p.posted_at ? new Date(p.posted_at) : new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Platform counts for badges
  const platformCounts = PLATFORMS.reduce((acc, p) => {
    acc[p] = posts.filter((post) => post.platform === p).length;
    return acc;
  }, {} as Record<string, number>);

  // Calendar view helpers
  const calendarDays = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  const postsByDay = (day: Date) => posts.filter((p) => {
    const d = p.posted_at ? new Date(p.posted_at) : null;
    return d ? isSameDay(d, day) : false;
  });

  return (
    <div className="space-y-4">
      {/* Per-platform target progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["instagram", "facebook", "linkedin", "tiktok"] as const).map((platform) => {
          const count = thisMonthPosts.filter((p) => p.platform === platform).length;
          const target = targets[platform];
          const pct = Math.min(100, Math.round((count / target) * 100));
          return (
            <Card key={platform}>
              <CardContent className="pt-3 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <Badge className={`text-xs ${PLATFORM_COLORS[platform]}`}>{platform}</Badge>
                  {editingTarget === platform ? (
                    <Input
                      type="number"
                      className="w-14 h-5 text-xs px-1"
                      value={target}
                      autoFocus
                      onChange={(e) => setTargets({ ...targets, [platform]: Number(e.target.value) })}
                      onBlur={() => setEditingTarget(null)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingTarget(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setEditingTarget(platform)}
                      className="text-xs text-muted-foreground underline decoration-dashed"
                    >
                      {count}/{target}
                    </button>
                  )}
                </div>
                <Progress value={pct} className="h-1.5" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Tabs value={activePlatform} onValueChange={setActivePlatform}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7 px-2">All ({posts.length})</TabsTrigger>
              {PLATFORMS.filter((p) => platformCounts[p] > 0 || activePlatform === p).map((p) => (
                <TabsTrigger key={p} value={p} className="text-xs h-7 px-2 capitalize">
                  {p} ({platformCounts[p]})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setViewMode(viewMode === "list" ? "calendar" : "list")}
          >
            {viewMode === "list" ? <CalendarIcon className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
            {viewMode === "list" ? "Calendar" : "List"}
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => { setIsAdding(true); setTimeout(() => firstInputRef.current?.focus(), 50); }}
          >
            <Plus className="h-3.5 w-3.5" /> Log Post
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">{format(now, "MMMM yyyy")}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: calendarDays[0].getDay() }).map((_, i) => <div key={`e${i}`} />)}
              {calendarDays.map((day) => {
                const dayPosts = postsByDay(day);
                const isToday = isSameDay(day, now);
                return (
                  <div
                    key={day.toISOString()}
                    className={`rounded-lg p-1 min-h-[50px] border text-xs ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <span className={`font-medium ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayPosts.map((p) => (
                        <div key={p.id} className={`rounded px-1 truncate ${PLATFORM_COLORS[p.platform]}`}>
                          {p.platform.slice(0, 2).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* List View */
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Platform</TableHead>
                  <TableHead className="w-[80px]">Type</TableHead>
                  <TableHead>Caption</TableHead>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead className="w-[70px]">Status</TableHead>
                  <TableHead className="w-[60px]">Likes</TableHead>
                  <TableHead className="w-[60px]">Reach</TableHead>
                  <TableHead className="w-[70px]">Eng%</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isAdding && (
                  <TableRow className="bg-primary/5">
                    <TableCell className="p-1">
                      <Select value={newRow.platform} onValueChange={(v: any) => setNewRow({ ...newRow, platform: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Select value={newRow.post_type} onValueChange={(v: any) => setNewRow({ ...newRow, post_type: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POST_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        ref={firstInputRef}
                        placeholder="Caption / description"
                        value={newRow.caption}
                        onChange={(e) => setNewRow({ ...newRow, caption: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="date"
                        value={newRow.posted_at}
                        onChange={(e) => setNewRow({ ...newRow, posted_at: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select value={newRow.status} onValueChange={(v: any) => setNewRow({ ...newRow, status: v })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {POST_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        placeholder="0"
                        value={newRow.likes}
                        onChange={(e) => setNewRow({ ...newRow, likes: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        type="number"
                        placeholder="0"
                        value={newRow.reach}
                        onChange={(e) => setNewRow({ ...newRow, reach: e.target.value })}
                        onKeyDown={handleKeyDown}
                        className="h-7 text-xs"
                      />
                    </TableCell>
                    <TableCell className="p-1 text-xs text-muted-foreground">auto</TableCell>
                    <TableCell className="p-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-green-600"
                        onClick={() => addMutation.mutate(newRow)}
                        disabled={addMutation.isPending}
                      >
                        ✓
                      </Button>
                    </TableCell>
                  </TableRow>
                )}

                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 && !isAdding ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      No posts logged yet. Click "Log Post" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const engRate = p.engagement_rate != null
                      ? `${p.engagement_rate}%`
                      : p.reach > 0
                      ? `${(((p.likes || 0) + (p.comments || 0) + (p.shares || 0)) / p.reach * 100).toFixed(1)}%`
                      : "-";
                    return (
                      <TableRow key={p.id} className="group">
                        <TableCell>
                          <Badge className={`text-xs capitalize ${PLATFORM_COLORS[p.platform]}`}>{p.platform}</Badge>
                        </TableCell>
                        <TableCell className="text-xs capitalize">{p.post_type}</TableCell>
                        <TableCell className="text-xs max-w-[200px]">
                          <div className="truncate" title={p.caption || ""}>{p.caption || <span className="text-muted-foreground">No caption</span>}</div>
                          {p.post_url && (
                            <a href={p.post_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline text-xs mt-0.5">
                              <ExternalLink className="h-3 w-3" /> View post
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.posted_at ? format(new Date(p.posted_at), "MMM d, yyyy") : <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs capitalize ${STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{(p.likes || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{(p.reach || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-xs font-semibold">{engRate}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-500"
                            onClick={() => deleteMutation.mutate(p.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
