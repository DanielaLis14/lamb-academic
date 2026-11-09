import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';

export const ESTADOS_ALUMNO = ['ACTIVO', 'SUSPENDIDO', 'RETIRADO', 'EGRESADO'] as const;
export type EstadoAlumno = (typeof ESTADOS_ALUMNO)[number];

/** Transiciones de AlumnoService.TRANSICIONES; el backend las vuelve a validar. */
export const TRANSICIONES_ALUMNO: Record<EstadoAlumno, EstadoAlumno[]> = {
  ACTIVO: ['SUSPENDIDO', 'RETIRADO', 'EGRESADO'],
  SUSPENDIDO: ['ACTIVO', 'RETIRADO'],
  RETIRADO: ['ACTIVO'],
  EGRESADO: [],
};

/** AlumnoResponse de Base Universal. Solo lo consulta el personal (SecurityConfig). */
export interface Alumno {
  id: number;
  codigoEstudiante: string;
  estado: EstadoAlumno;
  fechaIngreso: string;
  habilitado: boolean;
  persona: {
    id: number;
    numeroDocumento: string;
    nombreCompleto: string;
    email: string | null;
    idEscuela: number | null;
    escuelaNombre: string | null;
  };
}

export interface AlumnoRequest {
  personaId: number;
  codigoEstudiante: string;
  fechaIngreso: string;
}

export interface FiltroAlumnos {
  estado?: EstadoAlumno | null;
  idEscuela?: number | null;
  q?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AlumnoService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/alumnos';

  listar(estado?: Alumno['estado']): Observable<Alumno[]> {
    return this.buscar({ estado });
  }

  buscar(filtro: FiltroAlumnos): Observable<Alumno[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<Alumno[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Alumno> {
    return this.http.get<Alumno>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  crear(alumno: AlumnoRequest): Observable<Alumno> {
    return this.http.post<Alumno>(this.api.buildUrl(this.resource), alumno);
  }

  actualizar(id: number, alumno: AlumnoRequest): Observable<Alumno> {
    return this.http.put<Alumno>(this.api.buildUrl(`${this.resource}/${id}`), alumno);
  }

  cambiarEstado(id: number, estado: EstadoAlumno): Observable<Alumno> {
    return this.http.patch<Alumno>(this.api.buildUrl(`${this.resource}/${id}/estado`), { estado });
  }
}
