import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideDownload, LucidePencil, LucidePlus, LucideTrash } from '@lucide/angular';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_COORDINACION } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import {
  GrupoDocumento,
  grupoDocumento,
  guardarEnEquipo,
  mensajeDocumento,
  problemaArchivo,
  tamanoLegible,
  valorDocumento,
} from './documento-form';
import {
  ACEPTA_ARCHIVO,
  DocumentoAdjunto,
  ESTADOS_EDITABLES,
  EstadoExpediente,
  Expediente,
  MAX_DOCUMENTOS,
  NOMBRE_ESTADO_EXPEDIENTE,
  TIPOS_ARCHIVO,
  TRANSICIONES_EXPEDIENTE,
} from './expediente.model';
import { ExpedienteService } from './expediente-service';

const EFECTO_ESTADO: Record<EstadoExpediente, string> = {
  REGISTRADO: '',
  EN_REVISION: 'El expediente pasa a revisión y el titular ya no podrá modificar sus documentos.',
  OBSERVADO: 'El titular podrá corregir, agregar o quitar documentos y volver a enviarlo a revisión.',
  APROBADO: 'El trámite queda aprobado; sus documentos ya no se modifican.',
  ARCHIVADO: 'Archivar es definitivo: el expediente no admitirá más cambios de estado.',
};

/** Detalle del expediente: corregir o quitar documentos (titular o personal) y revisar (coordinacion). */
@Component({
  selector: 'app-expediente-detalle',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    NgTemplateOutlet,
    EtiquetaEstado,
    LucideDownload,
    LucidePencil,
    LucidePlus,
    LucideTrash,
  ],
  templateUrl: './expediente-detalle.html',
})
export class ExpedienteDetalle {
  private readonly fb = inject(FormBuilder);
  private readonly expedienteService = inject(ExpedienteService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  private readonly auth = inject(AuthService);

  protected readonly esCoordinacion = computed(() => this.auth.tieneRol(...ROLES_COORDINACION));
  protected readonly tiposArchivo = TIPOS_ARCHIVO;
  protected readonly nombreEstado = NOMBRE_ESTADO_EXPEDIENTE;
  protected readonly mensajeDocumento = mensajeDocumento;
  protected readonly expediente = signal<Expediente | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly procesando = signal(false);
  /** Documento en edicion (id) o 0 para uno nuevo; null sin edicion abierta. */
  protected readonly editando = signal<number | null>(null);
  protected linea: GrupoDocumento = grupoDocumento(this.fb);
  /** El documento en edicion tiene archivo cargado: solo se corrige su nombre. */
  protected readonly editandoArchivo = signal(false);
  protected readonly acepta = ACEPTA_ARCHIVO;
  protected readonly tamanoLegible = tamanoLegible;
  protected readonly subida = this.fb.group({
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    archivo: this.fb.control<File | null>(null),
  });
  protected readonly errorArchivo = signal<string | null>(null);

  protected readonly editable = computed(() => {
    const e = this.expediente();
    return e !== null && ESTADOS_EDITABLES.includes(e.estado);
  });
  protected readonly destinos = computed(() => {
    const e = this.expediente();
    return e && this.esCoordinacion() ? TRANSICIONES_EXPEDIENTE[e.estado] : [];
  });
  protected readonly admiteMas = computed(() => (this.expediente()?.documentos.length ?? 0) < MAX_DOCUMENTOS);

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.expedienteService.obtener(this.id).subscribe({
      next: (e) => {
        this.expediente.set(e);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar el expediente.'));
        this.loading.set(false);
      },
    });
  }

  nuevoDocumento(): void {
    this.subida.reset({ nombre: '', archivo: null });
    this.errorArchivo.set(null);
    this.editando.set(0);
  }

  editar(documento: DocumentoAdjunto): void {
    this.editandoArchivo.set(documento.archivoDisponible);
    this.linea = grupoDocumento(this.fb, { ...documento, rutaArchivo: documento.rutaArchivo ?? 'archivo cargado' });
    this.editando.set(documento.id);
  }

