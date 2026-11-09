import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePlus } from '@lucide/angular';
import { Observable } from 'rxjs';
import { AuthService } from '../../../core/auth/auth-service';
import { Rol } from '../../../core/auth/roles';
import { AvisoService } from '../../../core/services/aviso-service';
import { mensajeHttp } from '../../../core/services/error-http';
import { EstadoVacio } from '../../../shared/componentes/estado-vacio';
import { InstitucionalService } from './institucional-service';
import { NIVELES, NIVEL_ETIQUETA, Nivel, SedeArbol } from './institucional.model';

type Nivel3 = 'sede' | 'facultad' | 'escuela';

/**
 * Estructura institucional Sede > Facultad > Escuela (aporte de Core Academico - Curriculo, adaptado al
 * sistema visual de LAMB). Coordinacion la consulta; registrar cada nivel es de ADMIN (SecurityConfig).
 */
@Component({
  selector: 'app-institucional',
  imports: [ReactiveFormsModule, NgTemplateOutlet, EstadoVacio, LucidePlus],
  templateUrl: './institucional.html',
  styleUrl: './institucional.css',
})
export class Institucional implements OnInit {
  private readonly service = inject(InstitucionalService);
  private readonly avisos = inject(AvisoService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);
  protected readonly rolAdmin = Rol.ADMIN;

  protected readonly niveles = NIVELES;
  protected readonly nivelEtiqueta = NIVEL_ETIQUETA;
  protected readonly arbol = signal<SedeArbol[]>([]);
  protected readonly sedeId = signal<number | null>(null);
  protected readonly facultadId = signal<number | null>(null);
  protected readonly abierto = signal<Nivel3 | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly guardando = signal(false);

  protected readonly sede = computed(() => this.arbol().find((s) => s.id === this.sedeId()) ?? null);
  protected readonly facultad = computed(() => this.sede()?.facultades.find((f) => f.id === this.facultadId()) ?? null);

  protected readonly form = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    direccion: ['', [Validators.maxLength(255)]],
    nivel: ['PREGRADO' as Nivel],
  });

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.service.arbol().subscribe({
      next: (data) => {
        this.arbol.set(data);
        if (!data.some((s) => s.id === this.sedeId())) this.seleccionarSede(data[0]?.id ?? null);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo cargar la estructura institucional.'));
        this.loading.set(false);
      },
    });
  }

  seleccionarSede(id: number | null): void {
    this.sedeId.set(id);
    this.facultadId.set(this.sede()?.facultades[0]?.id ?? null);
    this.abierto.set(null);
  }

  seleccionarFacultad(id: number): void {
    this.facultadId.set(id);
    this.abierto.set(null);
  }

  abrir(nivel: Nivel3): void {
    this.form.reset({ codigo: '', nombre: '', direccion: '', nivel: 'PREGRADO' });
    this.error.set(null);
    this.abierto.set(nivel);
  }

  guardar(): void {
    const nivel = this.abierto();
    if (!nivel || this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const codigo = v.codigo.trim().toUpperCase();
    const nombre = v.nombre.trim();
    let peticion: Observable<unknown>;
    if (nivel === 'sede') {
      peticion = this.service.crearSede({ codigo, nombre, direccion: v.direccion.trim() || null });
    } else if (nivel === 'facultad') {
      peticion = this.service.crearFacultad({ idSede: this.sedeId()!, codigo, nombre });
    } else {
      peticion = this.service.crearEscuela({ idFacultad: this.facultadId()!, codigo, nombre, nivel: v.nivel });
    }
    this.guardando.set(true);
    peticion.subscribe({
      next: () => {
        const etiqueta = { sede: 'Sede', facultad: 'Facultad', escuela: 'Escuela' }[nivel];
        this.avisos.mostrar(`${etiqueta} ${codigo} registrada.`, 'ok');
        this.abierto.set(null);
        this.guardando.set(false);
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(mensajeHttp(err, 'No se pudo registrar.'));
        this.guardando.set(false);
      },
    });
  }

  protected etiquetaNivel(nivel: string): string {
    return NIVEL_ETIQUETA[nivel as Nivel] ?? nivel;
  }

  protected mensaje(campo: 'codigo' | 'nombre' | 'direccion'): string {
    const control = this.form.controls[campo];
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Obligatorio.';
    if (control.hasError('maxlength')) return `Máximo ${control.getError('maxlength').requiredLength} caracteres.`;
    return '';
  }
}
