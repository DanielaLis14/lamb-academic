import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideEye, LucidePlus } from '@lucide/angular';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_COORDINACION } from '../../../core/auth/roles';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import {
  ESTADOS_EXPEDIENTE,
  EstadoExpediente,
  ExpedienteEstadoReporte,
  ExpedienteResumen,
  NOMBRE_ESTADO_EXPEDIENTE,
} from './expediente.model';
import { ExpedienteService } from './expediente-service';

/**
 * Expedientes (cabecera-detalle con documentos). El ESTUDIANTE ve solo los suyos: el backend filtra por
 * la persona de su token aunque se envie otro titular. Coordinacion ve todos y el resumen por estado.
 */
@Component({
  selector: 'app-expediente-list',
  imports: [FormsModule, RouterLink, DatePipe, EstadoVacio, EtiquetaEstado, LucideEye, LucidePlus],
  templateUrl: './expediente-list.html',
})
export class ExpedienteList implements OnInit {
  private readonly expedienteService = inject(ExpedienteService);
  protected readonly auth = inject(AuthService);

  protected readonly esCoordinacion = computed(() => this.auth.tieneRol(...ROLES_COORDINACION));
  protected readonly estados = ESTADOS_EXPEDIENTE;
  protected readonly nombreEstado = NOMBRE_ESTADO_EXPEDIENTE;
  protected readonly expedientes = signal<ExpedienteResumen[]>([]);
  protected readonly resumen = signal<ExpedienteEstadoReporte[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected estadoFiltro: EstadoExpediente | null = null;
  protected desde = '';
  protected hasta = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      lista: this.expedienteService.buscar({
        estado: this.estadoFiltro,
        desde: this.desde ? `${this.desde}T00:00:00` : null,
        hasta: this.hasta ? `${this.hasta}T23:59:59` : null,
      }),
      resumen: this.esCoordinacion() ? this.expedienteService.resumen() : of([] as ExpedienteEstadoReporte[]),
    }).subscribe({
      next: ({ lista, resumen }) => {
        this.expedientes.set(lista);
        this.resumen.set(resumen);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar la lista de expedientes.'));
        this.loading.set(false);
      },
    });
  }

  protected cantidad(estado: EstadoExpediente): number {
    return this.resumen().find((r) => r.estado === estado)?.cantidadExpedientes ?? 0;
  }
}
