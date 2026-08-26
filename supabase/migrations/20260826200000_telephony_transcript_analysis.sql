-- Transcricao e analise por IA da ligacao.
--
-- A transcricao e capturada no navegador durante a chamada (Web Speech API) e
-- guardada aqui; a analise e gerada sob demanda a partir dela. Sao colunas
-- separadas de proposito: transcript e materia-prima e nunca muda, analysis e
-- derivada e pode ser regerada com outro prompt sem perder o original.

ALTER TABLE public.telephony_calls
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS transcript_source text,
  ADD COLUMN IF NOT EXISTS analysis jsonb,
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

ALTER TABLE public.telephony_calls
  DROP CONSTRAINT IF EXISTS telephony_calls_transcript_source_check;
ALTER TABLE public.telephony_calls
  ADD CONSTRAINT telephony_calls_transcript_source_check
  CHECK (transcript_source IS NULL OR transcript_source IN ('browser','provider','manual'));

-- Bucket privado das gravacoes. Audio nunca e servido direto: a rota
-- /api/telephony/calls/[id]/recording confere sessao e workspace antes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('call-recordings', 'call-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Leitura pelo membro do workspace, no padrao do bucket do WhatsApp: o primeiro
-- segmento do caminho e o id do workspace.
DROP POLICY IF EXISTS "call_recordings: workspace read" ON storage.objects;
CREATE POLICY "call_recordings: workspace read" ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'call-recordings'
    AND (storage.foldername(name))[1] IN (SELECT my_workspace_ids()::text)
  );
