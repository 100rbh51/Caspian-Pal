import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const authorization = req.headers.get("Authorization");
    const jwt = authorization?.replace(/^Bearer\\s+/i, "");
    const projectUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const liveKitUrl = Deno.env.get("LIVEKIT_URL");
    const liveKitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const liveKitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!jwt || !projectUrl || !anonKey || !serviceRoleKey) {
      return Response.json({ error: "Missing authentication configuration." }, { status: 401, headers: corsHeaders });
    }
    if (!liveKitUrl || !liveKitApiKey || !liveKitApiSecret) {
      return Response.json({ error: "LiveKit server secrets are not configured." }, { status: 500, headers: corsHeaders });
    }

    const admin = createClient(projectUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (authError || !authData.user) {
      return Response.json({ error: "Sign in is required to join a call." }, { status: 401, headers: corsHeaders });
    }

    const { callRoomId } = await req.json();
    if (typeof callRoomId !== "string") {
      return Response.json({ error: "A call room ID is required." }, { status: 400, headers: corsHeaders });
    }

    const { data: call, error: callError } = await admin
      .from("call_rooms")
      .select("id, caller_id, callee_id, room_name, status")
      .eq("id", callRoomId)
      .maybeSingle();

    if (callError || !call) {
      return Response.json({ error: "Call was not found." }, { status: 404, headers: corsHeaders });
    }
    if (![call.caller_id, call.callee_id].includes(authData.user.id)) {
      return Response.json({ error: "You are not a participant in this call." }, { status: 403, headers: corsHeaders });
    }
    if (!["ringing", "active"].includes(call.status)) {
      return Response.json({ error: "This call has already ended." }, { status: 409, headers: corsHeaders });
    }

    const token = new AccessToken(liveKitApiKey, liveKitApiSecret, {
      identity: authData.user.id,
      ttl: "1h",
    });
    token.addGrant({
      roomJoin: true,
      room: call.room_name,
      canPublish: true,
      canSubscribe: true,
    });

    return Response.json({
      participantToken: await token.toJwt(),
      serverUrl: liveKitUrl,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("LiveKit token error:", error);
    return Response.json({ error: "Unable to create a call token." }, { status: 500, headers: corsHeaders });
  }
});
