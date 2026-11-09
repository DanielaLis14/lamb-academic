package pe.edu.upeu.lambacademic.exception;

/**
 * La solicitud esta bien formada pero no se puede atender tal como llego (p. ej. le faltan documentos
 * obligatorios o combina un tipo con una categoria ajena): responde 422. A diferencia de
 * ReglaNegocioException (409), no depende del estado actual del sistema: fallaria igual en cualquier momento.
 */
public class SolicitudIncompletaException extends RuntimeException {

    public SolicitudIncompletaException(String mensaje) {
        super(mensaje);
    }
}
