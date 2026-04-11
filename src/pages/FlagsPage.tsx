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
          clients (name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Sort: high priority first, then open before closed
      return (data || []).sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        return 0;
      });
    }
  });

  const filteredFlags = flags?.filter(f => 
    f.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleResolve = async () => {
    if (!resolvingFlag) return;
    try {
      const { error } = await supabase
        .from('flags')
        .update({
          status: 'resolved',
          description: resolvingFlag.description + (resolutionNote ? `\n\nResolution: ${resolutionNote}` : ''),
        })
        .eq('id', resolvingFlag.id);

      if (error) throw error;
      toast.success("Flag marked as resolved");
      setResolvingFlag(null);
      setResolutionNote("");
      queryClient.invalidateQueries({ queryKey: ['flags-list'] });
      queryClient.invalidateQueries({ queryKey: ['open-flags-count'] });
    } catch (err: any) {
      toast.error("Failed to resolve flag");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Flags</h1>
          <p className="text-muted-foreground mt-1">Monitor alerts, SLA breaches, and critical system warnings.</p>
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
                <TableHead>Priority</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="w-[30%]">Issue</TableHead>
                <TableHead>Time Open</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFlags?.map((flag) => (
                <TableRow key={flag.id} className={flag.status === 'resolved' ? "opacity-60 bg-muted/30" : ""}>
                  <TableCell>
                    <Badge variant={flag.priority === 'high' ? 'destructive' : 'secondary'} className="uppercase text-[10px] tracking-wider">
                      {flag.priority === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {flag.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold text-sm">{flag.clients?.name || 'System Wide'}</span>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{flag.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{flag.description}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {formatDistanceToNow(new Date(flag.created_at))}
                    </span>
                  </TableCell>
                  <TableCell>
                    {flag.status === 'resolved' ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ShieldCheck className="w-3 h-3 mr-1" /> Resolved
                      </Badge>
                    ) : (
                      <Badge variant="outline">Open</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {flag.status !== 'resolved' ? (
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
                    No flags found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!resolvingFlag} onOpenChange={(open) => !open && setResolvingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Flag</DialogTitle>
            <DialogDescription>
              Mark this issue as resolved. Optionally, leave a note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
             <div className="bg-destructive/10 p-3 rounded-lg border border-destructive/20 text-sm">
                <span className="font-semibold text-destructive uppercase text-xs">Issue:</span>
                <p className="mt-1 font-medium text-destructive">{resolvingFlag?.title}</p>
             </div>
             
             <div className="space-y-2">
               <Label>Resolution Note</Label>
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
