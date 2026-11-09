import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucidePencil, LucidePlus } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { Escuela } from '../institucional/institucional.model';
import { InstitucionalService } from '../institucional/institucional-service';
import { Alumno, AlumnoService, ESTADOS_ALUMNO, EstadoAlumno, TRANSICIONES_ALUMNO } from './alumno-service';

const NOMBRE_ESTADO: Record<EstadoAlumno, string> = {
  ACTIVO: 'Activo',
  SUSPENDIDO: 'Suspendido',
  RETIRADO: 'Retirado',
  EGRESADO: 'Egresado',
};

const EFECTO_ESTADO: Record<EstadoAlumno, string> = {
  ACTIVO: 'El alumno vuelve a estar habilitado para matricularse.',
  SUSPENDIDO: 'El alumno no podrá matricularse mientras dure la suspensión.',
  RETIRADO: 'El alumno deja de estar habilitado para matricularse; su historia académica se conserva.',
  EGRESADO: 'Egresado es definitivo: el alumno ya no podrá cambiar de estado ni matricularse.',
};

/** CRUD de Alumno (Base Universal): el personal consulta; ADMIN registra, corrige y cambia el estado. */
@Component({
  selector: 'app-alumno-list',
  imports: [FormsModule, RouterLink, DatePipe, EstadoVacio, EtiquetaEstado, LucidePencil, LucidePlus],
  templateUrl: './alumno-list.html',
})
export class AlumnoList implements OnInit {
  private readonly alumnoService = inject(AlumnoService);
  private readonly institucional = inject(InstitucionalService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly estados = ESTADOS_ALUMNO;
  protected readonly nombreEstado = NOMBRE_ESTADO;
  protected readonly transiciones = TRANSICIONES_ALUMNO;
  protected readonly alumnos = signal<Alumno[]>([]);
  protected readonly escuelas = signal<Escuela[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected estadoFiltro: EstadoAlumno | null = null;
  protected escuelaFiltro: number | null = null;
  protected texto = '';

  ngOnInit(): void {
    this.institucional.escuelas().subscribe({ next: (data) => this.escuelas.set(data) });
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.alumnoService
      .buscar({ estado: this.estadoFiltro, idEscuela: this.escuelaFiltro, q: this.texto.trim() || null })
      .subscribe({
        next: (data) => {
          this.alumnos.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo cargar la lista de alumnos.'));
          this.loading.set(false);
        },
      });
  }

  cambiarEstado(alumno: Alumno, destino: EstadoAlumno, selector: HTMLSelectElement): void {
    selector.value = '';
    confirmar(this.dialog, {
      titulo: `Cambiar a ${NOMBRE_ESTADO[destino]} el alumno ${alumno.codigoEstudiante}`,
      mensaje: EFECTO_ESTADO[destino],
      detalle: [alumno.persona.nombreCompleto, `Estado actual: ${NOMBRE_ESTADO[alumno.estado]}`],
      confirmar: `Cambiar a ${NOMBRE_ESTADO[destino]}`,
      peligro: destino !== 'ACTIVO',
    }).subscribe((ok) => {
      if (!ok) return;
      this.alumnoService.cambiarEstado(alumno.id, destino).subscribe({
        next: (actualizado) => {
          this.avisos.mostrar(`${actualizado.codigoEstudiante}: estado ${NOMBRE_ESTADO[actualizado.estado]}.`, 'ok');
          this.alumnos.update((lista) => lista.map((a) => (a.id === actualizado.id ? actualizado : a)));
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo cambiar el estado del alumno.')),
      });
    });
  }
}
