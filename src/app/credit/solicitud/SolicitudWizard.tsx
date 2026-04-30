"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SOLICITUD_STEP_SLUGS,
  type SolicitudFormState,
  type SolicitudStepSlug,
  buildApplicantProfileForApi,
  defaultSolicitudForm,
  stepIndex,
  STORAGE_KEY,
} from "@/lib/credit/solicitud-form";
import { FL } from "./field-labels";
import { DocumentacionImageDropzone } from "./DocumentacionImageDropzone";

type Sim = {
  paymentAmount: number;
  totalInterest: number;
  totalPayment: number;
  installments: {
    index: number;
    payment: number;
    principal: number;
    interest: number;
  }[];
};

function loadState(): SolicitudFormState {
  if (typeof window === "undefined") return defaultSolicitudForm();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSolicitudForm();
    const parsed = JSON.parse(raw) as Partial<SolicitudFormState>;
    const base = defaultSolicitudForm();
    return {
      ...base,
      ...parsed,
      datos_generales: { ...base.datos_generales, ...parsed.datos_generales },
      emprendimiento: { ...base.emprendimiento, ...parsed.emprendimiento },
      produccion: { ...base.produccion, ...parsed.produccion },
      redes: { ...base.redes, ...parsed.redes },
      documentacion: {
        ...base.documentacion,
        ...parsed.documentacion,
        fotos_mock: Array.isArray(parsed.documentacion?.fotos_mock)
          ? parsed.documentacion!.fotos_mock
          : base.documentacion.fotos_mock,
      },
      simulador: { ...base.simulador, ...parsed.simulador },
    };
  } catch {
    return defaultSolicitudForm();
  }
}

