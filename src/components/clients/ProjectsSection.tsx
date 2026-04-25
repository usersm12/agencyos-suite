import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FolderOpen, Settings2, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";

interface Props {
  clientId: string;
}

const STATUS_OPTIONS = ["active", "completed", "on_hold", "cancelled"] as const;

const statusBadge: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  on_hold: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function ProjectsSection({ clientId }: Props) {
  const queryClient = useQueryClient();

  const [editProject, setEditProject] = useState<any | null>(null);
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<string>("active");

  // Add form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      // RPC returns id, name, description, status, created_at — no second table query needed
      const { data, error } = await supabase.rpc("get_projects_for_client", {
        p_client_id: clientId,
      });
      if (error) throw error;
      return data || [];
    },
    refetchOnMount: "always",
  });

  // ── Add project ──────────────────────────────────────────
  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        client_id: clientId,
        name: newName.trim(),
        description: newDescription.trim() || null,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created");
      setAddOpen(false);
      setNewName("");
      setNewDescription("");
      queryClient.invalidateQueries({ queryKey: ["client-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["task-modal-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["quick-log-projects", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Edit project ─────────────────────────────────────────
  const editMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("update_project", {
        p_project_id: editProject.id,
        p_name: editName.trim(),
        p_description: editDescription.trim() || null,
        p_status: editStatus,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Project updated");
      setEditProject(null);
      queryClient.invalidateQueries({ queryKey: ["client-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["task-modal-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["quick-log-projects", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Delete project ───────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { data, error } = await supabase.rpc("delete_project", {
        p_project_id: projectId,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Project deleted");
      setDeleteProjectId(null);
      queryClient.invalidateQueries({ queryKey: ["client-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["task-modal-projects", clientId] });
      queryClient.invalidateQueries({ queryKey: ["quick-log-projects", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(project: any) {
    setEditProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditStatus(project.status);
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-base">Projects</h3>
          <Badge variant="secondary" className="ml-1 text-xs">
            {projects.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Project
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No projects yet. Click <strong>New Project</strong> to create one.
        </p>
      ) : (
        <div className="divide-y divide-border/50">
          {projects.map((p: any) => (
            <div
              key={p.id}
              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.description}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  Created {format(new Date(p.created_at), "d MMM yyyy")}
                </p>
              </div>

              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0 ${
                  statusBadge[p.status] ?? "bg-muted text-muted-foreground border-border"
                }`}
              >
                {p.status.replace("_", " ")}
              </span>

              {/* Settings button — owners + managers */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                title="Edit project"
                onClick={() => openEdit(p)}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>

              {/* Delete button — server enforces owner-only via delete_project RPC */}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Delete project (owners only)"
                onClick={() => setDeleteProjectId(p.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ── Edit dialog ──────────────────────────────────── */}
      <Dialog open={!!editProject} onOpenChange={(v) => !v && setEditProject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProject(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {editMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add dialog ───────────────────────────────────── */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) { setNewName(""); setNewDescription(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Project Name *</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Website Redesign"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ───────────────────────────────── */}
      <AlertDialog
        open={!!deleteProjectId}
        onOpenChange={(v) => !v && setDeleteProjectId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its associated
              tasks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteProjectId && deleteMutation.mutate(deleteProjectId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
