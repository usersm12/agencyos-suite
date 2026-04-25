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

    // Owners AND managers can create users
    const { data: callerProfile } = await callerClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", callerUser.id)
      .single();

    const callerRole = callerProfile?.role;

    if (callerRole !== "owner" && callerRole !== "manager") {
      return json({ error: "Forbidden: only owners and managers can add team members" }, 403);
    }

    // Parse request body
    const { email, password, full_name, role, client_ids } = await req.json();

    if (!email || !password || !full_name) {
      return json({ error: "email, password and full_name are required" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Role enforcement:
    //  - Managers can ONLY create team_members (ignore whatever role they pass)
    //  - Owners can create any valid role
    let assignedRole: string;
    if (callerRole === "manager") {
      assignedRole = "team_member";
    } else {
      const validRoles = ["owner", "manager", "team_member"];
      assignedRole = validRoles.includes(role) ? role : "team_member";
    }

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

    const newAuthId = newUser.user.id;

    // If client_ids were provided (manager assigning new member to their clients),
    // look up the new user's profile id and create team_assignment rows.
    if (Array.isArray(client_ids) && client_ids.length > 0) {
      // Wait briefly for the handle_new_user trigger to create the profile
      await new Promise((r) => setTimeout(r, 500));

      const { data: newProfile } = await adminClient
        .from("profiles")
        .select("id")
        .eq("user_id", newAuthId)
        .single();

      if (newProfile?.id) {
        const assignments = client_ids.map((cid: string) => ({
          user_id: newProfile.id,
          client_id: cid,
        }));

        // Insert, ignore duplicates
        await adminClient
          .from("team_assignments")
          .upsert(assignments, { onConflict: "user_id,client_id", ignoreDuplicates: true });
      }
    }

    return json({ success: true, user_id: newAuthId });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