function saveState(s: SolicitudFormState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function SolicitudWizard({ step }: { step: SolicitudStepSlug }) {
  const t = useTranslations("creditPortal");
  const router = useRouter();
  const [state, setState] = useState<SolicitudFormState>(defaultSolicitudForm);
  const [sim, setSim] = useState<Sim | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const slug = step;
  const idx = stepIndex(slug);
  const total = SOLICITUD_STEP_SLUGS.length;
  const progressPct = ((idx + 1) / total) * 100;

  const runSim = useCallback(async () => {
    const p = Number(state.simulador.principal);
    const n = Number(state.simulador.num_cuotas);
    const r = Number(state.simulador.tna_pct);
    const res = await fetch("/api/credit/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        principal: p,
        annualRatePct: r,
        numInstallments: n,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSim(null);
      return;
    }
    setSim(data.simulation);
  }, [state.simulador]);

  useEffect(() => {
    if (slug === "simulador") {
      runSim().catch(() => {});
    }
  }, [slug, runSim]);

  async function submitFinal() {
    setSubmitting(true);
    setError(null);
    try {
      const profile = buildApplicantProfileForApi(state);
      const p = Number(state.simulador.principal);
      const n = Number(state.simulador.num_cuotas);
      const r = Number(state.simulador.tna_pct);
      const res = await fetch("/api/credit/applications", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: state.referral_code.trim() || undefined,
          requestedPrincipal: p,
          numInstallments: n,
          annualRatePct: r,
          applicantProfile: profile,
          submit: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error al enviar");
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/credit/my-loans");
    } finally {
      setSubmitting(false);
    }
  }

  function go(to: SolicitudStepSlug) {
    router.push(`/credit/solicitud/${to}`);
  }

  const dg = state.datos_generales;
  const em = state.emprendimiento;
  const pr = state.produccion;
  const rs = state.redes;
  const doc = state.documentacion;

  const section = useMemo(() => {
    switch (slug) {
      case "datos-generales":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FL.datos.apellidoNombre} value={dg.apellido_y_nombre} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, apellido_y_nombre: v } }))} />
            <Field label={FL.datos.dni} value={dg.dni} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, dni: v } }))} />
            <Field label={FL.datos.fechaNac} type="date" value={dg.fecha_nacimiento} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, fecha_nacimiento: v } }))} />
            <Field label={FL.datos.barrio} value={dg.barrio} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, barrio: v } }))} />
            <Field label={FL.datos.direccion} value={dg.direccion} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, direccion: v } }))} className="sm:col-span-2" />
            <Field label={FL.datos.estadoCivil} value={dg.estado_civil} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, estado_civil: v } }))} />
            <Field label={FL.datos.nivelEducativo} value={dg.nivel_educativo} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, nivel_educativo: v } }))} />
            <Field label={FL.datos.telefono} value={dg.telefono} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, telefono: v } }))} />
            <Field label={FL.datos.personasHogar} value={dg.personas_hogar} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, personas_hogar: v } }))} />
            <Field label={FL.datos.personasIngresos} value={dg.personas_ingresos} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, personas_ingresos: v } }))} />
            <Select label={FL.datos.planSocial} value={dg.recibe_plan_social} options={FL.opciones.siNo} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, recibe_plan_social: v } }))} />
            <Select label={FL.datos.otroEmpleo} value={dg.tiene_otro_empleo} options={FL.opciones.siNo} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, tiene_otro_empleo: v } }))} />
            <Select label={FL.datos.enBlanco} value={dg.es_en_blanco} options={FL.opciones.siNo} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, es_en_blanco: v } }))} />
            <Select label={FL.datos.monotributo} value={dg.tiene_monotributo} options={FL.opciones.siNo} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, tiene_monotributo: v } }))} />
            <Field label={FL.datos.banco} value={dg.banco} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, banco: v } }))} />
            <Field label={FL.datos.cbuCvu} value={dg.cbu_cvu} onChange={(v) => setState((s) => ({ ...s, datos_generales: { ...s.datos_generales, cbu_cvu: v } }))} />
          </div>
        );
      case "emprendimiento":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={FL.emprendimiento.rubro} value={em.rubro} options={FL.opciones.rubro} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, rubro: v } }))} />
            <Field label={FL.emprendimiento.descripcion} value={em.descripcion} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, descripcion: v } }))} className="sm:col-span-2" />
            <Select label={FL.emprendimiento.funcionamiento} value={em.en_funcionamiento} options={FL.opciones.siNo} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, en_funcionamiento: v } }))} />
            <Field label={FL.emprendimiento.antiguedad} value={em.antiguedad} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, antiguedad: v } }))} />
            <Field label={FL.emprendimiento.objetivo} value={em.objetivo} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, objetivo: v } }))} className="sm:col-span-2" />
            <Field label={FL.emprendimiento.usoGanancia} value={em.uso_ganancia} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, uso_ganancia: v } }))} className="sm:col-span-2" />
            <Field label={FL.emprendimiento.estacionalidad} value={em.estacionalidad} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, estacionalidad: v } }))} />
            <Field label={FL.emprendimiento.proveedores} value={em.proveedores} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, proveedores: v } }))} />
            <Field label={FL.emprendimiento.clientes} value={em.clientes} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, clientes: v } }))} />
            <Field label={FL.emprendimiento.modalidadCobro} value={em.modalidad_cobro} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, modalidad_cobro: v } }))} />
            <Field label={FL.emprendimiento.promocion} value={em.estrategia_promocion} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, estrategia_promocion: v } }))} className="sm:col-span-2" />
            <Field label={FL.emprendimiento.competencia} value={em.competencia} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, competencia: v } }))} />
            <Field label={FL.emprendimiento.diferenciacion} value={em.diferenciacion} onChange={(v) => setState((s) => ({ ...s, emprendimiento: { ...s.emprendimiento, diferenciacion: v } }))} className="sm:col-span-2" />
          </div>
        );
      case "produccion":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FL.produccion.participan} value={pr.personas_participan} onChange={(v) => setState((s) => ({ ...s, produccion: { ...s.produccion, personas_participan: v } }))} className="sm:col-span-2" />
            <Field label={FL.produccion.tareas} value={pr.distribucion_tareas} onChange={(v) => setState((s) => ({ ...s, produccion: { ...s.produccion, distribucion_tareas: v } }))} className="sm:col-span-2" />
            <Field label={FL.produccion.horas} value={pr.horas_semanales} onChange={(v) => setState((s) => ({ ...s, produccion: { ...s.produccion, horas_semanales: v } }))} />
            <Field label={FL.produccion.bienes} value={pr.bienes_capital} onChange={(v) => setState((s) => ({ ...s, produccion: { ...s.produccion, bienes_capital: v } }))} className="sm:col-span-2" />
          </div>
        );
      case "redes-sociales":
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={FL.redes.instagram} value={rs.instagram} onChange={(v) => setState((s) => ({ ...s, redes: { ...s.redes, instagram: v } }))} />
            <Field label={FL.redes.facebook} value={rs.facebook} onChange={(v) => setState((s) => ({ ...s, redes: { ...s.redes, facebook: v } }))} />
            <Field label={FL.redes.otros} value={rs.otros} onChange={(v) => setState((s) => ({ ...s, redes: { ...s.redes, otros: v } }))} className="sm:col-span-2" />
          </div>
        );
      case "documentacion":
        return (
          <div className="grid gap-6">
            <DocumentacionImageDropzone
              fileNames={doc.fotos_mock}
              onFilesChange={(names) =>
                setState((s) => ({
                  ...s,
                  documentacion: { ...s.documentacion, fotos_mock: names },
                }))
              }
              label={t("dropFotosLabel")}
              hint={t("dropFotosHint")}
            />
            <Field
              label={FL.docs.fotos}
              value={doc.notas_fotos}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  documentacion: { ...s.documentacion, notas_fotos: v },
                }))
              }
            />
            <p className="text-xs text-gray-500 dark:text-gray-500">{t("dropFotosHelper")}</p>
            <Field
              label={FL.docs.presEmp}
              value={doc.presupuesto_emprendimiento}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  documentacion: { ...s.documentacion, presupuesto_emprendimiento: v },
                }))
              }
            />
            <Field
              label={FL.docs.presFam}
              value={doc.presupuesto_familiar}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  documentacion: { ...s.documentacion, presupuesto_familiar: v },
                }))
              }
            />
            <Field
              label={FL.docs.ventas}
              value={doc.ventas}
              onChange={(v) =>
                setState((s) => ({
                  ...s,
                  documentacion: { ...s.documentacion, ventas: v },
                }))
              }
            />
          </div>
        );
      case "simulador":
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={FL.sim.monto} value={state.simulador.principal} onChange={(v) => setState((s) => ({ ...s, simulador: { ...s.simulador, principal: v } }))} />
              <Field label={FL.sim.cuotas} value={state.simulador.num_cuotas} onChange={(v) => setState((s) => ({ ...s, simulador: { ...s.simulador, num_cuotas: v } }))} />
              <Field label={FL.sim.tna} value={state.simulador.tna_pct} onChange={(v) => setState((s) => ({ ...s, simulador: { ...s.simulador, tna_pct: v } }))} />
            </div>
            <button type="button" onClick={() => runSim()} className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {t("simRecalc")}
            </button>
            {sim && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t("simTitle")}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  {t("simCuota")}: <strong>{sim.paymentAmount.toFixed(2)} USD</strong> · {t("simTotalInteres")}: {sim.totalInterest.toFixed(2)} · {t("simTotalPagar")}: {sim.totalPayment.toFixed(2)}
                </p>
                <div className="mt-2 max-h-36 overflow-auto text-xs font-mono text-gray-700 dark:text-gray-300">
                  {sim.installments.slice(0, 8).map((row) => (
                    <div key={row.index}>
                      #{row.index} — {row.payment.toFixed(2)} (P {row.principal.toFixed(2)} + I {row.interest.toFixed(2)})
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      case "revision":
        return (
          <div className="space-y-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">{t("revisionTitle")}</p>
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm dark:border-gray-700 dark:bg-gray-900 space-y-2">
              <p><strong>{FL.datos.apellidoNombre}:</strong> {dg.apellido_y_nombre || "—"}</p>
              <p><strong>{FL.datos.dni}:</strong> {dg.dni || "—"}</p>
              <p><strong>{FL.emprendimiento.rubro}:</strong> {em.rubro || "—"}</p>
              <p><strong>{FL.sim.monto}:</strong> {state.simulador.principal} · {FL.sim.cuotas}: {state.simulador.num_cuotas}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t("referralHint")}</label>
              <input
                className="mt-1 w-full max-w-md rounded border border-gray-300 px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
                value={state.referral_code}
                onChange={(e) => setState((s) => ({ ...s, referral_code: e.target.value }))}
                placeholder="Ej. MUJERES2000"
              />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitFinal()}
              className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
            >
              {submitting ? t("saving") : t("enviar")}
            </button>
          </div>
        );
      default:
        return null;
    }
  }, [slug, state, sim, dg, em, pr, rs, doc, t, error, submitting, runSim]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-2 rounded-full bg-gray-900 dark:bg-white transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t("progress", { current: idx + 1, total })} — {t(`steps.${slug}`)}
        </p>
      </div>

      <Link href="/credit" className="text-sm text-blue-600 dark:text-blue-400">
        ← {t("backHome")}
      </Link>
      <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">
        {t(`steps.${slug}`)}
      </h1>

      <div className="mt-6">{section}</div>

      <div className="mt-10 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          disabled={idx === 0}
          onClick={() => go(SOLICITUD_STEP_SLUGS[idx - 1])}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
        >
          {t("prev")}
        </button>
        {idx < total - 1 ? (
          <button
            type="button"
            onClick={() => go(SOLICITUD_STEP_SLUGS[idx + 1])}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          >
            {t("siguiente")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${className}`}>
      {label}
      <input
        type={type}
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      <select
        className="mt-1 w-full rounded border border-gray-300 px-3 py-2 dark:bg-gray-900 dark:border-gray-600"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.filter(Boolean).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
