import { AbstractControl, FormArray, FormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DocumentoAdjuntoRequest, EXTENSIONES_ARCHIVO, TAMANO_MAXIMO_ARCHIVO, TipoArchivo } from './expediente.model';

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

/** Linea de DocumentoAdjuntoRequest con las mismas reglas de forma del backend. */
export function grupoDocumento(fb: FormBuilder, valor?: Partial<DocumentoAdjuntoRequest>) {
  return fb.nonNullable.group(
    {
      nombre: [valor?.nombre ?? '', [Validators.required, Validators.maxLength(150)]],
      nombreArchivo: [valor?.nombreArchivo ?? '', [Validators.required, Validators.maxLength(255)]],
      tipoDocumento: [(valor?.tipoDocumento ?? 'PDF') as TipoArchivo, Validators.required],
      rutaArchivo: [valor?.rutaArchivo ?? '', [Validators.required, Validators.maxLength(500)]],
    },
    { validators: extensionCoincide },
  );
}

export type GrupoDocumento = ReturnType<typeof grupoDocumento>;

export function valorDocumento(grupo: GrupoDocumento): DocumentoAdjuntoRequest {
  const v = grupo.getRawValue();
  return {
    nombre: v.nombre.trim(),
    nombreArchivo: v.nombreArchivo.trim(),
    tipoDocumento: v.tipoDocumento,
    rutaArchivo: v.rutaArchivo.trim(),
  };
}

/** Mensaje de validacion de un campo de la linea. */
export function mensajeDocumento(grupo: GrupoDocumento, campo: keyof DocumentoAdjuntoRequest): string {
  const control = grupo.controls[campo];
  if (!control.touched) return '';
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
