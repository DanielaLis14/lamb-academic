import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AvisoService } from '../../../core/services/aviso-service';
import { cuerpoError, mensajeHttp } from '../../../core/services/error-http';
import { Persona } from '../persona/persona.model';
import { PersonaService } from '../persona/persona-service';
import { Alumno, AlumnoService } from './alumno-service';

function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Alta y correccion de Alumno. Un alumno es una Persona de tipo Alumno, activa y sin otro registro de
 * alumno; al editar, la persona no cambia (lo exige AlumnoService).
 */
@Component({
  selector: 'app-alumno-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './alumno-form.html',
})
export class AlumnoForm {
  private readonly fb = inject(FormBuilder);
  private readonly alumnoService = inject(AlumnoService);
  private readonly personaService = inject(PersonaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly hoy = hoy();
  protected readonly id = signal<number | null>(null);
  protected readonly alumno = signal<Alumno | null>(null);
  private readonly personas = signal<Persona[]>([]);
  private readonly personasConAlumno = signal<Set<number>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});
  protected readonly loading = signal(false);
  protected readonly errorCarga = signal(false);

  /** Personas de tipo Alumno, activas y que aun no tienen registro de alumno. */
  protected readonly disponibles = computed(() =>
    this.personas().filter((p) => !this.personasConAlumno().has(p.id)),
  );

  protected readonly form = this.fb.group({
    personaId: this.fb.control<number | null>(null, Validators.required),
    codigoEstudiante: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[A-Z0-9-]{4,20}$/)]),
    fechaIngreso: this.fb.nonNullable.control('', Validators.required),
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.loading.set(true);
    if (idParam) {
      const id = Number(idParam);
      this.id.set(id);
      this.alumnoService.obtener(id).subscribe({
        next: (a) => {
          this.alumno.set(a);
          this.form.patchValue({ personaId: a.persona.id, codigoEstudiante: a.codigoEstudiante, fechaIngreso: a.fechaIngreso });
          this.form.controls.personaId.disable();
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => this.falloCarga(err, 'No se pudo cargar el alumno.'),
      });
      return;
    }
    forkJoin({
      personas: this.personaService.buscar({ tipoPersona: 'ALUMNO', activo: true }),
      alumnos: this.alumnoService.buscar({}),
    }).subscribe({
      next: ({ personas, alumnos }) => {
        this.personas.set(personas);
        this.personasConAlumno.set(new Set(alumnos.map((a) => a.persona.id)));
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => this.falloCarga(err, 'No se pudieron cargar las personas disponibles.'),
    });
  }

  guardar(): void {
    if (this.loading() || this.errorCarga()) return;
    this.error.set(null);
    this.erroresServidor.set({});
    const codigo = this.form.controls.codigoEstudiante;
    codigo.setValue(codigo.value.trim().toUpperCase());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const solicitud = { personaId: v.personaId!, codigoEstudiante: v.codigoEstudiante, fechaIngreso: v.fechaIngreso };
    const id = this.id();
    this.loading.set(true);
    (id ? this.alumnoService.actualizar(id, solicitud) : this.alumnoService.crear(solicitud)).subscribe({
      next: (a) => {
        this.avisos.mostrar(`Alumno ${a.codigoEstudiante} ${id ? 'actualizado' : 'registrado'}.`, 'ok');
        this.router.navigate(['/alumnos']);
      },
      error: (err: HttpErrorResponse) => {
        this.erroresServidor.set(cuerpoError(err)?.errores ?? {});
        this.error.set(mensajeHttp(err, 'No se pudo guardar el alumno.'));
        this.loading.set(false);
      },
    });
  }

  protected mensajeValidacion(campo: 'personaId' | 'codigoEstudiante' | 'fechaIngreso'): string {
    const servidor = this.erroresServidor()[campo];
    if (servidor) return servidor;
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('pattern')) return 'De 4 a 20 caracteres: letras mayúsculas, dígitos o guion.';
    return '';
  }

  private falloCarga(err: HttpErrorResponse, generico: string): void {
    this.errorCarga.set(true);
    this.error.set(mensajeHttp(err, generico));
    this.loading.set(false);
  }
}
