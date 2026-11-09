package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CatalogoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CatalogoResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.RequisitoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.TipoSolicitudResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.CategoriaTramiteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.DestinatarioRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoDocumentoInstitucionalRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoSolicitudRepository;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.util.List;

/** Consulta de los catalogos de tramite (V5): solo registros activos, para cualquier usuario autenticado. */
@Service
@RequiredArgsConstructor
public class CatalogoExpedienteService {

    private final CategoriaTramiteRepository categoriaRepository;
    private final TipoSolicitudRepository tipoSolicitudRepository;
    private final DestinatarioRepository destinatarioRepository;
    private final TipoDocumentoInstitucionalRepository tipoDocumentoRepository;

    @Transactional(readOnly = true)
    public List<CatalogoResponse> categorias() {
        return categoriaRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(c -> new CatalogoResponse(c.getId(), c.getCodigo(), c.getNombre(), c.getDescripcion()))
                .toList();
    }

    /** Tipos activos de la categoria con sus requisitos vigentes; una categoria inactiva no ofrece tipos. */
    @Transactional(readOnly = true)
    public List<TipoSolicitudResponse> tiposSolicitud(Long categoriaId) {
        CategoriaTramite categoria = categoriaRepository.findById(categoriaId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria de tramite", categoriaId));
        if (!Boolean.TRUE.equals(categoria.getActivo())) {
            return List.of();
        }
        return tipoSolicitudRepository.findByCategoriaIdAndActivoTrueOrderByNombreAsc(categoriaId).stream()
                .map(CatalogoExpedienteService::tipoResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogoResponse> destinatarios() {
        return destinatarioRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(d -> new CatalogoResponse(d.getId(), d.getCodigo(), d.getNombre(), d.getDescripcion()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CatalogoResponse> tiposDocumento() {
        return tipoDocumentoRepository.findByActivoTrueOrderByNombreAsc().stream()
                .map(t -> new CatalogoResponse(t.getId(), t.getCodigo(), t.getNombre(), t.getDescripcion()))
                .toList();
    }

    private static TipoSolicitudResponse tipoResponse(TipoSolicitud tipo) {
        Destinatario sugerido = tipo.getDestinatarioSugerido();
        CatalogoResumen destinatario = Boolean.TRUE.equals(sugerido.getActivo())
                ? new CatalogoResumen(sugerido.getId(), sugerido.getCodigo(), sugerido.getNombre())
                : null;
        List<RequisitoResponse> requisitos = tipo.requisitosVigentes().stream()
                .map(r -> {
                    TipoDocumentoInstitucional documento = r.getTipoDocumento();
                    return new RequisitoResponse(documento.getId(), documento.getCodigo(), documento.getNombre(),
                            Boolean.TRUE.equals(r.getObligatorio()));
                })
                .toList();
        return new TipoSolicitudResponse(tipo.getId(), tipo.getCodigo(), tipo.getNombre(), tipo.getDescripcion(),
                tipo.getCategoria().getId(), destinatario, requisitos);
    }
}
