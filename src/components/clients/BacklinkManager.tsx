import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, Upload, Trash2, ExternalLink, Target } from "lucide-react";
import { format } from "date-fns";

interface BacklinkManagerProps {
  clientId: string;
}

const EMPTY_ROW = {
  source_url: "",
  target_url: "",
  anchor_text: "",
  da_score: "",
  pa_score: "",
  is_dofollow: true,
  date_built: "",
  status: "live",
  notes: "",
};

const STATUS_OPTIONS = ["live", "pending", "rejected"];

export function BacklinkManager({ clientId }: BacklinkManagerProps) {
  const queryClient = useQueryClient();
  const [newRow, setNewRow] = useState({ ...EMPTY_ROW });
  const [isAdding, setIsAdding] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState(20);
  const [editingTarget, setEditingTarget] = useState(false);
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvRaw, setCsvRaw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const { data: backlinks = [], isLoading } = useQuery({
    queryKey: ["backlinks", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backlink_log")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
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
      const { error } = await supabase.from("backlink_log").insert({
        client_id: clientId,
        source_url: row.source_url || null,
        target_url: row.target_url || null,
        url: row.source_url || row.target_url || "",
        anchor_text: row.anchor_text || null,
        da_score: row.da_score ? Number(row.da_score) : null,
        pa_score: row.pa_score ? Number(row.pa_score) : null,
        is_dofollow: row.is_dofollow,
        date_built: row.date_built || null,
        status: row.status,
        notes: row.notes || null,
        logged_by: profile?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlinks", clientId] });
      setNewRow({ ...EMPTY_ROW });
      setIsAdding(false);
      toast.success("Backlink added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("backlink_log").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlinks", clientId] });
      toast.success("Backlink removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkInsertMutation = useMutation({
    mutationFn: async (rows: any[]) => {
      const { error } = await supabase.from("backlink_log").insert(
        rows.map((r) => ({
          client_id: clientId,
          url: r.source_url || r.target_url || "",
          source_url: r.source_url || null,
          target_url: r.target_url || null,
          anchor_text: r.anchor_text || null,
          da_score: r.da_score ? Number(r.da_score) : null,
          pa_score: r.pa_score ? Number(r.pa_score) : null,
          is_dofollow: r.is_dofollow !== "false",
          date_built: r.date_built || null,
          status: r.status || "live",
          notes: r.notes || null,
          logged_by: profile?.id || null,
        }))
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backlinks", clientId] });
      setCsvDialog(false);
      setCsvPreview([]);
      setCsvRaw("");
      toast.success(`${csvPreview.length} backlinks imported`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleTabKey = (e: React.KeyboardEvent<HTMLInputElement>, nextField: string | null) => {
    if (e.key === "Tab" && !e.shiftKey && nextField === null) {
      e.preventDefault();
      if (newRow.source_url || newRow.target_url) addMutation.mutate(newRow);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (newRow.source_url || newRow.target_url) addMutation.mutate(newRow);
    }
    if (e.key === "Escape") {
      setIsAdding(false);
      setNewRow({ ...EMPTY_ROW });
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvRaw(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return;
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s/g, "_"));
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      return headers.reduce((obj: any, h, i) => { obj[h] = vals[i] || ""; return obj; }, {});
    });
    setCsvPreview(rows);
    setCsvDialog(true);
  };

  // This month live backlinks
  const thisMonth = new Date();
  const liveThisMonth = backlinks.filter((b) => {
    if (!b.date_built) return b.status === "live";
    const d = new Date(b.date_built);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  }).length;
  const progressPct = Math.min(100, Math.round((liveThisMonth / monthlyTarget) * 100));

  const getStatusBadge = (status: string) => {
    if (status === "live") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Live</Badge>;
    if (status === "pending") return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Pending</Badge>;
    if (status === "rejected") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Rejected</Badge>;
    if (status === "active") return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Monthly Target Progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">This Month: {liveThisMonth} / </span>
              {editingTarget ? (
                <Input
                  type="number"
                  className="w-16 h-6 text-sm px-1"
                  value={monthlyTarget}
                  autoFocus
                  onChange={(e) => setMonthlyTarget(Number(e.target.value))}
                  onBlur={() => setEditingTarget(false)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingTarget(false)}
                />
              ) : (
                <button
                  onClick={() => setEditingTarget(true)}
                  className="text-sm font-medium underline decoration-dashed text-muted-foreground hover:text-foreground"
                >
                  {monthlyTarget} target
                </button>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{backlinks.length} total backlinks</p>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setIsAdding(true); setTimeout(() => firstInputRef.current?.focus(), 50); }}>
            <Plus className="h-3.5 w-3.5" /> Add Backlink
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source URL</TableHead>
                <TableHead>Target URL</TableHead>
                <TableHead>Anchor Text</TableHead>
                <TableHead className="w-[60px]">DA</TableHead>
                <TableHead className="w-[60px]">PA</TableHead>
                <TableHead className="w-[70px]">DoFollow</TableHead>
                <TableHead className="w-[100px]">Date Built</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdding && (
                <TableRow className="bg-primary/5">
                  <TableCell className="p-1">
                    <Input
                      ref={firstInputRef}
                      placeholder="https://example.com/page"
                      value={newRow.source_url}
                      onChange={(e) => setNewRow({ ...newRow, source_url: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      placeholder="https://yoursite.com"
                      value={newRow.target_url}
                      onChange={(e) => setNewRow({ ...newRow, target_url: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      placeholder="Anchor text"
                      value={newRow.anchor_text}
                      onChange={(e) => setNewRow({ ...newRow, anchor_text: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={newRow.da_score}
                      onChange={(e) => setNewRow({ ...newRow, da_score: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="number"
                      placeholder="0"
                      value={newRow.pa_score}
                      onChange={(e) => setNewRow({ ...newRow, pa_score: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={newRow.is_dofollow ? "true" : "false"}
                      onValueChange={(v) => setNewRow({ ...newRow, is_dofollow: v === "true" })}
                    >
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      type="date"
                      value={newRow.date_built}
                      onChange={(e) => setNewRow({ ...newRow, date_built: e.target.value })}
                      onKeyDown={handleKeyDown}
                      className="h-7 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={newRow.status} onValueChange={(v) => setNewRow({ ...newRow, status: v })}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
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
              ) : backlinks.length === 0 && !isAdding ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No backlinks yet. Click "Add Backlink" or import a CSV.
                  </TableCell>
                </TableRow>
              ) : (
                backlinks.map((b) => (
                  <TableRow key={b.id} className="group">
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {b.source_url ? (
                        <a href={b.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary truncate" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.source_url.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {b.target_url ? (
                        <a href={b.target_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary truncate" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{b.target_url.replace(/^https?:\/\//, "")}</span>
                        </a>
                      ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-xs">{b.anchor_text || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell className="text-xs font-medium">{b.da_score ?? "-"}</TableCell>
                    <TableCell className="text-xs font-medium">{b.pa_score ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className={b.is_dofollow !== false ? "border-green-200 text-green-600" : "border-gray-200 text-gray-500"}>
                        {b.is_dofollow !== false ? "Do" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{b.date_built ? format(new Date(b.date_built), "MMM d, yy") : "-"}</TableCell>
                    <TableCell>{getStatusBadge(b.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-red-500"
                        onClick={() => deleteMutation.mutate(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CSV Preview Dialog */}
      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import Preview — {csvPreview.length} rows</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  {csvPreview[0] && Object.keys(csvPreview[0]).map((h) => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvPreview.slice(0, 20).map((row, i) => (
                  <TableRow key={i}>
                    {Object.values(row).map((v: any, j) => <TableCell key={j} className="text-xs py-1">{v}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {csvPreview.length > 20 && <p className="text-xs text-muted-foreground">Showing first 20 of {csvPreview.length} rows.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCsvDialog(false); setCsvPreview([]); }}>Cancel</Button>
            <Button onClick={() => bulkInsertMutation.mutate(csvPreview)} disabled={bulkInsertMutation.isPending}>
              {bulkInsertMutation.isPending ? "Importing..." : `Import ${csvPreview.length} backlinks`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
