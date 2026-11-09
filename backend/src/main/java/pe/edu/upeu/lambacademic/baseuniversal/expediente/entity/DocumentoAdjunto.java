package pe.edu.upeu.lambacademic.baseuniversal.expediente.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** DETALLE del expediente: metadatos de un documento adjunto (la ruta, no el binario). */
@Entity
@Table(name = "DOCUMENTOS_ADJUNTOS")
@Getter
@Setter
@NoArgsConstructor
public class DocumentoAdjunto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ID_EXPEDIENTE", nullable = false)
    private Expediente expediente;

    @Column(name = "NOMBRE", nullable = false, length = 150)
    private String nombre;

    @Column(name = "NOMBRE_ARCHIVO", nullable = false, length = 255)
    private String nombreArchivo;

    /** Formato del archivo; NULL en un documento con enlace de SharePoint. */
    @Enumerated(EnumType.STRING)
    @Column(name = "TIPO_DOCUMENTO", length = 10)
    private TipoArchivo tipoDocumento;

    /** "almacen:clave" o la ruta declarada de los registros previos; NULL en un documento con enlace. */
    @Column(name = "RUTA_ARCHIVO", length = 500)
    private String rutaArchivo;

    @Column(name = "FECHA_CARGA", nullable = false)
    private LocalDateTime fechaCarga;

    /** Tipo institucional (V5); NULL solo en documentos registrados antes de V5. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ID_TIPO_DOCUMENTO_INST")
    private TipoDocumentoInstitucional tipoDocumentoInstitucional;

    /** Tamano del archivo cargado; NULL en documentos con enlace o con ruta declarada. */
    @Column(name = "TAMANO_BYTES")
    private Long tamanoBytes;

    /** Enlace institucional de SharePoint u OneDrive, en lugar de un archivo. */
    @Column(name = "ENLACE", length = 1000)
    private String enlace;

    public boolean tieneEnlace() {
        return enlace != null;
    }
}
