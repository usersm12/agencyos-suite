import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function InviteMemberModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("team_member");
    setShowPassword(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: { email: email.trim(), password, full_name: fullName.trim(), role },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${fullName} added successfully — they can now log in with their credentials.`);
      setOpen(false);
      reset();
      // Refresh team lists
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["settings-team"] });
      queryClient.invalidateQueries({ queryKey: ["profiles-list"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Team Member
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add Team Member
          </DialogTitle>
          <DialogDescription>
            Create a login for a new team member. They can sign in immediately with the credentials you set here — no email confirmation required.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              placeholder="Jane Smith"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@youragency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">Password *</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share these credentials with the team member directly.
            </p>
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Role *</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="team_member">Team Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              <UserPlus className="w-4 h-4" />
              {loading ? "Creating…" : "Create & Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
