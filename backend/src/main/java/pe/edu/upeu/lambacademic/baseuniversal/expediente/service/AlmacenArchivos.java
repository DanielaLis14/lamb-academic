package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import org.springframework.util.unit.DataSize;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Almacen privado de los archivos de los expedientes. Los archivos se guardan fuera de cualquier carpeta
 * publica, con un nombre generado por el servidor (UUID): ningun dato enviado por el usuario forma parte de
 * la ruta. El tipo se decide por el contenido (firma del archivo), no por la extension ni por el
 * Content-Type que declara el navegador. Solo se aceptan PDF, PNG y JPG.
 *
 * En DOCUMENTOS_ADJUNTOS.RUTA_ARCHIVO se registra "almacen:" + clave; los registros previos, que solo
 * tienen la ruta declarada por el usuario, no tienen archivo descargable.
 */
@Slf4j
@Component
public class AlmacenArchivos {

    public static final String PREFIJO = "almacen:";
    private static final Pattern CLAVE = Pattern.compile("[0-9a-f-]{36}\\.(pdf|png|jpg)");
    private static final byte[] FIRMA_PDF = {'%', 'P', 'D', 'F', '-'};
    private static final byte[] FIRMA_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    private static final byte[] FIRMA_JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};

    private final Path directorio;
    private final long tamanoMaximo;

    public AlmacenArchivos(@Value("${lamb.archivos.directorio:${user.home}/lamb-academic-archivos}") String directorio,
                           @Value("${lamb.archivos.tamano-maximo:5MB}") DataSize tamanoMaximo) {
        this.directorio = Path.of(directorio).toAbsolutePath().normalize();
        this.tamanoMaximo = tamanoMaximo.toBytes();
    }

    public record ArchivoGuardado(String ruta, TipoArchivo tipo, long tamano) {
    }

    public static boolean esAlmacenado(String ruta) {
        return ruta != null && ruta.startsWith(PREFIJO);
    }

    public long tamanoMaximo() {
        return tamanoMaximo;
    }

    /** Valida y guarda el archivo; devuelve la ruta interna que se registra en el documento. */
    public ArchivoGuardado guardar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ReglaNegocioException("Selecciona un archivo con contenido");
        }
        if (archivo.getSize() > tamanoMaximo) {
            throw new ReglaNegocioException("El archivo " + nombreVisible(archivo) + " supera el tamano maximo de "
                    + (tamanoMaximo / (1024 * 1024)) + " MB");
        }
        TipoArchivo tipo = detectarTipo(archivo);
        String clave = UUID.randomUUID() + "." + tipo.name().toLowerCase();
        Path destino = resolver(clave);
        try {
            Files.createDirectories(directorio);
            try (InputStream entrada = archivo.getInputStream()) {
                Files.copy(entrada, destino, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar el archivo en el almacen", e);
        }
        return new ArchivoGuardado(PREFIJO + clave, tipo, archivo.getSize());
    }

    public Resource leer(String ruta) {
        Path archivo = resolver(clave(ruta));
        if (!Files.isRegularFile(archivo)) {
            throw new ResourceNotFoundException("El archivo del documento ya no esta disponible en el almacen");
        }
        return new PathResource(archivo);
    }

    /** Borra el archivo; un fallo se registra y no interrumpe la operacion que ya se confirmo. */
    public void eliminar(String ruta) {
        if (!esAlmacenado(ruta)) {
            return;
        }
        try {
            Files.deleteIfExists(resolver(clave(ruta)));
        } catch (IOException | RuntimeException e) {
            log.warn("No se pudo borrar el archivo {} del almacen: {}", ruta, e.getMessage());
        }
    }

    /** Nombre original sin carpetas ni caracteres de control, solo para mostrarlo y descargarlo. */
    public static String nombreVisible(MultipartFile archivo) {
        String original = archivo.getOriginalFilename() == null ? "archivo" : archivo.getOriginalFilename();
        String base = original.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").strip();
        if (base.isEmpty()) {
            base = "archivo";
        }
        return base.length() > 255 ? base.substring(base.length() - 255) : base;
    }

    private TipoArchivo detectarTipo(MultipartFile archivo) {
        byte[] cabecera;
        try (InputStream entrada = archivo.getInputStream()) {
            cabecera = entrada.readNBytes(8);
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer el archivo recibido", e);
        }
        if (empiezaCon(cabecera, FIRMA_PDF)) {
            return TipoArchivo.PDF;
        }
        if (empiezaCon(cabecera, FIRMA_PNG)) {
            return TipoArchivo.PNG;
        }
        if (empiezaCon(cabecera, FIRMA_JPG)) {
            return TipoArchivo.JPG;
        }
        throw new ReglaNegocioException("El archivo " + nombreVisible(archivo)
                + " no es un PDF, PNG o JPG valido");
    }

    private static boolean empiezaCon(byte[] datos, byte[] firma) {
        return datos.length >= firma.length && Arrays.equals(Arrays.copyOf(datos, firma.length), firma);
    }

    private static String clave(String ruta) {
        String clave = esAlmacenado(ruta) ? ruta.substring(PREFIJO.length()) : "";
        if (!CLAVE.matcher(clave).matches()) {
            throw new ResourceNotFoundException("El documento no tiene un archivo cargado");
        }
        return clave;
    }

    private Path resolver(String clave) {
        Path archivo = directorio.resolve(clave).normalize();
        if (!archivo.getParent().equals(directorio)) {
            throw new IllegalStateException("Ruta de archivo fuera del almacen");
        }
        return archivo;
    }
}
