import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucideCopyPlus, LucideEye, LucidePlus } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { Escuela } from '../../base-universal/institucional/institucional.model';
import { InstitucionalService } from '../../base-universal/institucional/institucional-service';
import { ESTADOS_PLAN, EstadoPlan, PlanEstudio, PlanResumen } from './plan-estudio.model';
import { PlanEstudioService } from './plan-estudio-service';

/**
 * Mallas curriculares con filtros combinados, orden y resumen por escuela (aporte de Core Academico -
 * Curriculo, adaptado al sistema visual de LAMB). Registrar y versionar es de ADMIN, como en SecurityConfig.
 */
@Component({
  selector: 'app-plan-list',
  imports: [FormsModule, RouterLink, EstadoVacio, EtiquetaEstado, LucideCopyPlus, LucideEye, LucidePlus],
  templateUrl: './plan-list.html',
})
export class PlanList implements OnInit {
  private readonly planService = inject(PlanEstudioService);
  private readonly institucional = inject(InstitucionalService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly estados = ESTADOS_PLAN;
  protected readonly planes = signal<PlanEstudio[]>([]);
  protected readonly escuelas = signal<Escuela[]>([]);
  protected readonly resumen = signal<PlanResumen[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected escuelaFiltro: number | null = null;
  protected estadoFiltro: EstadoPlan | null = null;
  protected anioFiltro: number | null = null;
  protected texto = '';
  protected orden = 'anio';
  protected direccion: 'asc' | 'desc' = 'desc';

  ngOnInit(): void {
    this.institucional.escuelas().subscribe({ next: (data) => this.escuelas.set(data) });
    this.planService.resumen().subscribe({ next: (data) => this.resumen.set(data) });
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.planService
      .filtrar({
        idEscuela: this.escuelaFiltro,
        estado: this.estadoFiltro,
        anio: this.anioFiltro || null,
        q: this.texto.trim() || null,
        sortBy: this.orden,
        dir: this.direccion,
      })
      .subscribe({
        next: (data) => {
          this.planes.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudieron cargar las mallas curriculares.'));
          this.loading.set(false);
        },
      });
  }

  limpiar(): void {
    this.escuelaFiltro = null;
    this.estadoFiltro = null;
    this.anioFiltro = null;
    this.texto = '';
    this.orden = 'anio';
    this.direccion = 'desc';
    this.cargar();
  }

  versionar(plan: PlanEstudio): void {
    confirmar(this.dialog, {
      titulo: `Versionar la malla ${plan.codigo}`,
      mensaje:
        'Se crea una nueva versión vigente con los mismos cursos y esta malla pasa a Obsoleta. Las matrículas ' +
        'registradas no cambian; las nuevas usarán la versión vigente.',
      detalle: [plan.nombre, `Versión actual: ${plan.version}`, `${plan.totalCursos} cursos · ${plan.totalCreditos} créditos`],
      confirmar: 'Generar nueva versión',
    }).subscribe((ok) => {
      if (!ok) return;
      this.planService.versionar(plan.id).subscribe({
        next: (nuevo) => {
          this.avisos.mostrar(`Malla ${nuevo.codigo} versión ${nuevo.version} creada.`, 'ok');
          this.planService.resumen().subscribe({ next: (data) => this.resumen.set(data) });
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo versionar la malla.')),
      });
    });
  }
}
