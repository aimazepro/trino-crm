# Por que não há `process-whatsapp-queue` aqui

A fila `automation_whatsapp_queue` é drenada por `POST /api/whatsapp/queue`
no app Next.js, não por uma Edge Function.

A função que existia aqui postava direto na Meta Cloud API — uma integração
que este CRM nunca teve credencial para usar, então toda mensagem automática
falhava. O envio real acontece pelo driver da Evolution
(`src/lib/whatsapp/`), que precisa do token da instância descriptografado, da
resolução de JID e do registro da mensagem na thread. Reimplementar isso em
Deno seria manter duas versões de "enviar um WhatsApp".

O agendamento continua no `pg_cron` (job 2), que agora chama a rota do app
com o service role key no `Authorization`.

A função antiga pode continuar publicada no projeto Supabase sem ser chamada.
Para removê-la de vez: `supabase functions delete process-whatsapp-queue`.
