// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_EMAIL       = Deno.env.get("VAPID_EMAIL") ?? "mailto:admin@agencyos.app";

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { user_ids, title, body, url } = await req.json() as {
      user_ids: string[];
      title: string;
      body: string;
      url?: string;
    };

    if (!user_ids?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .in("user_id", user_ids);

    if (!subs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    const payload = JSON.stringify({ title, body, url: url ?? "/" });
    const stale: string[] = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          // 410 Gone / 404 = subscription expired, clean up
          if (err.statusCode === 410 || err.statusCode === 404) {
            stale.push(s.endpoint);
          } else {
            console.error("webpush error:", err.message);
          }
        }
      }),
    );

    if (stale.length) {
      await supabase.from("push_subscriptions").delete().in("endpoint", stale);
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    console.error("push-notify error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
