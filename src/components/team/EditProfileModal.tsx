import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, User, KeyRound, Eye, EyeOff } from "lucide-react";

interface EditProfileModalProps {
  member: {
    id: string;          // profiles.id
    user_id: string;     // auth.users id — needed for password reset
    full_name: string | null;
    avatar_url: string | null;
    role: string;
  };
  open: boolean;
  onClose: () => void;
}

export function EditProfileModal({ member, open, onClose }: EditProfileModalProps) {
  const { profile: myProfile } = useAuth();
  const isCallerManager = myProfile?.role === "manager";
  const queryClient = useQueryClient();

  // Profile fields
  const [fullName, setFullName] = useState(member.full_name || "");
  const [role, setRole] = useState(member.role || "team_member");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    try {
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
      setSavingProfile(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword) {
      toast.error("Enter a new password");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-user-password", {
        body: {
          target_user_id: member.user_id,
          new_password: newPassword,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Password updated for ${member.full_name || "user"}`);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to set password");
    } finally {
      setSavingPassword(false);
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

          {/* ── Profile section ── */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter full name..."
                onKeyDown={(e) => e.key === "Enter" && handleSaveProfile()}
              />
            </div>

            {isCallerManager ? (
              /* Managers cannot change roles */
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="flex items-center h-10 px-3 rounded-[10px] border border-border bg-muted/40 text-sm text-muted-foreground capitalize">
                  {member.role.replace("_", " ")}
                </div>
                <p className="text-xs text-muted-foreground">Only owners can change roles.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveProfile} disabled={savingProfile} size="sm">
              {savingProfile && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Profile
            </Button>
          </div>

          <Separator />

          {/* ── Password reset section ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Reset Password</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>

            <Button
              onClick={handleSetPassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
              variant="outline"
              size="sm"
              className="w-full gap-2"
            >
              {savingPassword
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Setting password...</>
                : <><KeyRound className="w-4 h-4" /> Set Password</>
              }
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
