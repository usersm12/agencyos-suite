import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, ShieldCheck, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function FlagsPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvingFlag, setResolvingFlag] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const { data: flags, isLoading } = useQuery({
    queryKey: ['flags-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flags')
        .select(`
          *,
          clients (name),
          services (name),
          profiles!flags_assigned_manager_id_fkey (full_name)
        `)
        .order('severity', { ascending: true }) // assuming 'critical' sorts before 'warning' alphabetically, or we can sort later
        .order('triggered_date', { ascending: false });
      
      if (error) throw error;
      
      return data.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        return 0;
      });
    }
  });

  const filteredFlags = flags?.filter(f => 
    f.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleResolve = async () => {
    if (!resolvingFlag) return;
    try {
      const { error } = await supabase
        .from('flags')
        .update({
          resolved: true,
          resolved_date: new Date().toISOString(),
          resolved_note: resolutionNote
        })
        .eq('id', resolvingFlag.id);

      if (error) throw error;
      toast.success("Flag marked as resolved");
      setResolvingFlag(null);
      setResolutionNote("");
      queryClient.invalidateQueries({ queryKey: ['flags-list'] });
    } catch (err: any) {
      toast.error("Failed to resolve flag");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Flags</h1>
          <p className="text-muted-foreground mt-1">Monitor automated alerts, SLA breaches, and critical system warnings.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search" 
            placeholder="Search flags..." 
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
                <TableHead>Severity</TableHead>
                <TableHead>Client & Service</TableHead>
                <TableHead className="w-[30%]">Issue Description</TableHead>
                <TableHead>Time Open</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags?.map((flag) => (
                <TableRow key={flag.id} className={flag.resolved ? "opacity-60 bg-muted/30" : ""}>
                  <TableCell>
                    {flag.resolved ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Resolved
                      </Badge>
                    ) : (
                      <Badge variant={flag.severity === 'critical' ? 'destructive' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                        {flag.severity === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
                        {flag.severity || 'WARNING'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{flag.clients?.name || 'System Wide'}</span>
                      <span className="text-xs text-muted-foreground">{flag.services?.name || 'General Operation'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{flag.title || 'Automated System Flag'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{flag.description}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {flag.triggered_date ? formatDistanceToNow(new Date(flag.triggered_date)) : 'Unknown'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{flag.profiles?.full_name || 'Unassigned'}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {!flag.resolved ? (
                      <Button size="sm" variant="outline" onClick={() => setResolvingFlag(flag)}>
                        Resolve
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled className="text-green-600">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Closed
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredFlags?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No active flags found! Beautiful.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resolution Modal */}
      <Dialog open={!!resolvingFlag} onOpenChange={(open) => !open && setResolvingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>
              Mark this issue as resolved. Optionally, leave a note detailing the resolution for the permanent log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-sm">
                <span className="font-semibold text-destructive uppercase text-xs">Issue details:</span>
                <p className="mt-1 font-medium text-destructive">{resolvingFlag?.description}</p>
             </div>
             
             <div className="space-y-2">
               <Label>Resolution Actions Taken</Label>
               <Textarea 
                 placeholder="Describe what was done to fix this..." 
                 value={resolutionNote}
                 onChange={(e) => setResolutionNote(e.target.value)}
                 className="min-h-[100px]"
               />
             </div>
          </div>
          <div className="flex justify-end gap-3">
             <Button variant="outline" onClick={() => setResolvingFlag(null)}>Cancel</Button>
             <Button onClick={handleResolve}>Complete Resolution</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
