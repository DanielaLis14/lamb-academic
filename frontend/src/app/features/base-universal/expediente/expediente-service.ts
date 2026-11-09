import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import {
  DocumentoAdjuntoRequest,
  EstadoExpediente,
  Expediente,
  ExpedienteArchivosRequest,
  ExpedienteEstadoReporte,
  ExpedienteRequest,
  ExpedienteResumen,
  FiltroExpedientes,
} from './expediente.model';

/** El backend limita al ESTUDIANTE a sus propios expedientes con la persona de su token. */
@Injectable({ providedIn: 'root' })
export class ExpedienteService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly resource = '/api/v1/expedientes';

  buscar(filtro: FiltroExpedientes = {}): Observable<ExpedienteResumen[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtro)) {
      if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, String(valor));
    }
    return this.http.get<ExpedienteResumen[]>(this.api.buildUrl(this.resource), { params });
  }

  obtener(id: number): Observable<Expediente> {
    return this.http.get<Expediente>(this.api.buildUrl(`${this.resource}/${id}`));
  }

  registrar(expediente: ExpedienteRequest): Observable<Expediente> {
    return this.http.post<Expediente>(this.api.buildUrl(this.resource), expediente);
  }

  /** Cabecera y archivos en una sola peticion multipart; el servidor guarda los archivos en su almacen privado. */
  registrarConArchivos(datos: ExpedienteArchivosRequest, archivos: File[]): Observable<Expediente> {
    const formulario = new FormData();
    formulario.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    archivos.forEach((archivo) => formulario.append('archivos', archivo, archivo.name));
    return this.http.post<Expediente>(this.api.buildUrl(this.resource), formulario);
  }

  agregarArchivo(id: number, nombre: string, archivo: File): Observable<Expediente> {
    const formulario = new FormData();
    formulario.append('nombre', nombre);
    formulario.append('archivo', archivo, archivo.name);
    return this.http.post<Expediente>(this.api.buildUrl(`${this.resource}/${id}/documentos`), formulario);
  }

  /** Descarga con el token de la sesion (el archivo no tiene una URL publica). */
  descargarArchivo(id: number, documentoId: number): Observable<Blob> {
    return this.http.get(this.api.buildUrl(`${this.resource}/${id}/documentos/${documentoId}/archivo`), {
      responseType: 'blob',
    });
  }

  agregarDocumento(id: number, documento: DocumentoAdjuntoRequest): Observable<Expediente> {
    return this.http.post<Expediente>(this.api.buildUrl(`${this.resource}/${id}/documentos`), documento);
  }

  actualizarDocumento(id: number, documentoId: number, documento: DocumentoAdjuntoRequest): Observable<Expediente> {
    return this.http.put<Expediente>(this.api.buildUrl(`${this.resource}/${id}/documentos/${documentoId}`), documento);
  }

  eliminarDocumento(id: number, documentoId: number): Observable<Expediente> {
    return this.http.delete<Expediente>(this.api.buildUrl(`${this.resource}/${id}/documentos/${documentoId}`));
  }

  cambiarEstado(id: number, estado: EstadoExpediente): Observable<Expediente> {
    return this.http.patch<Expediente>(this.api.buildUrl(`${this.resource}/${id}/estado`), { estado });
  }

  resumen(): Observable<ExpedienteEstadoReporte[]> {
    return this.http.get<ExpedienteEstadoReporte[]>(this.api.buildUrl(`${this.resource}/resumen`));
  }
}
