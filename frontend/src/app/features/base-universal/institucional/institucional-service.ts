import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import {
  Escuela,
  EscuelaRequest,
  Facultad,
  FacultadRequest,
  Sede,
  SedeArbol,
  SedeRequest,
} from './institucional.model';

/**
 * Catálogo institucional (Sede > Facultad > Escuela) del modulo Base Universal.
 * Solo transporta: las reglas (código único, jerarquía, borrado protegido) las aplica el backend.
 */
@Injectable({ providedIn: 'root' })
export class InstitucionalService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  arbol(): Observable<SedeArbol[]> {
    return this.http.get<SedeArbol[]>(this.api.buildUrl('/api/v1/institucional/arbol'));
  }

  /* -------------------------------- Sede ------------------------------- */

  sedes(): Observable<Sede[]> {
    return this.http.get<Sede[]>(this.api.buildUrl('/api/v1/sedes'));
  }

  crearSede(req: SedeRequest): Observable<Sede> {
    return this.http.post<Sede>(this.api.buildUrl('/api/v1/sedes'), req);
  }

  actualizarSede(id: number, req: SedeRequest): Observable<Sede> {
    return this.http.put<Sede>(this.api.buildUrl(`/api/v1/sedes/${id}`), req);
  }

  /* ------------------------------ Facultad ----------------------------- */

  facultades(idSede?: number): Observable<Facultad[]> {
    let params = new HttpParams();
    if (idSede) params = params.set('idSede', idSede);
    return this.http.get<Facultad[]>(this.api.buildUrl('/api/v1/facultades'), { params });
  }

  crearFacultad(req: FacultadRequest): Observable<Facultad> {
    return this.http.post<Facultad>(this.api.buildUrl('/api/v1/facultades'), req);
  }

  /* ------------------------------- Escuela ----------------------------- */

  escuelas(idFacultad?: number): Observable<Escuela[]> {
    let params = new HttpParams();
    if (idFacultad) params = params.set('idFacultad', idFacultad);
    return this.http.get<Escuela[]>(this.api.buildUrl('/api/v1/escuelas'), { params });
  }

  crearEscuela(req: EscuelaRequest): Observable<Escuela> {
    return this.http.post<Escuela>(this.api.buildUrl('/api/v1/escuelas'), req);
  }
}
