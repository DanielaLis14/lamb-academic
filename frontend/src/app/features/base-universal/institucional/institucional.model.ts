/**
 * Modelos de Institucional (Base Universal). Espejo de los DTO del backend:
 * SedeResponse, FacultadResponse, EscuelaResponse y ArbolResponse.
 */

export type Nivel = 'PREGRADO' | 'POSGRADO';

export interface Sede {
  id: number;
  codigo: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
}

export interface Facultad {
  id: number;
  idSede: number;
  sedeNombre: string;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface Escuela {
  id: number;
  idFacultad: number;
  facultadNombre: string;
  codigo: string;
  nombre: string;
  nivel: Nivel;
  activo: boolean;
}

/* ------------------------------ Árbol ------------------------------ */

export interface EscuelaArbol {
  id: number;
  codigo: string;
  nombre: string;
  nivel: string;
}

export interface FacultadArbol {
  id: number;
  codigo: string;
  nombre: string;
  escuelas: EscuelaArbol[];
}

export interface SedeArbol {
  id: number;
  codigo: string;
  nombre: string;
  facultades: FacultadArbol[];
}

/* ----------------------------- Requests ---------------------------- */

export interface SedeRequest {
  codigo: string;
  nombre: string;
  direccion: string | null;
}

export interface FacultadRequest {
  idSede: number;
  codigo: string;
  nombre: string;
}

export interface EscuelaRequest {
  idFacultad: number;
  codigo: string;
  nombre: string;
  nivel: Nivel;
}

/* ---------------------------- Constantes --------------------------- */

export const NIVELES: Nivel[] = ['PREGRADO', 'POSGRADO'];

export const NIVEL_ETIQUETA: Record<Nivel, string> = {
  PREGRADO: 'Pregrado',
  POSGRADO: 'Posgrado',
};
