import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    const callerRole = callerProfile?.role;

    // Only owners and managers can reset passwords
    if (callerRole !== "owner" && callerRole !== "manager") {
      return json({ error: "Forbidden: only owners and managers can reset passwords" }, 403);
    }

    const { target_user_id, new_password } = await req.json();

    if (!target_user_id || !new_password) {
      return json({ error: "Missing target_user_id or new_password" }, 400);
    }
    if (new_password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Managers can only reset passwords for team_members — not managers or owners
    if (callerRole === "manager") {
      const { data: targetProfile } = await callerClient
        .from("profiles")
        .select("role")
        .eq("user_id", target_user_id)
        .single();

      if (targetProfile?.role !== "team_member") {
        return json({ error: "Managers can only reset passwords for team members" }, 403);
      }
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await adminClient.auth.admin.updateUserById(target_user_id, {
      password: new_password,
    });

    if (error) return json({ error: error.message }, 500);

    return json({ success: true });
  } catch (err: any) {
    return json({ error: err.message ?? "Unexpected error" }, 500);
  }
});
