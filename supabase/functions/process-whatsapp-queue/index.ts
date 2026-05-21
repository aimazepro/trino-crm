import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

Deno.serve(async () => {
  const { data: items, error } = await supabase
    .from("automation_whatsapp_queue")
    .select("*")
    .eq("status", "pending")
    .limit(50);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!items || items.length === 0) return new Response(JSON.stringify({ processed: 0 }));

  let processed = 0;
  for (const item of items) {
    try {
      const body = item.template_id
        ? {
            messaging_product: "whatsapp",
            to: item.phone,
            type: "template",
            template: { name: item.template_id, language: { code: "pt_BR" } },
          }
        : {
            messaging_product: "whatsapp",
            to: item.phone,
            type: "text",
            text: { body: item.message },
          };

      const res = await fetch(
        `https://graph.facebook.com/v18.0/${WA_PHONE_ID}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (res.ok) {
        await supabase.from("automation_whatsapp_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);
        processed++;
      } else {
        const err = await res.text();
        await supabase.from("automation_whatsapp_queue")
          .update({ status: "failed", error: err })
          .eq("id", item.id);
      }
    } catch (e) {
      await supabase.from("automation_whatsapp_queue")
        .update({ status: "failed", error: String(e) })
        .eq("id", item.id);
    }
  }

  return new Response(JSON.stringify({ processed }));
});
