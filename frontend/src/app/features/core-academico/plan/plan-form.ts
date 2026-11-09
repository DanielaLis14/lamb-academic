import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucidePlus, LucideTrash } from '@lucide/angular';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { alMenosUnaLinea, entero, sinRepetidos } from '../../../shared/validadores';
import { Escuela } from '../../base-universal/institucional/institucional.model';
import { InstitucionalService } from '../../base-universal/institucional/institucional-service';
import { Curso } from '../curso/curso.model';
import { CursoService } from '../curso/curso-service';
import { CREDITOS_MAX_CICLO, CREDITOS_MIN_CICLO, TIPOS_CURSO_PLAN, TipoCursoPlan } from './plan-estudio.model';
import { PlanEstudioService } from './plan-estudio-service';

interface Fila {
  idCurso: number | null;
  ciclo: number | null;
  creditos: number | null;
  tipo: TipoCursoPlan;
  idPrerrequisito: number | null;
}

/**
 * Alta de malla curricular: cabecera y cursos en un solo POST (operacion transaccional). Los totales por
 * ciclo y las reglas de PlanEstudioService se muestran antes de enviar; el backend decide al registrar.
 */
@Component({
  selector: 'app-plan-form',
  imports: [ReactiveFormsModule, RouterLink, LucidePlus, LucideTrash],
  templateUrl: './plan-form.html',
})
export class PlanForm {
  private readonly fb = inject(FormBuilder);
  private readonly planService = inject(PlanEstudioService);
  private readonly cursoService = inject(CursoService);
  private readonly institucional = inject(InstitucionalService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly tipos = TIPOS_CURSO_PLAN;
  protected readonly minCiclo = CREDITOS_MIN_CICLO;
  protected readonly maxCiclo = CREDITOS_MAX_CICLO;
  protected readonly escuelas = signal<Escuela[]>([]);
  protected readonly cursos = signal<Curso[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    idEscuela: this.fb.control<number | null>(null, Validators.required),
    codigo: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(25)]),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    anio: this.fb.control<number | null>(new Date().getFullYear(), [
      Validators.required, Validators.min(2000), Validators.max(2100), entero,
    ]),
    detalles: this.fb.array([this.fila()], [alMenosUnaLinea, sinRepetidos('idCurso')]),
  });

  private readonly valor = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly filas = computed(() => (this.valor().detalles ?? []) as Fila[]);
  protected readonly totalCreditos = computed(() => this.filas().reduce((t, f) => t + (Number(f.creditos) || 0), 0));

  /** Creditos por ciclo con aviso fuera del rango 6-24 (regla 2 de PlanEstudioService). */
  protected readonly porCiclo = computed(() => {
    const mapa = new Map<number, number>();
    for (const f of this.filas()) {
      const ciclo = Number(f.ciclo);
      if (ciclo > 0) mapa.set(ciclo, (mapa.get(ciclo) ?? 0) + (Number(f.creditos) || 0));
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ciclo, creditos]) => ({ ciclo, creditos, fueraDeRango: creditos < CREDITOS_MIN_CICLO || creditos > CREDITOS_MAX_CICLO }));
  });
  protected readonly hayCicloInvalido = computed(() => this.porCiclo().some((c) => c.fueraDeRango));

  constructor() {
    this.institucional.escuelas().subscribe({
      next: (data) => this.escuelas.set(data.filter((e) => e.activo)),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar las escuelas.')),
    });
    this.cursoService.listar(true).subscribe({
      next: (data) => this.cursos.set([...data].sort((a, b) => a.codigo.localeCompare(b.codigo))),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar los cursos.')),
    });
  }

  protected get detalles() {
    return this.form.controls.detalles;
  }

  private fila() {
    return this.fb.group({
      idCurso: this.fb.control<number | null>(null, Validators.required),
      ciclo: this.fb.control<number | null>(1, [Validators.required, Validators.min(1), Validators.max(14), entero]),
      creditos: this.fb.control<number | null>(4, [Validators.required, Validators.min(1), Validators.max(10), entero]),
      tipo: this.fb.nonNullable.control<TipoCursoPlan>('OBLIGATORIO'),
      idPrerrequisito: this.fb.control<number | null>(null),
    });
  }

  agregarFila(): void {
    this.detalles.push(this.fila());
  }

  quitarFila(indice: number): void {
    if (this.detalles.length === 1) return;
    const quitado = this.detalles.at(indice).controls.idCurso.value;
    this.detalles.removeAt(indice);
    for (const fila of this.detalles.controls) {
      if (quitado && fila.controls.idPrerrequisito.value === quitado) fila.controls.idPrerrequisito.setValue(null);
    }
  }

  /** Al elegir el curso se proponen sus creditos del catalogo. */
  alElegirCurso(indice: number): void {
    const fila = this.detalles.at(indice);
    const curso = this.cursos().find((c) => c.id === fila.controls.idCurso.value);
    if (curso) fila.controls.creditos.setValue(curso.creditos);
  }

  /** Candidatos a prerrequisito: cursos obligatorios de la misma malla en un ciclo anterior (reglas 3 y orden). */
  protected candidatos(indice: number): Curso[] {
    const actual = this.filas()[indice];
    const ciclo = Number(actual?.ciclo) || 0;
    const ids = this.filas()
      .filter((f, i) => i !== indice && f.idCurso && f.tipo === 'OBLIGATORIO' && Number(f.ciclo) < ciclo)
      .map((f) => f.idCurso);
    return this.cursos().filter((c) => ids.includes(c.id));
  }

  guardar(): void {
    if (this.guardando()) return;
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(
        this.detalles.hasError('repetido')
          ? 'Un curso aparece más de una vez en la malla.'
          : 'Completa la cabecera y el curso, ciclo y créditos de cada fila.',
      );
      return;
    }
    if (this.hayCicloInvalido()) {
      this.error.set(`Cada ciclo debe sumar entre ${CREDITOS_MIN_CICLO} y ${CREDITOS_MAX_CICLO} créditos.`);
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.planService
      .crear({
        idEscuela: v.idEscuela!,
        codigo: v.codigo.trim().toUpperCase(),
        nombre: v.nombre.trim(),
        anio: Number(v.anio),
        detalles: v.detalles.map((f) => ({
          idCurso: f.idCurso!,
          ciclo: Number(f.ciclo),
          creditos: Number(f.creditos),
          tipo: f.tipo,
          idPrerrequisito: f.idPrerrequisito,
        })),
      })
      .subscribe({
        next: (plan) => {
          this.avisos.mostrar(`Malla ${plan.codigo} registrada con ${plan.totalCursos} cursos.`, 'ok');
          this.router.navigate(['/academico/planes', plan.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo registrar la malla. No se guardó ningún curso.'));
          this.guardando.set(false);
        },
      });
  }

  protected mensaje(campo: 'idEscuela' | 'codigo' | 'nombre' | 'anio'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (control.hasError('min') || control.hasError('max') || control.hasError('entero')) return 'Año entre 2000 y 2100.';
    return '';
  }
}
