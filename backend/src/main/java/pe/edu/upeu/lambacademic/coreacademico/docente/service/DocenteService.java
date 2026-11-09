package pe.edu.upeu.lambacademic.coreacademico.docente.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.upeu.lambacademic.baseuniversal.persona.dto.DocenteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.persona.dto.PersonaResponse;
import pe.edu.upeu.lambacademic.baseuniversal.persona.service.PersonaService;
import pe.edu.upeu.lambacademic.coreacademico.docente.dto.CargaDocenteResponse;
import pe.edu.upeu.lambacademic.coreacademico.seccion.dto.SeccionResponse;
import pe.edu.upeu.lambacademic.coreacademico.seccion.entity.EstadoSeccion;
import pe.edu.upeu.lambacademic.coreacademico.seccion.port.PeriodoAcademicoPort;
import pe.edu.upeu.lambacademic.coreacademico.seccion.service.SeccionService;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;

import java.time.Duration;
import java.util.List;

/**
 * Plana docente. No existe una entidad Docente en ningun aporte del equipo: el docente es
 * una Persona de tipo DOCENTE (Base Universal) y su carga se deriva de las secciones.
 */
@Service
@RequiredArgsConstructor
public class DocenteService {

    private final PersonaService personaService;
    private final SeccionService seccionService;
    private final PeriodoAcademicoPort periodoAcademicoPort;

    @Transactional(readOnly = true)
    public List<PersonaResponse> listar(Boolean activo, String texto) {
        return personaService.listarDocentes(activo, texto);
    }

    @Transactional(readOnly = true)
    public PersonaResponse obtener(Long id) {
        return personaService.obtenerDocenteRegistrado(id);
    }

    @Transactional
    public PersonaResponse crear(DocenteRequest request) {
        return personaService.crearDocente(request);
    }

    @Transactional
    public PersonaResponse actualizar(Long id, DocenteRequest request) {
        return personaService.actualizarDocente(id, request);
    }

    /**
     * Baja logica. Un docente con secciones vigentes (no canceladas, de periodos no cerrados) no se
     * desactiva: primero se reasignan o cancelan, para que ninguna seccion quede con un docente inactivo.
     */
    @Transactional
    public void desactivar(Long id) {
        personaService.obtenerDocenteRegistrado(id);
        long vigentes = seccionService.buscar(null, null, id, null, false, "grupo", "asc").stream()
                .filter(s -> s.estado() != EstadoSeccion.CANCELADA)
                .filter(s -> periodoAcademicoPort.buscarPeriodo(s.periodoId())
                        .map(p -> !p.estaCerrado()).orElse(true))
                .count();
        if (vigentes > 0) {
            throw new ReglaNegocioException("El docente " + id + " tiene " + vigentes
                    + " seccion(es) vigente(s); reasignalas o cancelalas antes de darlo de baja");
        }
        personaService.desactivarDocente(id);
    }

    @Transactional(readOnly = true)
    public CargaDocenteResponse carga(Long docenteId, Long periodoId) {
        PersonaResponse docente = personaService.obtenerDocente(docenteId);
        List<SeccionResponse> secciones = seccionService.buscar(periodoId, null, docenteId, null, false, "grupo", "asc")
                .stream().filter(s -> s.estado() != EstadoSeccion.CANCELADA).toList();
        double horas = secciones.stream()
                .flatMap(s -> s.horarios().stream())
                .mapToLong(h -> Duration.between(h.horaInicio(), h.horaFin()).toMinutes())
                .sum() / 60.0;
        return new CargaDocenteResponse(docente.id(), docente.nombreCompleto(), periodoId, secciones.size(),
                horas, secciones);
    }
}
