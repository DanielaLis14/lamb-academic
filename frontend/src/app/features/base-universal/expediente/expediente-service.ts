import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api-service';
import {
  Catalogo,
  DocumentoAdjuntoRequest,
  EstadoExpediente,
  Expediente,
  ExpedienteArchivosRequest,
  ExpedienteEstadoReporte,
  ExpedienteRequest,
  ExpedienteResumen,
  FiltroExpedientes,
  TipoSolicitud,
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

  /**
   * Cabecera, archivos y enlaces en una sola peticion multipart; el servidor guarda los archivos en su almacen
   * privado. Los archivos van en el orden de los documentos sin enlace.
   */
  registrarConArchivos(datos: ExpedienteArchivosRequest, archivos: File[]): Observable<Expediente> {
    const formulario = new FormData();
    formulario.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    archivos.forEach((archivo) => formulario.append('archivos', archivo, archivo.name));
    return this.http.post<Expediente>(this.api.buildUrl(this.resource), formulario);
  }

  /** Catalogos de tramite: solo registros activos; los consulta cualquier sesion. */
  categorias(): Observable<Catalogo[]> {
    return this.http.get<Catalogo[]>(this.api.buildUrl(`${this.resource}/catalogos/categorias`));
  }

  tiposSolicitud(categoriaId: number): Observable<TipoSolicitud[]> {
    return this.http.get<TipoSolicitud[]>(
      this.api.buildUrl(`${this.resource}/catalogos/categorias/${categoriaId}/tipos-solicitud`),
    );
  }

  destinatarios(): Observable<Catalogo[]> {
    return this.http.get<Catalogo[]>(this.api.buildUrl(`${this.resource}/catalogos/destinatarios`));
  }

  tiposDocumento(): Observable<Catalogo[]> {
    return this.http.get<Catalogo[]>(this.api.buildUrl(`${this.resource}/catalogos/tipos-documento`));
  }

  /** Agrega un documento con su archivo o con un enlace de SharePoint (solo uno de los dos). */
  agregarArchivo(
    id: number,
    nombre: string,
    tipoDocumentoInstitucionalId: number,
    contenido: { archivo: File } | { enlace: string },
  ): Observable<Expediente> {
    const formulario = new FormData();
    formulario.append('nombre', nombre);
    formulario.append('tipoDocumentoInstitucionalId', String(tipoDocumentoInstitucionalId));
    if ('archivo' in contenido) formulario.append('archivo', contenido.archivo, contenido.archivo.name);
    else formulario.append('enlace', contenido.enlace);
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
