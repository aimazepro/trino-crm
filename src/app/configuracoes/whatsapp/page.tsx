"use client";

import { useState } from "react";
import {
  MessageCircle,
  TriangleAlert,
  WifiOff,
  QrCode,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

type State = "disconnected" | "qrcode" | "connected";

// Placeholder QR code — in production this comes from the backend
const PLACEHOLDER_QR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEX///8AAABVwtN+AAAFC0lEQVR42uyZP47zrBrFD6KgMxuwzDZSRGJLKd1B5zJbQnLhbWBlA7hzgThXj2fy3Ve3jePifq+bkTK/aKwHOH8Y/H3+XY8iG25wCcXxmXWEYwHClj2ZzgESOs2yptCA0O5j64HsI/qb/O4aYGbn0mO4B3nRpqMiY4Pp+ltYTwTI41M84Nng41pHmy8GlgjPTi+RjOrFMgClPw9I6Nxus4+WyWY92QxwZoc/1uLbANn622Odp+5/fvyxJz8D5HHpoeZpyzebNW1F4Dyh/+PwfBlQMxsMV+4bUyDZaUY371v1zCcB5JZNURWq+ucAbNwBGPnWcBEAvdvqo5p3wJfsd/QmKu62vqf0MaDSWHAL5AS9PJvfC3x0NbAiXAeg9T5mP3VuYZPDa6KrKHopwzkAYDbuj+E+WjK6ZIre4SqYTfzd1d8HNLsej+Z3Oa6Djk0vZa2hw+2RcQqgGOGWmPWuuId8DyITao72lX5H/X1AxFc0Ssdj+p4dzJMiXOShUScAGFX2HO7oeh+ZQpHDW41Y3GWAnlh9dNzhyDUF6PSA3+1reR/ej4G7UWLVei9i2vfDzYZDDa1L1wBqjp1O8hG5cNCE5nOdoyULzwKmjQvXNAKwax2LYwRC949Ofh+AnyxJRRYtm5udThaexS3EOYBK41Z9EanCzTIZkSrWsfTvUX8fgKd9sbg5Sg4dEIrerauwb9c7AziE4cd74FLYyOLS2A5PvwZQaWyOsd2DvFO7h9KL1cfmEjJOAfAT/IDxSGISqH3J98DX8taorwNq3smlZB8lmA6yncXqY4P/tcWPAWgWLTI/bsfEA5wst2HGA1cBkKjwcJxUNUfE13xyjsVJvzoFUDPReyrGw0r1JFMRf+3fEeUCIAXJ9msN6rVwnSfREZdg6+3RzgGgJ7hkm96bk/rwU0jvoySxt6l9HfBk9WWdJ/VilODd3+z6sxbv/PApgHF7pcBqVL7ZBnPM2E/bkcuuAVQNx9g1i9uDqqFpRs576c3zR2FOAEbRv4axg4mD3otjUXXs9B7aRQD0ZClvB9lyLoWuhxQ2iYg4BzhaIH4qKGy7Q4KDqmbLt6DSNYCUMi3hJUoTXWto8JJIm1vir8J8CigSvaES05aJS314uDSK267pGkDMPfsnK7ZsONyDuDr8YfX/uP9ngEqmSIXRe9HJDoBMnDN/Fv8aAJrMNwwwKiPkI9HIqe2OUHgKoI7QhbVi4xLlj3N/OFl1PH714esA/HS0xfsoUqySCMjTHXcO76j2KaASVPbPIzGYQvFXz7UaiWfvC6uvA3Wk9G4fcRypUI7sO0p3PAnAHaX3dIx8JTQft9dR9KV+/5zuCwBPvlIYpFHsYvVNSnENWzUFJwEw0Cm0+6HtwxF6C+7BZs/LAL1L8FsrLNNjTeG4PmGEXn6z3MeA4oTeFMfJconN7yKDv6P+vUT9OiAvyYWyyXrzdMmQe3AJTcwPpwAqjSr7Ah0lYTc92XoL+Q70/21J3wZEQPRS1pkSY0jp/pHzEQobzgGk9LFkzy1LcJiOan8Ezl8Z/D5w/KPH0M2xueW5ztwo/WI/xoFzgB9zEWNlQtZRVSmD5o/68H1gZtebIk3G7ZZkETuo8q33Tc45gKgSucQ1mSNQV9Pc/hhwHeDSQ1U0wA56b71/NhiJSe0kIKHT6SFpV3r3sZXsIKN+X1hdAJDNpZD1riqkkAJeTpZlsjgH+Pv8/zz/CQAA//8lxY8VDdODOwAAAABJRU5ErkJggg==";

export default function WhatsAppConfigPage() {
  const [state, setState] = useState<State>("disconnected");
  const [refreshing, setRefreshing] = useState(false);

  const handleConnect = () => setState("qrcode");

  const handleRefreshQR = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-zinc-50/30">
      <div className="max-w-2xl mx-auto py-10 px-6">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">WhatsApp</h1>
            <p className="text-sm text-zinc-500">
              Conecte seu WhatsApp para conversar com leads diretamente pelo CRM
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
          <div className="flex gap-3">
            <TriangleAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-bold mb-2">Antes de conectar, leia com atenção</p>
              <ul className="space-y-1.5">
                <li>
                  <strong>Use um número comercial.</strong> NÃO conecte seu WhatsApp pessoal. Use
                  um chip dedicado para o CRM.
                </li>
                <li>
                  <strong>Não envie mensagens em massa.</strong> Use para conversas individuais com
                  leads. Disparos em massa podem resultar em restrição da conta.
                </li>
                <li>
                  <strong>Restrições no número</strong> estão relacionadas à qualidade do chip e
                  fazem parte do uso.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Main Connection Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">

          {/* Disconnected state */}
          {state === "disconnected" && (
            <div className="text-center py-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto">
                <WifiOff className="h-8 w-8 text-zinc-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">WhatsApp não conectado</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Conecte seu WhatsApp pessoal para enviar e receber mensagens pelo CRM
                </p>
              </div>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                Conectar WhatsApp
              </button>
            </div>
          )}

          {/* QR Code state */}
          {state === "qrcode" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-zinc-900">Escaneie o QR Code</p>
                  <p className="text-sm text-zinc-500">
                    Abra o WhatsApp no celular {">"} Aparelhos conectados {">"} Conectar
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-xl border-2 border-zinc-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                    src={PLACEHOLDER_QR}
                  />
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Aguardando leitura do QR Code...
                </div>

                <button
                  onClick={handleRefreshQR}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Gerar novo QR Code
                </button>
              </div>
            </div>
          )}

          {/* Connected state */}
          {state === "connected" && (
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900">WhatsApp conectado</p>
                <p className="text-sm text-zinc-500 mt-0.5">+55 (11) 9 9999-9999</p>
              </div>
              <button
                onClick={() => setState("disconnected")}
                className="px-4 py-2 border border-red-200 text-red-500 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
              >
                Desconectar
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp API Oficial card */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-zinc-900">
                  WhatsApp API Oficial (Meta)
                </h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  Em breve
                </span>
              </div>
              <p className="text-sm text-zinc-600 mt-2">
                Conexão oficial com a Meta, sem risco de banimento. Ideal para empresas que querem
                estabilidade e escala. Cobrado por uso (pré-pago em créditos).
              </p>
              <p className="text-xs text-zinc-500 mt-3">
                Estamos desenvolvendo essa integração. Em breve você poderá ativar no seu workspace.
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
