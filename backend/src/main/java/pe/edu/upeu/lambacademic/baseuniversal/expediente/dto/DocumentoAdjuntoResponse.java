package pe.edu.upeu.lambacademic.baseuniversal.expediente.dto;

import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;

import java.time.LocalDateTime;

public record DocumentoAdjuntoResponse(
        Long id,
        String nombre,
        String nombreArchivo,
        TipoArchivo tipoDocumento,
        /** Ruta declarada por el usuario; null cuando el archivo esta en el almacen privado. */
        String rutaArchivo,
        LocalDateTime fechaCarga,
        /** true si el archivo se cargo y se puede descargar por el endpoint protegido. */
        boolean archivoDisponible
) {
}
