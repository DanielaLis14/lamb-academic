package pe.edu.upeu.lambacademic.baseuniversal.expediente.entity;

/** Tipos de archivo aceptados; la extension del nombre de archivo debe coincidir. */
public enum TipoArchivo {
    PDF("pdf"),
    JPG("jpg", "jpeg"),
    PNG("png"),
    DOCX("docx");

    private final String[] extensiones;

    TipoArchivo(String... extensiones) {
        this.extensiones = extensiones;
    }

    public boolean coincideCon(String nombreArchivo) {
        if (nombreArchivo == null) {
            return false;
        }
        String nombre = nombreArchivo.toLowerCase();
        for (String extension : extensiones) {
            if (nombre.endsWith("." + extension)) {
                return true;
            }
        }
        return false;
    }
}
