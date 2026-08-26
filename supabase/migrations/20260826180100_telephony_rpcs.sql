-- ---------------------------------------------------------------------------
-- Telefonia: funcoes transacionais.
--
-- Toda mexida em dinheiro mora aqui. A regra e uma so: o navegador nunca cobra.
-- O debito acontece quando chega o CDR do provedor, dentro de uma transacao,
-- protegido por chave de idempotencia.
-- ---------------------------------------------------------------------------

-- Tarifa vigente: a do workspace tem prioridade sobre a global.
CREATE OR REPLACE FUNCTION public.telephony_current_rate(
  p_workspace_id uuid,
  p_destination_type text
) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT price_cents_per_minute FROM public.telephony_rates
   WHERE destination_type = p_destination_type
     AND effective_from <= now()
     AND (workspace_id = p_workspace_id OR workspace_id IS NULL)
   ORDER BY (workspace_id IS NOT NULL) DESC, effective_from DESC
   LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Abre a chamada: valida ramal, valida saldo, congela a tarifa e reserva o
-- custo de um minuto. Congelar a tarifa na linha da chamada e o que impede que
-- mudar de preco amanha reescreva o historico de cobranca de ontem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telephony_start_call(
  p_workspace_id     uuid,
  p_user_id          uuid,
  p_extension_id     uuid,
  p_provider         text,
  p_to_number        text,
  p_from_number      text,
  p_destination_type text,
  p_deal_id          uuid DEFAULT NULL,
  p_contact_id       uuid DEFAULT NULL,
  p_script_id        uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ext     public.telephony_extensions%ROWTYPE;
  v_rate    integer;
  v_reserve bigint;
  v_bal     public.telephony_balances%ROWTYPE;
  v_call_id uuid;
BEGIN
  SELECT * INTO v_ext FROM public.telephony_extensions
   WHERE id = p_extension_id AND workspace_id = p_workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'extension_not_found');
  END IF;
  IF v_ext.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'extension_disabled');
  END IF;

  v_rate := COALESCE(public.telephony_current_rate(p_workspace_id, p_destination_type), 0);

  -- Modo ilimitado ocupa vaga do plano e nao toca no saldo.
  IF v_ext.mode = 'per_minute' THEN
    v_reserve := v_rate;

    INSERT INTO public.telephony_balances (workspace_id) VALUES (p_workspace_id)
      ON CONFLICT (workspace_id) DO NOTHING;

    SELECT * INTO v_bal FROM public.telephony_balances
     WHERE workspace_id = p_workspace_id FOR UPDATE;

    IF (v_bal.balance_cents - v_bal.reserved_cents) < v_reserve THEN
      RETURN jsonb_build_object(
        'ok', false, 'reason', 'insufficient_balance',
        'balance_cents', v_bal.balance_cents,
        'required_cents', v_reserve);
    END IF;

    UPDATE public.telephony_balances
       SET reserved_cents = reserved_cents + v_reserve, updated_at = now()
     WHERE workspace_id = p_workspace_id;
  ELSE
    v_reserve := 0;
  END IF;

  INSERT INTO public.telephony_calls (
    workspace_id, user_id, extension_id, contact_id, deal_id, script_id,
    direction, from_number, to_number, provider, status,
    rate_cents_per_minute, billing_mode, destination_type, reserved_cents
  ) VALUES (
    p_workspace_id, p_user_id, p_extension_id, p_contact_id, p_deal_id, p_script_id,
    'outbound', p_from_number, p_to_number, p_provider, 'queued',
    v_rate, v_ext.mode, p_destination_type, v_reserve
  ) RETURNING id INTO v_call_id;

  RETURN jsonb_build_object(
    'ok', true, 'call_id', v_call_id,
    'rate_cents_per_minute', v_rate,
    'mode', v_ext.mode,
    'reserved_cents', v_reserve);
END;
$$;

