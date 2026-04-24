import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";
import { InviteMemberModal } from "@/components/team/InviteMemberModal";
import { EditProfileModal } from "@/components/team/EditProfileModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, MoreVertical, Edit2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function TeamPage() {
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }); // newest first

      if (error) throw error;

      // Get task counts per profile
      const { data: tasks } = await supabase
        .from('tasks')
        .select('assigned_to, status');

      return (data || []).map((profile: any) => {
        const myTasks = (tasks || []).filter((t: any) => t.assigned_to === profile.id);
        const completed = myTasks.filter((t: any) => t.status === 'completed').length;
        const assigned = myTasks.length;
        const utilRate = assigned > 0 ? (assigned / 30) * 100 : 0;
        const isNew = differenceInDays(new Date(), new Date(profile.created_at)) <= 7;

        return {
          ...profile,
          isNew,
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

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "owner": return "border-purple-200 bg-purple-50 text-purple-700";
      case "manager": return "border-blue-200 bg-blue-50 text-blue-700";
      default: return "border-gray-200 bg-gray-50 text-gray-700";
    }
  };

  const filtered = teamMembers?.filter(m =>
    m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.role?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

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
          <Input
            type="search"
            placeholder="Search team..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member: any) => (
                <TableRow key={member.id}>
                  {/* Member name + email + "New" badge */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {member.full_name?.substring(0, 2).toUpperCase() || 'NA'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{member.full_name || 'Unnamed User'}</span>
                          {member.isNew && (
                            <Badge className="text-[10px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200">
                              New
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          {member.role?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className={`text-xs uppercase tracking-wider ${getRoleBadgeClass(member.role)}`}>
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

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(member.created_at).toLocaleDateString()}
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
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => setEditingMember(member)}
                        >
                          <Edit2 className="w-4 h-4" /> Edit Profile / Password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    {searchQuery ? "No members match your search." : "No team members found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {editingMember && (
        <EditProfileModal
          member={editingMember}
          open={!!editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}
