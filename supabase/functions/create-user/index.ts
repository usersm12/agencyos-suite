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
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser } } = await callerClient.auth.getUser();
    if (!callerUser) return json({ error: "Unauthorized" }, 401);

    // Only owners can create users
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("role")
      .eq("user_id", callerUser.id)
      .single();

    if (callerProfile?.role !== "owner") {
      return json({ error: "Forbidden: only owners can add team members" }, 403);
    }

    // Parse request body
    const { email, password, full_name, role } = await req.json();

    if (!email || !password || !full_name) {
      return json({ error: "email, password and full_name are required" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const validRoles = ["owner", "manager", "team_member"];
    const assignedRole = validRoles.includes(role) ? role : "team_member";

    // Use service role for admin operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user — email_confirm: true skips the confirmation email.
    // Pass role in user_metadata so the SECURITY DEFINER handle_new_user trigger
    // sets it directly during profile creation — avoids any RLS UPDATE check.
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role: assignedRole },
    });

    if (createError) {
      return json({ error: createError.message }, 400);
    }

    return json({ success: true, user_id: newUser.user.id });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
