import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, MoreVertical, Edit2, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function TeamPage() {
  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (error) throw error;

      // Get task counts per profile
      const { data: tasks } = await supabase
        .from('tasks')
        .select('assigned_to, status');

      return (data || []).map((profile: any) => {
        const myTasks = (tasks || []).filter(t => t.assigned_to === profile.id);
        const completed = myTasks.filter(t => t.status === 'completed').length;
        const assigned = myTasks.length;
        const utilRate = assigned > 0 ? (assigned / 30) * 100 : 0;
        
        return {
          ...profile,
          metrics: {
            assigned,
            completed,
            completionRate: assigned === 0 ? 100 : Math.round((completed / assigned) * 100),
            utilization: Math.round(utilRate)
          }
        };
      });
    }
  });

  const getUtilColor = (util: number) => {
    if (util > 100) return "bg-red-500 [&>div]:bg-red-500";
    if (util > 80) return "bg-orange-500 [&>div]:bg-orange-500";
    return "bg-green-500 [&>div]:bg-green-500";
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">Manage team members, roles, and capacity utilization.</p>
        </div>
        <div className="flex items-center gap-3">
          <InviteMemberModal />
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search team..." className="pl-8" />
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl border animate-pulse bg-muted/20" />
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Tasks (MTD)</TableHead>
                <TableHead className="w-[200px]">Utilization</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers?.map((member: any) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {member.full_name?.substring(0, 2).toUpperCase() || 'NA'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{member.full_name || 'Unnamed User'}</span>
                        <span className="text-xs text-muted-foreground capitalize">{member.role?.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs uppercase bg-muted/50 tracking-wider">
                      {member.role?.replace('_', ' ') || 'Team Member'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{member.metrics.completed} / {member.metrics.assigned}</span>
                      <span className="text-xs text-muted-foreground">{member.metrics.completionRate}% completion</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                       <div className="flex items-center justify-between text-xs">
                         <span className="font-medium">{member.metrics.utilization}%</span>
                       </div>
                       <Progress value={Math.min(member.metrics.utilization, 100)} className={`h-2 ${getUtilColor(member.metrics.utilization)}`} />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2">
                          <Edit2 className="w-4 h-4" /> Edit Profile
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {teamMembers?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No team members found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
