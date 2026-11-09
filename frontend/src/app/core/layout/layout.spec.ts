import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { cerrarSesionDePrueba, iniciarSesionDePrueba } from '../../../testing/sesion-prueba';
import { Layout } from './layout';

async function enlacesDelMenu(): Promise<string[]> {
  await TestBed.configureTestingModule({ imports: [Layout], providers: [provideRouter([])] }).compileComponents();
  const fixture = TestBed.createComponent(Layout);
  await fixture.whenStable();
  const nav = fixture.nativeElement.querySelector('nav') as HTMLElement | null;
  return nav ? [...nav.querySelectorAll('a')].map((a) => a.textContent!.trim()) : [];
}

describe('Layout: menu por rol (S11 2.7)', () => {
  beforeEach(() => {
    cerrarSesionDePrueba();
    TestBed.resetTestingModule();
  });

  it('sin sesion no muestra menu y ofrece "Iniciar sesión"', async () => {
    await TestBed.configureTestingModule({ imports: [Layout], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('nav')).toBeNull();
    expect(html.textContent).toContain('Iniciar sesión');
  });

  it('ESTUDIANTE: solo su informacion, sin la gestion academica', async () => {
    iniciarSesionDePrueba(['ESTUDIANTE'], 1001);
    expect(await enlacesDelMenu()).toEqual([
      'Portal de matrícula',
      'Mi plan de estudios',
      'Inscripción',
      'Mis matrículas',
      'Mi horario',
      'Mis expedientes',
      'Mis pagos',
    ]);
  });

  it('COORDINADOR: gestion academica completa, consulta de finanzas y Base Universal', async () => {
    iniciarSesionDePrueba(['COORDINADOR']);
    expect(await enlacesDelMenu()).toEqual([
      'Portal de matrícula',
      'Inscripción',
      'Matrículas',
      'Horario',
      'Reportes',
      'Expedientes',
      'Periodos',
      'Cursos',
      'Mallas curriculares',
      'Secciones',
      'Plana docente',
      'Cargos',
      'Conceptos de pago',
      'Personas',
      'Alumnos',
      'Institucional',
    ]);
  });

  it('CAJERO: finanzas y consulta de personas y alumnos', async () => {
    iniciarSesionDePrueba(['CAJERO']);
    expect(await enlacesDelMenu()).toEqual(['Portal de matrícula', 'Cargos', 'Conceptos de pago', 'Personas', 'Alumnos']);
  });

  it('DOCENTE: solo su carga lectiva, sin matriculas ni datos de otros', async () => {
    iniciarSesionDePrueba(['DOCENTE']);
    expect(await enlacesDelMenu()).toEqual(['Mi carga lectiva']);
  });
});
