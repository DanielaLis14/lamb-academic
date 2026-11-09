package pe.edu.upeu.lambacademic.coreacademico.curso.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import pe.edu.upeu.lambacademic.coreacademico.curso.entity.Curso;
import pe.edu.upeu.lambacademic.coreacademico.curso.mapper.CursoMapper;
import pe.edu.upeu.lambacademic.coreacademico.curso.repository.CursoRepository;
import pe.edu.upeu.lambacademic.coreacademico.seccion.entity.EstadoSeccion;
import pe.edu.upeu.lambacademic.coreacademico.seccion.entity.Seccion;
import pe.edu.upeu.lambacademic.coreacademico.seccion.port.PeriodoAcademicoPort;
import pe.edu.upeu.lambacademic.coreacademico.seccion.repository.SeccionRepository;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Baja logica de un curso: no se desactiva mientras tenga secciones programadas en periodos abiertos. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CursoServiceTest {

    @Mock private CursoRepository repository;
    @Mock private CursoMapper mapper;
    @Mock private SeccionRepository seccionRepository;
    @Mock private PeriodoAcademicoPort periodoAcademicoPort;

    @InjectMocks private CursoService service;

    @Test
    @DisplayName("Un curso con seccion abierta en un periodo activo no se desactiva")
    void cursoConSeccionVigente() {
        Curso curso = curso();
        when(repository.findById(5L)).thenReturn(Optional.of(curso));
        when(seccionRepository.buscar(isNull(), eq(5L), isNull(), isNull(), anyInt(), any()))
                .thenReturn(List.of(seccion(4L, EstadoSeccion.ABIERTA)));
        when(periodoAcademicoPort.buscarPeriodo(4L))
                .thenReturn(Optional.of(new PeriodoAcademicoPort.PeriodoInfo(4L, "2026-II", "2026-II", "ACTIVO")));

        assertThatThrownBy(() -> service.desactivar(5L)).isInstanceOf(ReglaNegocioException.class);
        assertThat(curso.getActivo()).isTrue();
        verify(repository, never()).save(any());
    }

    @Test
    @DisplayName("Secciones canceladas o de periodos cerrados no impiden la baja")
    void cursoSoloConHistoria() {
        Curso curso = curso();
        when(repository.findById(5L)).thenReturn(Optional.of(curso));
        when(seccionRepository.buscar(isNull(), eq(5L), isNull(), isNull(), anyInt(), any()))
                .thenReturn(List.of(seccion(1L, EstadoSeccion.CERRADA), seccion(4L, EstadoSeccion.CANCELADA)));
        when(periodoAcademicoPort.buscarPeriodo(1L))
                .thenReturn(Optional.of(new PeriodoAcademicoPort.PeriodoInfo(1L, "2025-I", "2025-I", "CERRADO")));

        service.desactivar(5L);

        assertThat(curso.getActivo()).isFalse();
        verify(repository).save(curso);
    }

    private static Curso curso() {
        Curso curso = new Curso();
        curso.setId(5L);
        curso.setCodigo("IS201");
        curso.setActivo(true);
        return curso;
    }

    private static Seccion seccion(Long periodoId, EstadoSeccion estado) {
        Seccion seccion = new Seccion();
        seccion.setPeriodoId(periodoId);
        seccion.setEstado(estado);
        return seccion;
    }
}
