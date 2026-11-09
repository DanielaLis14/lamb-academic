import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { map } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { LucidePlus, LucideTrash } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_COORDINACION } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { alMenosUnaLinea } from '../../../shared/validadores';
import { Persona } from '../persona/persona.model';
import { PersonaService } from '../persona/persona-service';
import { OrigenDocumento, problemaArchivo, problemaEnlace, tamanoLegible } from './documento-form';
import { ACEPTA_ARCHIVO, Catalogo, MAX_DOCUMENTOS, Requisito, TipoSolicitud } from './expediente.model';
import { ExpedienteService } from './expediente-service';
import { LineaResumen, resumirExpediente } from './resumen-expediente';

/** Cada linea tiene un archivo valido o un enlace institucional, segun su origen. */
function contenidoValido(linea: AbstractControl): ValidationErrors | null {
  const origen = linea.get('origen')?.value as OrigenDocumento;
  const problema =
    origen === 'enlace'
      ? problemaEnlace(linea.get('enlace')?.value as string)
      : problemaArchivo(linea.get('archivo')?.value as File | null);
  return problema ? { contenido: problema } : null;
}

/** Ningun nombre de archivo se repite entre las lineas con archivo (el backend aplica la misma regla). */
function archivosDistintos(control: AbstractControl): ValidationErrors | null {
  const nombres = (control.value as { origen: OrigenDocumento; archivo: File | null }[])
    .filter((l) => l.origen === 'archivo')
    .map((l) => l.archivo?.name.toLowerCase())
    .filter(Boolean);
  return new Set(nombres).size !== nombres.length ? { archivoRepetido: true } : null;
}

/**
 * Registro transaccional Expediente + DocumentoAdjunto en una sola peticion, con archivos reales o enlaces de
 * SharePoint: si un documento no es valido o faltan requisitos, el backend no guarda nada. El codigo de tramite
 * lo asigna el servidor.
 */
@Component({
  selector: 'app-expediente-form',
  imports: [ReactiveFormsModule, RouterLink, LucidePlus, LucideTrash],
  templateUrl: './expediente-form.html',
})
export class ExpedienteForm {
  private readonly fb = inject(FormBuilder);
  private readonly expedienteService = inject(ExpedienteService);
  private readonly personaService = inject(PersonaService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);
  private readonly auth = inject(AuthService);

  /** El personal elige el titular; el estudiante registra a su nombre (lo fija el backend). */
  protected readonly esCoordinacion = computed(() => this.auth.tieneRol(...ROLES_COORDINACION));
  protected readonly acepta = ACEPTA_ARCHIVO;
  protected readonly maxDocumentos = MAX_DOCUMENTOS;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly personas = signal<Persona[]>([]);
  protected readonly categorias = signal<Catalogo[]>([]);
  protected readonly tipos = signal<TipoSolicitud[]>([]);
  protected readonly destinatarios = signal<Catalogo[]>([]);
  protected readonly tiposDocumento = signal<Catalogo[]>([]);
  protected readonly tipoElegido = signal<TipoSolicitud | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  /** Las lineas son invalidas si faltan obligatorios del tipo elegido o los archivos superan 25 MB. */
  private readonly requisitosYTamano: ValidatorFn = (control) => {
    const resumen = resumirExpediente((control as FormArray).getRawValue() as LineaResumen[], this.tipoElegido());
    const errores: ValidationErrors = {};
    if (resumen.excedido) errores['tamanoTotal'] = resumen.tamano;
    if (resumen.faltantes.length) errores['requisitos'] = resumen.faltantes.map((r) => r.nombre);
    return Object.keys(errores).length ? errores : null;
  };

  protected readonly form = this.fb.group({
    asunto: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
    personaId: this.fb.control<number | null>(null),
    categoriaId: this.fb.control<number | null>(null, Validators.required),
    tipoSolicitudId: this.fb.control<number | null>(null, Validators.required),
    destinatarioId: this.fb.control<number | null>(null, Validators.required),
    documentos: this.fb.array([this.linea()], [alMenosUnaLinea, archivosDistintos, this.requisitosYTamano]),
  });

  /** Valor de las lineas como senal: el resumen se recalcula con cada cambio de linea o de tipo. */
  private readonly lineas = toSignal(
    this.form.controls.documentos.valueChanges.pipe(map(() => this.form.controls.documentos.getRawValue())),
    { initialValue: this.form.controls.documentos.getRawValue() },
  );
  protected readonly resumen = computed(() => resumirExpediente(this.lineas() as LineaResumen[], this.tipoElegido()));

  constructor() {
    this.expedienteService.categorias().subscribe({
      next: (data) => this.categorias.set(data),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar las categorías.')),
    });
    this.expedienteService.tiposDocumento().subscribe({
      next: (data) => this.tiposDocumento.set(data),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar los tipos de documento.')),
    });
    this.expedienteService.destinatarios().subscribe({
      next: (data) => this.destinatarios.set(data),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar los destinatarios.')),
    });
    if (this.esCoordinacion()) {
      this.form.controls.personaId.addValidators(Validators.required);
      this.personaService.buscar({ activo: true }).subscribe({
        next: (data) => this.personas.set(data),
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar las personas.')),
      });
    }
    this.form.controls.categoriaId.valueChanges.subscribe((id) => this.elegirCategoria(id));
    this.form.controls.tipoSolicitudId.valueChanges.subscribe((id) => this.elegirTipo(id));
  }

