import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/** Modulo al que pertenece cada ruta: el encabezado lo muestra junto a la marca. */
const MODULOS: [string, string][] = [
  ['/matricula/periodos', 'Gestión académica'],
  ['/matricula/secciones', 'Gestión académica'],
  ['/matricula', 'Matrícula'],
  ['/mi-plan', 'Matrícula'],
  ['/academico', 'Gestión académica'],
  ['/docencia', 'Mi docencia'],
  ['/expedientes', 'Trámites'],
  ['/finanzas', 'Finanzas'],
  ['/personas', 'Base Universal'],
  ['/alumnos', 'Base Universal'],
  ['/institucional', 'Base Universal'],
];

export function moduloDeRuta(url: string): string {
  const ruta = url.split(/[?#]/)[0];
  return MODULOS.find(([prefijo]) => ruta === prefijo || ruta.startsWith(prefijo + '/'))?.[1] ?? '';
}

/** Titulo de la pestana: "Pantalla · LAMB Academic", con el titulo declarado en cada ruta. */
@Injectable()
export class TituloLamb extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(estado: RouterStateSnapshot): void {
    const pantalla = this.buildTitle(estado);
    this.title.setTitle(pantalla ? `${pantalla} · LAMB Academic` : 'LAMB Academic');
  }
}
