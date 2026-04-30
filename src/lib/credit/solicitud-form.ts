/** MUJERES 2000–style solicitud — stored in applicant_profile JSON (nested). */

export const SOLICITUD_STEP_SLUGS = [
  "datos-generales",
  "emprendimiento",
  "produccion",
  "redes-sociales",
  "documentacion",
  "simulador",
  "revision",
] as const;

export type SolicitudStepSlug = (typeof SOLICITUD_STEP_SLUGS)[number];

export type DatosGenerales = {
  apellido_y_nombre: string;
  dni: string;
  fecha_nacimiento: string;
  barrio: string;
  direccion: string;
  estado_civil: string;
  nivel_educativo: string;
  telefono: string;
  personas_hogar: string;
  personas_ingresos: string;
  recibe_plan_social: string;
  tiene_otro_empleo: string;
  es_en_blanco: string;
  tiene_monotributo: string;
  banco: string;
  cbu_cvu: string;
};

export type Emprendimiento = {
  rubro: string;
  descripcion: string;
  en_funcionamiento: string;
  antiguedad: string;
  objetivo: string;
  uso_ganancia: string;
  estacionalidad: string;
  proveedores: string;
  clientes: string;
  modalidad_cobro: string;
  estrategia_promocion: string;
  competencia: string;
  diferenciacion: string;
};

export type Produccion = {
  personas_participan: string;
  distribucion_tareas: string;
  horas_semanales: string;
  bienes_capital: string;
};

export type RedesSociales = {
  instagram: string;
  facebook: string;
  otros: string;
};

export type Documentacion = {
  /** Nombres de archivo mock (sin subida real). */
  fotos_mock: string[];
  notas_fotos: string;
  presupuesto_emprendimiento: string;
  presupuesto_familiar: string;
  ventas: string;
};

export type SolicitudFormState = {
  datos_generales: DatosGenerales;
  emprendimiento: Emprendimiento;
  produccion: Produccion;
  redes: RedesSociales;
  documentacion: Documentacion;
  simulador: {
    principal: string;
    num_cuotas: string;
    tna_pct: string;
  };
  referral_code: string;
};

export const STORAGE_KEY = "sozu_credit_solicitud_v1";

export function defaultSolicitudForm(): SolicitudFormState {
  return {
    datos_generales: {
      apellido_y_nombre: "",
      dni: "",
      fecha_nacimiento: "",
      barrio: "",
      direccion: "",
      estado_civil: "",
      nivel_educativo: "",
      telefono: "",
      personas_hogar: "",
      personas_ingresos: "",
      recibe_plan_social: "",
      tiene_otro_empleo: "",
      es_en_blanco: "",
      tiene_monotributo: "",
      banco: "",
      cbu_cvu: "",
    },
    emprendimiento: {
      rubro: "",
      descripcion: "",
      en_funcionamiento: "",
      antiguedad: "",
      objetivo: "",
      uso_ganancia: "",
      estacionalidad: "",
      proveedores: "",
      clientes: "",
      modalidad_cobro: "",
      estrategia_promocion: "",
      competencia: "",
      diferenciacion: "",
    },
    produccion: {
      personas_participan: "",
      distribucion_tareas: "",
      horas_semanales: "",
      bienes_capital: "",
    },
    redes: {
      instagram: "",
      facebook: "",
      otros: "",
    },
    documentacion: {
      fotos_mock: [],
      notas_fotos: "",
      presupuesto_emprendimiento: "",
      presupuesto_familiar: "",
      ventas: "",
    },
    simulador: {
      principal: "50000",
      num_cuotas: "12",
      tna_pct: "36",
    },
    referral_code: "",
  };
}

export function isValidStep(slug: string): slug is SolicitudStepSlug {
  return (SOLICITUD_STEP_SLUGS as readonly string[]).includes(slug);
}

export function stepIndex(slug: SolicitudStepSlug): number {
  return SOLICITUD_STEP_SLUGS.indexOf(slug);
}

/** Flat profile for API compatibility + nested sections for audit */
export function buildApplicantProfileForApi(state: SolicitudFormState): Record<string, unknown> {
  const dg = state.datos_generales;
  return {
    datos_generales: state.datos_generales,
    emprendimiento: state.emprendimiento,
    produccion: state.produccion,
    redes_sociales: state.redes,
    documentacion: state.documentacion,
    full_name: dg.apellido_y_nombre,
    dni: dg.dni,
    phone: dg.telefono,
    cbu: dg.cbu_cvu,
  };
}
