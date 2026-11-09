import { CurrencyPipe } from '@angular/common';
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
import { ConceptoPago, ConceptoPagoService, NOMBRE_CALCULO } from './concepto-service';

/** CRUD de ConceptoPago (Finanzas): caja y coordinacion consultan; ADMIN configura. */
@Component({
  selector: 'app-concepto-list',
  imports: [FormsModule, RouterLink, CurrencyPipe, EstadoVacio, LucideBan, LucidePencil, LucidePlus],
  templateUrl: './concepto-list.html',
})
export class ConceptoList implements OnInit {
  private readonly conceptoService = inject(ConceptoPagoService);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;
  protected readonly nombreCalculo = NOMBRE_CALCULO;

  private readonly conceptos = signal<ConceptoPago[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly soloActivos = signal(true);
  protected readonly visibles = computed(() =>
    this.conceptos().filter((c) => !this.soloActivos() || c.activo).sort((a, b) => a.codigo.localeCompare(b.codigo)),
  );

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);
    this.conceptoService.listar().subscribe({
      next: (data) => {
        this.conceptos.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudieron cargar los conceptos de pago.'));
        this.loading.set(false);
      },
    });
  }

  desactivar(concepto: ConceptoPago): void {
    confirmar(this.dialog, {
      titulo: `Desactivar el concepto ${concepto.codigo}`,
      mensaje:
        'El concepto dejará de aplicarse a los cargos nuevos. Los cargos ya emitidos conservan su monto.',
      detalle: [concepto.nombre],
      confirmar: 'Desactivar concepto',
      peligro: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.conceptoService.desactivar(concepto.id).subscribe({
        next: () => {
          this.avisos.mostrar(`Concepto ${concepto.codigo} desactivado.`, 'ok');
          this.cargar();
        },
        error: (err: HttpErrorResponse) => this.error.set(mensajeHttp(err, 'No se pudo desactivar el concepto.')),
      });
    });
  }
}
