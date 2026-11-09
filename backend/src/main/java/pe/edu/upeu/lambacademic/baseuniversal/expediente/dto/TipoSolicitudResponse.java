package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import java.util.List;

/** Tipo de solicitud activo con su destinatario sugerido (null si esta inactivo) y sus requisitos vigentes. */
public record TipoSolicitudResponse(
        Long id,
        String codigo,
        String nombre,
        String descripcion,
        Long categoriaId,
        CatalogoResumen destinatarioSugerido,
        List<RequisitoResponse> requisitos
) {
}
