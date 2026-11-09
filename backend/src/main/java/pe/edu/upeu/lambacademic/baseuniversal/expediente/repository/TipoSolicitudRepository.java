package pe.edu.upeu.lambacademic.baseuniversal.expediente.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;

import java.util.List;
import java.util.Optional;

public interface TipoSolicitudRepository extends JpaRepository<TipoSolicitud, Long> {

    /** Tipos activos de una categoria con su destinatario sugerido y sus requisitos, en una sola consulta. */
    @EntityGraph(attributePaths = {"destinatarioSugerido", "requisitos", "requisitos.tipoDocumento"})
    List<TipoSolicitud> findByCategoriaIdAndActivoTrueOrderByNombreAsc(Long categoriaId);

    @EntityGraph(attributePaths = {"categoria", "destinatarioSugerido", "requisitos", "requisitos.tipoDocumento"})
    Optional<TipoSolicitud> findDetalladoById(Long id);
}
