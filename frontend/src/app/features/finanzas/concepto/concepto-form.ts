import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AvisoService } from '../../../core/services/aviso-service';
import { cuerpoError, mensajeHttp } from '../../../core/services/error-http';
import { ConceptoPagoService, NOMBRE_CALCULO, TipoCalculo } from './concepto-service';

/** Alta y edicion de ConceptoPago con las reglas de ConceptoPagoRequest. */
@Component({
  selector: 'app-concepto-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './concepto-form.html',
})
export class ConceptoForm {
  private readonly fb = inject(FormBuilder);
  private readonly conceptoService = inject(ConceptoPagoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisoService);

  protected readonly tipos: TipoCalculo[] = ['FIJO', 'POR_CREDITO'];
  protected readonly nombreCalculo = NOMBRE_CALCULO;
  protected readonly id = signal<number | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly erroresServidor = signal<Record<string, string>>({});
  protected readonly loading = signal(false);
  protected readonly errorCarga = signal(false);

  protected readonly form = this.fb.group({
    codigo: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[A-Z0-9-]{2,20}$/)]),
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
    tipoCalculo: this.fb.nonNullable.control<TipoCalculo>('FIJO', Validators.required),
    monto: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(99999.99),
      Validators.pattern(/^\d{1,5}(\.\d{1,2})?$/)]),
    aplicaMatricula: this.fb.nonNullable.control(false),
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) return;
    const id = Number(idParam);
    this.id.set(id);
    this.loading.set(true);
    this.conceptoService.obtener(id).subscribe({
      next: (c) => {
        this.form.patchValue(c);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.errorCarga.set(true);
        this.error.set(mensajeHttp(err, 'No se pudo cargar el concepto.'));
        this.loading.set(false);
      },
    });
  }

  guardar(): void {
    if (this.loading() || this.errorCarga()) return;
    this.error.set(null);
    this.erroresServidor.set({});
    const { codigo, nombre } = this.form.controls;
    codigo.setValue(codigo.value.trim().toUpperCase());
    nombre.setValue(nombre.value.trim());
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const concepto = { ...v, monto: Number(v.monto) };
    const id = this.id();
    this.loading.set(true);
    (id ? this.conceptoService.actualizar(id, concepto) : this.conceptoService.crear(concepto)).subscribe({
      next: (c) => {
        this.avisos.mostrar(`Concepto ${c.codigo} ${id ? 'actualizado' : 'registrado'}.`, 'ok');
        this.router.navigate(['/finanzas/conceptos']);
      },
      error: (err: HttpErrorResponse) => {
        this.erroresServidor.set(cuerpoError(err)?.errores ?? {});
        this.error.set(mensajeHttp(err, 'No se pudo guardar el concepto.'));
        this.loading.set(false);
      },
    });
  }

  protected mensajeValidacion(campo: 'codigo' | 'nombre' | 'monto'): string {
    const servidor = this.erroresServidor()[campo];
    if (servidor) return servidor;
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    if (campo === 'codigo' && control.hasError('pattern')) return 'De 2 a 20 caracteres: mayúsculas, dígitos o guion.';
    if (control.hasError('min') || control.hasError('max') || control.hasError('pattern')) {
      return 'Entre 0.00 y 99 999.99, con dos decimales como máximo.';
    }
    return '';
  }
}
