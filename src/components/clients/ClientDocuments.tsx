import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Download, Trash2, FileText, FileImage, FileSpreadsheet, Film, Archive, File } from "lucide-react";
import { format } from "date-fns";

interface ClientDocumentsProps {
  clientId: string;
}

const BUCKET = "client-documents";
const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.csv,.mp4,.zip";
const MAX_SIZE_MB = 50;
const CATEGORIES = ["contract", "report", "creative", "other"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700",
  report: "bg-green-100 text-green-700",
  creative: "bg-purple-100 text-purple-700",
  other: "bg-gray-100 text-gray-700",
};

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

export function ClientDocuments({ clientId }: ClientDocumentsProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<typeof CATEGORIES[number]>("other");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
      return data;
    },
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = filterCategory === "all" ? documents : documents.filter((d: any) => d.category === filterCategory);

  const uploadFile = async (file: File) => {
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return;
    }

    setUploading(true);
    try {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });

      if (uploadError) {
        if (uploadError.message?.includes("bucket") || uploadError.message?.includes("not found")) {
          toast.error("Storage bucket not set up. Create 'client-documents' bucket in Supabase Dashboard > Storage.");
        } else {
          throw uploadError;
        }
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: dbError } = await supabase.from("client_documents").insert({
        client_id: clientId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        category: uploadCategory,
        uploaded_by: profile?.id || null,
      });

      if (dbError) throw dbError;

      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
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
      const pathMatch = fileUrl.match(/client-documents\/(.+)$/);
      if (pathMatch) await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
      const { error } = await supabase.from("client_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      toast.success("Document removed");
    },
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Upload as:</label>
          <Select value={uploadCategory} onValueChange={(v: any) => setUploadCategory(v)}>
            <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-xs text-muted-foreground">Filter:</label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All ({documents.length})</SelectItem>
              {CATEGORIES.map((c) => {
                const count = documents.filter((d: any) => d.category === c).length;
                return <SelectItem key={c} value={c} className="capitalize">{c} ({count})</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" multiple accept={ACCEPTED} className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        {uploading ? (
          <p className="text-sm text-muted-foreground animate-pulse">Uploading...</p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <Upload className="h-5 w-5 text-muted-foreground mb-1" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="text-xs text-muted-foreground">PDF, images, spreadsheets, docs — max {MAX_SIZE_MB}MB</p>
          </div>
        )}
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="h-20 bg-muted/20 animate-pulse rounded" />
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc: any) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card group hover:bg-muted/30 transition-colors">
              <div className="shrink-0">{getFileIcon(doc.file_type)}</div>
              {doc.file_type?.includes("image") && (
                <img src={doc.file_url} alt={doc.file_name} className="h-10 w-10 rounded object-cover border shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <a href={doc.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:text-primary truncate block">
                  {doc.file_name}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge className={`text-[10px] py-0 px-1.5 capitalize ${CATEGORY_COLORS[doc.category]}`}>{doc.category}</Badge>
                  <span className="text-xs text-muted-foreground">{doc.file_size ? formatBytes(doc.file_size) : ""} · {format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a href={doc.file_url} target="_blank" rel="noreferrer" download>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Download className="h-3.5 w-3.5" /></Button>
                </a>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500"
                  onClick={() => deleteMutation.mutate({ id: doc.id, fileUrl: doc.file_url })}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
