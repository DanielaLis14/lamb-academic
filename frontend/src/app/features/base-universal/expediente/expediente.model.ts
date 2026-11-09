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

/** Registro activo de un catalogo de tramite (V5). */
export interface Catalogo {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}

export interface CatalogoResumen {
  id: number;
  codigo: string;
  nombre: string;
}

export interface Requisito {
  tipoDocumentoInstitucionalId: number;
  codigo: string;
  nombre: string;
  /** false: recomendado, no se exige. */
  obligatorio: boolean;
}

export interface TipoSolicitud {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoriaId: number;
  /** null si el destinatario sugerido esta inactivo: hay que elegir uno. */
  destinatarioSugerido: CatalogoResumen | null;
  requisitos: Requisito[];
}

/**
 * Documento por metadatos: ruta declarada (nombreArchivo, tipoDocumento y rutaArchivo) o enlace de SharePoint.
 * En un documento con archivo cargado solo cuentan el nombre y el tipo institucional.
 */
export interface DocumentoAdjuntoRequest {
  nombre: string;
  tipoDocumentoInstitucionalId: number;
  nombreArchivo?: string | null;
  tipoDocumento?: TipoArchivo | null;
  rutaArchivo?: string | null;
  enlace?: string | null;
}

export interface DocumentoAdjunto {
  id: number;
  nombre: string;
  /** null solo en documentos registrados antes de los catalogos. */
  tipoDocumentoInstitucional: CatalogoResumen | null;
  nombreArchivo: string;
  /** Formato del archivo; null en un documento con enlace. */
  tipoDocumento: TipoArchivo | null;
  /** Ruta declarada en los registros anteriores; null si el archivo esta en el almacen o hay enlace. */
  rutaArchivo: string | null;
  /** Enlace institucional de SharePoint: se abre en una pestana nueva, no se descarga. */
  enlace: string | null;
  tamanoBytes: number | null;
  fechaCarga: string;
  archivoDisponible: boolean;
}

/** El codigo de tramite (TR-AAAA-NNNNN) lo genera el servidor. */
export interface ExpedienteRequest {
  asunto: string;
  /** Lo indica el personal; para un ESTUDIANTE el backend usa la persona de su token. */
  personaId: number | null;
  categoriaId: number;
  tipoSolicitudId: number;
  /** null: el destinatario sugerido del tipo. */
  destinatarioId: number | null;
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
  /** null en los expedientes registrados antes de los catalogos. */
  tipoSolicitudNombre: string | null;
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
  /** null en los expedientes registrados antes de los catalogos. */
  categoria: CatalogoResumen | null;
  tipoSolicitud: CatalogoResumen | null;
  destinatario: CatalogoResumen | null;
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

/** Documento del registro multipart: sin enlace recibe, en orden, el siguiente archivo. */
export interface DocumentoArchivoRequest {
  nombre: string;
  tipoDocumentoInstitucionalId: number;
  enlace: string | null;
}

/** Parte "datos" del registro multipart; los archivos van en el orden de los documentos sin enlace. */
export interface ExpedienteArchivosRequest {
  asunto: string;
  personaId: number | null;
  categoriaId: number;
  tipoSolicitudId: number;
  destinatarioId: number | null;
  documentos: DocumentoArchivoRequest[];
}

/** Lo mismo que acepta AlmacenArchivos del backend (el servidor vuelve a validar el contenido). */
export const TAMANO_MAXIMO_ARCHIVO = 5 * 1024 * 1024;
export const EXTENSIONES_ARCHIVO = ['.pdf', '.png', '.jpg', '.jpeg'];
export const ACEPTA_ARCHIVO = 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg';

/** Suma maxima de archivos de un expediente (lamb.archivos.tamano-maximo-expediente); los enlaces no cuentan. */
export const TAMANO_MAXIMO_EXPEDIENTE = 25 * 1024 * 1024;

/** Dominios de SharePoint y OneDrive de la universidad (EnlaceSharePoint del backend). */
export const DOMINIOS_SHAREPOINT = ['upeuedupe.sharepoint.com', 'upeuedupe-my.sharepoint.com'];
