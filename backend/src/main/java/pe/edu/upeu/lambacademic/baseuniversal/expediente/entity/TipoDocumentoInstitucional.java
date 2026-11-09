package pe.edu.upeu.lambacademic.baseuniversal.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Catalogo (V5): documento institucional que se adjunta (FUT, voucher, silabo...). */
@Entity
@Table(name = "TIPOS_DOCUMENTO_INSTITUCIONAL")
@Getter
@Setter
@NoArgsConstructor
public class TipoDocumentoInstitucional {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @Column(name = "CODIGO", nullable = false, unique = true, length = 30)
    private String codigo;

    @Column(name = "NOMBRE", nullable = false, length = 150)
    private String nombre;

    @Column(name = "DESCRIPCION", length = 255)
    private String descripcion;

    @Column(name = "ACTIVO", nullable = false)
    private Boolean activo = Boolean.TRUE;
}
