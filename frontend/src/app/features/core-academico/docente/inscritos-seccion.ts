import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { InscritosSeccion } from '../../matricula/matricula/matricula.model';
import { MatriculaService } from '../../matricula/matricula/matricula-service';

/**
 * Estudiantes inscritos en una seccion (matriculas no anuladas). El DOCENTE solo abre las secciones que
 * dicta: el backend responde 403 en cualquier otra. Coordinacion abre cualquiera.
 */
@Component({
  selector: 'app-inscritos-seccion',
  imports: [RouterLink, EstadoVacio, EtiquetaEstado],
  templateUrl: './inscritos-seccion.html',
})
export class InscritosSeccionVista {
  private readonly matriculaService = inject(MatriculaService);
  private readonly route = inject(ActivatedRoute);

  protected readonly propia = this.route.snapshot.data['propia'] === true;
  protected readonly volverA = this.propia ? '/docencia' : '/matricula/secciones';
  protected readonly datos = signal<InscritosSeccion | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    const seccionId = Number(this.route.snapshot.paramMap.get('id'));
    this.matriculaService.inscritos(seccionId).subscribe({
      next: (datos) => {
        this.datos.set(datos);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar la lista de estudiantes.'));
        this.loading.set(false);
      },
    });
  }
}
