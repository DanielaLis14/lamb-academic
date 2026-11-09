package pe.edu.upeu.lambacademic.matricula.matricula.adapter;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import pe.edu.upeu.lambacademic.baseuniversal.alumno.service.AlumnoService;
import pe.edu.upeu.lambacademic.matricula.matricula.port.EstudianteConsultaPort;

import java.util.Optional;

/** Consulta del alumno en Base Universal. El estudianteId de la matricula es el id de ALUMNOS. */
@Component
@RequiredArgsConstructor
public class EstudianteConsultaAdapter implements EstudianteConsultaPort {

    private final AlumnoService alumnoService;

    @Override
    public EstudianteInfo consultarEstudiante(Long estudianteId) {
        return alumnoService.buscarEstudiante(estudianteId)
                .map(e -> new EstudianteInfo(e.estudianteId(), true, e.habilitado(), e.escuelaId()))
                .orElseGet(() -> EstudianteInfo.inexistente(estudianteId));
    }

    @Override
    public Optional<EstudianteDatos> consultarDatos(Long estudianteId) {
        return alumnoService.buscarEstudiante(estudianteId)
                .map(e -> new EstudianteDatos(e.estudianteId(), e.codigoEstudiante(), e.nombreCompleto()));
    }
}
