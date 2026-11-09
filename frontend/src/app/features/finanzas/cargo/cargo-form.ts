import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { entero } from '../../../shared/validadores';
import { Alumno, AlumnoService } from '../../base-universal/alumno/alumno-service';
import { Periodo } from '../../matricula/periodo/periodo.model';
import { PeriodoService } from '../../matricula/periodo/periodo-service';
import { ConceptoPago, ConceptoPagoService, NOMBRE_CALCULO } from '../concepto/concepto-service';
import { CargoService, NOMBRE_ORIGEN, PROCESOS_MANUALES, ProcesoOrigen } from './cargo-service';

/**
 * Cargo manual (tramite u otro) con sus cuotas en una sola transaccion. El total y las cuotas los calcula y
 * registra el backend con los conceptos elegidos; la pantalla solo muestra una estimacion antes de enviar.
 */
@Component({
  selector: 'app-cargo-form',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './cargo-form.html',
})
export class CargoForm {
  private readonly fb = inject(FormBuilder);
  private readonly cargoService = inject(CargoService);
  private readonly conceptoService = inject(ConceptoPagoService);
  private readonly alumnoService = inject(AlumnoService);
  private readonly periodoService = inject(PeriodoService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly origenes = PROCESOS_MANUALES;
  protected readonly nombreOrigen = NOMBRE_ORIGEN;
  protected readonly nombreCalculo = NOMBRE_CALCULO;
  protected readonly alumnos = signal<Alumno[]>([]);
  protected readonly periodos = signal<Periodo[]>([]);
  protected readonly conceptos = signal<ConceptoPago[]>([]);
  protected readonly elegidos = signal<Set<string>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly cargando = signal(true);

  protected readonly form = this.fb.group({
    estudianteId: this.fb.control<number | null>(null, Validators.required),
    periodoId: this.fb.control<number | null>(null, Validators.required),
    procesoOrigen: this.fb.nonNullable.control<ProcesoOrigen>('TRAMITE', Validators.required),
    referenciaId: this.fb.control<number | null>(null, [Validators.min(1), entero]),
    totalCreditos: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(40), entero]),
    numeroCuotas: this.fb.control<number | null>(1, [Validators.required, Validators.min(1), Validators.max(12), entero]),
    observacion: this.fb.nonNullable.control('', Validators.maxLength(500)),
  });

  private readonly valor = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly seleccion = computed(() => this.conceptos().filter((c) => this.elegidos().has(c.codigo)));
  protected readonly requiereCreditos = computed(() => this.seleccion().some((c) => c.tipoCalculo === 'POR_CREDITO'));
  /** Estimacion con la misma formula de CalculadoraCargo; el monto definitivo es el que devuelve el backend. */
  protected readonly estimado = computed(() => {
    const creditos = Number(this.valor().totalCreditos) || 0;
    return this.seleccion().reduce((t, c) => t + (c.tipoCalculo === 'POR_CREDITO' ? c.monto * creditos : c.monto), 0);
  });

  constructor() {
    forkJoin({
      alumnos: this.alumnoService.buscar({ estado: 'ACTIVO' }),
      periodos: this.periodoService.listar(),
      conceptos: this.conceptoService.listar(),
    }).subscribe({
      next: ({ alumnos, periodos, conceptos }) => {
        this.alumnos.set(alumnos);
        const ordenados = [...periodos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
        this.periodos.set(ordenados);
        this.form.controls.periodoId.setValue(ordenados.find((p) => p.estado === 'ACTIVO')?.id ?? null);
        this.conceptos.set(conceptos.filter((c) => c.activo).sort((a, b) => a.codigo.localeCompare(b.codigo)));
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudieron cargar alumnos, periodos y conceptos.'));
        this.cargando.set(false);
      },
    });
  }

  alternar(codigo: string): void {
    this.elegidos.update((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(codigo)) nuevo.delete(codigo);
      else nuevo.add(codigo);
      return nuevo;
    });
  }

  guardar(): void {
    if (this.guardando() || this.cargando()) return;
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.seleccion().length) {
      this.error.set('Elige al menos un concepto de pago.');
      return;
    }
    const v = this.form.getRawValue();
    if (this.requiereCreditos() && !v.totalCreditos) {
      this.error.set('Un concepto por crédito necesita la cantidad de créditos.');
      return;
    }
    this.guardando.set(true);
    this.cargoService
      .registrar({
        estudianteId: v.estudianteId!,
        procesoOrigen: v.procesoOrigen,
        referenciaId: v.referenciaId ? Number(v.referenciaId) : null,
        periodoId: v.periodoId!,
        totalCreditos: v.totalCreditos ? Number(v.totalCreditos) : null,
        numeroCuotas: Number(v.numeroCuotas),
        observacion: v.observacion.trim() || null,
        conceptos: this.seleccion().map((c) => c.codigo),
      })
      .subscribe({
        next: (cargo) => {
          this.avisos.mostrar(`Cargo ${cargo.numeroCargo} registrado por S/ ${cargo.montoTotal.toFixed(2)}.`, 'ok');
          this.router.navigate(['/finanzas/cargos', cargo.id]);
        },
        error: (err: HttpErrorResponse) => {
          this.error.set(mensajeHttp(err, 'No se pudo registrar el cargo. No se guardó ninguna cuota.'));
          this.guardando.set(false);
        },
      });
  }

  protected mensaje(campo: 'estudianteId' | 'periodoId' | 'referenciaId' | 'totalCreditos' | 'numeroCuotas' | 'observacion'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return 'Máximo 500 caracteres.';
    if (control.hasError('entero')) return 'Debe ser un número entero.';
    if (control.hasError('min') || control.hasError('max')) {
      return campo === 'numeroCuotas' ? 'Entre 1 y 12 cuotas.' : campo === 'totalCreditos' ? 'Entre 1 y 40 créditos.' : 'Debe ser mayor a cero.';
    }
    return '';
  }
}
