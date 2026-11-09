package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Documento del registro multipart. Sin enlace, recibe en orden la siguiente parte "archivos";
 * con enlace de SharePoint, no lleva archivo.
 */
public record DocumentoArchivoRequest(
        @NotBlank(message = "cada documento necesita un nombre") @Size(max = 150) String nombre,
        @NotNull(message = "el tipo de documento institucional es obligatorio") Long tipoDocumentoInstitucionalId,
        @Size(max = 1000, message = "el enlace admite como maximo 1000 caracteres") String enlace
) {
}
