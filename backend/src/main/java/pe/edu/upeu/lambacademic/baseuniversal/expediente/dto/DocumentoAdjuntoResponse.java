package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;

import java.time.LocalDateTime;

/**
 * tipoDocumentoInstitucional: null solo en documentos registrados antes de V5.
 * tipoDocumento (formato) y rutaArchivo: null en un documento con enlace; rutaArchivo tambien es null
 * cuando el archivo esta en el almacen privado. tamanoBytes: solo para archivos cargados despues de V5.
 */
public record DocumentoAdjuntoResponse(
        Long id,
        String nombre,
        CatalogoResumen tipoDocumentoInstitucional,
        String nombreArchivo,
        TipoArchivo tipoDocumento,
        String rutaArchivo,
        String enlace,
        Long tamanoBytes,
        LocalDateTime fechaCarga,
        /** true si el archivo se cargo y se puede descargar por el endpoint protegido. */
        boolean archivoDisponible
) {
}
