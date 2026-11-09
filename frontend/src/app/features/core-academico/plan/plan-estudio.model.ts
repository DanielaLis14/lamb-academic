/** Contratos de PlanEstudio (coreacademico.plan): malla curricular cabecera-detalle con prerrequisitos. */
export type TipoCursoPlan = 'OBLIGATORIO' | 'ELECTIVO';
export type EstadoPlan = 'VIGENTE' | 'OBSOLETO';

export const TIPOS_CURSO_PLAN: TipoCursoPlan[] = ['OBLIGATORIO', 'ELECTIVO'];
export const ESTADOS_PLAN: EstadoPlan[] = ['VIGENTE', 'OBSOLETO'];

/** PlanEstudioService.CREDITOS_MIN_CICLO / MAX_CICLO; el backend decide al registrar. */
export const CREDITOS_MIN_CICLO = 6;
export const CREDITOS_MAX_CICLO = 24;

export interface DetallePlan {
  id: number;
  idCurso: number;
  cursoCodigo: string;
  cursoNombre: string;
  ciclo: number;
  creditos: number;
  tipo: TipoCursoPlan;
  idPrerrequisito: number | null;
  prerrequisitoCodigo: string | null;
}

export interface PlanEstudio {
  id: number;
  idEscuela: number;
  escuelaNombre: string | null;
  codigo: string;
  nombre: string;
  anio: number;
  version: number;
  estado: EstadoPlan;
  totalCreditos: number;
  totalCursos: number;
  detalles: DetallePlan[];
}

export interface DetallePlanRequest {
  idCurso: number;
  ciclo: number;
  creditos: number;
  tipo: TipoCursoPlan;
  idPrerrequisito: number | null;
}

export interface PlanEstudioRequest {
  idEscuela: number;
  codigo: string;
  nombre: string;
  anio: number;
  detalles: DetallePlanRequest[];
}

export interface PlanDistribucion {
  ciclo: number;
  cantidadCursos: number;
  creditos: number;
}

export interface PlanResumen {
  idEscuela: number;
  escuela: string;
  estado: EstadoPlan;
  cantidadPlanes: number;
  totalCreditos: number;
}

/** Filtros combinados y orden de GET /api/v1/planes-estudio. */
export interface FiltroPlanes {
  idEscuela?: number | null;
  estado?: EstadoPlan | null;
  anio?: number | null;
  q?: string | null;
  sortBy?: string;
  dir?: 'asc' | 'desc';
}