-- Grava o id do provedor assim que a originacao responde.
CREATE OR REPLACE FUNCTION public.telephony_attach_provider_call(
  p_call_id uuid,
  p_provider_call_id text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.telephony_calls
     SET provider_call_id = p_provider_call_id, status = 'ringing'
   WHERE id = p_call_id AND provider_call_id IS NULL;
$$;

-- ---------------------------------------------------------------------------
-- Finaliza: atualiza o CDR, debita o ledger, solta a reserva e registra a
-- atividade na timeline. Tudo numa transacao. Reentrega de webhook cai na
-- UNIQUE de idempotency_key e vira no-op.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telephony_finalize_call(
  p_provider         text,
  p_provider_call_id text,
  p_status           text,
  p_duration_seconds integer,
  p_answered_at      timestamptz,
  p_ended_at         timestamptz,
  p_hangup_cause     text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_call     public.telephony_calls%ROWTYPE;
  v_acct     public.telephony_accounts%ROWTYPE;
  v_billable integer;
  v_cost     bigint := 0;
  v_key      text;
  v_bal      bigint;
  v_debited  boolean := false;
  v_rows     integer;
  v_act_id   uuid;
  v_title    text;
BEGIN
  SELECT * INTO v_call FROM public.telephony_calls
   WHERE provider = p_provider AND provider_call_id = p_provider_call_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'call_not_found');
  END IF;

  IF v_call.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'call_id', v_call.id);
  END IF;

  SELECT * INTO v_acct FROM public.telephony_accounts
   WHERE workspace_id = v_call.workspace_id;

  -- Duracao autoritativa: a do provedor, nunca a do navegador.
  v_billable := GREATEST(COALESCE(p_duration_seconds, 0),
                         COALESCE(v_acct.minimum_billable_seconds, 0));
  IF COALESCE(p_duration_seconds, 0) = 0 THEN
    v_billable := 0;  -- nao atendida nao cobra, nem com minimo configurado
  END IF;

  IF v_call.billing_mode = 'per_minute' AND v_billable > 0 THEN
    v_cost := ROUND(
      CEIL(v_billable::numeric / COALESCE(v_acct.bill_increment_seconds, 60))
      * COALESCE(v_acct.bill_increment_seconds, 60)
      * v_call.rate_cents_per_minute / 60.0);
  END IF;

  UPDATE public.telephony_calls
     SET status           = p_status,
         duration_seconds = COALESCE(p_duration_seconds, 0),
         answered_at      = COALESCE(p_answered_at, answered_at),
         ended_at         = COALESCE(p_ended_at, now()),
         hangup_cause     = p_hangup_cause,
         billed_cents     = v_cost,
         finalized_at     = now()
   WHERE id = v_call.id;

  -- Solta a reserva feita na abertura.
  IF v_call.reserved_cents > 0 THEN
    UPDATE public.telephony_balances
       SET reserved_cents = GREATEST(0, reserved_cents - v_call.reserved_cents),
           updated_at = now()
     WHERE workspace_id = v_call.workspace_id;
  END IF;

  IF v_cost > 0 THEN
    v_key := 'call_debit:' || p_provider || ':' || p_provider_call_id;

    SELECT balance_cents INTO v_bal FROM public.telephony_balances
     WHERE workspace_id = v_call.workspace_id FOR UPDATE;
    v_bal := COALESCE(v_bal, 0) - v_cost;

    INSERT INTO public.telephony_ledger (
      workspace_id, kind, amount_cents, balance_after_cents,
      call_id, idempotency_key, description)
    VALUES (
      v_call.workspace_id, 'call_debit', -v_cost, v_bal,
      v_call.id, v_key,
      'Ligacao para ' || v_call.to_number || ' (' || v_billable || 's)')
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_debited := v_rows > 0;

    IF v_debited THEN
      UPDATE public.telephony_balances
         SET balance_cents = balance_cents - v_cost, updated_at = now()
       WHERE workspace_id = v_call.workspace_id;
    END IF;
  END IF;

  -- Timeline do negocio.
  IF v_call.deal_id IS NOT NULL THEN
    v_title := CASE
      WHEN p_status = 'completed' AND COALESCE(p_duration_seconds,0) > 0
        THEN 'Ligacao atendida (' || COALESCE(p_duration_seconds,0) || 's)'
      WHEN p_status = 'no_answer' THEN 'Ligacao nao atendida'
      WHEN p_status = 'busy'      THEN 'Ligacao ocupada'
      WHEN p_status = 'failed'    THEN 'Ligacao falhou'
      ELSE 'Ligacao encerrada'
    END;

    INSERT INTO public.activities
      (deal_id, workspace_id, title, description, date, type, completed, assignee_id)
    VALUES
      (v_call.deal_id, v_call.workspace_id, v_title,
       'Para ' || v_call.to_number, COALESCE(p_ended_at, now()),
       'Ligação', true, v_call.user_id)
    RETURNING id INTO v_act_id;

    UPDATE public.telephony_calls SET activity_id = v_act_id WHERE id = v_call.id;

    -- deal_history e a timeline que o detalhe do negocio renderiza; activities e
    -- a agenda. A ligacao precisa aparecer nas duas.
    INSERT INTO public.deal_history (deal_id, description, subtext)
    VALUES (v_call.deal_id, v_title, 'Para ' || v_call.to_number);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'call_id', v_call.id,
    'billed_cents', v_cost, 'debited', v_debited,
    'billable_seconds', v_billable);
