/** CursoRequest / CursoResponse / CursoResumen del backend (coreacademico.curso). */
export interface Curso {
  id: number;
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoricas: number | null;
  horasPracticas: number | null;
  activo: boolean;
}

export interface CursoResumen {
  id: number;
  codigo: string;
  nombre: string;
  creditos: number;
}

export interface CursoRequest {
  codigo: string;
  nombre: string;
  creditos: number;
  horasTeoricas: number | null;
  horasPracticas: number | null;
}

export interface FiltroCursos {
  activo?: boolean | null;
  creditos?: number | null;
  q?: string | null;
}
