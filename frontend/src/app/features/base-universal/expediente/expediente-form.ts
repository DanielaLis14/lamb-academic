import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucidePlus, LucideTrash } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_COORDINACION } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { alMenosUnaLinea } from '../../../shared/validadores';
import { Persona } from '../persona/persona.model';
import { PersonaService } from '../persona/persona-service';
import { problemaArchivo, tamanoLegible } from './documento-form';
import { ACEPTA_ARCHIVO, MAX_DOCUMENTOS } from './expediente.model';
import { ExpedienteService } from './expediente-service';

function codigoSugerido(): string {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `EXP-${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}${dos(d.getSeconds())}`;
}

function archivoValido(control: AbstractControl): ValidationErrors | null {
  const problema = problemaArchivo(control.value as File | null);
  return problema ? { archivo: problema } : null;
}

/** Ningun nombre de archivo se repite entre las lineas (el backend aplica la misma regla). */
function archivosDistintos(control: AbstractControl): ValidationErrors | null {
  const nombres = (control.value as { archivo: File | null }[])
    .map((l) => l.archivo?.name.toLowerCase())
    .filter(Boolean);
  return new Set(nombres).size !== nombres.length ? { archivoRepetido: true } : null;
}

/**
 * Registro transaccional Expediente + DocumentoAdjunto con archivos reales en una sola peticion: si un
 * archivo no es valido, el backend no guarda la cabecera, ni los documentos, ni ningun archivo.
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
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly form = this.fb.group({
    codigoTramite: this.fb.nonNullable.control(codigoSugerido(), [Validators.required, Validators.maxLength(50)]),
    asunto: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(255)]),
    personaId: this.fb.control<number | null>(null),
    documentos: this.fb.array([this.linea()], [alMenosUnaLinea, archivosDistintos]),
  });

  constructor() {
    if (this.esCoordinacion()) {
      this.form.controls.personaId.addValidators(Validators.required);
      this.personaService.buscar({ activo: true }).subscribe({
        next: (data) => this.personas.set(data),
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar las personas.')),
      });
    }
  }

  protected get documentos() {
    return this.form.controls.documentos;
  }

  private linea() {
    return this.fb.group({
      nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
      archivo: this.fb.control<File | null>(null, archivoValido),
    });
  }

  agregarLinea(): void {
    if (this.documentos.length < MAX_DOCUMENTOS) this.documentos.push(this.linea());
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
          codigoTramite: v.codigoTramite.trim(),
          asunto: v.asunto.trim(),
          personaId: this.esCoordinacion() ? v.personaId : null,
          nombres: v.documentos.map((d) => d.nombre.trim()),
        },
        v.documentos.map((d) => d.archivo as File),
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

  protected mensaje(campo: 'codigoTramite' | 'asunto' | 'personaId'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    return '';
  }

  protected mensajeLinea(indice: number, campo: 'nombre' | 'archivo'): string {
    const control = this.documentos.at(indice).controls[campo];
    if (!control.touched) return '';
    if (campo === 'archivo') return control.getError('archivo') ?? '';
    if (control.hasError('required')) return 'Indica el nombre del documento.';
    if (control.hasError('maxlength')) return 'Máximo 150 caracteres.';
    return '';
  }
}
