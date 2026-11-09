import { AbstractControl, FormArray, FormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import {
  DOMINIOS_SHAREPOINT,
  DocumentoAdjuntoRequest,
  EXTENSIONES_ARCHIVO,
  TAMANO_MAXIMO_ARCHIVO,
  TipoArchivo,
} from './expediente.model';

/**
 * Origen del contenido de un documento: archivo cargado al almacen, ruta declarada (registros previos)
 * o enlace institucional de SharePoint.
 */
export type OrigenDocumento = 'archivo' | 'ruta' | 'enlace';

const MENSAJE_ENLACE =
  'Usa un enlace de SharePoint u OneDrive de la universidad (https://upeuedupe.sharepoint.com o https://upeuedupe-my.sharepoint.com).';

/** EnlaceSharePoint.validar del backend: https, dominio institucional, sin usuario ni puerto. */
export function problemaEnlace(enlace: string | null | undefined): string | null {
  const valor = (enlace ?? '').trim();
  if (!valor) return 'Pega el enlace de SharePoint.';
  if (valor.toLowerCase().startsWith('almacen:')) return 'Ese prefijo está reservado para los archivos del sistema.';
  if (valor.length > 1000) return 'El enlace admite como máximo 1000 caracteres.';
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return MENSAJE_ENLACE;
  }
  const institucional =
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    url.port === '' &&
    DOMINIOS_SHAREPOINT.includes(url.hostname) &&
    valor.startsWith(`https://${url.hostname}/`);
  return institucional ? null : MENSAJE_ENLACE;
}

export const enlaceValido: ValidatorFn = (control) => {
  const problema = problemaEnlace(control.value as string | null);
  return problema ? { enlace: problema } : null;
};

/** TipoArchivo.coincideCon del backend: la extension del nombre de archivo debe ser la del tipo. */
export function extensionCoincide(grupo: AbstractControl): ValidationErrors | null {
  const tipo = grupo.get('tipoDocumento')?.value as TipoArchivo | null;
  const archivo = (grupo.get('nombreArchivo')?.value as string | null)?.trim().toLowerCase() ?? '';
  const extensiones = tipo === 'JPG' ? ['.jpg', '.jpeg'] : [`.${tipo?.toLowerCase()}`];
  return tipo && archivo && !extensiones.some((e) => archivo.endsWith(e)) ? { extension: true } : null;
}

/** En el FormArray de documentos: el nombre de archivo no se repite (sin distinguir mayusculas). */
export const archivosSinRepetir: ValidatorFn = (control) => {
  const nombres = (control as FormArray).controls
    .map((linea) => (linea.get('nombreArchivo')?.value as string)?.trim().toLowerCase())
    .filter(Boolean);
  return new Set(nombres).size !== nombres.length ? { archivoRepetido: true } : null;
};

/**
 * Linea de DocumentoAdjuntoRequest con las reglas de forma del backend para su origen: con ruta declarada exige
 * nombre, tipo y ruta del archivo; con enlace, un enlace institucional; con archivo cargado, solo nombre y tipo.
 */
export function grupoDocumento(
  fb: FormBuilder,
  valor?: Partial<DocumentoAdjuntoRequest>,
  origen: OrigenDocumento = 'ruta',
) {
  const ruta = origen === 'ruta';
  return fb.nonNullable.group(
    {
      nombre: [valor?.nombre ?? '', [Validators.required, Validators.maxLength(150)]],
      tipoDocumentoInstitucionalId: fb.control<number | null>(valor?.tipoDocumentoInstitucionalId ?? null,
        Validators.required),
      nombreArchivo: [valor?.nombreArchivo ?? '', ruta ? [Validators.required, Validators.maxLength(255)] : []],
      tipoDocumento: [(valor?.tipoDocumento ?? 'PDF') as TipoArchivo, ruta ? Validators.required : []],
      rutaArchivo: [valor?.rutaArchivo ?? '', ruta ? [Validators.required, Validators.maxLength(500)] : []],
      enlace: [valor?.enlace ?? '', origen === 'enlace' ? enlaceValido : []],
    },
    { validators: ruta ? extensionCoincide : [] },
  );
}

export type GrupoDocumento = ReturnType<typeof grupoDocumento>;

export function valorDocumento(grupo: GrupoDocumento, origen: OrigenDocumento = 'ruta'): DocumentoAdjuntoRequest {
  const v = grupo.getRawValue();
  const base = { nombre: v.nombre.trim(), tipoDocumentoInstitucionalId: v.tipoDocumentoInstitucionalId as number };
  if (origen === 'enlace') return { ...base, enlace: v.enlace.trim() };
  if (origen === 'archivo') return base;
  return { ...base, nombreArchivo: v.nombreArchivo.trim(), tipoDocumento: v.tipoDocumento, rutaArchivo: v.rutaArchivo.trim() };
}

/** Mensaje de validacion de un campo de la linea. */
export function mensajeDocumento(grupo: GrupoDocumento, campo: keyof GrupoDocumento['controls']): string {
  const control = grupo.controls[campo];
  if (!control.touched) return '';
  if (campo === 'tipoDocumentoInstitucionalId' && control.hasError('required')) return 'Elige el tipo de documento.';
  if (campo === 'enlace') return (control.getError('enlace') as string | null) ?? '';
  if (control.hasError('required')) return 'Obligatorio.';
  if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
  if (campo === 'nombreArchivo' && grupo.hasError('extension')) {
    return `La extensión debe ser .${grupo.controls.tipoDocumento.value.toLowerCase()}.`;
  }
  return '';
}

/** Archivo aceptable antes de enviarlo: extension permitida y tamano maximo (el backend revisa el contenido). */
export function problemaArchivo(archivo: File | null): string | null {
  if (!archivo) return 'Selecciona el archivo.';
  const nombre = archivo.name.toLowerCase();
  if (!EXTENSIONES_ARCHIVO.some((e) => nombre.endsWith(e))) return 'Solo se aceptan archivos PDF, PNG o JPG.';
  if (archivo.size === 0) return 'El archivo está vacío.';
  if (archivo.size > TAMANO_MAXIMO_ARCHIVO) return 'El archivo supera los 5 MB.';
  return null;
}

export function tamanoLegible(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Guarda en el equipo un archivo descargado con el token de la sesion. */
export function guardarEnEquipo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
