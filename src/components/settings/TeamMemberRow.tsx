import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function TeamMemberRow({ member }: { member: any }) {
  const queryClient = useQueryClient();
  const [capacity, setCapacity] = useState(String(member.capacity || 0));

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<any>) => {
      const { error } = await supabase.from('profiles').update(updates).eq('id', member.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-team'] });
      toast.success("Profile updated");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile");
    }
  });

  const handleRoleChange = (newRole: string) => {
    updateMutation.mutate({ role: newRole });
  };

  const handleActiveToggle = (active: boolean) => {
    updateMutation.mutate({ active });
  };

  const handleCapacityBlur = () => {
    const num = parseInt(capacity, 10);
    if (!isNaN(num) && num !== member.capacity) {
      updateMutation.mutate({ capacity: num });
    }
  };

  return (
    <tr className={!member.active ? "opacity-50 grayscale bg-muted/20" : "bg-card"}>
      <td className="px-4 py-3 text-sm flex items-center gap-3 border-b-0 border-t-0">
        <Avatar className="h-8 w-8">
           <AvatarFallback className="text-[10px]">{member.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="font-semibold">{member.full_name}</span>
          <span className="text-xs text-muted-foreground">{member.email || 'No email onboarded'}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <Select value={member.role} onValueChange={handleRoleChange}>
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
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2 max-w-[120px]">
          <Input 
             type="number" 
             className="h-8 w-16" 
             value={capacity} 
             onChange={(e) => setCapacity(e.target.value)}
             onBlur={handleCapacityBlur}
          />
          <span className="text-xs text-muted-foreground leading-none">MTD</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{member.profiles?.full_name || 'Owner'}</td>
      <td className="px-4 py-3 text-sm text-right">
         <Switch 
            checked={member.active} 
            onCheckedChange={handleActiveToggle}
            title={member.active ? "Deactivate" : "Activate"}
         />
      </td>
    </tr>
  );
}
