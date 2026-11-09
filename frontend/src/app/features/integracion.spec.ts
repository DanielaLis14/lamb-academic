import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { cerrarSesionDePrueba, iniciarSesionDePrueba } from '../../testing/sesion-prueba';
import { archivosSinRepetir, grupoDocumento, problemaEnlace } from './base-universal/expediente/documento-form';
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

  const REZAGADO = {
    id: 30,
    codigo: 'EXAMEN_REZAGADO',
    nombre: 'Examen rezagado',
    descripcion: null,
    categoriaId: 1,
    destinatarioSugerido: { id: 10, codigo: 'COORD_ACADEMICA', nombre: 'Coordinación Académica' },
    requisitos: [
      { tipoDocumentoInstitucionalId: 100, codigo: 'FUT', nombre: 'FUT', obligatorio: true },
      { tipoDocumentoInstitucionalId: 102, codigo: 'CERT_MEDICO', nombre: 'Certificado médico', obligatorio: false },
    ],
  };

  async function crear(roles: string[]) {
    iniciarSesionDePrueba(roles, roles.includes('ESTUDIANTE') ? 1001 : undefined);
    await TestBed.configureTestingModule({
      imports: [ExpedienteForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ExpedienteForm);
    backend.expectOne(`${API}/expedientes/catalogos/categorias`).flush([{ id: 1, codigo: 'ACADEMICO', nombre: 'Académico' }]);
    backend.expectOne(`${API}/expedientes/catalogos/tipos-documento`).flush([
      { id: 100, codigo: 'FUT', nombre: 'FUT' },
      { id: 102, codigo: 'CERT_MEDICO', nombre: 'Certificado médico' },
    ]);
    backend.expectOne(`${API}/expedientes/catalogos/destinatarios`).flush([
      { id: 10, codigo: 'COORD_ACADEMICA', nombre: 'Coordinación Académica' },
      { id: 11, codigo: 'TESORERIA', nombre: 'Tesorería' },
    ]);
    await fixture.whenStable();
    return fixture;
  }

  /** Elige la categoria (carga sus tipos) y el tipo de solicitud. */
  async function clasificar(fixture: { nativeElement: HTMLElement; whenStable(): Promise<unknown> }) {
    const html = fixture.nativeElement;
    llenar(html, { categoriaId: '1: 1' });
    backend.expectOne(`${API}/expedientes/catalogos/categorias/1/tipos-solicitud`).flush([REZAGADO]);
    await fixture.whenStable();
    llenar(html, { tipoSolicitudId: '1: 30' });
    await fixture.whenStable();
  }

  beforeEach(() => {
    cerrarSesionDePrueba();
    TestBed.resetTestingModule();
  });
  afterEach(() => backend.verify());

  function elegir(fixture: { componentInstance: unknown }, archivo: File, linea = 0) {
    (fixture.componentInstance as ExpedienteForm).elegirArchivo(linea, { target: { files: [archivo] } } as unknown as Event);
  }

  it('sin codigo de tramite: muestra los requisitos y propone el destinatario sugerido', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('#codigoTramite')).toBeNull();
    await clasificar(fixture);
    expect(html.textContent).toContain('Documentos para Examen rezagado');
    expect(html.textContent).toContain('Obligatorio');
    expect(html.textContent).toContain('Recomendado');
    expect((html.querySelector('#destinatarioId') as HTMLSelectElement).selectedOptions[0].textContent).toContain(
      'Coordinación Académica',
    );
  });

  it('el estudiante registra con archivo y enlace, sin titular: el backend usa la persona de su token', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('#personaId')).toBeNull();
    await clasificar(fixture);
    llenar(html, { asunto: 'Examen rezagado de Cálculo', 'doc-tipo-0': '1: 100' });
    elegir(fixture, new File(['%PDF-1.7'], 'fut.pdf', { type: 'application/pdf' }));
    (fixture.componentInstance as ExpedienteForm).agregarLinea();
    await fixture.whenStable();
    html.querySelector<HTMLInputElement>('#doc-origen-enlace-1')!.click();
    await fixture.whenStable();
    llenar(html, {
      'doc-nombre-1': 'Certificado',
      'doc-tipo-1': '2: 102',
      'doc-enlace-1': 'https://upeuedupe-my.sharepoint.com/:b:/g/personal/ana/Ef1',
    });
    await fixture.whenStable();
    expect((html.querySelector('#doc-nombre-0') as HTMLInputElement).value).toBe('fut');
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const req = backend.expectOne((r) => r.method === 'POST' && r.url === `${API}/expedientes`);
    const cuerpo = req.request.body as FormData;
    expect(cuerpo.getAll('archivos').map((a) => (a as File).name)).toEqual(['fut.pdf']);
    const datos = JSON.parse(await (cuerpo.get('datos') as Blob).text());
    expect(datos).toEqual({
      asunto: 'Examen rezagado de Cálculo',
      personaId: null,
      categoriaId: 1,
      tipoSolicitudId: 30,
      destinatarioId: 10,
      documentos: [
        { nombre: 'fut', tipoDocumentoInstitucionalId: 100, enlace: null },
        {
          nombre: 'Certificado',
          tipoDocumentoInstitucionalId: 102,
          enlace: 'https://upeuedupe-my.sharepoint.com/:b:/g/personal/ana/Ef1',
        },
      ],
    });
    req.flush({ id: 9, codigoTramite: 'TR-2026-00001', totalDocumentos: 2 });
    await fixture.whenStable();
    expect(navegar).toHaveBeenCalledWith(['/expedientes', 9]);
  });

  it('un enlace que no es de SharePoint de la universidad no se envia', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const html = fixture.nativeElement as HTMLElement;
    await clasificar(fixture);
    llenar(html, { asunto: 'Examen', 'doc-nombre-0': 'FUT', 'doc-tipo-0': '1: 100' });
    html.querySelector<HTMLInputElement>('#doc-origen-enlace-0')!.click();
    await fixture.whenStable();
    llenar(html, { 'doc-enlace-0': 'https://drive.google.com/file/d/1' });
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(html.textContent).toContain('Usa un enlace de SharePoint u OneDrive de la universidad');
    backend.expectNone((r) => r.method === 'POST');
  });

  it('un archivo que no es PDF ni imagen no se envia', async () => {
    const fixture = await crear(['ESTUDIANTE']);
    const html = fixture.nativeElement as HTMLElement;
    await clasificar(fixture);
    llenar(html, { asunto: 'Constancia', 'doc-nombre-0': 'DNI', 'doc-tipo-0': '1: 100' });
    elegir(fixture, new File(['MZ'], 'programa.exe'));
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    expect(html.textContent).toContain('Solo se aceptan archivos PDF, PNG o JPG.');
    backend.expectNone((r) => r.method === 'POST');
  });

  it('si faltan requisitos (422), muestra los que faltan, informa que no se guardo nada y no navega', async () => {
    const fixture = await crear(['COORDINADOR']);
    backend.expectOne((r) => r.url === `${API}/personas`).flush([{ id: 501, nombreCompleto: 'Ana', numeroDocumento: '1' }]);
    await fixture.whenStable();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');
    const html = fixture.nativeElement as HTMLElement;
    await clasificar(fixture);
    llenar(html, { personaId: '1: 501', asunto: 'Examen', 'doc-nombre-0': 'Certificado', 'doc-tipo-0': '2: 102' });
    elegir(fixture, new File(['%PDF-1.7'], 'cert.pdf', { type: 'application/pdf' }));
    html.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    backend
      .expectOne((r) => r.method === 'POST' && r.url === `${API}/expedientes`)
      .flush(
        { status: 422, message: 'Faltan documentos obligatorios para Examen rezagado: FUT' },
        { status: 422, statusText: 'Unprocessable Content' },
      );
    await fixture.whenStable();
    expect(html.textContent).toContain('Faltan documentos obligatorios para Examen rezagado: FUT');
    expect(navegar).not.toHaveBeenCalled();
  });
});

describe('Enlaces de SharePoint (EnlaceSharePoint del backend)', () => {
  it('acepta solo https de los dominios institucionales y nunca el prefijo almacen:', () => {
    expect(problemaEnlace('https://upeuedupe.sharepoint.com/:b:/s/tramites/Ea1')).toBeNull();
    expect(problemaEnlace(' https://upeuedupe-my.sharepoint.com/personal/ana/fut.pdf ')).toBeNull();
    for (const malo of [
      'http://upeuedupe.sharepoint.com/x',
      'https://upeuedupe.sharepoint.com.evil.com/x',
      'https://usuario@upeuedupe.sharepoint.com/x',
      'https://upeuedupe.sharepoint.com:8443/x',
      'https://UPEUEDUPE.sharepoint.com/x',
      'texto',
    ]) {
      expect(problemaEnlace(malo)).toContain('de la universidad');
    }
    expect(problemaEnlace('almacen:00000000-0000-0000-0000-000000000000.pdf')).toContain('reservado');
    expect(problemaEnlace('')).toBe('Pega el enlace de SharePoint.');
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
