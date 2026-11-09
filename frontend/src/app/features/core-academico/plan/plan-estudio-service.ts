import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import { FiltroPlanes, PlanDistribucion, PlanEstudio, PlanEstudioRequest, PlanResumen } from './plan-estudio.model';

/**
 * Mallas curriculares (Core Academico - Curriculo). Matricula usa buscar() para ubicar cada curso en el
 * ciclo del plan vigente de la escuela del alumno; las pantallas de mallas usan el resto.
 */
@Injectable({ providedIn: 'root' })
export class PlanEstudioService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/planes-estudio';

  /** Planes de una escuela en un estado; el backend los ordena por anio descendente. */
  buscar(idEscuela: number, estado: PlanEstudio['estado'] = 'VIGENTE'): Observable<PlanEstudio[]> {
    return this.filtrar({ idEscuela, estado });
  }

  filtrar(filtro: FiltroPlanes): Observable<PlanEstudio[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<PlanEstudio[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<PlanEstudio> {
    return this.http.get<PlanEstudio>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  distribucion(id: number): Observable<PlanDistribucion[]> {
    return this.http.get<PlanDistribucion[]>(this.api.buildUrl(`${this.resource}/${id}/distribucion`));
  }

  resumen(): Observable<PlanResumen[]> {
    return this.http.get<PlanResumen[]>(this.api.buildUrl(`${this.resource}/resumen`));
  }

  /** Cabecera y cursos en un solo POST: si un curso viola una regla, no se guarda nada. */
  crear(plan: PlanEstudioRequest): Observable<PlanEstudio> {
    return this.http.post<PlanEstudio>(this.api.buildUrl(this.resource), plan);
  }

  /** Nueva version con los mismos cursos; el plan actual pasa a OBSOLETO. */
  versionar(id: number): Observable<PlanEstudio> {
    return this.http.post<PlanEstudio>(this.api.buildUrl(`${this.resource}/${id}/versionar`), {});
  }
}
