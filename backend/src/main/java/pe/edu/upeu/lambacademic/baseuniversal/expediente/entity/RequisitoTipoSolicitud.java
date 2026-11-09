package pe.edu.upeu.lambacademic.baseuniversal.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;

/** Muchos a muchos (V5): documento que pide un tipo de solicitud; OBLIGATORIO = false es recomendado. */
@Entity
@Table(name = "REQUISITOS_TIPO_SOLICITUD")
@Getter
@Setter
@NoArgsConstructor
public class RequisitoTipoSolicitud {

    @EmbeddedId
    private Clave id = new Clave();

    @MapsId("tipoSolicitudId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_TIPO_SOLICITUD")
    private TipoSolicitud tipoSolicitud;

    @MapsId("tipoDocumentoId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_TIPO_DOCUMENTO")
    private TipoDocumentoInstitucional tipoDocumento;

    @Column(name = "OBLIGATORIO", nullable = false)
    private Boolean obligatorio = Boolean.TRUE;

    /** PK compuesta (ID_TIPO_SOLICITUD, ID_TIPO_DOCUMENTO). */
    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Clave implements Serializable {

        @Column(name = "ID_TIPO_SOLICITUD")
        private Long tipoSolicitudId;

        @Column(name = "ID_TIPO_DOCUMENTO")
        private Long tipoDocumentoId;
    }
}
