import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, EyeOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function InviteMemberModal() {
  const { profile } = useAuth();
  const isManager = profile?.role === "manager";
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("team_member");
  // Client assignments (managers only)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Fetch manager's assigned clients (only relevant when caller is a manager)
  const { data: managerClients = [] } = useQuery({
    queryKey: ["manager-own-clients"],
    queryFn: async () => {
      if (!profile?.id) return [];
      // Get clients this manager is assigned to
      const { data, error } = await supabase
        .from("team_assignments")
        .select("client_id, clients(id, name)")
        .eq("user_id", profile.id);
      if (error) throw error;
      return (data || [])
        .map((row: any) => row.clients)
        .filter(Boolean)
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    },
    enabled: open && isManager,
  });

  const reset = () => {
    setFullName("");
    setEmail("");
    setPassword("");
    setRole("team_member");
    setSelectedClientIds([]);
    setShowPassword(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    setOpen(v);
  };

  const toggleClient = (clientId: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const body: Record<string, any> = {
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        // Managers: role is ignored server-side (forced to team_member)
        // Owners: role is used as-is
        role: isManager ? "team_member" : role,
      };

      // Pass selected clients for manager-created team members
      if (isManager && selectedClientIds.length > 0) {
        body.client_ids = selectedClientIds;
      }

      const { data, error } = await supabase.functions.invoke("create-user", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${fullName} added successfully — they can now log in with their credentials.`);
      setOpen(false);
      reset();
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
            {isManager
              ? "Create a team member login. They'll be assigned Team Member role and can sign in immediately."
              : "Create a login for a new team member. They can sign in immediately — no email confirmation required."}
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

          {/* Role — owners only; managers are locked to team_member */}
          {isManager ? (
            <div className="space-y-1.5">
              <Label>Role</Label>
              <div className="flex items-center h-10 px-3 rounded-[10px] border border-border bg-muted/40 text-sm text-muted-foreground">
                Team Member
              </div>
              <p className="text-xs text-muted-foreground">
                Managers can only invite team members.
              </p>
            </div>
          ) : (
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
          )}

          {/* Client assignments — managers only */}
          {isManager && (
            <div className="space-y-2">
              <Label>Assign to Clients</Label>
              {managerClients.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  You have no assigned clients to share.
                </p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border/60 max-h-44 overflow-y-auto">
                  {managerClients.map((client: any) => (
                    <label
                      key={client.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedClientIds.includes(client.id)}
                        onCheckedChange={() => toggleClient(client.id)}
                        disabled={loading}
                      />
                      <span className="text-sm">{client.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The new team member will be assigned to the selected clients immediately.
              </p>
            </div>
          )}

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