  protected get documentos() {
    return this.form.controls.documentos;
  }

  private linea() {
    return this.fb.group(
      {
        nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
        tipoDocumentoInstitucionalId: this.fb.control<number | null>(null, Validators.required),
        origen: this.fb.nonNullable.control<OrigenDocumento>('archivo'),
        archivo: this.fb.control<File | null>(null),
        enlace: this.fb.nonNullable.control(''),
      },
      { validators: contenidoValido },
    );
  }

  private elegirCategoria(id: number | null): void {
    this.tipos.set([]);
    this.form.controls.tipoSolicitudId.setValue(null);
    if (id === null) return;
    this.expedienteService.tiposSolicitud(id).subscribe({
      next: (data) => this.tipos.set(data),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar los tipos de solicitud.')),
    });
  }

  /** El destinatario se propone con el sugerido del tipo; se puede cambiar. */
  private elegirTipo(id: number | null): void {
    const tipo = this.tipos().find((t) => t.id === id) ?? null;
    this.tipoElegido.set(tipo);
    this.form.controls.destinatarioId.setValue(tipo?.destinatarioSugerido?.id ?? null);
    // Los requisitos dependen del tipo: las lineas se vuelven a validar.
    this.documentos.updateValueAndValidity();
  }

  /** La linea nueva viene con el primer requisito obligatorio que aun falta. */
  agregarLinea(): void {
    if (this.documentos.length >= MAX_DOCUMENTOS) return;
    const linea = this.linea();
    const faltante = this.resumen().faltantes[0];
    if (faltante) linea.controls.tipoDocumentoInstitucionalId.setValue(faltante.tipoDocumentoInstitucionalId);
    this.documentos.push(linea);
  }

  protected readonly nombreRequisito = (r: Requisito) => r.nombre;

  /** Tamano legible, con 0 cuando aun no hay archivos. */
  protected tamanoTotal(bytes: number): string {
    return bytes === 0 ? '0 KB' : tamanoLegible(bytes);
  }

  quitarLinea(indice: number): void {
    if (this.documentos.length > 1) this.documentos.removeAt(indice);
  }

  elegirArchivo(indice: number, evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    const linea = this.documentos.at(indice);
    linea.controls.archivo.setValue(archivo);
    linea.controls.archivo.markAsTouched();
    if (archivo && !linea.controls.nombre.value.trim()) {
      linea.controls.nombre.setValue(archivo.name.replace(/\.[^.]+$/, '').slice(0, 150));
    }
  }

  guardar(): void {
    if (this.guardando()) return;
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.expedienteService
      .registrarConArchivos(
        {
          asunto: v.asunto.trim(),
          personaId: this.esCoordinacion() ? v.personaId : null,
          categoriaId: v.categoriaId as number,
          tipoSolicitudId: v.tipoSolicitudId as number,
          destinatarioId: v.destinatarioId,
          documentos: v.documentos.map((d) => ({
            nombre: d.nombre.trim(),
            tipoDocumentoInstitucionalId: d.tipoDocumentoInstitucionalId as number,
            enlace: d.origen === 'enlace' ? d.enlace.trim() : null,
          })),
        },
        v.documentos.filter((d) => d.origen === 'archivo').map((d) => d.archivo as File),
      )
      .subscribe({
        next: (e) => {
          this.avisos.mostrar(`Expediente ${e.codigoTramite} registrado con ${e.totalDocumentos} documento(s).`, 'ok');
          this.router.navigate(['/expedientes', e.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(
            err.status === 413
              ? 'Los archivos superan el tamaño permitido. No se guardó ningún dato.'
              : mensajeHttp(err, 'No se pudo registrar el expediente. No se guardó ningún dato.'),
          );
          this.guardando.set(false);
        },
      });
  }

  protected mensaje(campo: 'asunto' | 'personaId' | 'categoriaId' | 'tipoSolicitudId' | 'destinatarioId'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    return '';
  }

  protected mensajeLinea(indice: number, campo: 'nombre' | 'tipoDocumentoInstitucionalId' | 'contenido'): string {
    const linea = this.documentos.at(indice);
    if (campo === 'contenido') {
      const tocado = linea.controls.archivo.touched || linea.controls.enlace.touched;
      return tocado ? ((linea.getError('contenido') as string | null) ?? '') : '';
    }
    const control = linea.controls[campo];
    if (!control.touched) return '';
    if (campo === 'tipoDocumentoInstitucionalId') return control.hasError('required') ? 'Elige el tipo de documento.' : '';
    if (control.hasError('required')) return 'Indica el nombre del documento.';
    if (control.hasError('maxlength')) return 'Máximo 150 caracteres.';
    return '';
  }
}
