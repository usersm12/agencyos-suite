import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";

interface EditProfileModalProps {
  member: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  };
  open: boolean;
  onClose: () => void;
}

export function EditProfileModal({ member, open, onClose }: EditProfileModalProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(member.full_name || "");
  const [role, setRole] = useState(member.role || "team_member");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      // Use SECURITY DEFINER RPC to bypass RLS — works for both self-edit and owner editing others
      const { data: result, error } = await supabase.rpc("update_profile_by_id", {
        p_profile_id: member.id,
        p_full_name: fullName.trim(),
        p_role: role,
      });

      if (error) throw error;
      if (result !== "ok") throw new Error(result as string);

      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["settings-team"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" /> Edit Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Avatar preview */}
          <div className="flex justify-center">
            <Avatar className="h-16 w-16">
              <AvatarImage src={member.avatar_url || ""} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary font-bold">
                {fullName?.substring(0, 2).toUpperCase() || "??"}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter full name..."
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">
                  <div className="flex flex-col">
                    <span className="font-medium">Owner</span>
                    <span className="text-xs text-muted-foreground">Full access to all settings and clients</span>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex flex-col">
                    <span className="font-medium">Manager</span>
                    <span className="text-xs text-muted-foreground">Manages assigned clients and their tasks</span>
                  </div>
                </SelectItem>
                <SelectItem value="team_member">
                  <div className="flex flex-col">
                    <span className="font-medium">Team Member</span>
                    <span className="text-xs text-muted-foreground">Sees only tasks assigned to them</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
