package pe.edu.upeu.lambacademic.matricula.matricula.port;

import java.util.Optional;

public interface EstudianteConsultaPort {

    EstudianteInfo consultarEstudiante(Long estudianteId);

    /** Codigo y nombre del alumno para listados; vacio si no existe en Base Universal. */
    Optional<EstudianteDatos> consultarDatos(Long estudianteId);

    record EstudianteDatos(Long estudianteId, String codigoEstudiante, String nombreCompleto) {
    }

    /**
     * escuelaId permite resolver los prerrequisitos segun el
     * plan de estudios vigente de la escuela del estudiante.
     */
    record EstudianteInfo(
            Long estudianteId,
            boolean existe,
            boolean habilitado,
            Long escuelaId
    ) {

        public static EstudianteInfo inexistente(Long estudianteId) {
            return new EstudianteInfo(estudianteId, false, false, null);
        }
    }
}
