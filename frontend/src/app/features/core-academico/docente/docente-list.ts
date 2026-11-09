import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucideCalendarCheck, LucidePencil, LucidePlus, LucideUserX } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { Persona } from '../../base-universal/persona/persona.model';
import { DocenteService } from './docente-service';

/** CRUD de Docente (Core Academico - Curriculo): personas de tipo DOCENTE y su carga lectiva. */
@Component({
  selector: 'app-docente-list',
  imports: [FormsModule, RouterLink, EstadoVacio, LucideCalendarCheck, LucidePencil, LucidePlus, LucideUserX],
  templateUrl: './docente-list.html',
})
export class DocenteList implements OnInit {
  private readonly docenteService = inject(DocenteService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly docentes = signal<Persona[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected activoFiltro: boolean | null = true;
  protected texto = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.docenteService.listar(this.activoFiltro, this.texto.trim() || null).subscribe({
      next: (data) => {
        this.docentes.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar la plana docente.'));
        this.loading.set(false);
      },
    });
  }

  desactivar(docente: Persona): void {
    confirmar(this.dialog, {
      titulo: `Dar de baja a ${docente.nombreCompleto}`,
      mensaje:
        'El docente dejará de estar disponible para nuevas secciones. No es posible si dicta secciones vigentes: ' +
        'primero reasígnalas o cancélalas.',
      detalle: [`${docente.tipoDocumento} ${docente.numeroDocumento}`],
      confirmar: 'Dar de baja',
      peligro: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.docenteService.desactivar(docente.id).subscribe({
        next: () => {
          this.avisos.mostrar(`${docente.nombreCompleto} dado de baja.`, 'ok');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo dar de baja al docente.')),
      });
    });
  }
}
