import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { ESTADO_ANULADA, Matricula } from '../../matricula/matricula/matricula.model';
import { MatriculaService } from '../../matricula/matricula/matricula-service';
import { DetallePlan, PlanEstudio } from './plan-estudio.model';
import { PlanEstudioService } from './plan-estudio-service';

export type AvanceCurso = 'APROBADO' | 'EN_CURSO' | 'DESAPROBADO' | 'RETIRADO' | 'PENDIENTE';

const TEXTO_AVANCE: Record<AvanceCurso, string> = {
  APROBADO: 'Aprobado',
  EN_CURSO: 'En curso',
  DESAPROBADO: 'Desaprobado',
  RETIRADO: 'Retirado',
  PENDIENTE: 'Pendiente',
};

/**
 * Situacion de cada curso del plan segun las matriculas no anuladas del alumno: aprobado si alguna vez lo
 * aprobo; en curso si esta matriculado sin resultado; si no, el ultimo resultado registrado o pendiente.
 */
export function avancePorCurso(matriculas: Matricula[]): Map<number, AvanceCurso> {
  const avance = new Map<number, AvanceCurso>();
  const vigentes = matriculas.filter((m) => m.estado !== ESTADO_ANULADA).sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const m of vigentes) {
    for (const d of m.detalles) {
      if (d.cursoId === null || avance.get(d.cursoId) === 'APROBADO') continue;
      avance.set(d.cursoId, d.resultado ?? 'EN_CURSO');
    }
  }
  return avance;
}

/** Plan de estudios vigente de la escuela del ESTUDIANTE con su avance por curso (solo consulta). */
@Component({
  selector: 'app-mi-plan',
  imports: [RouterLink, EstadoVacio],
  templateUrl: './mi-plan.html',
})
export class MiPlan {
  private readonly matriculaService = inject(MatriculaService);
  private readonly planService = inject(PlanEstudioService);

  protected readonly plan = signal<PlanEstudio | null>(null);
  private readonly avance = signal<Map<number, AvanceCurso>>(new Map());
  protected readonly sinEscuela = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly textoAvance = TEXTO_AVANCE;

  protected readonly ciclos = computed(() => {
    const grupos = new Map<number, (DetallePlan & { avance: AvanceCurso })[]>();
    for (const d of this.plan()?.detalles ?? []) {
      const fila = { ...d, avance: this.avance().get(d.idCurso) ?? ('PENDIENTE' as AvanceCurso) };
      grupos.set(d.ciclo, [...(grupos.get(d.ciclo) ?? []), fila]);
    }
    return [...grupos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ciclo, cursos]) => ({
        ciclo,
        cursos: cursos.sort((a, b) => a.cursoCodigo.localeCompare(b.cursoCodigo)),
        creditos: cursos.reduce((t, c) => t + c.creditos, 0),
      }));
  });
  protected readonly creditosAprobados = computed(() =>
    (this.plan()?.detalles ?? []).filter((d) => this.avance().get(d.idCurso) === 'APROBADO').reduce((t, d) => t + d.creditos, 0),
  );
  protected readonly cursosEnCurso = computed(
    () => (this.plan()?.detalles ?? []).filter((d) => this.avance().get(d.idCurso) === 'EN_CURSO').length,
  );
  protected readonly porcentaje = computed(() => {
    const total = this.plan()?.totalCreditos ?? 0;
    return total ? Math.round((this.creditosAprobados() / total) * 100) : 0;
  });

  constructor() {
    this.matriculaService
      .contexto()
      .pipe(
        switchMap((contexto) => {
          if (!contexto.escuelaId) {
            this.sinEscuela.set(true);
            return of(null);
          }
          return this.planService.buscar(contexto.escuelaId);
        }),
      )
      .subscribe({
        next: (planes) => {
          this.plan.set(planes?.[0] ?? null);
          if (!planes?.length) {
            this.loading.set(false);
            return;
          }
          this.matriculaService.buscarTodas({}).subscribe({
            next: (matriculas) => {
              this.avance.set(avancePorCurso(matriculas));
              this.loading.set(false);
            },
            error: (err: HttpErrorResponse) => this.fallo(err),
          });
        },
        error: (err: HttpErrorResponse) => this.fallo(err),
      });
  }

  protected readonly claseAvance: Record<AvanceCurso, string> = {
    APROBADO: 'estado-activo',
    EN_CURSO: 'estado-info',
    DESAPROBADO: 'estado-error',
    RETIRADO: 'estado-neutro',
    PENDIENTE: 'estado-neutro',
  };

  private fallo(err: HttpErrorResponse): void {
    this.error.set(mensajeHttp(err, 'No se pudo cargar tu plan de estudios.'));
    this.loading.set(false);
  }
}
