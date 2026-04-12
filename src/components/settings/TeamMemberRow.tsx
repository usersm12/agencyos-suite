
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TeamMemberRow({ member }: { member: any }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newRole: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole as "owner" | "manager" | "team_member" })
        .eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-team'] });
      toast.success("Role updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile");
    }
  });

  return (
    <tr className="bg-card">
      <td className="px-4 py-3 text-sm flex items-center gap-3 border-b-0 border-t-0">
        <Avatar className="h-8 w-8">
           <AvatarFallback className="text-[10px]">{member.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-semibold">{member.full_name}</span>
          <span className="text-xs text-muted-foreground">Joined {new Date(member.created_at).toLocaleDateString()}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <Select value={member.role} onValueChange={(val) => updateMutation.mutate(val)}>
           <SelectTrigger className="h-8 text-xs w-[140px] uppercase">
             <SelectValue />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="owner">OWNER</SelectItem>
             <SelectItem value="manager">MANAGER</SelectItem>
             <SelectItem value="team_member">TEAM MEMBER</SelectItem>
           </SelectContent>
        </Select>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{member.role?.replace('_', ' ')}</td>
    </tr>
  );
}
