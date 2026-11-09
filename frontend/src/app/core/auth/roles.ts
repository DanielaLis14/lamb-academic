/**
 * Roles del realm lamb-academic. Son los mismos que exige SecurityConfig en el backend:
 * el menu y los guards solo reflejan esas reglas, nunca las reemplazan (S11 2.7).
 */
export const Rol = {
  ESTUDIANTE: 'ESTUDIANTE',
  COORDINADOR: 'COORDINADOR',
  ADMIN: 'ADMIN',
  CAJERO: 'CAJERO',
  DOCENTE: 'DOCENTE',
} as const;

export type Rol = (typeof Rol)[keyof typeof Rol];

/** Pueden registrar matriculas (el ESTUDIANTE solo la suya: lo valida el backend). */
export const ROLES_MATRICULA: Rol[] = [Rol.ESTUDIANTE, Rol.COORDINADOR, Rol.ADMIN];
/** Coordinacion academica: secciones, matriculas de cualquier alumno, anulacion y reportes. */
export const ROLES_COORDINACION: Rol[] = [Rol.COORDINADOR, Rol.ADMIN];
/** Consultan datos personales de Base Universal (personas y alumnos). */
export const ROLES_PERSONAL: Rol[] = [Rol.COORDINADOR, Rol.ADMIN, Rol.CAJERO];
/** Expedientes: el ESTUDIANTE los suyos; coordinacion y administracion todos. */
export const ROLES_EXPEDIENTE: Rol[] = [Rol.ESTUDIANTE, Rol.COORDINADOR, Rol.ADMIN];
/** Finanzas: caja opera los cargos; coordinacion los consulta. */
export const ROLES_FINANZAS: Rol[] = [Rol.CAJERO, Rol.COORDINADOR, Rol.ADMIN];
/** Operan pagos y registran cargos (SecurityConfig: /api/v1/finanzas/** CAJERO, ADMIN). */
export const ROLES_CAJA: Rol[] = [Rol.CAJERO, Rol.ADMIN];
