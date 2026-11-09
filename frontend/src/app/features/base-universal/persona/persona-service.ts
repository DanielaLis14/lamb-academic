import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import { FiltroPersonas, Persona, PersonaRequest } from './persona.model';

@Injectable({ providedIn: 'root' })
export class PersonaService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/personas';

  buscar(filtro: FiltroPersonas = {}): Observable<Persona[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<Persona[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Persona> {
    return this.http.get<Persona>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  crear(persona: PersonaRequest): Observable<Persona> {
    return this.http.post<Persona>(this.api.buildUrl(this.resource), persona);
  }

  actualizar(id: number, persona: PersonaRequest): Observable<Persona> {
    return this.http.put<Persona>(this.api.buildUrl(`${this.resource}/${id}`), persona);
  }

  /** Baja logica (ACTIVO = 0): la persona se conserva por su historia academica y financiera. */
  desactivar(id: number): Observable<void> {
    return this.http.delete<void>(this.api.buildUrl(`${this.resource}/${id}`));
  }
}
