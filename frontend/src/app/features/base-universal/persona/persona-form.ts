import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AvisoService } from '../../../core/services/aviso-service';
import { cuerpoError, mensajeHttp } from '../../../core/services/error-http';
import { DocenteService } from '../../core-academico/docente/docente-service';
import { Escuela } from '../institucional/institucional.model';
import { InstitucionalService } from '../institucional/institucional-service';
import { DatosPersona, NOMBRE_TIPO_PERSONA, Persona, TIPOS_DOCUMENTO, TIPOS_PERSONA, TipoPersona } from './persona.model';
import { PersonaService } from './persona-service';

type Campo = 'numeroDocumento' | 'nombres' | 'apellidoPaterno' | 'apellidoMaterno' | 'email' | 'telefono'
  | 'direccion' | 'fechaNacimiento';

/**
 * Formulario de Persona. Con la ruta en modo docente (data.docente) es la misma persona con el tipo fijo
 * en DOCENTE y se guarda por /api/v1/docentes: no hay una segunda entidad para la plana docente.
 */
@Component({
  selector: 'app-persona-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './persona-form.html',
})
export class PersonaForm {
  private readonly fb = inject(FormBuilder);
  private readonly personaService = inject(PersonaService);
  private readonly docenteService = inject(DocenteService);
  private readonly institucional = inject(InstitucionalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly esDocente = this.route.snapshot.data['docente'] === true;
  protected readonly volverA = this.esDocente ? '/academico/docentes' : '/personas';
  protected readonly tipos = TIPOS_PERSONA;
  protected readonly nombreTipo = NOMBRE_TIPO_PERSONA;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly escuelas = signal<Escuela[]>([]);
  protected readonly id = signal<number | null>(null);
  protected readonly inactiva = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});
  protected readonly loading = signal(false);
  protected readonly errorCarga = signal(false);

  protected readonly form = this.fb.group({
    tipoPersona: this.fb.nonNullable.control<TipoPersona>(this.esDocente ? 'DOCENTE' : 'ALUMNO', Validators.required),
    tipoDocumento: this.fb.nonNullable.control<DatosPersona['tipoDocumento']>('DNI', Validators.required),
    numeroDocumento: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^\d{8,12}$/)]),
    nombres: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(120)]),
    apellidoPaterno: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(80)]),
    apellidoMaterno: this.fb.nonNullable.control('', [Validators.maxLength(80)]),
    email: this.fb.nonNullable.control('', [Validators.email, Validators.maxLength(150)]),
    telefono: this.fb.nonNullable.control('', [Validators.pattern(/^$|^[0-9+ ]{6,20}$/)]),
    direccion: this.fb.nonNullable.control('', [Validators.maxLength(255)]),
    fechaNacimiento: this.fb.nonNullable.control(''),
    idEscuela: this.fb.control<number | null>(null),
  });

  constructor() {
    this.institucional.escuelas().subscribe({ next: (data) => this.escuelas.set(data.filter((e) => e.activo)) });
    if (this.esDocente) this.form.controls.tipoPersona.disable();
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    this.id.set(id);
    this.loading.set(true);
    const carga: Observable<Persona> = this.esDocente ? this.docenteService.obtener(id) : this.personaService.obtener(id);
    carga.subscribe({
      next: (p) => {
        this.form.patchValue({
          ...p,
          apellidoMaterno: p.apellidoMaterno ?? '',
          email: p.email ?? '',
          telefono: p.telefono ?? '',
          direccion: p.direccion ?? '',
          fechaNacimiento: p.fechaNacimiento ?? '',
        });
        this.inactiva.set(!p.activo);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorCarga.set(true);
        this.error.set(mensajeHttp(err, this.esDocente ? 'No se pudo cargar el docente.' : 'No se pudo cargar la persona.'));
        this.loading.set(false);
      },
    });
  }

  guardar(): void {
    if (this.loading() || this.errorCarga()) return;
    this.error.set(null);
    this.erroresServidor.set({});
    for (const campo of ['numeroDocumento', 'nombres', 'apellidoPaterno', 'apellidoMaterno', 'email', 'telefono', 'direccion'] as const) {
      const control = this.form.controls[campo];
      control.setValue(control.value.trim());
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const datos: DatosPersona = {
      tipoDocumento: v.tipoDocumento,
      numeroDocumento: v.numeroDocumento,
      nombres: v.nombres,
      apellidoPaterno: v.apellidoPaterno,
      apellidoMaterno: v.apellidoMaterno || null,
      email: v.email || null,
      telefono: v.telefono || null,
      direccion: v.direccion || null,
      fechaNacimiento: v.fechaNacimiento || null,
      idEscuela: v.idEscuela,
    };
    const id = this.id();
    let peticion: Observable<Persona>;
    if (this.esDocente) {
      peticion = id ? this.docenteService.actualizar(id, datos) : this.docenteService.crear(datos);
    } else {
      const persona = { ...datos, tipoPersona: v.tipoPersona };
      peticion = id ? this.personaService.actualizar(id, persona) : this.personaService.crear(persona);
    }
    this.loading.set(true);
    peticion.subscribe({
      next: (p) => {
        this.avisos.mostrar(`${p.nombreCompleto} ${id ? 'actualizado' : 'registrado'}.`, 'ok');
        this.router.navigate([this.volverA]);
      },
      error: (err: HttpErrorResponse) => {
        this.erroresServidor.set(cuerpoError(err)?.errores ?? {});
        this.error.set(mensajeHttp(err, 'No se pudo guardar el registro.'));
        this.loading.set(false);
      },
    });
  }

  protected mensajeValidacion(campo: Campo): string {
    const control = this.form.controls[campo];
    const servidor = this.erroresServidor()[campo];
    if (servidor) return servidor;
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control.hasError('email')) return 'Ingresa un correo válido.';
    if (control.hasError('pattern')) {
      return campo === 'numeroDocumento' ? 'Entre 8 y 12 dígitos.' : 'Solo dígitos, espacios y +, de 6 a 20 caracteres.';
    }
    return '';
  }
}
