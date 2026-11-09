import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideChevronDown, LucideDynamicIcon, LucideLogIn, LucideLogOut, LucideMenu, LucideX } from '@lucide/angular';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth-service';
import { Rol } from '../auth/roles';
import { AvisoService } from '../services/aviso-service';
import { menuPara } from './menu';
import { moduloDeRuta } from './titulo';

const NOMBRE_ROL: Record<string, string> = {
  [Rol.ESTUDIANTE]: 'Estudiante',
  [Rol.COORDINADOR]: 'Coordinación académica',
  [Rol.ADMIN]: 'Administración',
  [Rol.CAJERO]: 'Caja',
  [Rol.DOCENTE]: 'Docente',
};

/** Con mas opciones que estas, los grupos del menu se pueden plegar. */
const OPCIONES_SIN_PLEGAR = 8;
const CLAVE_PLEGADOS = 'lamb_menu_plegados';

function leerPlegados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_PLEGADOS) ?? '[]');
  } catch {
    return [];
  }
}

/**
 * Contenedor de navegacion (S7): encabezado, menu lateral y router-outlet. Inicio es publico; el
 * menu solo aparece con sesion y filtra por rol (S11 3.9) con las mismas reglas del backend.
 */
@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LucideChevronDown, LucideDynamicIcon, LucideLogIn, LucideLogOut, LucideMenu, LucideX],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
})
export class Layout {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly avisos = inject(AvisoService);
  protected readonly menuAbierto = signal(false);
  private readonly plegados = signal<string[]>(leerPlegados());

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  protected readonly modulo = computed(() => moduloDeRuta(this.url()));
  protected readonly menu = computed(() => menuPara(this.auth.roles()));
  protected readonly plegable = computed(
    () => this.menu().reduce((total, grupo) => total + grupo.items.length, 0) > OPCIONES_SIN_PLEGAR,
  );

  protected readonly rolPrincipal = computed(() => {
    const roles = this.auth.roles();
    const rol = [Rol.ADMIN, Rol.COORDINADOR, Rol.CAJERO, Rol.DOCENTE, Rol.ESTUDIANTE].find((r) => roles.includes(r));
    return rol ? NOMBRE_ROL[rol] : '';
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menuAbierto.set(false));
  }

  /** El grupo de la pantalla actual siempre queda desplegado. */
  protected desplegado(titulo: string, rutas: string[]): boolean {
    if (!this.plegable()) return true;
    const actual = this.url().split(/[?#]/)[0];
    if (rutas.some((r) => actual === r || actual.startsWith(r + '/'))) return true;
    return !this.plegados().includes(titulo);
  }

  protected alternarGrupo(titulo: string): void {
    this.plegados.update((lista) => (lista.includes(titulo) ? lista.filter((t) => t !== titulo) : [...lista, titulo]));
    try {
      localStorage.setItem(CLAVE_PLEGADOS, JSON.stringify(this.plegados()));
    } catch {
      // Sin almacenamiento local el menu funciona igual; solo no recuerda los grupos plegados.
    }
  }

  protected rutasDe(items: { ruta: string }[]): string[] {
    return items.map((i) => i.ruta).filter((r) => r !== '/matricula');
  }

  /** En pantallas pequenas, Escape cierra el menu lateral desplegado. */
  @HostListener('document:keydown.escape')
  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  /** "Saltar al contenido": lleva el foco al area principal sin recargar la ruta. */
  protected irAlContenido(evento: Event): void {
    evento.preventDefault();
    document.getElementById('contenido')?.focus();
  }
}
