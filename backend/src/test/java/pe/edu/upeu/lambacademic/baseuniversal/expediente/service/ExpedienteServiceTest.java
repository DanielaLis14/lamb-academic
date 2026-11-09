package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import pe.edu.upeu.lambacademic.baseuniversal.alumno.repository.AlumnoRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteArchivosRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.DocumentoAdjunto;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.mapper.ExpedienteMapper;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.ExpedienteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.persona.entity.Persona;
import pe.edu.upeu.lambacademic.baseuniversal.persona.repository.PersonaRepository;
import pe.edu.upeu.lambacademic.exception.AccesoDenegadoException;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Reglas del expediente: dueno del tramite (ESTUDIANTE) y correccion de documentos. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ExpedienteServiceTest {

    private static final Long PROPIA = 501L;
    private static final Long AJENA = 777L;

    @Mock private ExpedienteRepository expedienteRepository;
    @Mock private PersonaRepository personaRepository;
    @Mock private AlumnoRepository alumnoRepository;
    @Mock private ExpedienteMapper mapper;
    @Mock private AlmacenArchivos almacen;

    @InjectMocks private ExpedienteService service;

    @Test
    @DisplayName("El estudiante registra a su nombre aunque envie otra persona")
    void estudianteRegistraASuNombre() {
        Persona propia = persona(PROPIA);
        when(personaRepository.findWithEscuelaById(PROPIA)).thenReturn(Optional.of(propia));
        when(expedienteRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(mapper.toEntity(any(DocumentoAdjuntoRequest.class))).thenAnswer(i -> new DocumentoAdjunto());

        service.registrar(new ExpedienteRequest("TR-1", "Constancia", AJENA, List.of(documento("dni.pdf"))), PROPIA);

        verify(personaRepository).findWithEscuelaById(PROPIA);
        verify(personaRepository, never()).findWithEscuelaById(AJENA);
    }

    @Test
    @DisplayName("El personal debe indicar la persona titular")
    void personalSinPersonaEsRechazado() {
        assertThatThrownBy(() -> service.registrar(
                new ExpedienteRequest("TR-2", "Constancia", null, List.of(documento("dni.pdf"))), null))
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
    @DisplayName("Eliminar un documento actualiza el total del expediente")
    void eliminarActualizaTotal() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.OBSERVADO, 31L, 32L);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));
        when(expedienteRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.eliminarDocumento(9L, 31L, PROPIA);

        assertThat(expediente.getDocumentos()).extracting(DocumentoAdjunto::getId).containsExactly(32L);
        assertThat(expediente.getTotalDocumentos()).isEqualTo(1);
    }

    @Test
    @DisplayName("Un expediente en revision o aprobado no admite cambios en sus documentos")
    void expedienteEnRevisionNoSeEdita() {
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente(PROPIA,
                EstadoExpediente.EN_REVISION, 31L, 32L)));

        assertThatThrownBy(() -> service.actualizarDocumento(9L, 31L, documento("dni.pdf"), null))
                .isInstanceOf(ReglaNegocioException.class);
        assertThatThrownBy(() -> service.eliminarDocumento(9L, 32L, null)).isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("Corregir un documento mantiene unico el nombre de archivo y permite conservar el propio")
    void corregirDocumentoValidaArchivoRepetido() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L, 32L);
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));
        when(expedienteRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        assertThatThrownBy(() -> service.actualizarDocumento(9L, 31L, documento("archivo-32.pdf"), PROPIA))
                .isInstanceOf(ReglaNegocioException.class);

        service.actualizarDocumento(9L, 31L, documento("archivo-31.pdf"), PROPIA);
        assertThat(expediente.getDocumentos().get(0).getNombre()).isEqualTo("Documento de identidad");
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

        assertThatThrownBy(() -> service.agregarDocumento(9L, new DocumentoAdjuntoRequest("DNI", "dni.pdf",
                TipoArchivo.PDF, "almacen:00000000-0000-0000-0000-000000000000.pdf"), PROPIA))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("reservada");
    }

    @Test
    @DisplayName("Corregir un documento con archivo cargado solo cambia su nombre, nunca el archivo")
    void corregirDocumentoConArchivo() {
        Expediente expediente = expediente(PROPIA, EstadoExpediente.REGISTRADO, 31L);
        DocumentoAdjunto documento = expediente.getDocumentos().get(0);
        documento.setRutaArchivo("almacen:11111111-1111-1111-1111-111111111111.pdf");
        when(expedienteRepository.findDetalladoById(9L)).thenReturn(Optional.of(expediente));
        when(expedienteRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        service.actualizarDocumento(9L, 31L, new DocumentoAdjuntoRequest("DNI vigente", "otro.png", TipoArchivo.PNG,
                "/otra/ruta.png"), PROPIA);

        assertThat(documento.getNombre()).isEqualTo("DNI vigente");
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
    @DisplayName("Con archivos, la cantidad de nombres debe coincidir y no se guarda nada si no")
    void archivosSinNombre() {
        assertThatThrownBy(() -> service.registrarConArchivos(new ExpedienteArchivosRequest("TR-3", "Tramite", null,
                List.of("DNI")), List.of(), PROPIA)).isInstanceOf(ReglaNegocioException.class);
        verify(almacen, never()).guardar(any());
    }

    private static Persona persona(Long id) {
        Persona persona = new Persona();
        persona.setId(id);
        persona.setActivo(true);
        return persona;
    }

    private static DocumentoAdjuntoRequest documento(String archivo) {
        return new DocumentoAdjuntoRequest("Documento de identidad", archivo, TipoArchivo.PDF, "/expedientes/" + archivo);
    }

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
