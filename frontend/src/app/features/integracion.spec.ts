import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { cerrarSesionDePrueba, iniciarSesionDePrueba } from '../../testing/sesion-prueba';
import { archivosSinRepetir, grupoDocumento } from './base-universal/expediente/documento-form';
import { ExpedienteForm } from './base-universal/expediente/expediente-form';
import { periodoPorDefecto } from './core-academico/docente/carga-docente';
import { CargoDetalle } from './finanzas/cargo/cargo-detalle';
import { Periodo } from './matricula/periodo/periodo.model';

const API = 'http://localhost:8080/api/v1';

function llenar(html: HTMLElement, valores: Record<string, string>) {
  for (const [id, valor] of Object.entries(valores)) {
    const campo = html.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
    campo.value = valor;
    campo.dispatchEvent(new Event(campo.tagName === 'SELECT' ? 'change' : 'input'));
  }
}

describe('Documentos del expediente (reglas de DocumentoAdjuntoRequest)', () => {
  const fb = new FormBuilder();

  it('la extension del archivo debe coincidir con el tipo', () => {
    const linea = grupoDocumento(fb, { nombre: 'DNI', nombreArchivo: 'dni.jpg', tipoDocumento: 'PDF', rutaArchivo: '/d' });
    expect(linea.hasError('extension')).toBe(true);
    linea.controls.nombreArchivo.setValue('DNI.PDF');
    expect(linea.hasError('extension')).toBe(false);
  });

  it('el nombre de archivo no se repite entre documentos, sin distinguir mayusculas', () => {
    const lineas = fb.array([
      grupoDocumento(fb, { nombreArchivo: 'dni.pdf' }),
      grupoDocumento(fb, { nombreArchivo: 'DNI.pdf' }),
    ]);
    expect(archivosSinRepetir(lineas)).toEqual({ archivoRepetido: true });
  });
});

describe('Carga lectiva: periodo por defecto', () => {
  const p = (id: number, estado: Periodo['estado'], fechaInicio: string): Periodo =>
    ({ id, codigo: String(id), nombre: '', estado, fechaInicio, fechaFin: fechaInicio }) as Periodo;

  it('elige el periodo activo de inicio mas reciente; sin activos, el ultimo', () => {
    expect(periodoPorDefecto([p(1, 'CERRADO', '2025-03-01'), p(4, 'ACTIVO', '2026-08-01'), p(5, 'PLANIFICADO', '2027-03-01')])?.id)
      .toBe(4);
    expect(periodoPorDefecto([p(1, 'CERRADO', '2025-03-01'), p(2, 'CERRADO', '2025-08-01')])?.id).toBe(2);
    expect(periodoPorDefecto([])).toBeNull();
  });
});

describe('ExpedienteForm: registro transaccional', () => {
  let backend: HttpTestingController;

  async function crear(roles: string[]) {
    iniciarSesionDePrueba(roles, roles.includes('ESTUDIANTE') ? 1001 : undefined);
    await TestBed.configureTestingModule({
      imports: [ExpedienteForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ExpedienteForm);
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    cerrarSesionDePrueba();
    TestBed.resetTestingModule();
  });
  afterEach(() => backend.verify());

  function elegir(fixture: { componentInstance: unknown }, archivo: File) {
    (fixture.componentInstance as ExpedienteForm).elegirArchivo(0, { target: { files: [archivo] } } as unknown as Event);
  }

  it('el estudiante registra con su archivo y sin titular: el backend usa la persona de su token', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('#personaId')).toBeNull();
    llenar(html, { asunto: 'Constancia de estudios' });
    elegir(fixture, new File(['%PDF-1.7'], 'dni.pdf', { type: 'application/pdf' }));
    await fixture.whenStable();
    expect((html.querySelector('#doc-nombre-0') as HTMLInputElement).value).toBe('dni');
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = backend.expectOne((r) => r.method === 'POST' && r.url === `${API}/expedientes`);
    const cuerpo = req.request.body as FormData;
    expect(cuerpo.getAll('archivos').map((a) => (a as File).name)).toEqual(['dni.pdf']);
    const datos = JSON.parse(await (cuerpo.get('datos') as Blob).text());
    expect(datos.personaId).toBeNull();
    expect(datos.nombres).toEqual(['dni']);
    req.flush({ id: 9, codigoTramite: 'EXP-1', totalDocumentos: 1 });
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledWith(['/expedientes', 9]);
  });

  it('un archivo que no es PDF ni imagen no se envia', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const html = fixture.nativeElement as HTMLElement;
    llenar(html, { asunto: 'Constancia', 'doc-nombre-0': 'DNI' });
    elegir(fixture, new File(['MZ'], 'programa.exe'));
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(html.textContent).toContain('Solo se aceptan archivos PDF, PNG o JPG.');
    backend.expectNone((r) => r.method === 'POST');
  });

  it('si el backend rechaza el registro, informa que no se guardo nada y no navega', async () => {
    const fixture = await crear(['COORDINADOR']);
    backend.expectOne((r) => r.url === `${API}/personas`).flush([{ id: 501, nombreCompleto: 'Ana', numeroDocumento: '1' }]);
    await fixture.whenStable();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');
    const html = fixture.nativeElement as HTMLElement;
    llenar(html, { personaId: '1: 501', asunto: 'Constancia', 'doc-nombre-0': 'DNI' });
    elegir(fixture, new File(['%PDF-1.7'], 'dni.pdf', { type: 'application/pdf' }));
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    backend
      .expectOne((r) => r.method === 'POST' && r.url === `${API}/expedientes`)
      .flush({ status: 409, message: 'Ya existe un expediente con codigo EXP-1' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(html.textContent).toContain('Ya existe un expediente con codigo EXP-1');
    expect(navegar).not.toHaveBeenCalled();
  });
});

describe('CargoDetalle: acciones de caja', () => {
  let backend: HttpTestingController;
  const cargo = (procesoOrigen: string) => ({
    id: 7, numeroCargo: 'CRG-7', estudianteId: 1001, procesoOrigen, referenciaId: null, periodoId: 4, totalCreditos: 11,
    numeroCuotas: 1, montoTotal: 300, saldoPendiente: 300, estado: 'EMITIDO', observacion: null,
    fechaEmision: '2026-10-24T10:00:00', cuotas: [],
  });

  async function crear(roles: string[], origen: string) {
    iniciarSesionDePrueba(roles);
    await TestBed.configureTestingModule({
      imports: [CargoDetalle],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '7' }) } } },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CargoDetalle);
    backend.expectOne(`${API}/finanzas/cargos/7`).flush(cargo(origen));
    backend.expectOne(`${API}/finanzas/cargos/7/pagos`).flush([]);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    cerrarSesionDePrueba();
    TestBed.resetTestingModule();
  });
  afterEach(() => backend.verify());

  it('caja anula un cargo de tramite sin pagos, pero no el cargo de una matricula', async () => {
    expect((await crear(['CAJERO'], 'TRAMITE')).textContent).toContain('Anular cargo');
    TestBed.resetTestingModule();
    expect((await crear(['CAJERO'], 'MATRICULA')).textContent).not.toContain('Anular cargo');
  });

  it('coordinacion consulta el cargo sin registrar pagos', async () => {
    const html = await crear(['COORDINADOR'], 'TRAMITE');
    expect(html.textContent).not.toContain('Registrar pago');
    expect(html.textContent).not.toContain('Anular cargo');
  });
});
