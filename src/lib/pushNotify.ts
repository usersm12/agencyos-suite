import { supabase } from "@/integrations/supabase/client";

/**
 * Fire web push notifications to one or more profile IDs.
 * Called after any RPC that creates in-app notifications so recipients
 * also get an OS-level browser notification.
 *
 * Non-blocking — errors are logged but not thrown.
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  url = "/tasks",
): Promise<void> {
  if (!userIds.length) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/push-notify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ user_ids: userIds, title, body, url }),
      },
    );
  } catch (err) {
    console.warn("[push] Failed to send push notification:", err);
  }
}
