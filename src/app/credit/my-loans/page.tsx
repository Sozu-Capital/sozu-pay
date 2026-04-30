"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditTutorialModal } from "@/components/CreditTutorialModal";
import { cn } from "@/lib/utils";

const CREDIT_MY_LOANS_TUTORIAL_KEY = "sozu-credit-tutorial-my-loans-v1";
import { MOCK_LOAN_DEMO } from "@/lib/credit/mock-loan-demo";

type AppRow = {
  id: string;
  status: string;
  requested_principal: number;
  submitted_at: string | null;
  rejection_reason: string | null;
};

export default function MyLoansPage() {
  const t = useTranslations("creditPortal");
  const demo = MOCK_LOAN_DEMO;
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/credit/applications", { credentials: "include" });
        const data = res.ok ? await res.json() : { applications: [] };
        if (!cancelled) setApplications(data.applications ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n);

  const fmtDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <CreditTutorialModal
        storageKey={CREDIT_MY_LOANS_TUTORIAL_KEY}
        title={t("tutorialMyLoansTitle")}
        intro={t("tutorialMyLoansIntro")}
        steps={[
          t("tutorialMyLoansStep1"),
          t("tutorialMyLoansStep2"),
          t("tutorialMyLoansStep3"),
          t("tutorialMyLoansStep4"),
        ]}
        privacyTitle={t("tutorialPrivacyTitle")}
        privacyParagraphs={[
          t("tutorialPrivacyP1"),
          t("tutorialPrivacyP2"),
          t("tutorialPrivacyP3"),
        ]}
        nextLabel={t("tutorialLandingNext")}
        ctaLabel={t("tutorialMyLoansCta")}
      />
      <Link href="/credit" className="text-sm text-blue-600 dark:text-blue-400">
        ← {t("backHome")}
      </Link>
      <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">
        {t("ctaMyLoans")}
      </h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
        {t("gestionPagosTitle")} — {t("demoBadge")}
      </p>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{demo.label}</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            {t("demoBadge")}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/80">
            <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {t("totalOtorgado")}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900 dark:text-white">
              {fmt(demo.totalOtorgadoUsd)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/80">
            <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {t("totalPagado")}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-green-800 dark:text-green-300">
              {fmt(demo.totalPagadoUsd)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/80">
            <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {t("saldoPendiente")}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-amber-900 dark:text-amber-200">
              {fmt(demo.saldoPendienteUsd)}
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/80">
            <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {t("cuotasPagas")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {demo.cuotasPagas}{" "}
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                / {demo.cuotasTotal}
              </span>
            </p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/80">
            <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">
              {t("cuotasRestantes")}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {demo.cuotasRestantes}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {t("calendarioTitle")}
          </h3>
          <ul className="mt-3 divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {demo.calendario.map((row) => {
              const isNext = row.estado === "próximo";
              const isPaid = row.estado === "pagado";
              return (
                <li
                  key={row.cuotaN}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-sm",
                    isNext &&
                      "border-l-4 border-yellow-400 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-950/35",
                  )}
                >
                  <span className="min-w-[5.5rem] font-semibold text-gray-900 dark:text-white">
                    Cuota {row.cuotaN}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-900 dark:text-gray-100">
                    <span>
                      {t("cuotaDue")}: {fmtDate(row.fechaVencimiento)}
                    </span>
                    {isPaid && row.fechaPago && (
                      <span className="font-medium">
                        {t("cuotaPaidOn", { date: fmtDate(row.fechaPago) })}
                      </span>
                    )}
                  </div>
                  <span className="tabular-nums font-semibold text-gray-900 dark:text-white">
                    {fmt(row.importe)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-2 py-0.5 text-xs font-medium",
                      isPaid &&
                        "bg-green-100 text-green-800 dark:bg-green-900/45 dark:text-green-300",
                      isNext &&
                        "bg-yellow-200 text-yellow-950 dark:bg-yellow-900/60 dark:text-yellow-100",
                      row.estado === "pendiente" &&
                        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
                    )}
                  >
                    {isPaid
                      ? t("cuotaTagPaid")
                      : isNext
                        ? t("cuotaTagNext")
                        : t("cuotaTagPending")}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Notificaciones (ejemplo)
          </p>
          {demo.notificaciones.map((n) => (
            <div
              key={n.texto}
              className={`rounded-lg border px-3 py-2 text-sm ${
                n.tipo === "recordatorio"
                  ? "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                  : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
              }`}
            >
              {n.texto}
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-500 dark:text-gray-500">
          Próximamente: envío real por correo y SMS. {t("walletLink")} —{" "}
          <Link href="/dashboard" className="text-blue-600 dark:text-blue-400 underline">
            /dashboard
          </Link>
        </p>
      </section>

      {!loading && applications.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tus solicitudes (datos reales)
          </h2>
          <ul className="mt-2 space-y-2">
            {applications.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-gray-200 bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <span className="font-medium capitalize">{a.status}</span>
                {a.submitted_at && (
                  <span className="text-gray-500 ml-2">
                    · {new Date(a.submitted_at).toLocaleString("es-AR")}
                  </span>
                )}
                <div className="text-gray-600 dark:text-gray-400">
                  Monto: {Number(a.requested_principal).toFixed(2)} USD
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
