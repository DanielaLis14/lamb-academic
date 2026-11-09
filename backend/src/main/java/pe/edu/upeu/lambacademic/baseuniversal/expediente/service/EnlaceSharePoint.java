package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

/**
 * Enlaces de documentos en SharePoint u OneDrive de la universidad. Solo se aceptan direcciones https de los
 * dominios institucionales; el frontend aplica la misma regla y Oracle la vuelve a exigir (CK_DOCUMENTOS_ORIGEN).
 */
public final class EnlaceSharePoint {

    public static final Set<String> DOMINIOS = Set.of("upeuedupe.sharepoint.com", "upeuedupe-my.sharepoint.com");
    public static final int LONGITUD_MAXIMA = 1000;

    private EnlaceSharePoint() {
    }

    public static boolean indicado(String enlace) {
        return enlace != null && !enlace.isBlank();
    }

    /** Devuelve el enlace sin espacios alrededor, o rechaza uno que no sea institucional. */
    public static String validar(String enlace) {
        String valor = enlace == null ? "" : enlace.strip();
        if (valor.toLowerCase(Locale.ROOT).startsWith(AlmacenArchivos.PREFIJO)) {
            throw new ReglaNegocioException("El prefijo " + AlmacenArchivos.PREFIJO
                    + " esta reservado para los archivos cargados al sistema");
        }
        if (valor.length() > LONGITUD_MAXIMA) {
            throw new ReglaNegocioException("El enlace admite como maximo " + LONGITUD_MAXIMA + " caracteres");
        }
        URI uri;
        try {
            uri = new URI(valor);
        } catch (URISyntaxException e) {
            throw noInstitucional();
        }
        // Se compara con el texto original para que mayusculas o un esquema distinto no pasen el CHECK de Oracle.
        boolean institucional = "https".equals(uri.getScheme())
                && uri.getRawUserInfo() == null
                && uri.getPort() == -1
                && uri.getHost() != null
                && DOMINIOS.contains(uri.getHost())
                && valor.startsWith("https://" + uri.getHost() + "/");
        if (!institucional) {
            throw noInstitucional();
        }
        return valor;
    }

    /** Nombre interno del documento con enlace: unico por enlace, para la restriccion UK_DOCUMENTOS_ARCHIVO. */
    public static String nombreInterno(String enlace) {
        try {
            byte[] huella = MessageDigest.getInstance("SHA-256").digest(enlace.getBytes(StandardCharsets.UTF_8));
            return "sharepoint-" + HexFormat.of().formatHex(huella, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private static ReglaNegocioException noInstitucional() {
        return new ReglaNegocioException("El enlace debe ser de SharePoint u OneDrive de la universidad "
                + "(https://upeuedupe.sharepoint.com o https://upeuedupe-my.sharepoint.com)");
    }
}
