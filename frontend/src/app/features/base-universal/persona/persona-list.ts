import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { LucidePencil, LucidePlus, LucideUserX } from '@lucide/angular';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { Escuela } from '../institucional/institucional.model';
import { InstitucionalService } from '../institucional/institucional-service';
import { NOMBRE_TIPO_PERSONA, Persona, TIPOS_PERSONA, TipoPersona } from './persona.model';
import { PersonaService } from './persona-service';

/** CRUD de Persona (Base Universal): consulta para el personal; altas, cambios y bajas solo ADMIN. */
@Component({
  selector: 'app-persona-list',
  imports: [FormsModule, RouterLink, EstadoVacio, LucidePencil, LucidePlus, LucideUserX],
  templateUrl: './persona-list.html',
})
export class PersonaList implements OnInit {
  private readonly personaService = inject(PersonaService);
  private readonly institucional = inject(InstitucionalService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly tipos = TIPOS_PERSONA;
  protected readonly nombreTipo = NOMBRE_TIPO_PERSONA;
  protected readonly personas = signal<Persona[]>([]);
  protected readonly escuelas = signal<Escuela[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);

  protected tipoFiltro: TipoPersona | null = null;
  protected activoFiltro: boolean | null = true;
  protected escuelaFiltro: number | null = null;
  protected texto = '';

  ngOnInit(): void {
    this.institucional.escuelas().subscribe({ next: (data) => this.escuelas.set(data) });
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.personaService
      .buscar({
        tipoPersona: this.tipoFiltro,
        activo: this.activoFiltro,
        idEscuela: this.escuelaFiltro,
        q: this.texto.trim() || null,
      })
      .subscribe({
        next: (data) => {
          this.personas.set(data);
          this.loading.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo cargar la lista de personas.'));
          this.loading.set(false);
        },
      });
  }

  desactivar(persona: Persona): void {
    confirmar(this.dialog, {
      titulo: `Dar de baja a ${persona.nombreCompleto}`,
      mensaje:
        'La persona quedará inactiva: no podrá registrarse como alumno ni iniciar trámites. Sus matrículas, ' +
        'cargos y expedientes se conservan.',
      detalle: [`${persona.tipoDocumento} ${persona.numeroDocumento}`, this.nombreTipo[persona.tipoPersona]],
      confirmar: 'Dar de baja',
      peligro: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.personaService.desactivar(persona.id).subscribe({
        next: () => {
          this.avisos.mostrar(`${persona.nombreCompleto} quedó inactiva.`, 'ok');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo dar de baja a la persona.')),
      });
    });
  }
}
