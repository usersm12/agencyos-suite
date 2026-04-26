import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, AtSign, UserPlus, AlertTriangle, ListTodo, Clock4, ShieldCheck, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export function NotificationBell() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(25);
      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  });

  const list = notifications as any[];
  const unreadCount = list.filter((n) => !n.seen).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!profile) return;
      await supabase
        .from("notifications")
        .update({ seen: true })
        .eq("user_id", profile.id)
        .eq("seen", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markOne = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ seen: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const handleClick = (n: any) => {
    if (!n.seen) markOne.mutate(n.id);
    if (n.task_id) navigate(`/tasks?open=${n.task_id}`);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "mention":
        return <AtSign className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
      case "task_assigned":
        return <UserPlus className="w-3.5 h-3.5 text-green-500 shrink-0" />;
      case "subtask_assigned":
        return <ListTodo className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
      case "task_overdue":
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case "approval_requested":
      case "subtask_approval_requested":
        return <Clock4 className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case "task_approved":
      case "subtask_approved":
        return <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />;
      case "task_rejected":
      case "subtask_rejected":
        return <ShieldX className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-0.5 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                ({unreadCount} new)
              </span>
            )}
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground px-2"
              onClick={(e) => { e.preventDefault(); markAllRead.mutate(); }}
            >
              <CheckCheck className="w-3 h-3" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-[360px] overflow-y-auto">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Bell className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            list.map((n) => (
              <button
                key={n.id}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                  !n.seen ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
                onClick={() => handleClick(n)}
              >
                <div className="mt-0.5">{typeIcon(n.type)}</div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs leading-snug ${
                      !n.seen ? "font-semibold text-foreground" : "font-medium text-foreground/80"
                    }`}
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {n.body}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {format(new Date(n.created_at), "MMM d, h:mm a")}
                  </p>
                </div>
                {!n.seen && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
