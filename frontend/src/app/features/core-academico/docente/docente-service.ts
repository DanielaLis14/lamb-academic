import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import { DatosPersona, Persona } from '../../base-universal/persona/persona.model';
import { Seccion } from '../../matricula/seccion/seccion.model';

/** Campos del docente que usa Matricula al programar secciones. */
export type Docente = Pick<Persona, 'id' | 'nombreCompleto' | 'email' | 'activo'>;

/** CargaDocenteResponse: secciones no canceladas del periodo y horas semanales. */
export interface CargaDocente {
  docenteId: number;
  docenteNombre: string;
  periodoId: number;
  totalSecciones: number;
  horasSemanales: number;
  secciones: Seccion[];
}

/** El docente es una Persona de tipo DOCENTE: mismo registro de Base Universal, vista de Core Academico. */
@Injectable({ providedIn: 'root' })
export class DocenteService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/docentes';

  listar(activo: boolean | null = true, q?: string | null): Observable<Persona[]> {
    let params = new HttpParams();
    if (activo !== null) params = params.set('activo', activo);
    if (q) params = params.set('q', q);
    return this.http.get<Persona[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Persona> {
    return this.http.get<Persona>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  crear(docente: DatosPersona): Observable<Persona> {
    return this.http.post<Persona>(this.api.buildUrl(this.resource), docente);
  }

  actualizar(id: number, docente: DatosPersona): Observable<Persona> {
    return this.http.put<Persona>(this.api.buildUrl(`${this.resource}/${id}`), docente);
  }

  /** Baja logica; el backend la rechaza si el docente dicta secciones vigentes. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  carga(id: number, periodoId: number): Observable<CargaDocente> {
    const params = new HttpParams().set('periodoId', periodoId);
    return this.http.get<CargaDocente>(this.api.buildUrl(`${this.resource}/${id}/carga`), { params });
  }

  /** Carga del docente autenticado: el backend toma el docente del token, nunca de la peticion. */
  miCarga(periodoId: number): Observable<CargaDocente> {
    const params = new HttpParams().set('periodoId', periodoId);
    return this.http.get<CargaDocente>(this.api.buildUrl(`${this.resource}/mi-carga`), { params });
  }
}
