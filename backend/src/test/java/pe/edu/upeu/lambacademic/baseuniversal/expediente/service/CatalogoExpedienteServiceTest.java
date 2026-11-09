package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.RequisitoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.TipoSolicitudResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.RequisitoTipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.CategoriaTramiteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.DestinatarioRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoDocumentoInstitucionalRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoSolicitudRepository;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Catalogos de tramite: tipos de una categoria con requisitos vigentes y destinatario sugerido activo. */
@ExtendWith(MockitoExtension.class)
class CatalogoExpedienteServiceTest {

    @Mock private CategoriaTramiteRepository categoriaRepository;
    @Mock private TipoSolicitudRepository tipoSolicitudRepository;
    @Mock private DestinatarioRepository destinatarioRepository;
    @Mock private TipoDocumentoInstitucionalRepository tipoDocumentoRepository;

    @InjectMocks private CatalogoExpedienteService service;

    @Test
    @DisplayName("Los tipos incluyen sus requisitos (obligatorios y recomendados) y el destinatario sugerido")
    void tiposConRequisitos() {
        CategoriaTramite academico = categoria(true);
        Destinatario coordinacion = new Destinatario();
        coordinacion.setId(10L);
        coordinacion.setCodigo("COORD_ACADEMICA");
        coordinacion.setNombre("Coordinacion Academica");
        TipoSolicitud justificacion = new TipoSolicitud();
        justificacion.setId(20L);
        justificacion.setCodigo("JUSTIF_INASISTENCIA");
        justificacion.setNombre("Justificacion de inasistencias");
        justificacion.setCategoria(academico);
        justificacion.setDestinatarioSugerido(coordinacion);
        requisito(justificacion, tipoDocumento(102L, "CERT_MEDICO", true), false);
        requisito(justificacion, tipoDocumento(100L, "FUT", true), true);
        requisito(justificacion, tipoDocumento(105L, "RETIRADO", false), true);
        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(academico));
        when(tipoSolicitudRepository.findByCategoriaIdAndActivoTrueOrderByNombreAsc(1L)).thenReturn(List.of(justificacion));

        TipoSolicitudResponse tipo = service.tiposSolicitud(1L).getFirst();

        assertThat(tipo.destinatarioSugerido().codigo()).isEqualTo("COORD_ACADEMICA");
        assertThat(tipo.requisitos()).extracting(RequisitoResponse::codigo, RequisitoResponse::obligatorio)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("FUT", true),
                        org.assertj.core.groups.Tuple.tuple("CERT_MEDICO", false));
    }

    @Test
    @DisplayName("Categoria inexistente responde 404; una inactiva no ofrece tipos")
    void categoriaInexistenteOInactiva() {
        when(categoriaRepository.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.tiposSolicitud(9L)).isInstanceOf(ResourceNotFoundException.class);

        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria(false)));
        assertThat(service.tiposSolicitud(1L)).isEmpty();
        verify(tipoSolicitudRepository, never()).findByCategoriaIdAndActivoTrueOrderByNombreAsc(1L);
    }

    private static CategoriaTramite categoria(boolean activa) {
        CategoriaTramite categoria = new CategoriaTramite();
        categoria.setId(1L);
        categoria.setCodigo("ACADEMICO");
        categoria.setNombre("Tramites academicos");
        categoria.setActivo(activa);
        return categoria;
    }

    private static TipoDocumentoInstitucional tipoDocumento(Long id, String codigo, boolean activo) {
        TipoDocumentoInstitucional tipo = new TipoDocumentoInstitucional();
        tipo.setId(id);
        tipo.setCodigo(codigo);
        tipo.setNombre(codigo);
        tipo.setActivo(activo);
        return tipo;
    }

    private static void requisito(TipoSolicitud tipo, TipoDocumentoInstitucional documento, boolean obligatorio) {
        RequisitoTipoSolicitud requisito = new RequisitoTipoSolicitud();
        requisito.setTipoSolicitud(tipo);
        requisito.setTipoDocumento(documento);
        requisito.setObligatorio(obligatorio);
        tipo.getRequisitos().add(requisito);
    }
}
