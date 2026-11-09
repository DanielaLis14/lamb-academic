package pe.edu.upeu.lambacademic.matricula.matricula.port;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface SeccionConsultaPort {

    /** null si la seccion no existe. */
    SeccionInfo consultarSeccion(Long seccionId);

    List<HorarioInfo> consultarHorarios(Long seccionId);

    /** Ocupa un cupo de forma atomica; lanza una excepcion de negocio si ya no hay vacantes. */
    void reservarCupo(Long seccionId);

    void liberarCupo(Long seccionId);

    /** Curso, grupo, periodo y docente de la seccion; vacio si no existe. */
    Optional<SeccionAsignacion> consultarAsignacion(Long seccionId);

    record SeccionAsignacion(
            Long seccionId,
            String cursoCodigo,
            String cursoNombre,
            String grupo,
            Long periodoId,
            Long docenteId
    ) {
    }

    record SeccionInfo(
            Long seccionId,
            Integer cupoTotal,
            Integer cupoDisponible,
            Long cursoId,
            String cursoCodigo,
            Integer creditos,
            Long periodoId,
            boolean abierta
    ) {
    }

    record HorarioInfo(
            String dia,
            LocalTime horaInicio,
            LocalTime horaFin
    ) {
    }
}
