import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';

/** ConceptoPagoRequest / ConceptoPagoResponse (finanzas.concepto). */
export type TipoCalculo = 'FIJO' | 'POR_CREDITO';

export interface ConceptoPago {
  id: number;
  codigo: string;
  nombre: string;
  tipoCalculo: TipoCalculo;
  monto: number;
  aplicaMatricula: boolean;
  activo: boolean;
}

export interface ConceptoPagoRequest {
  codigo: string;
  nombre: string;
  tipoCalculo: TipoCalculo;
  monto: number;
  aplicaMatricula: boolean;
}

export const NOMBRE_CALCULO: Record<TipoCalculo, string> = { FIJO: 'Monto fijo', POR_CREDITO: 'Por crédito' };

@Injectable({ providedIn: 'root' })
export class ConceptoPagoService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/finanzas/conceptos';

  listar(): Observable<ConceptoPago[]> {
    return this.http.get<ConceptoPago[]>(this.api.buildUrl(this.resource));
  }

  obtener(id: number): Observable<ConceptoPago> {
    return this.http.get<ConceptoPago>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  crear(concepto: ConceptoPagoRequest): Observable<ConceptoPago> {
    return this.http.post<ConceptoPago>(this.api.buildUrl(this.resource), concepto);
  }

  actualizar(id: number, concepto: ConceptoPagoRequest): Observable<ConceptoPago> {
    return this.http.put<ConceptoPago>(this.api.buildUrl(`${this.resource}/${id}`), concepto);
  }

  /** Baja logica: los cargos ya emitidos conservan su monto. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(this.api.buildUrl(`${this.resource}/${id}`));
  }
}