END;
$$;

-- ---------------------------------------------------------------------------
-- Credito. Idempotente por chave, para poder reprocessar webhook de pagamento
-- sem creditar duas vezes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telephony_add_credit(
  p_workspace_id    uuid,
  p_amount_cents    bigint,
  p_description     text,
  p_created_by      uuid,
  p_idempotency_key text,
  p_kind            text DEFAULT 'credit_purchase'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal  bigint;
  v_ins  boolean;
  v_rows integer;
BEGIN
  IF p_amount_cents = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'zero_amount');
  END IF;

  INSERT INTO public.telephony_balances (workspace_id) VALUES (p_workspace_id)
    ON CONFLICT (workspace_id) DO NOTHING;

  SELECT balance_cents INTO v_bal FROM public.telephony_balances
   WHERE workspace_id = p_workspace_id FOR UPDATE;

  IF (v_bal + p_amount_cents) < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'would_go_negative',
                              'balance_cents', v_bal);
  END IF;

  INSERT INTO public.telephony_ledger (
    workspace_id, kind, amount_cents, balance_after_cents,
    idempotency_key, description, created_by)
  VALUES (
    p_workspace_id, p_kind, p_amount_cents, v_bal + p_amount_cents,
    p_idempotency_key, p_description, p_created_by)
  ON CONFLICT (idempotency_key) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  v_ins := v_rows > 0;

  IF v_ins THEN
    UPDATE public.telephony_balances
       SET balance_cents = balance_cents + p_amount_cents, updated_at = now()
     WHERE workspace_id = p_workspace_id;
    v_bal := v_bal + p_amount_cents;
  END IF;

  RETURN jsonb_build_object('ok', true, 'applied', v_ins, 'balance_cents', v_bal);
END;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliacao: chamada que nunca recebeu evento final (provedor caiu, webhook
-- perdido) fica com reserva presa no saldo. O cron diario solta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.telephony_reconcile_stale_calls(
  p_older_than interval DEFAULT '4 hours'
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_call public.telephony_calls%ROWTYPE;
  v_n integer := 0;
BEGIN
  FOR v_call IN
    SELECT * FROM public.telephony_calls
     WHERE finalized_at IS NULL
       AND status IN ('queued','ringing','answered')
       AND started_at < now() - p_older_than
     FOR UPDATE SKIP LOCKED
  LOOP
    IF v_call.reserved_cents > 0 THEN
      UPDATE public.telephony_balances
         SET reserved_cents = GREATEST(0, reserved_cents - v_call.reserved_cents),
             updated_at = now()
       WHERE workspace_id = v_call.workspace_id;
    END IF;

    UPDATE public.telephony_calls
       SET status = 'failed', hangup_cause = 'reconciled_no_final_event',
           finalized_at = now(), ended_at = COALESCE(ended_at, now())
     WHERE id = v_call.id;

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.telephony_mark_recording_deleted(p_call_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.telephony_calls
     SET recording_status = 'deleted', recording_key = NULL
   WHERE id = p_call_id;
$$;

-- Essas funcoes so devem ser chamadas pelo servidor (service role).
REVOKE ALL ON FUNCTION public.telephony_start_call(uuid,uuid,uuid,text,text,text,text,uuid,uuid,uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.telephony_attach_provider_call(uuid,text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.telephony_finalize_call(text,text,text,integer,timestamptz,timestamptz,text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.telephony_add_credit(uuid,bigint,text,uuid,text,text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.telephony_reconcile_stale_calls(interval) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.telephony_mark_recording_deleted(uuid) FROM anon, authenticated;
