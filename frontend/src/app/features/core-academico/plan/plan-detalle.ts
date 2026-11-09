import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideCopyPlus } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { DetallePlan, PlanDistribucion, PlanEstudio } from './plan-estudio.model';
import { PlanEstudioService } from './plan-estudio-service';

/** Detalle de una malla: datos, distribucion de creditos por ciclo y cursos con prerrequisitos. */
@Component({
  selector: 'app-plan-detalle',
  imports: [RouterLink, EtiquetaEstado, LucideCopyPlus],
  templateUrl: './plan-detalle.html',
  styleUrl: './plan-detalle.css',
})
export class PlanDetalle {
  private readonly route = inject(ActivatedRoute);
  private readonly planService = inject(PlanEstudioService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly plan = signal<PlanEstudio | null>(null);
  protected readonly distribucion = signal<PlanDistribucion[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  /** Cursos agrupados por ciclo, en orden de codigo. */
  protected readonly ciclos = computed(() => {
    const grupos = new Map<number, DetallePlan[]>();
    for (const d of this.plan()?.detalles ?? []) grupos.set(d.ciclo, [...(grupos.get(d.ciclo) ?? []), d]);
    return [...grupos.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ciclo, cursos]) => ({ ciclo, cursos: cursos.sort((a, b) => a.cursoCodigo.localeCompare(b.cursoCodigo)) }));
  });
  private readonly maxCreditos = computed(() => Math.max(1, ...this.distribucion().map((d) => d.creditos)));

  constructor() {
    this.cargar(Number(this.route.snapshot.paramMap.get('id')));
  }

  private cargar(id: number): void {
    this.loading.set(true);
    this.planService.obtener(id).subscribe({
      next: (data) => {
        this.plan.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar la malla.'));
        this.loading.set(false);
      },
    });
    this.planService.distribucion(id).subscribe({
      next: (data) => this.distribucion.set([...data].sort((a, b) => a.ciclo - b.ciclo)),
    });
  }

  versionar(): void {
    const plan = this.plan();
    if (!plan) return;
    confirmar(this.dialog, {
      titulo: `Versionar la malla ${plan.codigo}`,
      mensaje: 'Se crea una nueva versión vigente con los mismos cursos y esta malla pasa a Obsoleta.',
      detalle: [plan.nombre, `Versión actual: ${plan.version}`],
      confirmar: 'Generar nueva versión',
    }).subscribe((ok) => {
      if (!ok) return;
      this.planService.versionar(plan.id).subscribe({
        next: (nuevo) => {
          this.avisos.mostrar(`Malla ${nuevo.codigo} versión ${nuevo.version} creada.`, 'ok');
          this.cargar(nuevo.id);
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo versionar la malla.')),
      });
    });
  }

  protected ancho(creditos: number): string {
    return `${Math.round((creditos / this.maxCreditos()) * 100)}%`;
  }
}
