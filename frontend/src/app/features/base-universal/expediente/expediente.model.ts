/** Contratos de Expediente - DocumentoAdjunto (baseuniversal/expediente/dto). */
export const ESTADOS_EXPEDIENTE = ['REGISTRADO', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'ARCHIVADO'] as const;
export type EstadoExpediente = (typeof ESTADOS_EXPEDIENTE)[number];

export const NOMBRE_ESTADO_EXPEDIENTE: Record<EstadoExpediente, string> = {
  REGISTRADO: 'Registrado',
  EN_REVISION: 'En revisión',
  OBSERVADO: 'Observado',
  APROBADO: 'Aprobado',
  ARCHIVADO: 'Archivado',
};

export const TIPOS_ARCHIVO = ['PDF', 'JPG', 'PNG', 'DOCX'] as const;
export type TipoArchivo = (typeof TIPOS_ARCHIVO)[number];

/** ExpedienteService.TRANSICIONES; el backend las vuelve a validar. */
export const TRANSICIONES_EXPEDIENTE: Record<EstadoExpediente, EstadoExpediente[]> = {
  REGISTRADO: ['EN_REVISION', 'ARCHIVADO'],
  EN_REVISION: ['OBSERVADO', 'APROBADO'],
  OBSERVADO: ['EN_REVISION', 'ARCHIVADO'],
  APROBADO: ['ARCHIVADO'],
  ARCHIVADO: [],
};

/** Estados en los que el titular o el personal pueden agregar, corregir o quitar documentos. */
export const ESTADOS_EDITABLES: EstadoExpediente[] = ['REGISTRADO', 'OBSERVADO'];

export const MAX_DOCUMENTOS = 20;

export interface DocumentoAdjuntoRequest {
  nombre: string;
  nombreArchivo: string;
  tipoDocumento: TipoArchivo;
  rutaArchivo: string;
}

export interface DocumentoAdjunto {
  id: number;
  nombre: string;
  nombreArchivo: string;
  tipoDocumento: TipoArchivo;
  /** Ruta declarada en los registros anteriores; null si el archivo esta en el almacen del sistema. */
  rutaArchivo: string | null;
  fechaCarga: string;
  archivoDisponible: boolean;
}

export interface ExpedienteRequest {
  codigoTramite: string;
  asunto: string;
  /** Lo indica el personal; para un ESTUDIANTE el backend usa la persona de su token. */
  personaId: number | null;
  documentos: DocumentoAdjuntoRequest[];
}

export interface ExpedienteResumen {
  id: number;
  codigoTramite: string;
  asunto: string;
  fechaRegistro: string;
  estado: EstadoExpediente;
  totalDocumentos: number;
  personaId: number;
  personaNombre: string;
}

export interface Expediente {
  id: number;
  codigoTramite: string;
  asunto: string;
  fechaRegistro: string;
  estado: EstadoExpediente;
  totalDocumentos: number;
  persona: {
    id: number;
    numeroDocumento: string;
    nombreCompleto: string;
    email: string | null;
    idEscuela: number | null;
    escuelaNombre: string | null;
  };
  documentos: DocumentoAdjunto[];
}

export interface ExpedienteEstadoReporte {
  estado: EstadoExpediente;
  cantidadExpedientes: number;
  totalDocumentos: number;
}

export interface FiltroExpedientes {
  personaId?: number | null;
  estado?: EstadoExpediente | null;
  desde?: string | null;
  hasta?: string | null;
}

/** Parte "datos" del registro con archivos: los nombres van en el mismo orden que los archivos. */
export interface ExpedienteArchivosRequest {
  codigoTramite: string;
  asunto: string;
  personaId: number | null;
  nombres: string[];
}

/** Lo mismo que acepta AlmacenArchivos del backend (el servidor vuelve a validar el contenido). */
export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;
export const EXTENSIONES_ARCHIVO = ['.pdf', '.png', '.jpg', '.jpeg'];
export const ACEPTA_ARCHIVO = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';
