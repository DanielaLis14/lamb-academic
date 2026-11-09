package pe.edu.upeu.lambacademic.baseuniversal.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Catalogo (V5): tipo de solicitud de una categoria, con su destinatario sugerido y sus requisitos. */
@Entity
@Table(name = "TIPOS_SOLICITUD")
@Getter
@Setter
@NoArgsConstructor
public class TipoSolicitud {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_CATEGORIA", nullable = false)
    private CategoriaTramite categoria;

    @Column(name = "CODIGO", nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(name = "NOMBRE", nullable = false, length = 150)
    private String nombre;

    @Column(name = "DESCRIPCION", length = 255)
    private String descripcion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_DESTINATARIO_SUGERIDO", nullable = false)
    private Destinatario destinatarioSugerido;

    @Column(name = "ACTIVO", nullable = false)
    private Boolean activo = Boolean.TRUE;

    @OneToMany(mappedBy = "tipoSolicitud")
    private List<RequisitoTipoSolicitud> requisitos = new ArrayList<>();

    /** Requisitos cuyo tipo de documento sigue activo, en orden de catalogo. */
    public List<RequisitoTipoSolicitud> requisitosVigentes() {
        return requisitos.stream()
                .filter(r -> Boolean.TRUE.equals(r.getTipoDocumento().getActivo()))
                .sorted(Comparator.comparing((RequisitoTipoSolicitud r) -> r.getTipoDocumento().getId()))
                .toList();
    }
}
