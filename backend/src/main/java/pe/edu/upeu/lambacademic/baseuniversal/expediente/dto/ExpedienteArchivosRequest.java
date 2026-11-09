package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Parte "datos" del registro con archivos (multipart). Las partes "archivos" se asignan, en orden, a los
 * documentos sin enlace. La ruta, el tipo de archivo y el codigo de tramite los fija el servidor.
 * destinatarioId es opcional: sin valor se usa el destinatario sugerido del tipo de solicitud.
 */
public record ExpedienteArchivosRequest(
        @NotBlank(message = "el asunto es obligatorio") @Size(max = 255) String asunto,
        Long personaId,
        @NotNull(message = "la categoria es obligatoria") Long categoriaId,
        @NotNull(message = "el tipo de solicitud es obligatorio") Long tipoSolicitudId,
        Long destinatarioId,
        @NotEmpty(message = "el expediente debe tener al menos un documento")
        @Size(max = 20, message = "un expediente admite como maximo 20 documentos")
        @Valid List<DocumentoArchivoRequest> documentos
) {
}
