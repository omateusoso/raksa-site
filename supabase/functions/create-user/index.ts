import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const protectedEmails = new Set(["davidraksa@live.com", "omateusosos@gmail.com"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function profilePayload(body: Record<string, unknown>, authUserId: string, requesterId: string) {
  const email = stringValue(body.email).toLowerCase();
  const role = stringValue(body.role) || "viewer";
  return {
    auth_user_id: authUserId,
    full_name: stringValue(body.full_name),
    display_name: stringValue(body.display_name) || stringValue(body.full_name),
    email,
    phone: stringValue(body.phone),
    whatsapp: stringValue(body.whatsapp),
    role,
    department: stringValue(body.department),
    hierarchy_level: numberValue(body.hierarchy_level, 10),
    access_level: stringValue(body.access_level) || role,
    employment_type: stringValue(body.employment_type),
    status: stringValue(body.status) || "pending",
    supervisor_id: stringValue(body.supervisor_id) || null,
    weekly_hours: numberValue(body.weekly_hours),
    internal_hourly_rate: numberValue(body.internal_hourly_rate),
    monthly_cost: numberValue(body.monthly_cost),
    productive_hours_goal: numberValue(body.productive_hours_goal),
    internal_notes: stringValue(body.internal_notes),
    created_by: requesterId,
    updated_by: requesterId,
  };
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Edge Function sem configuração de Supabase." }, 500);
  }

  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json({ error: "Sessão ausente." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requesterData, error: requesterError } = await userClient.auth.getUser();
  const requester = requesterData.user;
  if (requesterError || !requester) return json({ error: "Sessão inválida." }, 401);

  const requesterEmail = String(requester.email || "").toLowerCase();
  let canCreate = protectedEmails.has(requesterEmail);
  if (!canCreate) {
    const { data: requesterProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, access_level, hierarchy_level, status")
      .eq("auth_user_id", requester.id)
      .maybeSingle();

    if (profileError) return json({ error: profileError.message }, 500);
    canCreate = Boolean(
      requesterProfile?.status === "active" &&
        (requesterProfile.role === "super_admin" ||
          requesterProfile.access_level === "super_admin" ||
          requesterProfile.role === "admin" ||
          requesterProfile.access_level === "admin" ||
          Number(requesterProfile.hierarchy_level || 0) >= 90),
    );
  }

  if (!canCreate) return json({ error: "Permissão insuficiente para criar usuários." }, 403);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return json({ error: "Payload inválido." }, 400);
  const email = stringValue(body.email).toLowerCase();
  const fullName = stringValue(body.full_name);
  if (!email || !fullName) return json({ error: "Nome completo e e-mail são obrigatórios." }, 400);

  const existingProfile = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile.data) return json({ error: "Já existe um perfil com este e-mail." }, 409);
  if (existingProfile.error) return json({ error: existingProfile.error.message }, 500);

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      display_name: stringValue(body.display_name) || fullName,
    },
  });

  if (inviteError) {
    const message = /already|registered|exists/i.test(inviteError.message)
      ? "Já existe um usuário Auth com este e-mail."
      : inviteError.message;
    return json({ error: message }, /already|registered|exists/i.test(inviteError.message) ? 409 : 400);
  }

  const authUserId = inviteData.user?.id;
  if (!authUserId) return json({ error: "Supabase Auth não retornou o usuário criado." }, 500);

  const payload = profilePayload(body, authUserId, requester.id);
  if (protectedEmails.has(email)) {
    payload.role = "super_admin";
    payload.access_level = "super_admin";
    payload.hierarchy_level = 100;
    payload.status = "active";
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .insert(payload)
    .select("*")
    .single();

  if (profileError) return json({ error: profileError.message }, 500);
  return json({ profile });
});
