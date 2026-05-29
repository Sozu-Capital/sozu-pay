"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Transaction, Keypair } from "@stellar/stellar-sdk";

const CTA_CLASS =
  "rounded-xl border border-orange-400/35 bg-orange-500/15 hover:bg-orange-500/25 active:bg-orange-500/30 backdrop-blur-md disabled:opacity-50 disabled:cursor-not-allowed text-orange-100 font-semibold py-3 px-6 transition-colors";

type Profile = {
  stellar_public_key: string | null;
  email?: string;
};

export function SdpRegisterFlow() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [secretInput, setSecretInput] = useState("");
  const [sep10Busy, setSep10Busy] = useState(false);
  const [sep10Error, setSep10Error] = useState<string | null>(null);
  const [sep10Done, setSep10Done] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [pollTx, setPollTx] = useState<unknown[] | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const loadProfile = useCallback(() => {
    setLoadingProfile(true);
    fetch("/api/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setProfile(null);
          return;
        }
        setProfile({
          stellar_public_key: data.stellar_public_key ?? null,
          email: data.email,
        });
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const runSep10 = async () => {
    setSep10Error(null);
    const secret = secretInput.trim();
    if (!secret || !secret.startsWith("S")) {
      setSep10Error(
        "Ingresá tu clave secreta de Stellar (empieza con S) de la cuenta registrada en Perfil."
      );
      return;
    }

    setSep10Busy(true);
    try {
      const chRes = await fetch("/api/sdp/sep10/challenge", {
        credentials: "include",
      });
      const chData = await chRes.json().catch(() => ({}));
      if (!chRes.ok) {
        throw new Error(chData.error ?? "No se pudo iniciar la autenticación");
      }

      const tx = new Transaction(
        chData.transaction_xdr as string,
        chData.network_passphrase as string
      );
      const kp = Keypair.fromSecret(secret);
      tx.sign(kp);
      const signedXdr = tx.toEnvelope().toXDR("base64");

      const tokRes = await fetch("/api/sdp/sep10/token", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_xdr: signedXdr,
          network_passphrase: chData.network_passphrase,
          server_account_id: chData.server_account_id,
          web_auth_domain: chData.web_auth_domain,
          home_domains: chData.home_domains,
        }),
      });
      const tokData = await tokRes.json().catch(() => ({}));
      if (!tokRes.ok) {
        throw new Error(tokData.error ?? "No se pudo completar la autenticación");
      }
      setSep10Done(true);
      setSecretInput("");
    } catch (e) {
      setSep10Error(e instanceof Error ? e.message : "Falló la autenticación SEP-10");
    } finally {
      setSep10Busy(false);
    }
  };

  const openDeposit = async () => {
    setDepositError(null);
    setDepositBusy(true);
    try {
      const res = await fetch("/api/sdp/sep24/deposit", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo iniciar la verificación");
      }
      const url = data.url as string;
      if (typeof url === "string" && url.startsWith("http")) {
        window.location.assign(url);
      } else {
        throw new Error("No se recibió la URL de verificación");
      }
    } catch (e) {
      setDepositError(e instanceof Error ? e.message : "Falló la verificación");
    } finally {
      setDepositBusy(false);
    }
  };

  const pollTransactions = async () => {
    setPollError(null);
    try {
      const res = await fetch("/api/sdp/sep24/transactions", {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo consultar el estado");
      }
      setPollTx(data.transactions ?? []);
    } catch (e) {
      setPollError(e instanceof Error ? e.message : "No se pudo consultar el estado");
    }
  };

  if (loadingProfile) {
    return <p className="text-sm text-gray-400">Cargando…</p>;
  }

  if (!profile?.stellar_public_key) {
    return (
      <div className="space-y-4 max-w-lg">
        <h1 className="text-xl font-semibold">Registro de desembolso</h1>
        <p className="text-sm text-gray-300">
          Primero agregá una billetera Stellar a tu cuenta y volvé a esta página.
        </p>
        <Link href="/dashboard/profile" className={`inline-block ${CTA_CLASS}`}>
          Ir a Perfil
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold">Recibí tu pago</h1>
        <p className="text-sm text-gray-400 mt-1">
          Cuenta{" "}
          <span className="text-gray-200 font-mono text-xs break-all">
            {profile.stellar_public_key}
          </span>
        </p>
        <p className="text-sm text-gray-400 mt-2">
          Completá la autenticación Stellar y abrí el sitio de desembolso para verificar tus datos.
          Tu clave secreta solo se usa en este navegador para firmar el desafío SEP-10 y no se envía
          a nuestros servidores.
        </p>
      </div>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">1. Iniciar sesión con Stellar (SEP-10)</h2>
        {!sep10Done ? (
          <>
            <input
              type="password"
              autoComplete="off"
              placeholder="Clave secreta Stellar (S…)"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              disabled={sep10Busy}
              onClick={() => void runSep10()}
              className={CTA_CLASS}
            >
              {sep10Busy ? "Firmando…" : "Firmar desafío"}
            </button>
            {sep10Error && <p className="text-sm text-red-400">{sep10Error}</p>}
          </>
        ) : (
          <p className="text-sm text-orange-300">Autenticado con la plataforma de desembolso.</p>
        )}
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">2. Línea de confianza USDC (si hace falta)</h2>
        <p className="text-xs text-gray-400">
          Si el pago es en USDC, asegurate de tener la trustline en Perfil; si no, Horizon rechazará
          el crédito.
        </p>
        <Link href="/dashboard/profile" className="text-sm text-orange-300 hover:underline">
          Revisar trustline en Perfil
        </Link>
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">3. Abrir registro (SEP-24)</h2>
        <p className="text-xs text-gray-400">
          Vas a completar la verificación de teléfono o identidad en el sitio de desembolso. No
          compartas códigos con nadie.
        </p>
        <button
          type="button"
          disabled={!sep10Done || depositBusy}
          onClick={() => void openDeposit()}
          className={CTA_CLASS}
        >
          {depositBusy ? "Abriendo…" : "Continuar a verificación"}
        </button>
        {depositError && <p className="text-sm text-red-400">{depositError}</p>}
      </section>

      <section className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">4. Estado de la transacción</h2>
        <button
          type="button"
          disabled={!sep10Done}
          onClick={() => void pollTransactions()}
          className="rounded-md border border-white/20 px-4 py-2 text-sm disabled:opacity-50"
        >
          Actualizar estado
        </button>
        {pollError && <p className="text-sm text-red-400">{pollError}</p>}
        {pollTx && (
          <pre className="text-xs text-gray-400 overflow-auto max-h-48 p-2 bg-black/50 rounded">
            {JSON.stringify(pollTx, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
