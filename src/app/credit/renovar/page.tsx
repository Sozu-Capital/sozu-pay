"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  defaultRenovacionForm,
  RENOVACION_STORAGE_KEY,
  type RenovacionFormState,
} from "@/lib/credit/renovacion-form";
import { FL } from "../solicitud/field-labels";

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RenovarCreditoPage() {
  const t = useTranslations("creditPortal");
  const [state, setState] = useState<RenovacionFormState>(defaultRenovacionForm);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RENOVACION_STORAGE_KEY);
      if (raw) setState({ ...defaultRenovacionForm(), ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(RENOVACION_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/credit" className="text-sm text-blue-600 dark:text-blue-400">
        ← {t("backHome")}
      </Link>
      <h1 className="text-2xl font-bold mt-4 text-gray-900 dark:text-white">
        {t("renovarTitle")}
      </h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{t("renovarIntro")}</p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white">{FL.renovacion.title}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={FL.renovacion.saldo}
              value={state.saldo_actual}
              onChange={(v) => setState((s) => ({ ...s, saldo_actual: v }))}
            />
            <Field
              label={FL.renovacion.montoUltimo}
              value={state.monto_ultimo_prestamo}
              onChange={(v) => setState((s) => ({ ...s, monto_ultimo_prestamo: v }))}
            />
            <Field
              label={FL.renovacion.fechaInicio}
              type="date"
              value={state.fecha_inicio}
              onChange={(v) => setState((s) => ({ ...s, fecha_inicio: v }))}
            />
            <Field
              label={FL.renovacion.fechaCancel}
              type="date"
              value={state.fecha_cancelacion}
              onChange={(v) => setState((s) => ({ ...s, fecha_cancelacion: v }))}
            />
            <Field
              label={FL.renovacion.cuotas}
              value={state.cantidad_cuotas}
              onChange={(v) => setState((s) => ({ ...s, cantidad_cuotas: v }))}
            />
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-gray-900 dark:text-white">{FL.renovacion.evalTitle}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Select
              label={FL.renovacion.actividad}
              value={state.desempeno_actividad}
              options={FL.opciones.desempeno}
              onChange={(v) => setState((s) => ({ ...s, desempeno_actividad: v }))}
            />
            <Select
              label={FL.renovacion.pagoCuotas}
              value={state.desempeno_pago_cuotas}
              options={FL.opciones.desempeno}
              onChange={(v) => setState((s) => ({ ...s, desempeno_pago_cuotas: v }))}
            />
            <Select
              label={FL.renovacion.asistencia}
              value={state.desempeno_asistencia}
              options={FL.opciones.desempeno}
              onChange={(v) => setState((s) => ({ ...s, desempeno_asistencia: v }))}
            />
            <Select
              label={FL.renovacion.evolucion}
              value={state.desempeno_evolucion}
              options={FL.opciones.desempeno}
              onChange={(v) => setState((s) => ({ ...s, desempeno_evolucion: v }))}
            />
          </div>
        </section>

        <section>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {FL.renovacion.checklist}
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.checklist_monotributo}
              onChange={(e) =>
                setState((s) => ({ ...s, checklist_monotributo: e.target.checked }))
              }
            />
            {FL.renovacion.monotributo}
          </label>
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={state.checklist_capitalizacion}
              onChange={(e) =>
                setState((s) => ({ ...s, checklist_capitalizacion: e.target.checked }))
              }
            />
            {FL.renovacion.capitalizacion}
          </label>
          <label className="flex items-center gap-2 text-sm mt-2">
            <input
              type="checkbox"
              checked={state.checklist_canales}
              onChange={(e) =>
                setState((s) => ({ ...s, checklist_canales: e.target.checked }))
              }
            />
            {FL.renovacion.canales}
          </label>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium dark:border-gray-600"
          >
            {t("renovarGuardar")}
          </button>
          <button
            type="button"
            onClick={() => setSaved(true)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
          >
            {t("renovarEnviar")}
          </button>
        </div>
        {saved && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Borrador guardado localmente (demo).
          </p>
        )}
      </div>
    </div>
  );
}
