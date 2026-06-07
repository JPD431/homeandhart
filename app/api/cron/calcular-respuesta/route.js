import { createClient } from "@supabase/supabase-js";

// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tiempo_respuesta_horas numeric;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge_respuesta text;

const DAY_MS = 24 * 60 * 60 * 1000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function computeBadge(avgHours, hasData) {
  if (!hasData) {
    return { badge_respuesta: null, tiempo_respuesta_horas: null };
  }

  const hours = Math.round(avgHours * 10) / 10;

  if (avgHours < 1) {
    return { badge_respuesta: "rapido", tiempo_respuesta_horas: hours };
  }

  if (avgHours < 3) {
    return { badge_respuesta: "pocas_horas", tiempo_respuesta_horas: hours };
  }

  return { badge_respuesta: null, tiempo_respuesta_horas: hours };
}

function calcResponseTimes(messages, providerId) {
  const byConversation = {};

  for (const message of messages) {
    if (!byConversation[message.conversation_id]) {
      byConversation[message.conversation_id] = [];
    }
    byConversation[message.conversation_id].push(message);
  }

  const responseTimes = [];

  for (const convMessages of Object.values(byConversation)) {
    convMessages.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    for (let i = 0; i < convMessages.length; i += 1) {
      const incoming = convMessages[i];
      if (incoming.sender_id === providerId) continue;

      for (let j = i + 1; j < convMessages.length; j += 1) {
        const reply = convMessages[j];
        if (reply.sender_id !== providerId) continue;

        const diffMs =
          new Date(reply.created_at).getTime() - new Date(incoming.created_at).getTime();
        responseTimes.push(diffMs / (1000 * 60 * 60));
        break;
      }
    }
  }

  return responseTimes;
}

async function processProvider(providerId, sinceIso) {
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id")
    .or(`participant_a_id.eq.${providerId},participant_b_id.eq.${providerId}`);

  if (!conversations?.length) {
    return computeBadge(0, false);
  }

  const conversationIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, created_at")
    .in("conversation_id", conversationIds)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: true });

  const responseTimes = calcResponseTimes(messages ?? [], providerId);

  if (responseTimes.length === 0) {
    return computeBadge(0, false);
  }

  const avg =
    responseTimes.reduce((sum, hours) => sum + hours, 0) / responseTimes.length;

  return computeBadge(avg, true);
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sinceIso = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const { data: providers, error: providersError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "proveedor")
    .eq("verificado", true);

  if (providersError) {
    return Response.json({ error: providersError.message }, { status: 500 });
  }

  const stats = { processed: 0, rapido: 0, pocas_horas: 0, sin_badge: 0, errors: [] };

  for (const provider of providers ?? []) {
    try {
      const badgeData = await processProvider(provider.id, sinceIso);

      const { error: updateError } = await supabase
        .from("profiles")
        .update(badgeData)
        .eq("id", provider.id);

      if (updateError) {
        stats.errors.push(`${provider.id}:${updateError.message}`);
        continue;
      }

      stats.processed += 1;
      if (badgeData.badge_respuesta === "rapido") stats.rapido += 1;
      else if (badgeData.badge_respuesta === "pocas_horas") stats.pocas_horas += 1;
      else stats.sin_badge += 1;
    } catch (err) {
      stats.errors.push(`${provider.id}:${err.message}`);
    }
  }

  return Response.json({ success: true, stats });
}
