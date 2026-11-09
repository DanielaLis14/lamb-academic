import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideDynamicIcon, LucideLock } from '@lucide/angular';
import { AuthService } from '../auth/auth-service';
import { accesosRapidos } from '../layout/menu';

/** Inicio publico (S11 2.5): sin sesion muestra el acceso; con sesion, los accesos de su rol. */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, LucideDynamicIcon, LucideLock],
  template: `
    <section class="pagina inicio">
      <header class="encabezado-pagina">
        <div>
          <p class="migas">Sistema académico universitario</p>
          <h1>LAMB Academic</h1>
          <p class="descripcion">
            Matrícula, gestión académica, docencia, trámites y pagos de la universidad. Cada perfil ve las opciones
            que le corresponden.
          </p>
        </div>
      </header>

      @if (!auth.autenticado()) {
        <div class="tarjeta acceso">
          <div class="cuerpo">
            <svg lucideLock class="acceso-icono" aria-hidden="true"></svg>
            <div>
              <h2>Ingreso con tu cuenta institucional</h2>
              <p class="texto-secundario">
                El inicio de sesión se realiza en el servidor de identidad de LAMB Academic. Esta aplicación nunca
                recibe tu contraseña.
              </p>
            </div>
            <button type="button" class="boton boton-primario" (click)="auth.iniciarLogin('/')">
              Iniciar sesión
            </button>
          </div>
        </div>
      } @else {
        <div class="rejilla rejilla-3">
          @for (acceso of accesos(); track acceso.ruta) {
            <a class="tarjeta enlace" [routerLink]="acceso.ruta">
              <div class="cuerpo">
                <svg [lucideIcon]="acceso.icono" aria-hidden="true"></svg>
                <h2>{{ acceso.etiqueta }}</h2>
                <p class="texto-secundario">{{ acceso.grupo }}</p>
              </div>
            </a>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .acceso .cuerpo {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 1rem 1.25rem;
    }
    .acceso .cuerpo > div {
      flex: 1 1 280px;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .acceso-icono {
      width: 28px;
      height: 28px;
      color: var(--lamb-marino-600);
    }
    .enlace {
      text-decoration: none;
      color: inherit;
    }
    .enlace:hover {
      border-color: var(--lamb-marino-600);
    }
    .enlace .cuerpo {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .enlace svg {
      width: 22px;
      height: 22px;
      color: var(--lamb-turquesa-600);
    }
  `,
})
export class Inicio {
  protected readonly auth = inject(AuthService);
  /** Cada rol ve solo lo que puede abrir, repartido entre sus modulos. */
  protected readonly accesos = computed(() => accesosRapidos(this.auth.roles()));
}
