package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

/** Documento que pide un tipo de solicitud; obligatorio = false es solo recomendado. */
public record RequisitoResponse(Long tipoDocumentoInstitucionalId, String codigo, String nombre, boolean obligatorio) {
}
