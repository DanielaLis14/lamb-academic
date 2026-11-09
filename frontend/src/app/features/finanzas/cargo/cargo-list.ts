import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideEye, LucidePlus } from '@lucide/angular';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_CAJA } from '../../../core/auth/roles';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { Alumno, AlumnoService } from '../../base-universal/alumno/alumno-service';
import { Periodo } from '../../matricula/periodo/periodo.model';
import { PeriodoService } from '../../matricula/periodo/periodo-service';
import {
  CargoEstadoReporte,
  CargoResumen,
  CargoService,
  ESTADOS_CARGO,
  EstadoCargo,
  NOMBRE_ESTADO_CARGO,
  NOMBRE_ORIGEN,
  PROCESOS_ORIGEN,
  ProcesoOrigen,
  SaldoEstudiante,
} from './cargo-service';

/** Cargos (cabecera de la cuenta del estudiante) con filtros, resumen por estado y saldo del alumno filtrado. */
@Component({
  selector: 'app-cargo-list',
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, EstadoVacio, EtiquetaEstado, LucideEye, LucidePlus],
  templateUrl: './cargo-list.html',
})
export class CargoList implements OnInit {
  private readonly cargoService = inject(CargoService);
  private readonly alumnoService = inject(AlumnoService);
  private readonly periodoService = inject(PeriodoService);
  protected readonly auth = inject(AuthService);

  protected readonly esCaja = computed(() => this.auth.tieneRol(...ROLES_CAJA));
  protected readonly estados = ESTADOS_CARGO;
  protected readonly origenes = PROCESOS_ORIGEN;
  protected readonly nombreOrigen = NOMBRE_ORIGEN;
  protected readonly nombreEstado = NOMBRE_ESTADO_CARGO;
  protected readonly cargos = signal<CargoResumen[]>([]);
  protected readonly resumen = signal<CargoEstadoReporte[]>([]);
  protected readonly saldo = signal<SaldoEstudiante | null>(null);
  protected readonly alumnos = signal<Alumno[]>([]);
  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  private readonly alumnoPorId = computed(() => new Map(this.alumnos().map((a) => [a.id, a])));
  private readonly periodoPorId = computed(() => new Map(this.periodos().map((p) => [p.id, p])));

  protected estudianteFiltro: number | null = null;
  protected periodoFiltro: number | null = null;
  protected estadoFiltro: EstadoCargo | null = null;
  protected origenFiltro: ProcesoOrigen | null = null;

  ngOnInit(): void {
    forkJoin({ alumnos: this.alumnoService.buscar({}), periodos: this.periodoService.listar() }).subscribe({
      next: ({ alumnos, periodos }) => {
        this.alumnos.set(alumnos);
        this.periodos.set([...periodos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)));
      },
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudieron cargar alumnos y periodos.')),
    });
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      cargos: this.cargoService.buscar({
        estudianteId: this.estudianteFiltro,
        periodoId: this.periodoFiltro,
        estado: this.estadoFiltro,
        procesoOrigen: this.origenFiltro,
      }),
      resumen: this.cargoService.resumen(this.periodoFiltro ?? undefined),
      saldo: this.estudianteFiltro ? this.cargoService.saldo(this.estudianteFiltro) : of(null),
    }).subscribe({
      next: ({ cargos, resumen, saldo }) => {
        this.cargos.set(cargos);
        this.resumen.set(resumen);
        this.saldo.set(saldo);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudieron cargar los cargos.'));
        this.loading.set(false);
      },
    });
  }

  protected alumno(id: number): string {
    const a = this.alumnoPorId().get(id);
    return a ? `${a.codigoEstudiante} · ${a.persona.nombreCompleto}` : `Alumno ${id}`;
  }

  protected periodo(id: number): string {
    return this.periodoPorId().get(id)?.codigo ?? String(id);
  }
}
