package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;

/**
 * Documento por metadatos (JSON). Su origen es una ruta declarada (nombreArchivo, tipoDocumento y rutaArchivo)
 * o un enlace institucional de SharePoint, no ambos: lo valida el servicio. En un documento con archivo
 * cargado solo se corrigen el nombre y el tipo institucional.
 */
public record DocumentoAdjuntoRequest(
        @NotBlank(message = "el nombre del documento es obligatorio") @Size(max = 150) String nombre,
        @NotNull(message = "el tipo de documento institucional es obligatorio") Long tipoDocumentoInstitucionalId,
        @Size(max = 255) String nombreArchivo,
        TipoArchivo tipoDocumento,
        @Size(max = 500) String rutaArchivo,
        @Size(max = 1000, message = "el enlace admite como maximo 1000 caracteres") String enlace
) {
}
