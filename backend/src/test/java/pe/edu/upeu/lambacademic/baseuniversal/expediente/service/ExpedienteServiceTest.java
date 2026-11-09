package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.upeu.lambacademic.baseuniversal.alumno.repository.AlumnoRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoArchivoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteArchivosRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.DocumentoAdjunto;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.RequisitoTipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.mapper.ExpedienteMapper;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.CategoriaTramiteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.DestinatarioRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.ExpedienteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoDocumentoInstitucionalRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoSolicitudRepository;
import pe.edu.upeu.lambacademic.baseuniversal.persona.entity.Persona;
import pe.edu.upeu.lambacademic.baseuniversal.persona.repository.PersonaRepository;
import pe.edu.upeu.lambacademic.exception.AccesoDenegadoException;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;
import pe.edu.upeu.lambacademic.exception.SolicitudIncompletaException;

import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Reglas del expediente: dueno del tramite, correccion de documentos, catalogos (V5), requisitos y enlaces. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExpedienteServiceTest {

    private static final Long PROPIA = 501L;
    private static final Long AJENA = 777L;
    private static final long MB = 1024L * 1024L;

    private static final Long ACADEMICO = 1L;
    private static final Long ECONOMICO = 2L;
    private static final Long REZAGADO = 30L;
    private static final Long FRACCIONAMIENTO = 40L;
    private static final Long FUT = 100L;
    private static final Long VOUCHER = 101L;
    private static final Long CERT_MEDICO = 102L;
    private static final Long OTRO = 103L;
    private static final String ENLACE = "https://upeuedupe.sharepoint.com/:b:/s/tramites/EaBcD123?e=x1";
    private static final String ENLACE_ONEDRIVE =
            "https://upeuedupe-my.sharepoint.com/:b:/g/personal/ana_upeu_edu_pe/EfGh456";

    @Mock private ExpedienteRepository expedienteRepository;
    @Mock private PersonaRepository personaRepository;
    @Mock private AlumnoRepository alumnoRepository;
    @Mock private CategoriaTramiteRepository categoriaRepository;
    @Mock private TipoSolicitudRepository tipoSolicitudRepository;
    @Mock private DestinatarioRepository destinatarioRepository;
    @Mock private TipoDocumentoInstitucionalRepository tipoDocumentoRepository;
    @Mock private ExpedienteMapper mapper;
    @Mock private AlmacenArchivos almacen;

    @InjectMocks private ExpedienteService service;

    private CategoriaTramite academico;
    private Destinatario coordinacion;
    private Destinatario tesoreria;
    private TipoSolicitud rezagado;
    private final Map<Long, TipoDocumentoInstitucional> tiposDocumento = new HashMap<>();

    @BeforeEach
    void catalogos() {
        academico = categoria(ACADEMICO, "Tramites academicos");
        CategoriaTramite economico = categoria(ECONOMICO, "Tramites economicos");
        coordinacion = destinatario(10L, "Coordinacion Academica");
        tesoreria = destinatario(11L, "Tesoreria");
        tiposDocumento.put(FUT, tipoDocumento(FUT, "FUT"));
        tiposDocumento.put(VOUCHER, tipoDocumento(VOUCHER, "Voucher de pago"));
        tiposDocumento.put(CERT_MEDICO, tipoDocumento(CERT_MEDICO, "Certificado medico"));
        tiposDocumento.put(OTRO, tipoDocumento(OTRO, "Otro documento"));
        // Examen rezagado: FUT y voucher obligatorios, certificado medico recomendado.
        rezagado = tipoSolicitud(REZAGADO, "Examen rezagado", academico, coordinacion);
        requisito(rezagado, FUT, true);
        requisito(rezagado, VOUCHER, true);
        requisito(rezagado, CERT_MEDICO, false);
        TipoSolicitud fraccionamiento = tipoSolicitud(FRACCIONAMIENTO, "Fraccionamiento de deuda", economico, tesoreria);
        requisito(fraccionamiento, FUT, true);

        when(categoriaRepository.findById(ACADEMICO)).thenReturn(Optional.of(academico));
        when(categoriaRepository.findById(ECONOMICO)).thenReturn(Optional.of(economico));
        when(tipoSolicitudRepository.findDetalladoById(REZAGADO)).thenReturn(Optional.of(rezagado));
        when(tipoSolicitudRepository.findDetalladoById(FRACCIONAMIENTO)).thenReturn(Optional.of(fraccionamiento));
        when(destinatarioRepository.findById(11L)).thenReturn(Optional.of(tesoreria));
        when(tipoDocumentoRepository.findAllById(any())).thenAnswer(i -> StreamSupport
                .stream(((Iterable<Long>) i.getArgument(0)).spliterator(), false)
                .filter(tiposDocumento::containsKey).map(tiposDocumento::get).toList());
        when(tipoDocumentoRepository.findById(anyLong()))
                .thenAnswer(i -> Optional.ofNullable(tiposDocumento.get(i.<Long>getArgument(0))));
        when(personaRepository.findWithEscuelaById(PROPIA)).thenReturn(Optional.of(persona(PROPIA)));
        when(personaRepository.findWithEscuelaById(AJENA)).thenReturn(Optional.of(persona(AJENA)));
        when(expedienteRepository.siguienteNumeroTramite()).thenReturn(42L);
        when(expedienteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(almacen.tamanoMaximoExpediente()).thenReturn(25 * MB);
    }

    // ------------------------------------------------------------------ duenio y documentos (previas)

    @Test
    @DisplayName("El estudiante registra a su nombre aunque envie otra persona")
    void estudianteRegistraASuNombre() {
        Expediente guardado = registrar(solicitud(AJENA, documento("fut.pdf", FUT), documento("voucher.pdf", VOUCHER)),
                PROPIA);

        assertThat(guardado.getPersona().getId()).isEqualTo(PROPIA);
        verify(personaRepository, never()).findWithEscuelaById(AJENA);
    }

    @Test
    @DisplayName("El personal debe indicar la persona titular")
    void personalSinPersonaEsRechazado() {
        assertThatThrownBy(() -> service.registrar(solicitud(null, documento("fut.pdf", FUT)), null))
                .isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("Un expediente de otra persona responde 403 al estudiante")
    void expedienteAjenoResponde403() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(AJENA,
                EstadoExpediente.REGISTRADO, 31L)));

        assertThatThrownBy(() -> service.obtener(9L, PROPIA)).isInstanceOf(AccesoDenegadoException.class);
        assertThatThrownBy(() -> service.eliminarDocumento(9L, 31L, PROPIA)).isInstanceOf(AccesoDenegadoException.class);
    }

    @Test
    @DisplayName("No se elimina el unico documento del expediente")
    void conservaAlMenosUnDocumento() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.REGISTRADO, 31L)));

        assertThatThrownBy(() -> service.eliminarDocumento(9L, 31L, PROPIA)).isInstanceOf(ReglaNegocioException.class);
        verify(expedienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Eliminar un documento de un expediente previo a V5 (sin tipo) actualiza el total")
    void eliminarActualizaTotal() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.OBSERVADO, 31L, 32L);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        service.eliminarDocumento(9L, 31L, PROPIA);

        assertThat(expediente.getDocumentos()).extracting(DocumentoAdjunto::getId).containsExactly(32L);
        assertThat(expediente.getTotalDocumentos()).isEqualTo(1);
    }

    @Test
    @DisplayName("Un expediente en revision o aprobado no admite cambios en sus documentos")
    void expedienteEnRevisionNoSeEdita() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.EN_REVISION, 31L, 32L)));

        assertThatThrownBy(() -> service.actualizarDocumento(9L, 31L, documento("dni.pdf", OTRO), null))
                .isInstanceOf(ReglaNegocioException.class);
        assertThatThrownBy(() -> service.eliminarDocumento(9L, 32L, null)).isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("Corregir un documento mantiene unico el nombre de archivo y permite conservar el propio")
    void corregirDocumentoValidaArchivoRepetido() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L, 32L);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        assertThatThrownBy(() -> service.actualizarDocumento(9L, 31L, documento("archivo-32.pdf", OTRO), PROPIA))
                .isInstanceOf(ReglaNegocioException.class);
        assertThat(expediente.getDocumentos().get(0).getNombre()).isEqualTo("Archivo 31");

        service.actualizarDocumento(9L, 31L, documento("archivo-31.pdf", OTRO), PROPIA);
        assertThat(expediente.getDocumentos().get(0).getNombre()).isEqualTo("Documento");
        assertThat(expediente.getDocumentos().get(0).getTipoDocumentoInstitucional().getId()).isEqualTo(OTRO);
    }

    @Test
    @DisplayName("Documento inexistente en el expediente responde 404")
    void documentoInexistente() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.REGISTRADO, 31L, 32L)));

        assertThatThrownBy(() -> service.eliminarDocumento(9L, 99L, null)).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("Una ruta del almacen no se acepta en los metadatos enviados por el usuario")
    void rutaReservadaDelAlmacen() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.REGISTRADO, 31L)));

        assertThatThrownBy(() -> service.agregarDocumento(9L, new DocumentoAdjuntoRequest("DNI", OTRO, "dni.pdf",
                TipoArchivo.PDF, "almacen:00000000-0000-0000-0000-000000000000.pdf", null), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("reservada");
    }

    @Test
    @DisplayName("Corregir un documento con archivo cargado cambia nombre y tipo institucional, nunca el archivo")
    void corregirDocumentoConArchivo() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L);
        DocumentoAdjunto documento = expediente.getDocumentos().get(0);
        documento.setRutaArchivo("almacen:11111111-1111-1111-1111-111111111111.pdf");
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        service.actualizarDocumento(9L, 31L, new DocumentoAdjuntoRequest("DNI vigente", OTRO, "otro.png",
                TipoArchivo.PNG, "/otra/ruta.png", null), PROPIA);

        assertThat(documento.getNombre()).isEqualTo("DNI vigente");
        assertThat(documento.getTipoDocumentoInstitucional().getId()).isEqualTo(OTRO);
        assertThat(documento.getRutaArchivo()).isEqualTo("almacen:11111111-1111-1111-1111-111111111111.pdf");
        assertThat(documento.getTipoDocumento()).isEqualTo(TipoArchivo.PDF);
    }

    @Test
    @DisplayName("El archivo de un expediente ajeno no se descarga")
    void descargaAjena() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(AJENA,
                EstadoExpediente.REGISTRADO, 31L)));

        assertThatThrownBy(() -> service.descargar(9L, 31L, PROPIA)).isInstanceOf(AccesoDenegadoException.class);
        verify(almacen, never()).leer(any());
    }

    @Test
    @DisplayName("Con archivos, cada documento sin enlace necesita su archivo y no se guarda nada si no")
    void archivosNoCoincidenConDocumentosSinEnlace() {
        assertThatThrownBy(() -> service.registrarConArchivos(archivos(new DocumentoArchivoRequest("FUT", FUT, null)),
                List.of(), PROPIA)).isInstanceOf(ReglaNegocioException.class);
        verify(almacen, never()).guardar(any());
    }

    // ------------------------------------------------------------------ codigo y catalogos

    @Test
    @DisplayName("El servidor genera el codigo TR-AAAA-NNNNN con la secuencia")
    void codigoGeneradoPorElServidor() {
        Expediente guardado = registrar(solicitud(null, documento("fut.pdf", FUT), documento("voucher.pdf", VOUCHER)),
                PROPIA);

        assertThat(guardado.getCodigoTramite()).isEqualTo("TR-" + Year.now().getValue() + "-00042");
        assertThat(guardado.getEstado()).isEqualTo(EstadoExpediente.REGISTRADO);
        verify(expedienteRepository).siguienteNumeroTramite();
    }

    @Test
    @DisplayName("Sin destinatario se usa el sugerido del tipo; con destinatario, el elegido")
    void destinatarioSugeridoOElegido() {
        Expediente sugerido = registrar(solicitud(null, documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)), PROPIA);
        assertThat(sugerido.getDestinatario()).isSameAs(coordinacion);
        assertThat(sugerido.getCategoria()).isSameAs(academico);
        assertThat(sugerido.getTipoSolicitud()).isSameAs(rezagado);

        ExpedienteRequest otro = new ExpedienteRequest("Examen", null, ACADEMICO, REZAGADO, 11L,
                List.of(documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)));
        assertThat(registrar(otro, PROPIA).getDestinatario()).isSameAs(tesoreria);
    }

    @Test
    @DisplayName("Un catalogo inexistente responde 404 y no se guarda nada")
    void catalogoInexistente() {
        assertThatThrownBy(() -> service.registrar(new ExpedienteRequest("x", null, 99L, REZAGADO, null,
                List.of(documento("fut.pdf", FUT))), PROPIA)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.registrar(new ExpedienteRequest("x", null, ACADEMICO, 99L, null,
                List.of(documento("fut.pdf", FUT))), PROPIA)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.registrar(new ExpedienteRequest("x", null, ACADEMICO, REZAGADO, 99L,
                List.of(documento("fut.pdf", FUT))), PROPIA)).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.registrar(solicitud(null, documento("fut.pdf", 999L)), PROPIA))
                .isInstanceOf(ResourceNotFoundException.class).hasMessageContaining("999");
        verify(expedienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un catalogo inactivo responde 409 (categoria, tipo, destinatario sugerido y tipo de documento)")
    void catalogoInactivo() {
        academico.setActivo(false);
        assertThatThrownBy(() -> registrar(solicitud(null, documento("fut.pdf", FUT)), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("inactiva");
        academico.setActivo(true);

        rezagado.setActivo(false);
        assertThatThrownBy(() -> registrar(solicitud(null, documento("fut.pdf", FUT)), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("Examen rezagado");
        rezagado.setActivo(true);

        coordinacion.setActivo(false);
        assertThatThrownBy(() -> registrar(solicitud(null, documento("fut.pdf", FUT)), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("elige otro destinatario");
        coordinacion.setActivo(true);

        tiposDocumento.get(VOUCHER).setActivo(false);
        assertThatThrownBy(() -> registrar(solicitud(null, documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)),
                PROPIA)).isInstanceOf(ReglaNegocioException.class).hasMessageContaining("Voucher de pago");
        verify(expedienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("El tipo de solicitud debe pertenecer a la categoria (422)")
    void tipoDeOtraCategoria() {
        assertThatThrownBy(() -> service.registrar(new ExpedienteRequest("x", null, ECONOMICO, REZAGADO, null,
                List.of(documento("fut.pdf", FUT), documento("v.pdf", VOUCHER))), PROPIA))
                .isInstanceOf(SolicitudIncompletaException.class)
                .hasMessage("El tipo de solicitud Examen rezagado no pertenece a la categoria Tramites economicos");
        verify(expedienteRepository, never()).save(any());
    }

    // ------------------------------------------------------------------ duplicado en curso

    @Test
    @DisplayName("No se registra otro expediente del mismo tipo en curso; el mensaje nombra el existente")
    void duplicadoEnCurso() {
        Expediente existente = expediente(PROPIA, EstadoExpediente.OBSERVADO, 31L);
        existente.setCodigoTramite("TR-2026-00007");
        when(expedienteRepository.findByPersonaIdAndTipoSolicitudIdAndEstadoIn(eq(PROPIA), eq(REZAGADO), anyCollection()))
                .thenReturn(List.of(existente));

        assertThatThrownBy(() -> registrar(solicitud(null, documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)),
                PROPIA))
                .isInstanceOf(ReglaNegocioException.class)
                .hasMessageContaining("TR-2026-00007").hasMessageContaining("OBSERVADO");
        verify(expedienteRepository, never()).siguienteNumeroTramite();
        verify(expedienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Solo cuentan como duplicado los estados REGISTRADO, EN_REVISION y OBSERVADO")
    @SuppressWarnings("unchecked")
    void duplicadoSoloEnEstadosEnCurso() {
        registrar(solicitud(null, documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)), PROPIA);

        ArgumentCaptor<Collection<EstadoExpediente>> estados = ArgumentCaptor.forClass(Collection.class);
        verify(expedienteRepository).findByPersonaIdAndTipoSolicitudIdAndEstadoIn(eq(PROPIA), eq(REZAGADO),
                estados.capture());
        assertThat(estados.getValue()).containsExactlyInAnyOrder(EstadoExpediente.REGISTRADO,
                EstadoExpediente.EN_REVISION, EstadoExpediente.OBSERVADO);
    }

    // ------------------------------------------------------------------ requisitos obligatorios

    @Test
    @DisplayName("Faltan documentos obligatorios: 422 con los nombres; el recomendado no se exige")
    void requisitosFaltantes() {
        assertThatThrownBy(() -> registrar(solicitud(null, documento("cert.pdf", CERT_MEDICO)), PROPIA))
                .isInstanceOf(SolicitudIncompletaException.class)
                .hasMessage("Faltan documentos obligatorios para Examen rezagado: FUT, Voucher de pago");
        verify(expedienteRepository, never()).save(any());

        // Sin el certificado medico (recomendado) el registro procede.
        assertThat(registrar(solicitud(null, documento("fut.pdf", FUT), documento("v.pdf", VOUCHER)), PROPIA)
                .getTotalDocumentos()).isEqualTo(2);
    }

    @Test
    @DisplayName("Un requisito cuyo tipo de documento esta inactivo no se exige")
    void requisitoDeTipoInactivoNoSeExige() {
        tiposDocumento.get(VOUCHER).setActivo(false);
        assertThat(registrar(solicitud(null, documento("fut.pdf", FUT)), PROPIA).getTotalDocumentos()).isEqualTo(1);
    }

    @Test
    @DisplayName("Los requisitos se cumplen tambien con enlaces de SharePoint")
    void requisitosConEnlace() {
        Expediente guardado = registrar(solicitud(null, enlace(ENLACE, FUT), enlace(ENLACE_ONEDRIVE, VOUCHER)), PROPIA);
        assertThat(guardado.getDocumentos()).allMatch(DocumentoAdjunto::tieneEnlace);
    }

    @Test
    @DisplayName("No se quita el unico documento de un tipo obligatorio (422)")
    void quitarObligatorio() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expedienteRezagado()));

        assertThatThrownBy(() -> service.eliminarDocumento(9L, 32L, PROPIA))
                .isInstanceOf(SolicitudIncompletaException.class).hasMessageContaining("Voucher de pago");
        verify(expedienteRepository, never()).save(any());

        // El recomendado (certificado medico) si se puede quitar.
        service.eliminarDocumento(9L, 33L, PROPIA);
    }

    @Test
    @DisplayName("No se cambia el tipo del unico documento obligatorio (422)")
    void cambiarTipoDeObligatorio() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expedienteRezagado()));

        assertThatThrownBy(() -> service.actualizarDocumento(9L, 31L, documento("fut.pdf", OTRO), PROPIA))
                .isInstanceOf(SolicitudIncompletaException.class).hasMessageContaining("FUT");
    }

    // ------------------------------------------------------------------ tamano total (25 MB)

    @Test
    @DisplayName("Registro con archivos: mas de 25 MB en total se rechaza antes de guardar ningun archivo")
    void tamanoTotalAlRegistrar() {
        List<MultipartFile> grandes = List.of(archivo(5 * MB), archivo(5 * MB), archivo(5 * MB), archivo(5 * MB),
                archivo(5 * MB), archivo(MB));
        List<DocumentoArchivoRequest> documentos = new ArrayList<>();
        documentos.add(new DocumentoArchivoRequest("FUT", FUT, null));
        documentos.add(new DocumentoArchivoRequest("Voucher", VOUCHER, null));
        for (int i = 0; i < 4; i++) {
            documentos.add(new DocumentoArchivoRequest("Anexo " + i, OTRO, null));
        }

        assertThatThrownBy(() -> service.registrarConArchivos(archivos(documentos.toArray(DocumentoArchivoRequest[]::new)),
                grandes, PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("25.0 MB");
        verify(almacen, never()).guardar(any());
    }

    @Test
    @DisplayName("Los enlaces no cuentan para los 25 MB: un registro solo con enlaces no guarda archivos")
    void registroSoloConEnlaces() {
        when(almacen.tamanoMaximoExpediente()).thenReturn(0L);
        when(mapper.toResponse(any(Expediente.class))).thenReturn(null);

        service.registrarConArchivos(archivos(new DocumentoArchivoRequest("FUT", FUT, ENLACE),
                new DocumentoArchivoRequest("Voucher", VOUCHER, ENLACE_ONEDRIVE)), null, PROPIA);

        ArgumentCaptor<Expediente> guardado = ArgumentCaptor.forClass(Expediente.class);
        verify(expedienteRepository).save(guardado.capture());
        assertThat(guardado.getValue().getDocumentos()).allSatisfy(d -> {
            assertThat(d.getEnlace()).startsWith("https://upeuedupe");
            assertThat(d.getTamanoBytes()).isNull();
            assertThat(d.getRutaArchivo()).isNull();
            assertThat(d.getTipoDocumento()).isNull();
        });
        verify(almacen, never()).guardar(any());
    }

    @Test
    @DisplayName("Agregar un archivo suma lo ya cargado (con o sin TAMANO_BYTES) y no supera 25 MB")
    void tamanoTotalAlAgregar() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L, 32L);
        expediente.getDocumentos().get(0).setTamanoBytes(15 * MB);
        expediente.getDocumentos().get(1).setRutaArchivo("almacen:22222222-2222-2222-2222-222222222222.pdf");
        when(almacen.tamano("almacen:22222222-2222-2222-2222-222222222222.pdf")).thenReturn(8 * MB);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        assertThatThrownBy(() -> service.agregarArchivo(9L, "Anexo", OTRO, archivo(3 * MB), null, PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("26.0 MB");
        verify(almacen, never()).guardar(any());

        // Un enlace no suma: se agrega aunque el expediente este cerca del limite.
        service.agregarArchivo(9L, "Anexo", OTRO, null, ENLACE, PROPIA);
        assertThat(expediente.getDocumentos()).hasSize(3);
    }

    // ------------------------------------------------------------------ enlaces de SharePoint

    @Test
    @DisplayName("Un documento lleva archivo o enlace: ni los dos ni ninguno")
    void archivoOEnlace() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.REGISTRADO, 31L)));

        assertThatThrownBy(() -> service.agregarArchivo(9L, "FUT", FUT, archivo(MB), ENLACE, PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("solo uno");
        assertThatThrownBy(() -> service.agregarArchivo(9L, "FUT", FUT, null, "  ", PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("solo uno");
        assertThatThrownBy(() -> service.agregarDocumento(9L, new DocumentoAdjuntoRequest("FUT", FUT, "fut.pdf",
                TipoArchivo.PDF, "/r/fut.pdf", ENLACE), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("no ambos");
        assertThatThrownBy(() -> service.agregarDocumento(9L, new DocumentoAdjuntoRequest("FUT", FUT, null, null,
                null, null), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("enlace de SharePoint");
        verify(almacen, never()).guardar(any());
    }

    @Test
    @DisplayName("Solo se aceptan enlaces de los dominios institucionales y nunca el prefijo almacen:")
    void enlaceInstitucional() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.REGISTRADO, 31L)));

        for (String malo : List.of("https://drive.google.com/file/d/1", "http://upeuedupe.sharepoint.com/x",
                "https://upeuedupe.sharepoint.com.evil.com/x", "almacen:00000000-0000-0000-0000-000000000000.pdf")) {
            assertThatThrownBy(() -> service.agregarArchivo(9L, "FUT", FUT, null, malo, PROPIA))
                    .as(malo).isInstanceOf(ReglaNegocioException.class);
        }
        verify(expedienteRepository, never()).save(any());
    }

    @Test
    @DisplayName("Un enlace repetido en el expediente se rechaza")
    void enlaceRepetido() {
        assertThatThrownBy(() -> registrar(solicitud(null, enlace(ENLACE, FUT), enlace(ENLACE, VOUCHER)), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("repetido");
    }

    @Test
    @DisplayName("Corregir un documento con ruta declarada lo puede cambiar a enlace")
    void corregirAEnlace() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L, 32L);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        service.actualizarDocumento(9L, 31L, enlace(ENLACE, FUT), PROPIA);

        DocumentoAdjunto documento = expediente.getDocumentos().get(0);
        assertThat(documento.getEnlace()).isEqualTo(ENLACE);
        assertThat(documento.getRutaArchivo()).isNull();
        assertThat(documento.getTipoDocumento()).isNull();
    }

    @Test
    @DisplayName("Un documento con enlace no se descarga del almacen")
    void enlaceNoSeDescarga() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L);
        DocumentoAdjunto documento = expediente.getDocumentos().get(0);
        documento.setEnlace(ENLACE);
        documento.setRutaArchivo(null);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));

        assertThatThrownBy(() -> service.descargar(9L, 31L, PROPIA)).isInstanceOf(ResourceNotFoundException.class);
        verify(almacen, never()).leer(any());
    }

    // ------------------------------------------------------------------ apoyo

    private Expediente registrar(ExpedienteRequest request, Long personaRestringida) {
        service.registrar(request, personaRestringida);
        ArgumentCaptor<Expediente> guardado = ArgumentCaptor.forClass(Expediente.class);
        verify(expedienteRepository, org.mockito.Mockito.atLeastOnce()).save(guardado.capture());
        return guardado.getValue();
    }

    /** Examen rezagado (academico) con los documentos indicados. */
    private static ExpedienteRequest solicitud(Long personaId, DocumentoAdjuntoRequest... documentos) {
        return new ExpedienteRequest("Examen rezagado de Calculo", personaId, ACADEMICO, REZAGADO, null,
                List.of(documentos));
    }

    private static ExpedienteArchivosRequest archivos(DocumentoArchivoRequest... documentos) {
        return new ExpedienteArchivosRequest("Examen rezagado", null, ACADEMICO, REZAGADO, null, List.of(documentos));
    }

    private static DocumentoAdjuntoRequest documento(String archivo, Long tipoDocumento) {
        return new DocumentoAdjuntoRequest("Documento", tipoDocumento, archivo, TipoArchivo.PDF,
                "/expedientes/" + archivo, null);
    }

    private static DocumentoAdjuntoRequest enlace(String url, Long tipoDocumento) {
        return new DocumentoAdjuntoRequest("Documento en SharePoint", tipoDocumento, null, null, null, url);
    }

    private static MultipartFile archivo(long bytes) {
        MultipartFile archivo = mock(MultipartFile.class);
        when(archivo.getSize()).thenReturn(bytes);
        when(archivo.getOriginalFilename()).thenReturn("anexo.pdf");
        return archivo;
    }

    private static Persona persona(Long id) {
        Persona persona = new Persona();
        persona.setId(id);
        persona.setActivo(true);
        return persona;
    }

    private static CategoriaTramite categoria(Long id, String nombre) {
        CategoriaTramite categoria = new CategoriaTramite();
        categoria.setId(id);
        categoria.setCodigo("C" + id);
        categoria.setNombre(nombre);
        return categoria;
    }

    private static Destinatario destinatario(Long id, String nombre) {
        Destinatario destinatario = new Destinatario();
        destinatario.setId(id);
        destinatario.setCodigo("D" + id);
        destinatario.setNombre(nombre);
        return destinatario;
    }

    private static TipoDocumentoInstitucional tipoDocumento(Long id, String nombre) {
        TipoDocumentoInstitucional tipo = new TipoDocumentoInstitucional();
        tipo.setId(id);
        tipo.setCodigo("T" + id);
        tipo.setNombre(nombre);
        return tipo;
    }

    private static TipoSolicitud tipoSolicitud(Long id, String nombre, CategoriaTramite categoria, Destinatario sugerido) {
        TipoSolicitud tipo = new TipoSolicitud();
        tipo.setId(id);
        tipo.setCodigo("S" + id);
        tipo.setNombre(nombre);
        tipo.setCategoria(categoria);
        tipo.setDestinatarioSugerido(sugerido);
        return tipo;
    }

    private void requisito(TipoSolicitud tipo, Long tipoDocumento, boolean obligatorio) {
        RequisitoTipoSolicitud requisito = new RequisitoTipoSolicitud();
        requisito.setTipoSolicitud(tipo);
        requisito.setTipoDocumento(tiposDocumento.get(tipoDocumento));
        requisito.setObligatorio(obligatorio);
        tipo.getRequisitos().add(requisito);
    }

    /** Expediente de examen rezagado con FUT (31), voucher (32) y certificado medico (33). */
    private Expediente expedienteRezagado() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L, 32L, 33L);
        expediente.setTipoSolicitud(rezagado);
        expediente.getDocumentos().get(0).setTipoDocumentoInstitucional(tiposDocumento.get(FUT));
        expediente.getDocumentos().get(1).setTipoDocumentoInstitucional(tiposDocumento.get(VOUCHER));
        expediente.getDocumentos().get(2).setTipoDocumentoInstitucional(tiposDocumento.get(CERT_MEDICO));
        return expediente;
    }

    /** Expediente previo a V5 (sin tipo de solicitud) con documentos de ruta declarada. */
    private static Expediente expediente(Long personaId, EstadoExpediente estado, Long... documentos) {
        Expediente expediente = new Expediente();
        expediente.setId(9L);
        expediente.setCodigoTramite("TR-9");
        expediente.setPersona(persona(personaId));
        expediente.setEstado(estado);
        for (Long id : documentos) {
            DocumentoAdjunto documento = new DocumentoAdjunto();
            documento.setId(id);
            documento.setNombre("Archivo " + id);
            documento.setNombreArchivo("archivo-" + id + ".pdf");
            documento.setTipoDocumento(TipoArchivo.PDF);
            documento.setRutaArchivo("/expedientes/archivo-" + id + ".pdf");
            documento.setFechaCarga(LocalDateTime.now());
            expediente.agregarDocumento(documento);
        }
        return expediente;
    }
}
