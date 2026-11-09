import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import { Curso, CursoRequest, CursoResumen, FiltroCursos } from './curso.model';

/** Catalogo de cursos (Core Academico - Oferta). Matricula usa listar y prerrequisitos. */
@Injectable({ providedIn: 'root' })
export class CursoService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/cursos';

  listar(activo?: boolean): Observable<Curso[]> {
    let params = new HttpParams();
    if (activo !== undefined) params = params.set('activo', activo);
    return this.http.get<Curso[]>(this.api.buildUrl(this.resource), { params });
  }

  buscar(filtro: FiltroCursos): Observable<Curso[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<Curso[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Curso> {
    return this.http.get<Curso>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  crear(curso: CursoRequest): Observable<Curso> {
    return this.http.post<Curso>(this.api.buildUrl(this.resource), curso);
  }

  actualizar(id: number, curso: CursoRequest): Observable<Curso> {
    return this.http.put<Curso>(this.api.buildUrl(`${this.resource}/${id}`), curso);
  }

  /** Baja logica; el backend la rechaza si el curso tiene secciones programadas en periodos abiertos. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  /**
   * Prerrequisitos del curso en los planes vigentes. Con idEscuela, solo los del plan de esa escuela:
   * los mismos que valida el registro de matricula para el alumno.
   */
  prerrequisitos(cursoId: number, idEscuela?: number | null): Observable<CursoResumen[]> {
    const params = idEscuela ? new HttpParams().set('idEscuela', idEscuela) : undefined;
    return this.http.get<CursoResumen[]>(this.api.buildUrl(`${this.resource}/${cursoId}/prerrequisitos`), { params });
  }
}
