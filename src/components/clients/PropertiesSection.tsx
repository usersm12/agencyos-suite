import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Globe, Plus, Settings2, Trash2, Star, ExternalLink,
  Smartphone, Code2, LayoutGrid, Loader2, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

interface Property {
  id: string;
  name: string;
  url: string | null;
  property_type: string;
  is_primary: boolean;
  created_at: string;
}

interface PropertiesSectionProps {
  clientId: string;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  website: Globe,
  app: Smartphone,
  subdomain: Code2,
  other: LayoutGrid,
};

const TYPE_LABEL: Record<string, string> = {
  website: "Website",
  app: "App",
  subdomain: "Subdomain",
  other: "Other",
};

export function PropertiesSection({ clientId }: PropertiesSectionProps) {
  const { profile } = useAuth();
  const isTeamMember = profile?.role === "team_member";
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Form state for add/edit
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formType, setFormType] = useState("website");
  const [formPrimary, setFormPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: properties, isLoading } = useQuery<Property[]>({
    queryKey: ["properties", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_properties_for_client", {
        p_client_id: clientId,
      });
      if (error) throw error;
      return (data as Property[]) || [];
    },
  });

  function openAdd() {
    setFormName("");
    setFormUrl("");
    setFormType("website");
    setFormPrimary(false);
    setEditingProperty(null);
    setAddOpen(true);
  }

  function openEdit(prop: Property) {
    setFormName(prop.name);
    setFormUrl(prop.url || "");
    setFormType(prop.property_type);
    setFormPrimary(prop.is_primary);
    setEditingProperty(prop);
    setAddOpen(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error("Property name is required");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("upsert_property", {
        p_client_id: clientId,
        p_property_id: editingProperty?.id ?? null,
        p_name: formName.trim(),
        p_url: formUrl.trim() || null,
        p_property_type: formType,
        p_is_primary: formPrimary,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(editingProperty ? "Property updated" : "Property added");
      setAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["properties", clientId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save property");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.rpc("delete_property", {
        p_property_id: deletingId,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Property deleted");
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ["properties", clientId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete property");
    } finally {
      setDeleting(false);
    }
  }

  if (isLoading) {
    return <div className="h-32 rounded-xl border bg-muted/20 animate-pulse" />;
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Properties</h3>
          <p className="text-sm text-muted-foreground">
            Manage the websites, apps, and subdomains for this client.
          </p>
        </div>
        {!isTeamMember && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {properties?.map((prop) => {
          const Icon = TYPE_ICON[prop.property_type] || Globe;
          return (
            <div
              key={prop.id}
              className="group relative rounded-lg border bg-background hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/clients/${clientId}/properties/${prop.id}`)}
            >
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm truncate">{prop.name}</span>
                        {prop.is_primary && (
                          <Star className="w-3 h-3 text-amber-500 flex-shrink-0 fill-amber-500" />
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {TYPE_LABEL[prop.property_type] || prop.property_type}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {prop.url && (
                  <a
                    href={prop.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs text-primary hover:underline truncate"
                  >
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{prop.url}</span>
                  </a>
                )}
              </div>

              {!isTeamMember && (
                <div
                  className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => openEdit(prop)}
                  >
                    <Settings2 className="w-3 h-3" />
                  </Button>
                  {!prop.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 hover:text-destructive"
                      onClick={() => setDeletingId(prop.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {(!properties || properties.length === 0) && (
          <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
            No properties yet.
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingProperty ? "Edit Property" : "Add Property"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="Main Site"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>URL</Label>
              <Input
                placeholder="https://example.com"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="app">App</SelectItem>
                  <SelectItem value="subdomain">Subdomain</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formPrimary}
                onCheckedChange={setFormPrimary}
                disabled={editingProperty?.is_primary}
              />
              <div>
                <Label>Primary property</Label>
                <p className="text-xs text-muted-foreground">
                  Used as the default for tasks and reports
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingProperty ? "Save" : "Add Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this property?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the property and unlink all associated tasks,
              backlinks, and integrations. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
