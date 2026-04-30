/** Formulario de renovación de crédito (flujo aparte). */

export type RenovacionFormState = {
  saldo_actual: string;
  monto_ultimo_prestamo: string;
  fecha_inicio: string;
  fecha_cancelacion: string;
  cantidad_cuotas: string;
  desempeno_actividad: string;
  desempeno_pago_cuotas: string;
  desempeno_asistencia: string;
  desempeno_evolucion: string;
  checklist_monotributo: boolean;
  checklist_capitalizacion: boolean;
  checklist_canales: boolean;
};

export const RENOVACION_STORAGE_KEY = "sozu_credit_renovacion_v1";

export function defaultRenovacionForm(): RenovacionFormState {
  return {
    saldo_actual: "",
    monto_ultimo_prestamo: "",
    fecha_inicio: "",
    fecha_cancelacion: "",
    cantidad_cuotas: "",
    desempeno_actividad: "",
    desempeno_pago_cuotas: "",
    desempeno_asistencia: "",
    desempeno_evolucion: "",
    checklist_monotributo: false,
    checklist_capitalizacion: false,
    checklist_canales: false,
  };
}
