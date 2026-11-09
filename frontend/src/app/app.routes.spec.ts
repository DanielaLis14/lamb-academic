import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from './core/auth/auth-service';
import { routes } from './app.routes';

/** La primera navegacion compila los componentes perezosos (loadComponent) en la prueba. */
const CARGA_PEREZOSA_MS = 120_000;

/**
 * Permisos de navegacion con las rutas reales de la SPA (authGuard + rolGuard). Refleja la matriz de
 * SecurityConfig; el backend sigue siendo la autoridad (los 403 reales los prueba matriz_accesos.py).
 */
describe('rutas de Matricula por rol', () => {
  function sesion(roles: string[]) {
    return {
      autenticado: () => true,
      roles: () => roles,
      tieneRol: (...permitidos: string[]) => permitidos.some((r) => roles.includes(r)),
      iniciarLogin: vi.fn(),
    };
  }

  async function navegar(roles: string[], url: string): Promise<string> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthService, useValue: sesion(roles) }],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return router.url;
  }

  const CASOS: [string, string[], string, boolean][] = [
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/inscripcion', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/consulta', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/horario', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/reportes', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/periodos', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/secciones', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/matricula/secciones/nueva', false],
    ['CAJERO', ['CAJERO'], '/matricula/inscripcion', false],
    ['CAJERO', ['CAJERO'], '/matricula/consulta', false],
    ['CAJERO', ['CAJERO'], '/matricula/reportes', false],
    ['COORDINADOR', ['COORDINADOR'], '/matricula/reportes', true],
    ['COORDINADOR', ['COORDINADOR'], '/matricula/secciones/nueva', true],
    ['COORDINADOR', ['COORDINADOR'], '/matricula/periodos', true],
    ['COORDINADOR', ['COORDINADOR'], '/matricula/periodos/nuevo', false],
    ['ADMIN', ['ADMIN'], '/matricula/periodos/nuevo', true],
    ['ADMIN', ['ADMIN'], '/matricula/periodos/4/editar', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/mi-plan', true],
    ['COORDINADOR', ['COORDINADOR'], '/mi-plan', false],
    ['DOCENTE', ['DOCENTE'], '/mi-plan', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/expedientes', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/expedientes/nuevo', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/finanzas/mis-cargos', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/finanzas/cargos/7', true],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/finanzas/cargos', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/personas', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/academico/cursos', false],
    ['ESTUDIANTE', ['ESTUDIANTE'], '/docencia', false],
    ['CAJERO', ['CAJERO'], '/finanzas/cargos', true],
    ['CAJERO', ['CAJERO'], '/finanzas/cargos/nuevo', true],
    ['CAJERO', ['CAJERO'], '/finanzas/conceptos/nuevo', false],
    ['CAJERO', ['CAJERO'], '/personas', true],
    ['CAJERO', ['CAJERO'], '/personas/nueva', false],
    ['CAJERO', ['CAJERO'], '/expedientes', false],
    ['COORDINADOR', ['COORDINADOR'], '/finanzas/cargos', true],
    ['COORDINADOR', ['COORDINADOR'], '/finanzas/cargos/nuevo', false],
    ['COORDINADOR', ['COORDINADOR'], '/academico/cursos', true],
    ['COORDINADOR', ['COORDINADOR'], '/academico/cursos/nuevo', false],
    ['COORDINADOR', ['COORDINADOR'], '/academico/planes/nuevo', false],
    ['COORDINADOR', ['COORDINADOR'], '/academico/docentes/5/carga', true],
    ['COORDINADOR', ['COORDINADOR'], '/academico/secciones/1004/inscritos', true],
    ['COORDINADOR', ['COORDINADOR'], '/docencia', false],
    ['ADMIN', ['ADMIN'], '/academico/planes/nuevo', true],
    ['ADMIN', ['ADMIN'], '/academico/docentes/nuevo', true],
    ['ADMIN', ['ADMIN'], '/alumnos/nuevo', true],
    ['ADMIN', ['ADMIN'], '/finanzas/conceptos/nuevo', true],
    ['DOCENTE', ['DOCENTE'], '/docencia', true],
    ['DOCENTE', ['DOCENTE'], '/docencia/secciones/1004/inscritos', true],
    ['DOCENTE', ['DOCENTE'], '/academico/secciones/1004/inscritos', false],
    ['DOCENTE', ['DOCENTE'], '/matricula/consulta', false],
    ['DOCENTE', ['DOCENTE'], '/expedientes', false],
    ['DOCENTE', ['DOCENTE'], '/finanzas/cargos', false],
  ];

  for (const [nombre, roles, url, permitido] of CASOS) {
    it(`${nombre} ${permitido ? 'puede abrir' : 'no puede abrir'} ${url}`, async () => {
      expect(await navegar(roles, url)).toBe(permitido ? url : '/sin-permiso');
    }, CARGA_PEREZOSA_MS);
  }

  it('sin sesion, una ruta protegida inicia el login recordando el destino', async () => {
    TestBed.resetTestingModule();
    const auth = { ...sesion([]), autenticado: () => false };
    TestBed.configureTestingModule({ providers: [provideRouter(routes), { provide: AuthService, useValue: auth }] });
    await TestBed.inject(Router).navigateByUrl('/matricula/consulta');
    expect(auth.iniciarLogin).toHaveBeenCalledWith('/matricula/consulta');
  });
});
