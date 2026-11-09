import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisoService } from '../../../core/services/aviso-service';
import { cuerpoError, mensajeHttp } from '../../../core/services/error-http';
import { entero } from '../../../shared/validadores';
import { CursoRequest } from './curso.model';
import { CursoService } from './curso-service';

type Campo = 'codigo' | 'nombre' | 'creditos' | 'horasTeoricas' | 'horasPracticas';

/** Alta y edicion de Curso con las reglas de CursoRequest (creditos 1-10, horas 0-20). */
@Component({
  selector: 'app-curso-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './curso-form.html',
})
export class CursoForm {
  private readonly fb = inject(FormBuilder);
  private readonly cursoService = inject(CursoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly id = signal<number | null>(null);
  protected readonly inactivo = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});
  protected readonly loading = signal(false);
  protected readonly errorCarga = signal(false);

  protected readonly form = this.fb.group({
    codigo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(20)]),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    creditos: this.fb.control<number | null>(4, [Validators.required, Validators.min(1), Validators.max(10), entero]),
    horasTeoricas: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(20), entero]),
    horasPracticas: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(20), entero]),
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    this.id.set(id);
    this.loading.set(true);
    this.cursoService.obtener(id).subscribe({
      next: (curso) => {
        this.form.patchValue(curso);
        this.inactivo.set(!curso.activo);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorCarga.set(true);
        this.error.set(mensajeHttp(err, 'No se pudo cargar el curso.'));
        this.loading.set(false);
      },
    });
  }

  guardar(): void {
    if (this.loading() || this.errorCarga()) return;
    this.error.set(null);
    this.erroresServidor.set({});
    const { codigo, nombre } = this.form.controls;
    codigo.setValue(codigo.value.trim().toUpperCase());
    nombre.setValue(nombre.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const curso: CursoRequest = {
      codigo: v.codigo,
      nombre: v.nombre,
      creditos: Number(v.creditos),
      horasTeoricas: v.horasTeoricas === null || (v.horasTeoricas as unknown) === '' ? null : Number(v.horasTeoricas),
      horasPracticas: v.horasPracticas === null || (v.horasPracticas as unknown) === '' ? null : Number(v.horasPracticas),
    };
    const id = this.id();
    this.loading.set(true);
    (id ? this.cursoService.actualizar(id, curso) : this.cursoService.crear(curso)).subscribe({
      next: (c) => {
        this.avisos.mostrar(`Curso ${c.codigo} ${id ? 'actualizado' : 'registrado'}.`, 'ok');
        this.router.navigate(['/academico/cursos']);
      },
      error: (err: HttpErrorResponse) => {
        this.erroresServidor.set(cuerpoError(err)?.errores ?? {});
        this.error.set(mensajeHttp(err, 'No se pudo guardar el curso.'));
        this.loading.set(false);
      },
    });
  }

  protected mensajeValidacion(campo: Campo): string {
    const servidor = this.erroresServidor()[campo];
    if (servidor) return servidor;
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control.hasError('entero')) return 'Debe ser un número entero.';
    if (control.hasError('min') || control.hasError('max')) {
      return campo === 'creditos' ? 'Entre 1 y 10 créditos.' : 'Entre 0 y 20 horas.';
    }
    return '';
  }
}
