import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";

export function TeamAssignmentsSection({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ['team_assignments', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_assignments')
        .select(`
          id,
          user_id,
          profiles (
            id,
            full_name,
            role
          )
        `)
        .eq('client_id', clientId);
      if (error) throw error;
      return data || [];
    }
  });

  const { data: teamMembers } = useQuery({
    queryKey: ['available-team'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role');
      if (error) throw error;
      return data || [];
    }
  });

  const assignMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('team_assignments').insert({
        client_id: clientId,
        user_id: userId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_assignments', clientId] });
      toast.success("Team member assigned");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from('team_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_assignments', clientId] });
      toast.success("Team member removed");
    },
    onError: (err: any) => toast.error(err.message)
  });

  const assignedUserIds = assignments?.map(a => a.user_id) || [];
  const unassignedMembers = teamMembers?.filter(tm => !assignedUserIds.includes(tm.id)) || [];

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Assigned Team Members</h3>
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="h-4 w-4" /> Add Team Member
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="end">
            <Command>
              <CommandInput placeholder="Search team members..." />
              <CommandList>
                <CommandEmpty>No available team members found.</CommandEmpty>
                <CommandGroup>
                  {unassignedMembers.map((member) => (
                    <CommandItem
                      key={member.id}
                      onSelect={() => {
                        assignMutation.mutate(member.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                           <AvatarFallback className="text-[10px]">{member.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span>{member.full_name}</span>
                        <span className="text-xs text-muted-foreground ml-auto uppercase">{member.role?.replace('_', ' ')}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {loadingAssignments ? (
        <div className="flex gap-2"><div className="h-8 w-24 bg-muted animate-pulse rounded-full" /></div>
      ) : assignments && assignments.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {assignments.map((assignment) => (
            <Badge key={assignment.id} variant="secondary" className="pl-1 pr-2 py-1 gap-2 border shadow-sm flex items-center bg-background">
              <Avatar className="h-5 w-5">
                 <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{assignment.profiles?.full_name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-xs font-semibold">{assignment.profiles?.full_name}</span>
              </div>
              <button 
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors flex p-0.5 rounded-full hover:bg-muted"
                onClick={() => removeMutation.mutate(assignment.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No team members are explicitly assigned.</p>
      )}
    </div>
  );
}
