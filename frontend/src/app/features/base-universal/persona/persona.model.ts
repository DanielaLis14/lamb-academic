/** PersonaRequest / PersonaResponse de Base Universal (persona/dto). */
export const TIPOS_PERSONA = ['ALUMNO', 'DOCENTE', 'ADMINISTRATIVO', 'CAJERO', 'EXTERNO'] as const;
export type TipoPersona = (typeof TIPOS_PERSONA)[number];

export const TIPOS_DOCUMENTO = ['DNI', 'CE', 'PASAPORTE', 'RUC'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const NOMBRE_TIPO_PERSONA: Record<TipoPersona, string> = {
  ALUMNO: 'Alumno',
  DOCENTE: 'Docente',
  ADMINISTRATIVO: 'Administrativo',
  CAJERO: 'Cajero',
  EXTERNO: 'Externo',
};

export interface Persona {
  id: number;
  tipoPersona: TipoPersona;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  nombreCompleto: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  idEscuela: number | null;
  escuelaNombre: string | null;
  activo: boolean;
}

/** Datos personales comunes; PersonaRequest agrega el tipo y DocenteRequest lo fija en DOCENTE. */
export interface DatosPersona {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  fechaNacimiento: string | null;
  idEscuela: number | null;
}

export interface PersonaRequest extends DatosPersona {
  tipoPersona: TipoPersona;
}

export interface FiltroPersonas {
  tipoPersona?: TipoPersona | null;
  activo?: boolean | null;
  q?: string | null;
  idEscuela?: number | null;
}
