package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

/** Registro activo de un catalogo: categoria, destinatario o tipo de documento institucional. */
public record CatalogoResponse(Long id, String codigo, String nombre, String descripcion) {
}
