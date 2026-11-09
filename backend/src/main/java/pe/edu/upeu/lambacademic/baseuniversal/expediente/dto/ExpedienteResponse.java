package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.persona.dto.PersonaResumen;

import java.time.LocalDateTime;
import java.util.List;

/** categoria, tipoSolicitud y destinatario son null en los expedientes registrados antes de V5. */
public record ExpedienteResponse(
        Long id,
        String codigoTramite,
        String asunto,
        LocalDateTime fechaRegistro,
        EstadoExpediente estado,
        Integer totalDocumentos,
        PersonaResumen persona,
        CatalogoResumen categoria,
        CatalogoResumen tipoSolicitud,
        CatalogoResumen destinatario,
        List<DocumentoAdjuntoResponse> documentos
) {
}