  elegirArchivo(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    this.subida.controls.archivo.setValue(archivo);
    this.errorArchivo.set(problemaArchivo(archivo));
    if (archivo && !this.subida.controls.nombre.value.trim()) {
      this.subida.controls.nombre.setValue(archivo.name.replace(/\.[^.]+$/, '').slice(0, 150));
    }
  }

  subirDocumento(): void {
    if (this.procesando()) return;
    const archivo = this.subida.controls.archivo.value;
    this.errorArchivo.set(problemaArchivo(archivo));
    if (this.subida.invalid || this.errorArchivo()) {
      this.subida.markAllAsTouched();
      return;
    }
    this.ejecutar(this.expedienteService.agregarArchivo(this.id, this.subida.controls.nombre.value.trim(), archivo!),
      'Documento agregado con su archivo.', 'No se pudo agregar el documento. No se guardó el archivo.');
  }

  descargar(documento: DocumentoAdjunto): void {
    this.expedienteService.descargarArchivo(this.id, documento.id).subscribe({
      next: (contenido) => guardarEnEquipo(contenido, documento.nombreArchivo),
      error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo descargar el archivo.')),
    });
  }

  cancelarEdicion(): void {
    this.editando.set(null);
  }

  guardarDocumento(): void {
    const documentoId = this.editando();
    if (documentoId === null || documentoId === 0 || this.procesando()) return;
    if (this.linea.invalid) {
      this.linea.markAllAsTouched();
      return;
    }
    this.ejecutar(this.expedienteService.actualizarDocumento(this.id, documentoId, valorDocumento(this.linea)),
      'Documento corregido.', 'No se pudo guardar el documento.');
  }

  eliminar(documento: DocumentoAdjunto): void {
    confirmar(this.dialog, {
      titulo: `Quitar el documento ${documento.nombre}`,
      mensaje: 'El documento se retira del expediente. El expediente debe conservar al menos un documento.',
      detalle: [documento.nombreArchivo, documento.archivoDisponible ? 'El archivo se borra del almacén.' : `Ruta: ${documento.rutaArchivo}`],
      confirmar: 'Quitar documento',
      peligro: true,
    }).subscribe((ok) => {
      if (ok) {
        this.ejecutar(this.expedienteService.eliminarDocumento(this.id, documento.id), 'Documento retirado.',
          'No se pudo quitar el documento.');
      }
    });
  }

  cambiarEstado(destino: EstadoExpediente): void {
    const e = this.expediente();
    if (!e) return;
    confirmar(this.dialog, {
      titulo: `Pasar ${e.codigoTramite} a ${NOMBRE_ESTADO_EXPEDIENTE[destino]}`,
      mensaje: EFECTO_ESTADO[destino],
      detalle: [e.asunto, `Titular: ${e.persona.nombreCompleto}`, `Documentos: ${e.totalDocumentos}`],
      confirmar: `Pasar a ${NOMBRE_ESTADO_EXPEDIENTE[destino]}`,
      peligro: destino === 'ARCHIVADO' || destino === 'OBSERVADO',
    }).subscribe((ok) => {
      if (ok) {
        this.ejecutar(this.expedienteService.cambiarEstado(this.id, destino),
          `Expediente en estado ${NOMBRE_ESTADO_EXPEDIENTE[destino]}.`, 'No se pudo cambiar el estado.');
      }
    });
  }

  private ejecutar(peticion: Observable<Expediente>, exito: string, generico: string): void {
    this.procesando.set(true);
    this.error.set(null);
    peticion.subscribe({
      next: (e) => {
        this.expediente.set(e);
        this.editando.set(null);
        this.procesando.set(false);
        this.avisos.mostrar(exito, 'ok');
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, generico));
        this.procesando.set(false);
      },
    });
  }
}
