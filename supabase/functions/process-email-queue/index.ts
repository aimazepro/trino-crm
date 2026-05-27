import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: items, error } = await supabase.rpc("claim_pending_email_queue", { p_limit: 50 });

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!items || items.length === 0) return new Response(JSON.stringify({ processed: 0 }));

  let processed = 0;
  for (const item of items) {
    try {
      const { data: intRow } = await supabase
        .from("integrations")
        .select("access_token, refresh_token, expires_at, id")
        .eq("user_id", item.user_id)
        .eq("provider", "gmail")
        .eq("active", true)
        .maybeSingle();

      if (!intRow) {
        await supabase.from("automation_email_queue")
          .update({ status: "failed", error: "No active Gmail integration" })
          .eq("id", item.id);
        continue;
      }

      let token = intRow.access_token;

      if (intRow.expires_at && new Date(intRow.expires_at) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("GMAIL_OAUTH_CLIENT_ID")!,
            client_secret: Deno.env.get("GMAIL_OAUTH_CLIENT_SECRET")!,
            refresh_token: intRow.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          await supabase.from("integrations")
            .update({ access_token: token, expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString() })
            .eq("id", intRow.id);
        }
      }

      const raw = btoa(
        `To: ${item.to_email}\r\nSubject: ${item.subject}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${item.body}`
      ).replace(/\+/g, "-").replace(/\//g, "_");

      const gmailRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        }
      );

      if (gmailRes.ok) {
        await supabase.from("automation_email_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);
        processed++;
      } else {
        const err = await gmailRes.text();
        await supabase.from("automation_email_queue")
          .update({ status: "failed", error: err })
          .eq("id", item.id);
      }
    } catch (e) {
      await supabase.from("automation_email_queue")
        .update({ status: "failed", error: String(e) })
        .eq("id", item.id);
    }
  }

  return new Response(JSON.stringify({ processed }));
});
