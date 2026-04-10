import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Paperclip, Send, CheckCircle2, Link as LinkIcon, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface TaskDetailPanelProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailPanel({ taskId, onClose }: TaskDetailPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          clients (name),
          services (name),
          profiles!tasks_assigned_to_fkey (full_name)
        `)
        .eq('id', taskId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });

  const { data: comments } = useQuery({
    queryKey: ['task_comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          *,
          profiles (full_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });

  const handleStatusChange = async (newStatus: string) => {
    if (!taskId) return;
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
      if (error) throw error;
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ['tasks-list'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const submitComment = async () => {
    if (!comment.trim() || !taskId || !user) return;
    
    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        profile_id: user.id,
        content: comment.trim()
      });
      
      if (error) throw error;
      setComment("");
      toast.success("Comment added");
      queryClient.invalidateQueries({ queryKey: ['task_comments', taskId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add comment");
    }
  };

  if (!taskId) return null;

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto outline-none">
        {isLoading ? (
          <div className="space-y-4 animate-pulse mt-6">
             <div className="h-8 bg-muted rounded w-3/4"></div>
             <div className="h-4 bg-muted rounded w-1/4"></div>
             <div className="h-64 bg-muted rounded w-full mt-8"></div>
          </div>
        ) : task ? (
          <>
            <SheetHeader className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{task.clients?.name}</span>
                    <span className="text-xs text-muted-foreground">&bull;</span>
                    <span className="text-xs text-muted-foreground">{task.services?.name || 'General'}</span>
                  </div>
                  <SheetTitle className="text-2xl leading-tight">{task.title}</SheetTitle>
                </div>
              </div>
            </SheetHeader>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 bg-muted/30 p-4 rounded-lg border">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <Select value={task.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="h-8 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Priority</p>
                <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}>
                  {task.priority?.toUpperCase() || 'MEDIUM'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Due Date</p>
                <div className="flex items-center text-sm font-medium">
                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assignee</p>
                <div className="flex items-center gap-2">
                  {task.profiles?.full_name ? (
                     <>
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {task.profiles.full_name.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[80px]">{task.profiles.full_name}</span>
                     </>
                  ) : <span className="text-sm italic">Unassigned</span>}
                </div>
              </div>
            </div>

            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="details">Details & Deliverables</TabsTrigger>
                <TabsTrigger value="comments">Comments ({comments?.length || 0})</TabsTrigger>
                <TabsTrigger value="backlinks">Backlink Log</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Description / Notes</h4>
                  <div className="bg-muted/10 border rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {task.description || "No description provided."}
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="flex items-center gap-2 text-md font-semibold mb-4">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    Deliverables Record
                  </h4>
                  <div className="grid gap-4">
                     {/* MOCK DELIVERABLE FORM - Real integration parses `task_deliverables` */}
                     {(task.services?.name?.toLowerCase().includes('seo') || true) && (
                       <div className="space-y-4 rounded-xl border p-4 bg-card">
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <Label>Keywords Updated</Label>
                             <Input type="number" placeholder="Count" />
                           </div>
                           <div className="space-y-2">
                             <Label>Content Published (URLs)</Label>
                             <Input placeholder="List URLs..." />
                           </div>
                         </div>
                         <Button variant="outline" className="w-full text-xs" size="sm">Save SEO Deliverables</Button>
                       </div>
                     )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="relative h-[450px] flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {comments?.map((comment: any) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-8 h-8 mt-1">
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {comment.profiles?.full_name?.substring(0,2).toUpperCase() || 'UN'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted/30 border rounded-xl p-3 flex-1 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-semibold">{comment.profiles?.full_name || 'User'}</span>
                          <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), 'MMM d, h:mm a')}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments?.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                      <p className="text-sm">No comments yet</p>
                    </div>
                  )}
                </div>
                <div className="mt-auto border-t pt-4">
                  <div className="flex items-end gap-2">
                    <Textarea 
                      placeholder="Add a comment..." 
                      className="min-h-[80px] resize-none"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          submitComment();
                        }
                      }}
                    />
                    <Button size="icon" className="mb-1" onClick={submitComment} disabled={!comment.trim()}>
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="backlinks">
                <div className="rounded-xl border border-dashed flex flex-col items-center justify-center h-64 bg-card/50">
                  <LinkIcon className="w-8 h-8 mb-3 text-muted-foreground opacity-50" />
                  <h3 className="font-medium">Backlink Log</h3>
                  <p className="text-sm text-muted-foreground mt-1">Specific to active SEO campaigns.</p>
                  <Button className="mt-4" size="sm" variant="outline">Add Entry</Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
