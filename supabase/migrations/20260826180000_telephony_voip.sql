-- ---------------------------------------------------------------------------
-- Telefonia / VoIP (Fase 4b do backlog)
--
-- Modelo: uma conta de provedor por workspace, um ramal por usuario, CDR
-- proprio e um ledger append-only que e a fonte da verdade do dinheiro.
--
-- Principio: a duracao faturavel vem SEMPRE do CDR do provedor, nunca do
-- cronometro do navegador. O debito acontece dentro de telephony_finalize_call,
-- numa transacao unica, com chave de idempotencia derivada do id da chamada no
-- provedor. Webhook reentregue nao cobra duas vezes -- quem garante isso e a
-- constraint UNIQUE em telephony_ledger.idempotency_key, nao a aplicacao.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Contas: credenciais do provedor. Tabela trancada, igual whatsapp_connections:
-- RLS ligada com zero policies + REVOKE, entao so a service role enxerga.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_accounts (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             uuid NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider                 text NOT NULL DEFAULT 'mock',
  provider_account_id      text,
  credentials_encrypted    text,          -- via src/lib/token-crypto.ts
  status                   text NOT NULL DEFAULT 'inactive',
  caller_id                text,
  webhook_secret           text NOT NULL,
  recording_enabled        boolean NOT NULL DEFAULT true,
  recording_retention_days integer NOT NULL DEFAULT 180,
  consent_mode             text NOT NULL DEFAULT 'announce',
  consent_text             text NOT NULL DEFAULT 'Esta ligacao podera ser gravada para fins de qualidade e treinamento.',
  bill_increment_seconds   integer NOT NULL DEFAULT 60,
  minimum_billable_seconds integer NOT NULL DEFAULT 0,
  last_error               text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_accounts_status_check
    CHECK (status IN ('inactive','provisioning','active','suspended')),
  CONSTRAINT telephony_accounts_consent_check
    CHECK (consent_mode IN ('announce','manual','off')),
  CONSTRAINT telephony_accounts_increment_check
    CHECK (bill_increment_seconds > 0 AND minimum_billable_seconds >= 0)
);

ALTER TABLE public.telephony_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telephony_accounts FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ramais: um por usuario dentro do workspace. Guarda senha SIP, entao tambem
-- fica trancada -- a UI le por rota de API com service role.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_extensions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  extension              text NOT NULL,
  provider_credential_id text,
  sip_username           text,
  sip_password_encrypted text,
  sip_server             text,
  mode                   text NOT NULL DEFAULT 'per_minute',
  dial_mode              text NOT NULL DEFAULT 'webphone',
  callback_number        text,
  status                 text NOT NULL DEFAULT 'active',
  linked_by              uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at              timestamptz NOT NULL DEFAULT now(),
  last_error             text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_extensions_mode_check      CHECK (mode IN ('unlimited','per_minute')),
  CONSTRAINT telephony_extensions_dial_mode_check CHECK (dial_mode IN ('webphone','callback')),
  CONSTRAINT telephony_extensions_status_check    CHECK (status IN ('active','disabled')),
  CONSTRAINT telephony_extensions_user_unique     UNIQUE (workspace_id, user_id),
  CONSTRAINT telephony_extensions_number_unique   UNIQUE (workspace_id, extension)
);

