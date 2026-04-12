import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function TaskComments({ taskId }: { taskId: string }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ['task_comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select(`
          id, content, created_at,
          profiles!task_comments_user_id_fkey (id, full_name, avatar_url)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!taskId
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!profile) throw new Error("Not logged in");
      const { error } = await supabase.from('task_comments').insert({
        task_id: taskId,
        user_id: profile.id,
        content
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ['task_comments', taskId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add comment");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || addComment.isPending) return;
    addComment.mutate(comment.trim());
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1,2].map(i => (
               <div key={i} className="flex gap-3">
                 <div className="w-8 h-8 rounded-full bg-muted"></div>
                 <div className="flex-1 space-y-2">
                   <div className="h-4 bg-muted w-24 rounded"></div>
                   <div className="h-10 bg-muted w-full rounded"></div>
                 </div>
               </div>
            ))}
          </div>
        ) : comments?.length ? (
          comments.map((c: any) => (
            <div key={c.id} className="flex gap-3 text-sm">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {c.profiles?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.profiles?.full_name || 'Unknown User'}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg rounded-tl-none whitespace-pre-wrap leading-relaxed text-sm">
                  {c.content}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8 italic border border-dashed rounded-lg bg-card/50">
            No comments yet. Start the conversation!
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="relative mt-auto pt-4 border-t">
        <Textarea 
          placeholder="Add a comment..."
          className="min-h-[80px] resize-none pr-12 pb-4 text-sm"
          value={comment}
          onChange={e => setComment(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <Button 
          type="submit" 
          size="icon" 
          className="absolute bottom-3 right-3 h-8 w-8"
          disabled={!comment.trim() || addComment.isPending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
