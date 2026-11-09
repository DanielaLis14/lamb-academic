import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideEye } from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import { Cargo, CargoService, NOMBRE_ORIGEN, SaldoEstudiante, cuotaVencida, porcentajePagado } from './cargo-service';

/** Estado de cuenta del ESTUDIANTE: sus cargos, cuotas y saldo (el backend compara con el alumno del token). */
@Component({
  selector: 'app-mis-cargos',
  imports: [RouterLink, CurrencyPipe, DatePipe, EstadoVacio, EtiquetaEstado, LucideEye],
  templateUrl: './mis-cargos.html',
})
export class MisCargos {
  private readonly cargoService = inject(CargoService);
  private readonly auth = inject(AuthService);

  protected readonly nombreOrigen = NOMBRE_ORIGEN;
  protected readonly cuotaVencida = cuotaVencida;
  protected readonly porcentajePagado = porcentajePagado;
  protected readonly cargos = signal<Cargo[]>([]);
  protected readonly saldo = signal<SaldoEstudiante | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);

  constructor() {
    const alumnoId = this.auth.alumnoId();
    if (!alumnoId) {
      this.error.set('Tu cuenta no está vinculada a ningún alumno. Solicita a la administración que registre tu código.');
      this.loading.set(false);
      return;
    }
    forkJoin({ cargos: this.cargoService.deEstudiante(alumnoId), saldo: this.cargoService.saldo(alumnoId) }).subscribe({
      next: ({ cargos, saldo }) => {
        this.cargos.set(cargos);
        this.saldo.set(saldo);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar tu estado de cuenta.'));
        this.loading.set(false);
      },
    });
  }
}