ALTER TABLE public.telephony_extensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telephony_extensions FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tarifas. Guardar custo E preco separados e o que torna a margem mensuravel
-- por workspace em vez de um chute. workspace_id nulo = tabela padrao global.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_rates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  destination_type      text NOT NULL,
  cost_cents_per_minute integer NOT NULL DEFAULT 0,
  price_cents_per_minute integer NOT NULL,
  effective_from        timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_rates_dest_check
    CHECK (destination_type IN ('mobile','landline','tollfree','international')),
  CONSTRAINT telephony_rates_price_check CHECK (price_cents_per_minute >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS telephony_rates_global_unique
  ON public.telephony_rates (destination_type, effective_from)
  WHERE workspace_id IS NULL;
CREATE INDEX IF NOT EXISTS telephony_rates_ws_idx
  ON public.telephony_rates (workspace_id, destination_type, effective_from DESC);

ALTER TABLE public.telephony_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telephony_rates: select" ON public.telephony_rates FOR SELECT
  USING (workspace_id IS NULL OR workspace_id IN (SELECT my_workspace_ids()));

-- Tarifa padrao: R$0,38/min celular, R$0,17/min fixo (o que o mockup do dono
-- ja anunciava). Custo fica zerado ate o contrato com o provedor existir.
INSERT INTO public.telephony_rates (workspace_id, destination_type, cost_cents_per_minute, price_cents_per_minute)
VALUES (NULL, 'mobile', 0, 38), (NULL, 'landline', 0, 17),
       (NULL, 'tollfree', 0, 0), (NULL, 'international', 0, 200)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Saldo materializado. O ledger continua sendo a verdade; este contador existe
-- para a checagem atomica na hora de discar e e reconciliavel a qualquer hora.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_balances (
  workspace_id   uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  balance_cents  bigint NOT NULL DEFAULT 0,
  reserved_cents bigint NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_balances_reserved_check CHECK (reserved_cents >= 0)
);

ALTER TABLE public.telephony_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telephony_balances: select" ON public.telephony_balances FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));

-- ---------------------------------------------------------------------------
-- CDR
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_calls (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  extension_id          uuid REFERENCES public.telephony_extensions(id) ON DELETE SET NULL,
  contact_id            uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id               uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  activity_id           uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  direction             text NOT NULL DEFAULT 'outbound',
  from_number           text,
  to_number             text NOT NULL,
  provider              text NOT NULL,
  provider_call_id      text,
  status                text NOT NULL DEFAULT 'queued',
  hangup_cause          text,
  started_at            timestamptz NOT NULL DEFAULT now(),
  answered_at           timestamptz,
  ended_at              timestamptz,
  duration_seconds      integer NOT NULL DEFAULT 0,
  billed_cents          bigint NOT NULL DEFAULT 0,
  rate_cents_per_minute integer NOT NULL DEFAULT 0,
  billing_mode          text NOT NULL DEFAULT 'per_minute',
  destination_type      text,
  reserved_cents        bigint NOT NULL DEFAULT 0,
  recording_status      text NOT NULL DEFAULT 'none',
  recording_key         text,
  recording_expires_at  timestamptz,
  consent_given         boolean NOT NULL DEFAULT false,
  disposition           text,
  notes                 text,
  script_id             uuid REFERENCES public.scripts(id) ON DELETE SET NULL,
  finalized_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_calls_direction_check CHECK (direction IN ('outbound','inbound')),
  CONSTRAINT telephony_calls_status_check
    CHECK (status IN ('queued','ringing','answered','completed','failed','no_answer','busy','canceled')),
  CONSTRAINT telephony_calls_recording_check
    CHECK (recording_status IN ('none','pending','stored','failed','deleted')),
  CONSTRAINT telephony_calls_billing_mode_check CHECK (billing_mode IN ('unlimited','per_minute')),
  CONSTRAINT telephony_calls_disposition_check
    CHECK (disposition IS NULL OR disposition IN
      ('atendeu','nao_atendeu','caixa_postal','numero_errado','reagendar','sem_interesse','ocupado'))
);

CREATE UNIQUE INDEX IF NOT EXISTS telephony_calls_provider_unique
  ON public.telephony_calls (provider, provider_call_id)
  WHERE provider_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telephony_calls_ws_started_idx
  ON public.telephony_calls (workspace_id, started_at DESC);
CREATE INDEX IF NOT EXISTS telephony_calls_deal_idx ON public.telephony_calls (deal_id)
  WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telephony_calls_contact_idx ON public.telephony_calls (contact_id)
  WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS telephony_calls_retention_idx
  ON public.telephony_calls (recording_expires_at)
  WHERE recording_status = 'stored';

ALTER TABLE public.telephony_calls ENABLE ROW LEVEL SECURITY;
-- Leitura para o workspace (é o que alimenta /ligacoes e o ranking de vendedor).
-- Escrita é exclusiva do servidor: nenhuma policy de insert/update/delete.
CREATE POLICY "telephony_calls: select" ON public.telephony_calls FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()));

-- ---------------------------------------------------------------------------
-- Ledger append-only. A UNIQUE em idempotency_key e o que impede cobranca dupla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_ledger (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind                text NOT NULL,
  amount_cents        bigint NOT NULL,
  balance_after_cents bigint NOT NULL,
  call_id             uuid REFERENCES public.telephony_calls(id) ON DELETE SET NULL,
  idempotency_key     text NOT NULL UNIQUE,
  description         text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telephony_ledger_kind_check
    CHECK (kind IN ('credit_purchase','call_debit','adjustment','refund'))
);

CREATE INDEX IF NOT EXISTS telephony_ledger_ws_idx
  ON public.telephony_ledger (workspace_id, created_at DESC);

ALTER TABLE public.telephony_ledger ENABLE ROW LEVEL SECURITY;
-- Extrato financeiro: so gestor/dono le.
CREATE POLICY "telephony_ledger: select" ON public.telephony_ledger FOR SELECT
  USING (workspace_id IN (SELECT my_workspace_ids()) AND (SELECT is_ws_manager(telephony_ledger.workspace_id)));

-- ---------------------------------------------------------------------------
-- Log cru de webhook: depurar evento fora de ordem e reprocessar sem risco.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telephony_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  call_id           uuid REFERENCES public.telephony_calls(id) ON DELETE SET NULL,
  provider          text NOT NULL,
  provider_event_id text NOT NULL,
  event_type        text NOT NULL,
  payload           jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  error             text,
  CONSTRAINT telephony_events_unique UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS telephony_events_call_idx ON public.telephony_events (call_id, received_at);

ALTER TABLE public.telephony_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telephony_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telephony_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS telephony_accounts_touch ON public.telephony_accounts;
CREATE TRIGGER telephony_accounts_touch BEFORE UPDATE ON public.telephony_accounts
  FOR EACH ROW EXECUTE FUNCTION public.telephony_touch_updated_at();
DROP TRIGGER IF EXISTS telephony_extensions_touch ON public.telephony_extensions;
CREATE TRIGGER telephony_extensions_touch BEFORE UPDATE ON public.telephony_extensions
  FOR EACH ROW EXECUTE FUNCTION public.telephony_touch_updated_at();
DROP TRIGGER IF EXISTS telephony_calls_touch ON public.telephony_calls;
CREATE TRIGGER telephony_calls_touch BEFORE UPDATE ON public.telephony_calls
  FOR EACH ROW EXECUTE FUNCTION public.telephony_touch_updated_at();
