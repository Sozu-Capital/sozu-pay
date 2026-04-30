/** Datos demo para “Gestión de pagos” en /credit/my-loans (sin API). */

const PRINCIPAL_USD = 2000;
const CUOTAS_TOTAL = 12;
/** 11 × 166,67 + 1 × 166,63 = 2000,00 */
const IMPORTE_CUOTA_REGULAR = 166.67;
const IMPORTE_ULTIMA_CUOTA = 166.63;

const CUOTAS_PAGAS = 7;

function importeCuota(n: number): number {
  return n === CUOTAS_TOTAL ? IMPORTE_ULTIMA_CUOTA : IMPORTE_CUOTA_REGULAR;
}

/** Vencimientos mensuales día 15; cuota 8 = próxima (no pagada). */
const FECHAS_VENCIMIENTO: string[] = [
  "2025-09-15",
  "2025-10-15",
  "2025-11-15",
  "2025-12-15",
  "2026-01-15",
  "2026-02-15",
  "2026-03-15",
  "2026-04-15",
  "2026-05-15",
  "2026-06-15",
  "2026-07-15",
  "2026-08-15",
];

/** Fecha en que se registró el pago (demo: 2 días después del vencimiento). */
function fechaPagoDemo(fechaVenc: string): string {
  const d = new Date(fechaVenc + "T12:00:00");
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

export type CuotaCalendarioEstado = "pagado" | "próximo" | "pendiente";

export type CuotaCalendarioRow = {
  cuotaN: number;
  fechaVencimiento: string;
  importe: number;
  estado: CuotaCalendarioEstado;
  /** Solo si estado === "pagado": fecha efectiva del pago (demo). */
  fechaPago?: string;
};

const calendario: CuotaCalendarioRow[] = FECHAS_VENCIMIENTO.map((fechaVencimiento, i) => {
  const cuotaN = i + 1;
  const importe = importeCuota(cuotaN);
  if (cuotaN <= CUOTAS_PAGAS) {
    return {
      cuotaN,
      fechaVencimiento,
      importe,
      estado: "pagado",
      fechaPago: fechaPagoDemo(fechaVencimiento),
    };
  }
  if (cuotaN === CUOTAS_PAGAS + 1) {
    return { cuotaN, fechaVencimiento, importe, estado: "próximo" };
  }
  return { cuotaN, fechaVencimiento, importe, estado: "pendiente" };
});

const totalPagadoUsdRaw = calendario
  .filter((r) => r.estado === "pagado")
  .reduce((s, r) => s + r.importe, 0);
const totalPagadoUsd = Math.round(totalPagadoUsdRaw * 100) / 100;
const saldoPendienteUsd = Math.round((PRINCIPAL_USD - totalPagadoUsd) * 100) / 100;

export const MOCK_LOAN_DEMO = {
  label: "Préstamo demo — Emprendimiento textil",
  totalOtorgadoUsd: PRINCIPAL_USD,
  totalPagadoUsd,
  saldoPendienteUsd,
  cuotasPagas: CUOTAS_PAGAS,
  cuotasRestantes: CUOTAS_TOTAL - CUOTAS_PAGAS,
  cuotasTotal: CUOTAS_TOTAL,
  calendario,
  notificaciones: [
    { tipo: "recordatorio" as const, texto: "Tu cuota vence en 5 días." },
    { tipo: "mora" as const, texto: "Tenés 2 días de mora." },
  ],
};
