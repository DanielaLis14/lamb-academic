package pe.edu.upeu.lambacademic.baseuniversal.expediente.repository;

import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteEstadoReporte;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ExpedienteRepository extends JpaRepository<Expediente, Long> {

    /** Proyeccion de listado: no carga la coleccion de documentos (S5 2.4). */
    @Query("""
            SELECT new pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResumen(
                e.id, e.codigoTramite, e.asunto, e.fechaRegistro, e.estado, e.totalDocumentos,
                p.id, CONCAT(p.apellidoPaterno, ' ', p.nombres), t.nombre)
            FROM Expediente e JOIN e.persona p LEFT JOIN e.tipoSolicitud t
            WHERE (:idPersona IS NULL OR p.id = :idPersona)
              AND (:estado IS NULL OR e.estado = :estado)
              AND (:desde IS NULL OR e.fechaRegistro >= :desde)
              AND (:hasta IS NULL OR e.fechaRegistro <= :hasta)
            """)
    List<ExpedienteResumen> buscar(@Param("idPersona") Long idPersona,
                                   @Param("estado") EstadoExpediente estado,
                                   @Param("desde") LocalDateTime desde,
                                   @Param("hasta") LocalDateTime hasta,
                                   Sort sort);

    @EntityGraph(attributePaths = {"persona", "documentos", "documentos.tipoDocumentoInstitucional", "categoria",
            "tipoSolicitud", "destinatario"})
    Optional<Expediente> findDetalladoById(Long id);

    /** Expedientes del titular con el mismo tipo de solicitud en los estados indicados (regla de duplicado). */
    List<Expediente> findByPersonaIdAndTipoSolicitudIdAndEstadoIn(Long personaId, Long tipoSolicitudId,
                                                                   Collection<EstadoExpediente> estados);

    /** Numero correlativo del codigo de tramite TR-AAAA-NNNNN (secuencia SEQ_CODIGO_TRAMITE de V5). */
    @Query(value = "SELECT SEQ_CODIGO_TRAMITE.NEXTVAL FROM DUAL", nativeQuery = true)
    Long siguienteNumeroTramite();

    /** Agregado por estado: cantidad de expedientes y documentos. */
    @Query("""
            SELECT new pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteEstadoReporte(
                e.estado, COUNT(e), COALESCE(SUM(e.totalDocumentos), 0L))
            FROM Expediente e
            GROUP BY e.estado
            ORDER BY e.estado
            """)
    List<ExpedienteEstadoReporte> resumenPorEstado();
}
