import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideUsers } from '@lucide/angular';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { BloqueSemanal, HorarioSemanal } from '../../../shared/horario/horario-semanal';
import { resumenHorario } from '../../../shared/horario/horario-util';
import { Periodo } from '../../matricula/periodo/periodo.model';
import { PeriodoService } from '../../matricula/periodo/periodo-service';
import { CargaDocente, DocenteService } from './docente-service';

/** Periodo por defecto: el activo de inicio mas reciente; si no hay, el ultimo por fecha de inicio. */
export function periodoPorDefecto(periodos: Periodo[]): Periodo | null {
  const ordenados = [...periodos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return ordenados.find((p) => p.estado === 'ACTIVO') ?? ordenados[0] ?? null;
}

/**
 * Carga lectiva: secciones, horario semanal y horas de un docente en un periodo. Con la ruta en modo propio
 * (data.propia) es el portal del DOCENTE y el backend toma el docente de su token; si no, coordinacion
 * consulta la carga del docente de la ruta.
 */
@Component({
  selector: 'app-carga-docente',
  imports: [FormsModule, RouterLink, DecimalPipe, EstadoVacio, EtiquetaEstado, HorarioSemanal, LucideUsers],
  templateUrl: './carga-docente.html',
})
export class CargaDocenteVista implements OnInit {
  private readonly docenteService = inject(DocenteService);
  private readonly periodoService = inject(PeriodoService);
  private readonly route = inject(ActivatedRoute);

  protected readonly propia = this.route.snapshot.data['propia'] === true;
  private readonly docenteId = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly rutaInscritos = this.propia ? '/docencia/secciones' : '/academico/secciones';
  protected readonly resumenHorario = resumenHorario;

  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly carga = signal<CargaDocente | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected periodoId: number | null = null;

  protected readonly bloques = computed<BloqueSemanal[]>(() =>
    (this.carga()?.secciones ?? []).flatMap((s) =>
      s.horarios.map((h) => ({
        clave: String(s.id),
        grupoColor: s.curso.codigo,
        dia: h.diaSemana,
        inicio: h.horaInicio,
        fin: h.horaFin,
        titulo: `${s.curso.codigo} · ${s.grupo}`,
        nombre: s.curso.nombre,
        subtitulo: `Aula ${h.aula}`,
      })),
    ),
  );
  protected readonly totalInscritos = computed(() =>
    (this.carga()?.secciones ?? []).reduce((t, s) => t + s.cuposOcupados, 0),
  );

  ngOnInit(): void {
    this.periodoService.listar().subscribe({
      next: (data) => {
        this.periodos.set([...data].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)));
        this.periodoId = periodoPorDefecto(data)?.id ?? null;
        if (this.periodoId) {
          this.cargar();
        } else {
          this.loading.set(false);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudieron cargar los periodos académicos.'));
        this.loading.set(false);
      },
    });
  }

  cargar(): void {
    if (!this.periodoId) return;
    this.loading.set(true);
    this.error.set(null);
    const peticion = this.propia
      ? this.docenteService.miCarga(this.periodoId)
      : this.docenteService.carga(this.docenteId, this.periodoId);
    peticion.subscribe({
      next: (carga) => {
        this.carga.set(carga);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.carga.set(null);
        this.error.set(mensajeHttp(err, 'No se pudo cargar la carga lectiva.'));
        this.loading.set(false);
      },
    });
  }
}
