import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, Upload, Download, Trash2, FileText, FileImage, FileSpreadsheet, Film, Archive, File } from "lucide-react";
import { format } from "date-fns";

interface TaskAttachmentsProps {
  taskId: string;
}

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.csv,.mp4,.zip";
const MAX_SIZE_MB = 50;
const BUCKET = "task-attachments";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return <File className="h-4 w-4 text-muted-foreground" />;
  if (fileType.includes("image")) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (fileType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (fileType.includes("sheet") || fileType.includes("excel") || fileType.includes("csv"))
    return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
  if (fileType.includes("video")) return <Film className="h-4 w-4 text-purple-500" />;
  if (fileType.includes("zip")) return <Archive className="h-4 w-4 text-yellow-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${taskId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        if (uploadError.message?.includes("bucket") || uploadError.message?.includes("not found")) {
          toast.error("Storage bucket not set up. Please create 'task-attachments' bucket in Supabase dashboard > Storage.");
        } else {
          throw uploadError;
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: dbError } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: profile?.id || null,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success(`${file.name} uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  };

  const deleteMutation = useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      // Extract storage path from URL
      const pathMatch = fileUrl.match(/task-attachments\/(.+)$/);
      if (pathMatch) {
        await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
      }
      const { error } = await supabase.from("task_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Attachment removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-sm flex-1">Attachments</h4>
        {attachments.length > 0 && (
          <Badge variant="secondary" className="text-xs">{attachments.length}</Badge>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors mb-3 ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Uploading...</p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, PNG, JPG, XLSX, DOCX, CSV, MP4, ZIP — max {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="h-12 bg-muted/20 animate-pulse rounded" />
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card group hover:bg-muted/30 transition-colors">
              <div className="shrink-0">{getFileIcon(att.file_type)}</div>

              {/* Image preview */}
              {att.file_type?.includes("image") && (
                <img src={att.file_url} alt={att.file_name} className="h-10 w-10 rounded object-cover border shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium hover:text-primary truncate block"
                  title={att.file_name}
                >
                  {att.file_name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {att.file_size ? formatBytes(att.file_size) : ""} · {format(new Date(att.created_at), "MMM d, yyyy")}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={att.file_url} target="_blank" rel="noreferrer" download>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </a>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-red-500"
                  onClick={() => deleteMutation.mutate({ id: att.id, fileUrl: att.file_url })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">No attachments yet.</p>
      )}
    </div>
  );
}
