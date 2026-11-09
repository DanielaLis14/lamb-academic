import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { avancePorCurso } from '../../features/core-academico/plan/mi-plan';
import { Cuota, cuotaVencida, porcentajePagado } from '../../features/finanzas/cargo/cargo-service';
import { Matricula } from '../../features/matricula/matricula/matricula.model';
import { cerrarSesionDePrueba, iniciarSesionDePrueba } from '../../../testing/sesion-prueba';
import { Layout } from './layout';
import { accesosRapidos } from './menu';
import { moduloDeRuta } from './titulo';

describe('Encabezado: modulo de cada ruta', () => {
  it('muestra el modulo real y no siempre Matrícula', () => {
    expect(moduloDeRuta('/matricula/consulta/93')).toBe('Matrícula');
    expect(moduloDeRuta('/matricula/periodos')).toBe('Gestión académica');
    expect(moduloDeRuta('/academico/planes/1')).toBe('Gestión académica');
    expect(moduloDeRuta('/finanzas/cargos?estado=EMITIDO')).toBe('Finanzas');
    expect(moduloDeRuta('/expedientes/9')).toBe('Trámites');
    expect(moduloDeRuta('/personas')).toBe('Base Universal');
    expect(moduloDeRuta('/docencia')).toBe('Mi docencia');
    expect(moduloDeRuta('/mi-plan')).toBe('Matrícula');
    expect(moduloDeRuta('/')).toBe('');
    expect(moduloDeRuta('/matriculas-falsas')).toBe('');
  });

  it('el encabezado cambia al navegar entre modulos', async () => {
    cerrarSesionDePrueba();
    iniciarSesionDePrueba(['ADMIN']);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Layout],
      providers: [provideRouter([{ path: '**', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Layout);
    const router = TestBed.inject(Router);
    const modulo = () => (fixture.nativeElement as HTMLElement).querySelector('.marca-modulo')?.textContent?.trim();
    await router.navigateByUrl('/finanzas/cargos');
    await fixture.whenStable();
    expect(modulo()).toBe('Finanzas');
    await router.navigateByUrl('/personas');
    await fixture.whenStable();
    expect(modulo()).toBe('Base Universal');
    cerrarSesionDePrueba();
  });
});

describe('Mi plan de estudios: avance por curso', () => {
  const matricula = (id: number, fecha: string, estado: string, detalles: [number, Matricula['detalles'][0]['resultado']][]) =>
    ({
      id, estudianteId: 1001, periodoId: 1, fecha, estado, totalCreditos: null, cargo: null,
      detalles: detalles.map(([cursoId, resultado], i) => ({ id: id * 10 + i, seccionId: 1, cursoId, creditos: 4, resultado })),
    }) as Matricula;

  it('aprobado prevalece, sin resultado esta en curso y lo anulado no cuenta', () => {
    const avance = avancePorCurso([
      matricula(1, '2025-03-10', 'CONFIRMADA', [[1, 'APROBADO'], [2, 'DESAPROBADO']]),
      matricula(2, '2026-08-10', 'INICIADA', [[2, null], [1, 'DESAPROBADO']]),
      matricula(3, '2026-08-11', 'ANULADA', [[3, null]]),
    ]);
    expect(avance.get(1)).toBe('APROBADO');
    expect(avance.get(2)).toBe('EN_CURSO');
    expect(avance.has(3)).toBe(false);
  });
});

describe('Finanzas: presentacion de cuotas', () => {
  const cuota = (estado: Cuota['estado'], fechaVencimiento: string): Cuota =>
    ({ id: 1, numeroCuota: 1, conceptoNombre: null, fechaVencimiento, montoCuota: 100, montoPagado: 0, estado });

  it('una cuota vencida tiene saldo y fecha pasada', () => {
    expect(cuotaVencida(cuota('PENDIENTE', '2026-10-10'), '2026-11-07')).toBe(true);
    expect(cuotaVencida(cuota('PAGADA_PARCIAL', '2026-10-10'), '2026-11-07')).toBe(true);
    expect(cuotaVencida(cuota('PAGADA', '2026-10-10'), '2026-11-07')).toBe(false);
    expect(cuotaVencida(cuota('PENDIENTE', '2026-11-07'), '2026-11-07')).toBe(false);
  });

  it('el porcentaje pagado no se calcula para un cargo anulado', () => {
    expect(porcentajePagado({ montoTotal: 700, saldoPendiente: 500, estado: 'PAGADO_PARCIAL' })).toBe(29);
    expect(porcentajePagado({ montoTotal: 700, saldoPendiente: 0, estado: 'ANULADO' })).toBe(0);
  });
});

describe('Inicio: accesos rapidos por rol', () => {
  const grupos = (roles: string[]) => accesosRapidos(roles).map((a) => a.grupo);

  it('reparte los accesos del administrador entre sus modulos', () => {
    const porGrupo = grupos(['ADMIN']).reduce<Record<string, number>>((c, g) => ({ ...c, [g]: (c[g] ?? 0) + 1 }), {});
    expect(Object.keys(porGrupo)).toEqual(['Matrícula', 'Trámites y pagos', 'Gestión académica', 'Finanzas', 'Base Universal']);
    expect(Math.max(...Object.values(porGrupo))).toBeLessThanOrEqual(2);
  });

  it('el estudiante conserva sus opciones personales', () => {
    const rutas = accesosRapidos(['ESTUDIANTE']).map((a) => a.ruta);
    for (const ruta of ['/matricula/inscripcion', '/mi-plan', '/matricula/horario', '/expedientes', '/finanzas/mis-cargos']) {
      expect(rutas).toContain(ruta);
    }
    expect(rutas.some((r) => r.startsWith('/academico') || r === '/finanzas/cargos')).toBe(false);
  });

  it('el docente solo ve su carga lectiva', () => {
    expect(accesosRapidos(['DOCENTE']).map((a) => a.ruta)).toEqual(['/docencia']);
  });
});
