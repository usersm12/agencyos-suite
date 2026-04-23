import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Paperclip, X, Loader2, FileText, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ChecklistItem {
  id: string;
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
  item: ChecklistItem;
  phaseId: string;
  taskId: string;
  onUpdate: () => void;
}

const STATUS_CYCLE: Record<string, "pending" | "received" | "not_applicable"> = {
  pending: "received",
  received: "not_applicable",
  not_applicable: "pending",
};

const STATUS_LABEL = {
  pending: "Pending",
  received: "Received",
  not_applicable: "N/A",
};

export function WebChecklistItemRow({ item, phaseId, taskId, onUpdate }: Props) {
  const { profile } = useAuth();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(item.notes || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cycleStatus = async () => {
    const next = STATUS_CYCLE[item.status];
    setSaving(true);
    try {
      const { error } = await supabase
        .from("web_phase_checklist_items")
        .update({
          status: next,
          completed_by: next === "received" ? profile?.id : null,
          completed_at: next === "received" ? new Date().toISOString() : null,
        })
        .eq("id", item.id);
      if (error) throw error;
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    try {
      const { error } = await supabase
        .from("web_phase_checklist_items")
        .update({ notes })
        .eq("id", item.id);
      if (error) throw error;
      setEditingNotes(false);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${taskId}/${phaseId}/${item.id}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("web-project-files")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage
        .from("web-project-files")
        .getPublicUrl(path);

      const { error } = await supabase
        .from("web_phase_checklist_items")
        .update({ file_url: urlData.publicUrl, file_name: file.name })
        .eq("id", item.id);
      if (error) throw error;
      toast.success("File uploaded");
      onUpdate();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async () => {
    try {
      const { error } = await supabase
        .from("web_phase_checklist_items")
        .update({ file_url: null, file_name: null })
        .eq("id", item.id);
      if (error) throw error;
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusBg = {
    pending: "bg-gray-100 text-gray-500 border-gray-200",
    received: "bg-green-100 text-green-700 border-green-200",
    not_applicable: "bg-slate-100 text-slate-400 border-slate-200",
  }[item.status];

  return (
    <div className={`group flex gap-3 py-2.5 px-1 rounded-lg hover:bg-muted/30 transition-colors ${item.status === "not_applicable" ? "opacity-50" : ""}`}>
      {/* Priority dot */}
      <div className="flex flex-col items-center pt-0.5 shrink-0">
        <div
          className={`w-2 h-2 rounded-full mt-1 shrink-0 ${item.priority === "required" ? "bg-red-500" : "bg-gray-300"}`}
          title={item.priority === "required" ? "Required" : "Optional"}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {/* Status toggle */}
          <button
            onClick={cycleStatus}
            disabled={saving}
            className={`shrink-0 mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer transition-colors ${statusBg}`}
            title="Click to cycle: Pending → Received → N/A"
          >
            {saving ? "..." : STATUS_LABEL[item.status]}
          </button>

          {/* Item text */}
          <span className={`text-sm leading-snug flex-1 ${item.status === "received" ? "line-through text-muted-foreground" : ""}`}>
            {item.item_text}
          </span>
        </div>

        {/* Notes */}
        <div className="mt-1.5 ml-[52px]">
          {editingNotes ? (
            <div className="flex gap-2 items-end">
              <textarea
                autoFocus
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="flex-1 text-xs border rounded px-2 py-1 resize-none bg-background min-h-[48px]"
                placeholder="Add notes..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) saveNotes();
                  if (e.key === "Escape") setEditingNotes(false);
                }}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs" onClick={saveNotes}>Save</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingNotes(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="text-xs text-muted-foreground hover:text-foreground text-left w-full"
            >
              {notes ? (
                <span className="italic">{notes}</span>
              ) : (
                <span className="opacity-0 group-hover:opacity-60">+ Add note</span>
              )}
            </button>
          )}
        </div>

        {/* File */}
        <div className="mt-1 ml-[52px] flex items-center gap-2 flex-wrap">
          {item.file_name ? (
            <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-0.5">
              <FileText className="w-3 h-3 text-blue-600" />
              <a
                href={item.file_url!}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-blue-700 hover:underline max-w-[160px] truncate"
              >
                {item.file_name}
              </a>
              <ExternalLink className="w-3 h-3 text-blue-400" />
              <button onClick={removeFile} className="ml-1 text-blue-400 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="opacity-0 group-hover:opacity-70 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-opacity"
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
              {uploading ? "Uploading..." : "Attach file"}
            </button>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
        </div>
      </div>
    </div>
  );
}
