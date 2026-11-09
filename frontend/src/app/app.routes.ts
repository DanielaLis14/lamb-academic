import { Routes } from '@angular/router';
import {
  ROLES_CAJA,
  ROLES_COORDINACION,
  ROLES_EXPEDIENTE,
  ROLES_FINANZAS,
  ROLES_MATRICULA,
  ROLES_PERSONAL,
  Rol,
} from './core/auth/roles';
import { authGuard } from './core/guards/auth-guard';
import { rolGuard } from './core/guards/rol-guard';

/**
 * Rutas de la SPA (S7 + S11 3.7). auth/callback queda fuera del layout y sin guard. Inicio es
 * publico. authGuard va en cada ruta con sesion y rolGuard, despues, en las que exigen rol; los
 * roles son los mismos de SecurityConfig (el backend decide de verdad).
 */
export const routes: Routes = [
  {
    path: 'auth/callback',
    title: 'Ingreso',
    loadComponent: () => import('./core/auth/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/layout').then((m) => m.Layout),
    children: [
      {
        path: '',
        title: 'Inicio',
        loadComponent: () => import('./core/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'matricula',
        title: 'Portal de matrícula',
        canActivate: [authGuard],
        loadComponent: () => import('./features/matricula/matricula/portal-matricula').then((m) => m.PortalMatricula),
      },
      {
        path: 'matricula/inscripcion',
        title: 'Inscripción',
        canActivate: [authGuard, rolGuard(...ROLES_MATRICULA)],
        loadComponent: () => import('./features/matricula/matricula/matricula-form').then((m) => m.MatriculaForm),
      },
      {
        path: 'matricula/consulta',
        title: 'Matrículas',
        canActivate: [authGuard, rolGuard(...ROLES_MATRICULA)],
        loadComponent: () => import('./features/matricula/matricula/matricula-list').then((m) => m.MatriculaList),
      },
      {
        path: 'matricula/consulta/:id',
        title: 'Detalle de matrícula',
        canActivate: [authGuard, rolGuard(...ROLES_MATRICULA)],
        loadComponent: () =>
          import('./features/matricula/matricula/matricula-detalle').then((m) => m.MatriculaDetalle),
      },
      {
        path: 'matricula/horario',
        title: 'Horario',
        canActivate: [authGuard, rolGuard(...ROLES_MATRICULA)],
        loadComponent: () =>
          import('./features/matricula/matricula/horario-matricula').then((m) => m.HorarioMatricula),
      },
      {
        path: 'matricula/reportes',
        title: 'Reportes de matrícula',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () =>
          import('./features/matricula/matricula/reporte-matricula').then((m) => m.ReporteMatricula),
      },
      {
        path: 'matricula/periodos',
        title: 'Periodos académicos',
        // Periodos y Secciones son pantallas de gestion. SecurityConfig permite leerlos con cualquier
        // sesion porque la inscripcion los usa; el estudiante ve la oferta alli y el periodo en el portal.
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/matricula/periodo/periodo-list').then((m) => m.PeriodoList),
      },
      {
        path: 'matricula/periodos/nuevo',
        title: 'Nuevo periodo',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/matricula/periodo/periodo-form').then((m) => m.PeriodoForm),
      },
      {
        path: 'matricula/periodos/:id/editar',
        title: 'Editar periodo',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/matricula/periodo/periodo-form').then((m) => m.PeriodoForm),
      },
      {
        path: 'matricula/secciones',
        title: 'Secciones',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/matricula/seccion/seccion-list').then((m) => m.SeccionList),
      },
      {
        path: 'matricula/secciones/nueva',
        title: 'Nueva sección',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/matricula/seccion/seccion-form').then((m) => m.SeccionForm),
      },
      {
        path: 'matricula/secciones/:id/editar',
        title: 'Editar sección',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/matricula/seccion/seccion-form').then((m) => m.SeccionForm),
      },
      {
        path: 'mi-plan',
        title: 'Mi plan de estudios',
        canActivate: [authGuard, rolGuard(Rol.ESTUDIANTE)],
        loadComponent: () => import('./features/core-academico/plan/mi-plan').then((m) => m.MiPlan),
      },
      {
        path: 'academico/cursos',
        title: 'Cursos',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/core-academico/curso/curso-list').then((m) => m.CursoList),
      },
      {
        path: 'academico/cursos/nuevo',
        title: 'Nuevo curso',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/core-academico/curso/curso-form').then((m) => m.CursoForm),
      },
      {
        path: 'academico/cursos/:id/editar',
        title: 'Editar curso',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/core-academico/curso/curso-form').then((m) => m.CursoForm),
      },
      {
        path: 'academico/planes',
        title: 'Mallas curriculares',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/core-academico/plan/plan-list').then((m) => m.PlanList),
      },
      {
        path: 'academico/planes/nuevo',
        title: 'Nueva malla curricular',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/core-academico/plan/plan-form').then((m) => m.PlanForm),
      },
      {
        path: 'academico/planes/:id',
        title: 'Malla curricular',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/core-academico/plan/plan-detalle').then((m) => m.PlanDetalle),
      },
      {
        path: 'academico/docentes',
        title: 'Plana docente',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () => import('./features/core-academico/docente/docente-list').then((m) => m.DocenteList),
      },
      {
        path: 'academico/docentes/nuevo',
        title: 'Nuevo docente',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        data: { docente: true },
        loadComponent: () => import('./features/base-universal/persona/persona-form').then((m) => m.PersonaForm),
      },
      {
        path: 'academico/docentes/:id/editar',
        title: 'Editar docente',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        data: { docente: true },
        loadComponent: () => import('./features/base-universal/persona/persona-form').then((m) => m.PersonaForm),
      },
      {
        path: 'academico/docentes/:id/carga',
        title: 'Carga lectiva',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () =>
          import('./features/core-academico/docente/carga-docente').then((m) => m.CargaDocenteVista),
      },
      {
        path: 'academico/secciones/:id/inscritos',
        title: 'Estudiantes de la sección',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () =>
          import('./features/core-academico/docente/inscritos-seccion').then((m) => m.InscritosSeccionVista),
      },
      {
        path: 'docencia',
        title: 'Mi carga lectiva',
        canActivate: [authGuard, rolGuard(Rol.DOCENTE)],
        data: { propia: true },
        loadComponent: () =>
          import('./features/core-academico/docente/carga-docente').then((m) => m.CargaDocenteVista),
      },
      {
        path: 'docencia/secciones/:id/inscritos',
        title: 'Estudiantes de la sección',
        canActivate: [authGuard, rolGuard(Rol.DOCENTE)],
        data: { propia: true },
        loadComponent: () =>
          import('./features/core-academico/docente/inscritos-seccion').then((m) => m.InscritosSeccionVista),
      },
      {
        path: 'institucional',
        title: 'Estructura institucional',
        canActivate: [authGuard, rolGuard(...ROLES_COORDINACION)],
        loadComponent: () =>
          import('./features/base-universal/institucional/institucional').then((m) => m.Institucional),
      },
      {
        path: 'finanzas/conceptos',
        title: 'Conceptos de pago',
        canActivate: [authGuard, rolGuard(...ROLES_FINANZAS)],
        loadComponent: () => import('./features/finanzas/concepto/concepto-list').then((m) => m.ConceptoList),
      },
      {
        path: 'finanzas/conceptos/nuevo',
        title: 'Nuevo concepto',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/finanzas/concepto/concepto-form').then((m) => m.ConceptoForm),
      },
      {
        path: 'finanzas/conceptos/:id/editar',
        title: 'Editar concepto',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/finanzas/concepto/concepto-form').then((m) => m.ConceptoForm),
      },
      {
        path: 'finanzas/cargos',
        title: 'Cargos',
        canActivate: [authGuard, rolGuard(...ROLES_FINANZAS)],
        loadComponent: () => import('./features/finanzas/cargo/cargo-list').then((m) => m.CargoList),
      },
      {
        path: 'finanzas/cargos/nuevo',
        title: 'Nuevo cargo',
        canActivate: [authGuard, rolGuard(...ROLES_CAJA)],
        loadComponent: () => import('./features/finanzas/cargo/cargo-form').then((m) => m.CargoForm),
      },
      {
        path: 'finanzas/cargos/:id',
        title: 'Detalle del cargo',
        canActivate: [authGuard, rolGuard(Rol.ESTUDIANTE, ...ROLES_FINANZAS)],
        loadComponent: () => import('./features/finanzas/cargo/cargo-detalle').then((m) => m.CargoDetalle),
      },
      {
        path: 'finanzas/mis-cargos',
        title: 'Mis pagos',
        canActivate: [authGuard, rolGuard(Rol.ESTUDIANTE)],
        loadComponent: () => import('./features/finanzas/cargo/mis-cargos').then((m) => m.MisCargos),
      },
      {
        path: 'personas',
        title: 'Personas',
        canActivate: [authGuard, rolGuard(...ROLES_PERSONAL)],
        loadComponent: () => import('./features/base-universal/persona/persona-list').then((m) => m.PersonaList),
      },
      {
        path: 'personas/nueva',
        title: 'Nueva persona',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/base-universal/persona/persona-form').then((m) => m.PersonaForm),
      },
      {
        path: 'personas/:id/editar',
        title: 'Editar persona',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/base-universal/persona/persona-form').then((m) => m.PersonaForm),
      },
      {
        path: 'alumnos',
        title: 'Alumnos',
        canActivate: [authGuard, rolGuard(...ROLES_PERSONAL)],
        loadComponent: () => import('./features/base-universal/alumno/alumno-list').then((m) => m.AlumnoList),
      },
      {
        path: 'alumnos/nuevo',
        title: 'Nuevo alumno',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/base-universal/alumno/alumno-form').then((m) => m.AlumnoForm),
      },
      {
        path: 'alumnos/:id/editar',
        title: 'Editar alumno',
        canActivate: [authGuard, rolGuard(Rol.ADMIN)],
        loadComponent: () => import('./features/base-universal/alumno/alumno-form').then((m) => m.AlumnoForm),
      },
      {
        path: 'expedientes',
        title: 'Expedientes',
        canActivate: [authGuard, rolGuard(...ROLES_EXPEDIENTE)],
        loadComponent: () =>
          import('./features/base-universal/expediente/expediente-list').then((m) => m.ExpedienteList),
      },
      {
        path: 'expedientes/nuevo',
        title: 'Nuevo expediente',
        canActivate: [authGuard, rolGuard(...ROLES_EXPEDIENTE)],
        loadComponent: () =>
          import('./features/base-universal/expediente/expediente-form').then((m) => m.ExpedienteForm),
      },
      {
        path: 'expedientes/:id',
        title: 'Expediente',
        canActivate: [authGuard, rolGuard(...ROLES_EXPEDIENTE)],
        loadComponent: () =>
          import('./features/base-universal/expediente/expediente-detalle').then((m) => m.ExpedienteDetalle),
      },
      {
        path: 'sin-permiso',
        title: 'Acceso no permitido',
        loadComponent: () => import('./core/sin-permiso/sin-permiso').then((m) => m.SinPermiso),
      },
      {
        path: '**',
        title: 'Página no encontrada',
        loadComponent: () => import('./core/no-encontrado/no-encontrado').then((m) => m.NoEncontrado),
      },
    ],
  },
];
