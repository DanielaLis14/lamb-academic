import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucideBan, LucidePencil, LucidePlus } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { Curso } from './curso.model';
import { CursoService } from './curso-service';

/** CRUD de Curso (Core Academico - Oferta): coordinacion consulta; ADMIN registra, edita y da de baja. */
@Component({
  selector: 'app-curso-list',
  imports: [FormsModule, RouterLink, EstadoVacio, LucideBan, LucidePencil, LucidePlus],
  templateUrl: './curso-list.html',
})
export class CursoList implements OnInit {
  private readonly cursoService = inject(CursoService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly cursos = signal<Curso[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly totalCreditos = computed(() => this.cursos().reduce((suma, c) => suma + c.creditos, 0));

  protected activoFiltro: boolean | null = true;
  protected creditosFiltro: number | null = null;
  protected texto = '';
  protected readonly opcionesCreditos = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.cursoService
      .buscar({ activo: this.activoFiltro, creditos: this.creditosFiltro, q: this.texto.trim() || null })
      .subscribe({
        next: (data) => {
          this.cursos.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo cargar el catálogo de cursos.'));
          this.loading.set(false);
        },
      });
  }

  desactivar(curso: Curso): void {
    confirmar(this.dialog, {
      titulo: `Desactivar el curso ${curso.codigo}`,
      mensaje:
        'El curso dejará de ofrecerse en nuevas secciones y mallas. Se conserva en las matrículas y planes ' +
        'existentes. No es posible si tiene secciones programadas en periodos no cerrados.',
      detalle: [curso.nombre, `${curso.creditos} créditos`],
      confirmar: 'Desactivar curso',
      peligro: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.cursoService.desactivar(curso.id).subscribe({
        next: () => {
          this.avisos.mostrar(`Curso ${curso.codigo} desactivado.`, 'ok');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo desactivar el curso.')),
      });
    });
  }
}
