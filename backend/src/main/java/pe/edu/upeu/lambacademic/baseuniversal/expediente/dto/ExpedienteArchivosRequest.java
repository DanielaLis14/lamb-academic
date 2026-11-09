package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Parte "datos" del registro con archivos (multipart): cabecera y el nombre de cada documento, en el mismo
 * orden que las partes "archivos". La ruta y el tipo los fija el servidor al guardar cada archivo.
 */
public record ExpedienteArchivosRequest(
        @NotBlank(message = "el codigo de tramite es obligatorio") @Size(max = 50) String codigoTramite,
        @NotBlank(message = "el asunto es obligatorio") @Size(max = 255) String asunto,
        Long personaId,
        @NotEmpty(message = "el expediente debe tener al menos un documento")
        @Size(max = 20, message = "un expediente admite como maximo 20 documentos")
        List<@NotBlank(message = "cada documento necesita un nombre") @Size(max = 150) String> nombres
) {
}
