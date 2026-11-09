package pe.edu.upeu.lambacademic.matricula.matricula.dto;

import pe.edu.upeu.lambacademic.matricula.matricula.entity.ResultadoCurso;

import java.util.List;

/** Estudiantes con matricula vigente (no anulada) en una seccion. */
public record InscritosSeccionResponse(
        Long seccionId,
        String cursoCodigo,
        String cursoNombre,
        String grupo,
        Long periodoId,
        Long docenteId,
        List<Inscrito> inscritos
) {

    public record Inscrito(
            Long matriculaId,
            Long detalleId,
            Long estudianteId,
            String codigoEstudiante,
            String nombreCompleto,
            String estadoMatricula,
            ResultadoCurso resultado
    ) {
    }
}
