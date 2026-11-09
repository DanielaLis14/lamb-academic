import {
  LucideBookOpen,
  LucideBuilding2,
  LucideCalendarCheck,
  LucideCalendarDays,
  LucideCalendarRange,
  LucideChartColumn,
  LucideClipboardPen,
  LucideFolderOpen,
  LucideGraduationCap,
  LucideIcon,
  LucideLayers,
  LucideLayoutDashboard,
  LucideLibrary,
  LucideListChecks,
  LucideReceipt,
  LucideUserRound,
  LucideUsers,
  LucideWallet,
} from '@lucide/angular';
import {
  ROLES_COORDINACION,
  ROLES_EXPEDIENTE,
  ROLES_FINANZAS,
  ROLES_MATRICULA,
  ROLES_PERSONAL,
  Rol,
} from '../auth/roles';

/**
 * Menu lateral declarativo (patron reutilizado de Cristian). `roles` repite las reglas de
 * app.routes.ts: el menu es UX, no seguridad. Sin `roles`: cualquier usuario con sesion.
 */
export interface ItemMenu {
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
  roles?: string[];
  exacto?: boolean;
  /** Texto para quien solo es ESTUDIANTE (su propia informacion): "Mis matrículas", "Mi horario". */
  etiquetaEstudiante?: string;
}

export interface GrupoMenu {
  titulo: string;
  items: ItemMenu[];
}

export const MENU: GrupoMenu[] = [
  {
    titulo: 'Matrícula',
    items: [
      {
        etiqueta: 'Portal de matrícula',
        ruta: '/matricula',
        icono: LucideLayoutDashboard,
        exacto: true,
        roles: [...ROLES_MATRICULA, Rol.CAJERO],
      },
      { etiqueta: 'Mi plan de estudios', ruta: '/mi-plan', icono: LucideLibrary, roles: [Rol.ESTUDIANTE] },
      { etiqueta: 'Inscripción', ruta: '/matricula/inscripcion', icono: LucideClipboardPen, roles: ROLES_MATRICULA },
      {
        etiqueta: 'Matrículas',
        etiquetaEstudiante: 'Mis matrículas',
        ruta: '/matricula/consulta',
        icono: LucideListChecks,
        roles: ROLES_MATRICULA,
      },
      {
        etiqueta: 'Horario',
        etiquetaEstudiante: 'Mi horario',
        ruta: '/matricula/horario',
        icono: LucideCalendarDays,
        roles: ROLES_MATRICULA,
      },
      { etiqueta: 'Reportes', ruta: '/matricula/reportes', icono: LucideChartColumn, roles: ROLES_COORDINACION },
    ],
  },
  {
    titulo: 'Mi docencia',
    items: [{ etiqueta: 'Mi carga lectiva', ruta: '/docencia', icono: LucideCalendarCheck, roles: [Rol.DOCENTE] }],
  },
  {
    titulo: 'Trámites y pagos',
    items: [
      {
        etiqueta: 'Expedientes',
        etiquetaEstudiante: 'Mis expedientes',
        ruta: '/expedientes',
        icono: LucideFolderOpen,
        roles: ROLES_EXPEDIENTE,
      },
      { etiqueta: 'Mis pagos', ruta: '/finanzas/mis-cargos', icono: LucideWallet, roles: [Rol.ESTUDIANTE] },
    ],
  },
  {
    titulo: 'Gestión académica',
    items: [
      { etiqueta: 'Periodos', ruta: '/matricula/periodos', icono: LucideCalendarRange, roles: ROLES_COORDINACION },
      { etiqueta: 'Cursos', ruta: '/academico/cursos', icono: LucideBookOpen, roles: ROLES_COORDINACION },
      { etiqueta: 'Mallas curriculares', ruta: '/academico/planes', icono: LucideLibrary, roles: ROLES_COORDINACION },
      { etiqueta: 'Secciones', ruta: '/matricula/secciones', icono: LucideLayers, roles: ROLES_COORDINACION },
      { etiqueta: 'Plana docente', ruta: '/academico/docentes', icono: LucideUserRound, roles: ROLES_COORDINACION },
    ],
  },
  {
    titulo: 'Finanzas',
    items: [
      { etiqueta: 'Cargos', ruta: '/finanzas/cargos', icono: LucideReceipt, roles: ROLES_FINANZAS },
      { etiqueta: 'Conceptos de pago', ruta: '/finanzas/conceptos', icono: LucideWallet, roles: ROLES_FINANZAS },
    ],
  },
  {
    titulo: 'Base Universal',
    items: [
      { etiqueta: 'Personas', ruta: '/personas', icono: LucideUsers, roles: ROLES_PERSONAL },
      { etiqueta: 'Alumnos', ruta: '/alumnos', icono: LucideGraduationCap, roles: ROLES_PERSONAL },
      { etiqueta: 'Institucional', ruta: '/institucional', icono: LucideBuilding2, roles: ROLES_COORDINACION },
    ],
  },
];

export interface AccesoRapido extends ItemMenu {
  grupo: string;
}

/**
 * Accesos de la pantalla de inicio: se toma una opcion de cada grupo por turno, para que ningun
 * modulo ocupe todos los accesos, y se presentan en el orden del menu.
 */
export function accesosRapidos(roles: string[], maximo = 9): AccesoRapido[] {
  const grupos = menuPara(roles);
  const elegidos = new Set<ItemMenu>();
  for (let turno = 0; elegidos.size < maximo && grupos.some((g) => g.items.length > turno); turno++) {
    for (const grupo of grupos) {
      if (elegidos.size < maximo && grupo.items[turno]) elegidos.add(grupo.items[turno]);
    }
  }
  return grupos.flatMap((g) => g.items.filter((i) => elegidos.has(i)).map((i) => ({ ...i, grupo: g.titulo })));
}

/**
 * Menu visible para los roles del usuario. Quien solo es ESTUDIANTE ve las etiquetas de su propia
 * informacion ("Mis matrículas"); los grupos sin opciones no se muestran.
 */
export function menuPara(roles: string[]): GrupoMenu[] {
  const soloEstudiante = roles.includes(Rol.ESTUDIANTE) && !ROLES_COORDINACION.some((r) => roles.includes(r));
  return MENU.map((grupo) => ({
    ...grupo,
    items: grupo.items
      .filter((item) => !item.roles || item.roles.some((r) => roles.includes(r)))
      .map((item) => ({ ...item, etiqueta: (soloEstudiante && item.etiquetaEstudiante) || item.etiqueta })),
  })).filter((grupo) => grupo.items.length > 0);
}
