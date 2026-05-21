import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const { data: enrollments } = await supabase
    .from("sequence_enrollments")
    .select("*, sequences(*, sequence_steps(*))")
    .eq("status", "active");

  if (!enrollments || enrollments.length === 0) return new Response(JSON.stringify({ processed: 0 }));

  let processed = 0;
  const now = new Date();

  for (const enrollment of enrollments) {
    const seq = enrollment.sequences;
    if (!seq) continue;

    const steps = (seq.sequence_steps ?? []).sort(
      (a: any, b: any) => a.sort_order - b.sort_order
    );

    if (enrollment.current_step >= steps.length) {
      await supabase.from("sequence_enrollments")
        .update({ status: "completed", updated_at: now.toISOString() })
        .eq("id", enrollment.id);
      continue;
    }

    const step = steps[enrollment.current_step];
    const enrolledAt = new Date(enrollment.enrolled_at);
    const targetDate = new Date(enrolledAt.getTime() + step.day_offset * 86400000);

    if (now < targetDate) continue;

    try {
      if (step.step_type === "Email") {
        await supabase.from("automation_email_queue").insert({
          user_id: enrollment.user_id,
          deal_id: enrollment.deal_id,
          automation_id: enrollment.automation_id,
          to_email: null,
          subject: step.note ?? "Sequência de email",
          body: step.note ?? "",
          status: "pending",
        });
      } else if (step.step_type === "WhatsApp") {
        await supabase.from("automation_whatsapp_queue").insert({
          user_id: enrollment.user_id,
          deal_id: enrollment.deal_id,
          automation_id: enrollment.automation_id,
          phone: null,
          message: step.note ?? "",
          status: "pending",
        });
      } else {
        // Ligação, Tarefa, Reunião, Visita, Outros → create activity
        await supabase.from("activities").insert({
          user_id: enrollment.user_id,
          deal_id: enrollment.deal_id,
          type: step.step_type,
          title: step.note ?? step.step_type,
          date: targetDate.toISOString(),
          completed: false,
        });
      }

      const nextStep = enrollment.current_step + 1;
      const completed = nextStep >= steps.length;
      await supabase.from("sequence_enrollments")
        .update({
          current_step: nextStep,
          status: completed ? "completed" : "active",
          updated_at: now.toISOString(),
        })
        .eq("id", enrollment.id);

      processed++;
    } catch (e) {
      console.error("sequence step error", enrollment.id, e);
    }
  }

  return new Response(JSON.stringify({ processed }));
});
