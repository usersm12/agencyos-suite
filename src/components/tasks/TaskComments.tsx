import { useState, useRef } from "react";
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
  const [mentionDropdown, setMentionDropdown] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["task_comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select(
          "id, content, created_at, profiles!task_comments_user_id_fkey (id, full_name, avatar_url)"
        )
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!profile) throw new Error("Not logged in");

      const { data: newComment, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, user_id: profile.id, content })
        .select("id")
        .single();
      if (error) throw error;

      // Parse @mentions — match @Firstname Lastname or @Firstname
      const mentionRegex = /@([\w]+(?:\s[\w]+)?)/g;
      const rawMatches = [...content.matchAll(mentionRegex)];
      const mentionedNames = rawMatches.map((m) => m[1].toLowerCase());

      const mentionedProfiles = (profiles as any[]).filter((p: any) =>
        mentionedNames.some(
          (name) => p.full_name?.toLowerCase() === name
        )
      );

      if (mentionedProfiles.length > 0 && newComment) {
        // Insert mention records
        await supabase.from("comment_mentions").insert(
          mentionedProfiles.map((p: any) => ({
            comment_id: newComment.id,
            mentioned_user_id: p.id,
          }))
        );

        // Insert notification for each mentioned user (skip self)
        const notifInserts = mentionedProfiles
          .filter((p: any) => p.id !== profile.id)
          .map((p: any) => ({
            user_id: p.id,
            type: "mention",
            title: `${profile.full_name || "Someone"} mentioned you`,
            body: content.length > 100 ? content.substring(0, 100) + "…" : content,
            task_id: taskId,
            comment_id: newComment.id,
          }));

        if (notifInserts.length > 0) {
          await supabase.from("notifications").insert(notifInserts);
        }
      }
    },
    onSuccess: () => {
      setComment("");
      setMentionDropdown([]);
      queryClient.invalidateQueries({ queryKey: ["task_comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to add comment"),
  });

  // Detect @mention as user types
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setComment(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, cursorPos);
    // Match @ followed by non-whitespace chars (no spaces) from the cursor
    const mentionMatch = textBeforeCursor.match(/@(\S*)$/);

    if (mentionMatch) {
      const q = mentionMatch[1].toLowerCase();
      const matching = (profiles as any[])
        .filter(
          (p: any) =>
            p.full_name?.toLowerCase().includes(q) ||
            p.full_name?.toLowerCase().split(" ").some((part: string) => part.startsWith(q))
        )
        .slice(0, 6);
      setMentionDropdown(matching);
    } else {
      setMentionDropdown([]);
    }
  };

  const insertMention = (user: any) => {
    const cursorPos = textareaRef.current?.selectionStart ?? comment.length;
    const textBefore = comment.substring(0, cursorPos);
    const textAfter = comment.substring(cursorPos);
    const atIdx = textBefore.lastIndexOf("@");
    const newText =
      comment.substring(0, atIdx) + `@${user.full_name} ` + textAfter;
    setComment(newText);
    setMentionDropdown([]);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = atIdx + user.full_name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  // Render comment text with @mentions highlighted
  const renderContent = (content: string) => {
    const profileNameSet = new Set(
      (profiles as any[]).map((p: any) => p.full_name?.toLowerCase())
    );
    // Split on @Word or @Word Word patterns
    const parts = content.split(/(@[\w]+(?:\s[\w]+)?)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (
            part.startsWith("@") &&
            profileNameSet.has(part.slice(1).toLowerCase())
          ) {
            return (
              <span
                key={i}
                className="text-blue-600 font-semibold bg-blue-50 dark:bg-blue-900/20 rounded px-0.5"
              >
                {part}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || addComment.isPending) return;
    addComment.mutate(comment.trim());
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Comments list */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted w-24 rounded" />
                  <div className="h-10 bg-muted w-full rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : comments?.length ? (
          comments.map((c: any) => (
            <div key={c.id} className="flex gap-3 text-sm">
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {c.profiles?.full_name?.substring(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {c.profiles?.full_name || "Unknown"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), "MMM d, h:mm a")}
                  </span>
                </div>
                <div className="p-3 bg-muted/40 rounded-lg rounded-tl-none whitespace-pre-wrap leading-relaxed text-sm">
                  {renderContent(c.content)}
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

      {/* Compose area */}
      <form onSubmit={handleSubmit} className="relative mt-auto pt-4 border-t">
        {/* @mention dropdown — positioned above the textarea */}
        {mentionDropdown.length > 0 && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
            <p className="text-[10px] text-muted-foreground px-3 pt-2 pb-1 font-medium uppercase tracking-wider">
              Mention someone
            </p>
            {mentionDropdown.map((user: any) => (
              <button
                key={user.id}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(user);
                }}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {user.full_name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{user.full_name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
            ref={textareaRef}
            placeholder="Add a comment… type @ to mention someone"
            className="min-h-[80px] resize-none pr-12 pb-4 text-sm"
            value={comment}
            onChange={handleCommentChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setMentionDropdown([]);
                return;
              }
              // Submit on Enter (unless dropdown is open or Shift is held)
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                mentionDropdown.length === 0
              ) {
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
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Enter to send · Shift+Enter for new line · @ to mention
        </p>
      </form>
    </div>
  );
}
