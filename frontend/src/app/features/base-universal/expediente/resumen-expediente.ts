import { OrigenDocumento } from './documento-form';
import { Requisito, TAMANO_MAXIMO_EXPEDIENTE, TipoSolicitud } from './expediente.model';

/** Lo que el resumen necesita de cada linea del formulario. */
export interface LineaResumen {
  origen: OrigenDocumento;
  archivo: File | null;
  tipoDocumentoInstitucionalId: number | null;
}

export interface RequisitoResumen {
  requisito: Requisito;
  cumplido: boolean;
}

export interface ResumenExpediente {
  documentos: number;
  /** Bytes de los archivos elegidos; las lineas con enlace no suman. */
  tamano: number;
  maximo: number;
  /** 0-100, para la barra. */
  porcentaje: number;
  excedido: boolean;
  obligatorios: RequisitoResumen[];
  recomendados: RequisitoResumen[];
  cumplidos: number;
  /** Obligatorios que aun no tienen una linea de su tipo, en orden de catalogo. */
  faltantes: Requisito[];
}

/**
 * Resumen del expediente que se esta armando, con las mismas reglas del backend: los archivos suman hasta
 * 25 MB (los enlaces no cuentan) y cada requisito obligatorio necesita una linea de su tipo, con archivo o enlace.
 */
export function resumirExpediente(lineas: LineaResumen[], tipo: TipoSolicitud | null): ResumenExpediente {
  const tamano = lineas
    .filter((l) => l.origen === 'archivo' && l.archivo)
    .reduce((total, l) => total + (l.archivo as File).size, 0);
  const presentes = new Set(lineas.map((l) => l.tipoDocumentoInstitucionalId).filter((id) => id !== null));
  const evaluar = (requisito: Requisito): RequisitoResumen => ({
    requisito,
    cumplido: presentes.has(requisito.tipoDocumentoInstitucionalId),
  });
  const obligatorios = (tipo?.requisitos ?? []).filter((r) => r.obligatorio).map(evaluar);
  const recomendados = (tipo?.requisitos ?? []).filter((r) => !r.obligatorio).map(evaluar);
  return {
    documentos: lineas.length,
    tamano,
    maximo: TAMANO_MAXIMO_EXPEDIENTE,
    porcentaje: Math.min(100, Math.round((tamano / TAMANO_MAXIMO_EXPEDIENTE) * 100)),
    excedido: tamano > TAMANO_MAXIMO_EXPEDIENTE,
    obligatorios,
    recomendados,
    cumplidos: obligatorios.filter((o) => o.cumplido).length,
    faltantes: obligatorios.filter((o) => !o.cumplido).map((o) => o.requisito),
  };
}
