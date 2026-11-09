import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';

/** Contratos de Finanzas (finanzas.cargo): Cargo cabecera con sus cuotas (DetalleCargo) y pagos. */
export type EstadoCargo = 'EMITIDO' | 'PAGADO_PARCIAL' | 'PAGADO_TOTAL' | 'ANULADO';
export type EstadoCuota = 'PENDIENTE' | 'PAGADA_PARCIAL' | 'PAGADA' | 'ANULADA';
export type ProcesoOrigen = 'MATRICULA' | 'TRAMITE' | 'OTRO';
export type MedioPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'DEPOSITO';

export const ESTADOS_CARGO: EstadoCargo[] = ['EMITIDO', 'PAGADO_PARCIAL', 'PAGADO_TOTAL', 'ANULADO'];
export const PROCESOS_ORIGEN: ProcesoOrigen[] = ['MATRICULA', 'TRAMITE', 'OTRO'];
/** Los cargos de MATRICULA los genera la matricula; un cargo manual solo puede ser de estos origenes. */
export const PROCESOS_MANUALES: ProcesoOrigen[] = ['TRAMITE', 'OTRO'];
export const MEDIOS_PAGO: MedioPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'DEPOSITO'];

export const NOMBRE_ESTADO_CARGO: Record<EstadoCargo, string> = {
  EMITIDO: 'Emitido',
  PAGADO_PARCIAL: 'Pago parcial',
  PAGADO_TOTAL: 'Pagado',
  ANULADO: 'Anulado',
};
export const NOMBRE_ORIGEN: Record<ProcesoOrigen, string> = { MATRICULA: 'Matrícula', TRAMITE: 'Trámite', OTRO: 'Otro' };
export const NOMBRE_MEDIO: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  DEPOSITO: 'Depósito',
};

export interface Cuota {
  id: number;
  numeroCuota: number;
  conceptoNombre: string | null;
  fechaVencimiento: string;
  montoCuota: number;
  montoPagado: number;
  estado: EstadoCuota;
}

export interface Cargo {
  id: number;
  numeroCargo: string;
  estudianteId: number;
  procesoOrigen: ProcesoOrigen;
  referenciaId: number | null;
  periodoId: number;
  totalCreditos: number | null;
  numeroCuotas: number;
  montoTotal: number;
  saldoPendiente: number;
  estado: EstadoCargo;
  observacion: string | null;
  fechaEmision: string;
  cuotas: Cuota[];
}

export interface CargoResumen {
  id: number;
  numeroCargo: string;
  estudianteId: number;
  procesoOrigen: ProcesoOrigen;
  referenciaId: number | null;
  periodoId: number;
  montoTotal: number;
  saldoPendiente: number;
  numeroCuotas: number;
  estado: EstadoCargo;
  fechaEmision: string;
}

export interface CargoRequest {
  estudianteId: number;
  procesoOrigen: ProcesoOrigen;
  referenciaId: number | null;
  periodoId: number;
  totalCreditos: number | null;
  numeroCuotas: number;
  observacion: string | null;
  /** Codigos de ConceptoPago; vacio aplica los conceptos de matricula. */
  conceptos: string[];
}

export interface Pago {
  id: number;
  cargoId: number;
  monto: number;
  fechaPago: string;
  medioPago: MedioPago;
  referencia: string | null;
}

export interface PagoRequest {
  monto: number;
  medioPago: MedioPago;
  referencia: string | null;
}

export interface SaldoEstudiante {
  estudianteId: number;
  deudaTotal: number;
  totalPagado: number;
  saldoPendiente: number;
  totalCargosPendientes: number;
  cuotasVencidas: number;
}

export interface CargoEstadoReporte {
  estado: EstadoCargo;
  cantidad: number;
  montoTotal: number;
  saldoPendiente: number;
}

export interface FiltroCargos {
  estudianteId?: number | null;
  periodoId?: number | null;
  estado?: EstadoCargo | null;
  procesoOrigen?: ProcesoOrigen | null;
}

/** El ESTUDIANTE solo consulta sus cargos (el backend compara con el alumno de su token). */
@Injectable({ providedIn: 'root' })
export class CargoService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/finanzas/cargos';

  buscar(filtro: FiltroCargos = {}): Observable<CargoResumen[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<CargoResumen[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Cargo> {
    return this.http.get<Cargo>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  deEstudiante(estudianteId: number): Observable<Cargo[]> {
    return this.http.get<Cargo[]>(this.api.buildUrl(`${this.resource}/estudiante/${estudianteId}`));
  }

  saldo(estudianteId: number): Observable<SaldoEstudiante> {
    return this.http.get<SaldoEstudiante>(this.api.buildUrl(`${this.resource}/estudiante/${estudianteId}/saldo`));
  }

  /** Cargo manual con sus cuotas en una sola transaccion; el monto lo calcula el backend. */
  registrar(cargo: CargoRequest): Observable<Cargo> {
    return this.http.post<Cargo>(this.api.buildUrl(this.resource), cargo);
  }

  anular(id: number): Observable<Cargo> {
    return this.http.patch<Cargo>(this.api.buildUrl(`${this.resource}/${id}/anular`), {});
  }

  pagos(id: number): Observable<Pago[]> {
    return this.http.get<Pago[]>(this.api.buildUrl(`${this.resource}/${id}/pagos`));
  }

  registrarPago(id: number, pago: PagoRequest): Observable<Cargo> {
    return this.http.post<Cargo>(this.api.buildUrl(`${this.resource}/${id}/pagos`), pago);
  }

  resumen(periodoId?: number): Observable<CargoEstadoReporte[]> {
    let params = new HttpParams();
    if (periodoId) params = params.set('periodoId', periodoId);
    return this.http.get<CargoEstadoReporte[]>(this.api.buildUrl(`${this.resource}/resumen`), { params });
  }
}

function hoyIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Cuota con saldo cuyo vencimiento ya paso (misma condicion que cuotasVencidas del saldo). */
export function cuotaVencida(cuota: Cuota, hoy = hoyIso()): boolean {
  return (cuota.estado === 'PENDIENTE' || cuota.estado === 'PAGADA_PARCIAL') && cuota.fechaVencimiento < hoy;
}

/** Porcentaje pagado de un cargo no anulado, para la barra de avance. */
export function porcentajePagado(cargo: { montoTotal: number; saldoPendiente: number; estado: EstadoCargo }): number {
  if (cargo.estado === 'ANULADO' || cargo.montoTotal <= 0) return 0;
  return Math.round(((cargo.montoTotal - cargo.saldoPendiente) / cargo.montoTotal) * 100);
}
