import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { ROLES_CAJA, ROLES_FINANZAS } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { confirmar } from '../../../shared/componentes/confirmar-dialogo';
import { EtiquetaEstado } from '../../../shared/componentes/etiqueta-estado';
import {
  Cargo,
  CargoService,
  MEDIOS_PAGO,
  MedioPago,
  NOMBRE_MEDIO,
  NOMBRE_ORIGEN,
  Pago,
  cuotaVencida,
  porcentajePagado,
} from './cargo-service';

/**
 * Detalle del cargo: cabecera, cuotas (detalle de la cuenta) y pagos. Caja registra pagos y anula cargos sin
 * pagos; el estado, el saldo y la aplicacion del pago a las cuotas los calcula el backend.
 */
@Component({
  selector: 'app-cargo-detalle',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, DatePipe, EtiquetaEstado],
  templateUrl: './cargo-detalle.html',
})
export class CargoDetalle {
  private readonly fb = inject(FormBuilder);
  private readonly cargoService = inject(CargoService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly avisos = inject(AvisoService);
  private readonly auth = inject(AuthService);

  protected readonly esCaja = computed(() => this.auth.tieneRol(...ROLES_CAJA));
  protected readonly volverA = this.auth.tieneRol(...ROLES_FINANZAS) ? '/finanzas/cargos' : '/finanzas/mis-cargos';
  protected readonly medios = MEDIOS_PAGO;
  protected readonly nombreMedio = NOMBRE_MEDIO;
  protected readonly nombreOrigen = NOMBRE_ORIGEN;
  protected readonly cuotaVencida = cuotaVencida;
  protected readonly porcentajePagado = porcentajePagado;
  protected readonly cargo = signal<Cargo | null>(null);
  protected readonly pagos = signal<Pago[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly procesando = signal(false);

  protected readonly admitePago = computed(() => {
    const c = this.cargo();
    return c !== null && c.estado !== 'ANULADO' && c.estado !== 'PAGADO_TOTAL' && c.saldoPendiente > 0;
  });
  protected readonly admiteAnulacion = computed(() => {
    const c = this.cargo();
    return c !== null && c.estado === 'EMITIDO' && c.procesoOrigen !== 'MATRICULA' && this.pagos().length === 0;
  });

  protected readonly formPago = this.fb.group({
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01),
      Validators.pattern(/^\d{1,10}(\.\d{1,2})?$/)]),
    medioPago: this.fb.nonNullable.control<MedioPago>('EFECTIVO', Validators.required),
    referencia: this.fb.nonNullable.control('', Validators.maxLength(100)),
  });

  private readonly id = Number(this.route.snapshot.paramMap.get('id'));

  constructor() {
    this.cargar();
  }

  private cargar(): void {
    forkJoin({ cargo: this.cargoService.obtener(this.id), pagos: this.cargoService.pagos(this.id) }).subscribe({
      next: ({ cargo, pagos }) => {
        this.cargo.set(cargo);
        this.pagos.set(pagos);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar el cargo.'));
        this.loading.set(false);
      },
    });
  }

  pagarSaldo(): void {
    const c = this.cargo();
    if (c) this.formPago.controls.monto.setValue(c.saldoPendiente);
  }

  registrarPago(): void {
    const c = this.cargo();
    if (!c || this.procesando()) return;
    this.error.set(null);
    if (this.formPago.invalid) {
      this.formPago.markAllAsTouched();
      return;
    }
    const v = this.formPago.getRawValue();
    const monto = Number(v.monto);
    if (monto > c.saldoPendiente) {
      this.error.set(`El pago supera el saldo pendiente de S/ ${c.saldoPendiente.toFixed(2)}.`);
      return;
    }
    confirmar(this.dialog, {
      titulo: `Registrar pago del cargo ${c.numeroCargo}`,
      mensaje: 'El pago se aplica a las cuotas pendientes en orden de vencimiento y no se puede revertir desde esta pantalla.',
      detalle: [`Monto: S/ ${monto.toFixed(2)}`, `Medio: ${NOMBRE_MEDIO[v.medioPago]}`, `Saldo actual: S/ ${c.saldoPendiente.toFixed(2)}`],
      confirmar: 'Registrar pago',
    }).subscribe((ok) => {
      if (!ok) return;
      this.procesando.set(true);
      this.cargoService
        .registrarPago(c.id, { monto, medioPago: v.medioPago, referencia: v.referencia.trim() || null })
        .subscribe({
          next: (actualizado) => {
            this.avisos.mostrar(`Pago registrado. Saldo: S/ ${actualizado.saldoPendiente.toFixed(2)}.`, 'ok');
            this.formPago.reset({ monto: null, medioPago: 'EFECTIVO', referencia: '' });
            this.procesando.set(false);
            this.cargar();
          },
          error: (err: HttpErrorResponse) => {
            this.error.set(mensajeHttp(err, 'No se pudo registrar el pago. No se aplicó ningún monto.'));
            this.procesando.set(false);
          },
        });
    });
  }

  anular(): void {
    const c = this.cargo();
    if (!c) return;
    confirmar(this.dialog, {
      titulo: `Anular el cargo ${c.numeroCargo}`,
      mensaje: 'El cargo y sus cuotas quedan anulados y su saldo pasa a cero. Solo es posible si no tiene pagos.',
      detalle: [`Total: S/ ${c.montoTotal.toFixed(2)}`, `Origen: ${NOMBRE_ORIGEN[c.procesoOrigen]}`],
      confirmar: 'Anular cargo',
      peligro: true,
    }).subscribe((ok) => {
      if (!ok) return;
      this.procesando.set(true);
      this.cargoService.anular(c.id).subscribe({
        next: (actualizado) => {
          this.cargo.set(actualizado);
          this.procesando.set(false);
          this.avisos.mostrar(`Cargo ${actualizado.numeroCargo} anulado.`, 'ok');
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo anular el cargo.'));
          this.procesando.set(false);
        },
      });
    });
  }

  protected mensajePago(campo: 'monto' | 'referencia'): string {
    const control = this.formPago.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Indica el monto.';
    if (control.hasError('maxlength')) return 'Máximo 100 caracteres.';
    if (control.hasError('min') || control.hasError('pattern')) return 'Monto mayor a cero, con dos decimales como máximo.';
    return '';
  }
}
