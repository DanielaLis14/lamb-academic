package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.util.unit.DataSize;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Almacen privado: tipo por contenido, tamano maximo y rutas que nunca salen del directorio. */
class AlmacenArchivosTest {

    private static final byte[] PDF = "%PDF-1.7\n%prueba\n".getBytes();
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};

    @TempDir
    Path directorio;

    private AlmacenArchivos almacen() {
        return new AlmacenArchivos(directorio.toString(), DataSize.ofKilobytes(1), DataSize.ofKilobytes(3));
    }

    @Test
    @DisplayName("Guarda un PDF con nombre generado por el servidor y lo vuelve a leer")
    void guardaYLee() throws Exception {
        AlmacenArchivos almacen = almacen();
        var guardado = almacen.guardar(new MockMultipartFile("archivo", "../../dni.pdf", "text/plain", PDF));

        assertThat(guardado.tipo()).isEqualTo(TipoArchivo.PDF);
        assertThat(guardado.ruta()).matches("almacen:[0-9a-f-]{36}\\.pdf");
        try (var archivos = Files.list(directorio)) {
            assertThat(archivos.toList()).singleElement()
                    .satisfies(a -> assertThat(a.getFileName().toString()).isEqualTo(guardado.ruta().substring(8)));
        }
        assertThat(almacen.leer(guardado.ruta()).getContentAsByteArray()).isEqualTo(PDF);
    }

    @Test
    @DisplayName("El tipo se decide por el contenido: un texto con extension .pdf se rechaza")
    void contenidoFalso() {
        assertThatThrownBy(() -> almacen().guardar(
                new MockMultipartFile("archivo", "virus.pdf", "application/pdf", "<script>".getBytes())))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("no es un PDF, PNG o JPG");
        assertThat(directorio.toFile().list()).isEmpty();
    }

    @Test
    @DisplayName("Rechaza archivos vacios y los que superan el tamano maximo")
    void tamano() {
        assertThatThrownBy(() -> almacen().guardar(new MockMultipartFile("archivo", "a.png", "image/png", new byte[0])))
                .isInstanceOf(ReglaNegocioException.class);
        byte[] grande = new byte[2048];
        System.arraycopy(PNG, 0, grande, 0, PNG.length);
        assertThatThrownBy(() -> almacen().guardar(new MockMultipartFile("archivo", "a.png", "image/png", grande)))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("tamano maximo");
    }

    @Test
    @DisplayName("Una ruta que no es una clave del almacen no se lee, aunque intente salir del directorio")
    void rutasInvalidas() {
        AlmacenArchivos almacen = almacen();
        assertThatThrownBy(() -> almacen.leer("/tramites/dni.pdf")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> almacen.leer("almacen:../../secretos.env")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> almacen.leer("almacen:00000000-0000-0000-0000-000000000000.pdf"))
                .isInstanceOf(ResourceNotFoundException.class).hasMessageContaining("ya no esta disponible");
    }

    @Test
    @DisplayName("El nombre visible no conserva carpetas ni caracteres de control")
    void nombreVisible() {
        assertThat(AlmacenArchivos.nombreVisible(new MockMultipartFile("a", "C:\\temp\\..\\dni\u0000.pdf", null, PDF)))
                .isEqualTo("dni.pdf");
        assertThat(AlmacenArchivos.nombreVisible(new MockMultipartFile("a", "", null, PDF))).isEqualTo("archivo");
    }

    @Test
    @DisplayName("Informa el tamano guardado y el maximo por expediente; una ruta ajena mide 0")
    void tamanoDeArchivoGuardado() {
        AlmacenArchivos almacen = almacen();
        var guardado = almacen.guardar(new MockMultipartFile("archivo", "foto.png", "image/png", PNG));

        assertThat(guardado.tamano()).isEqualTo(PNG.length);
        assertThat(almacen.tamano(guardado.ruta())).isEqualTo(PNG.length);
        assertThat(almacen.tamano("/tramites/foto.png")).isZero();
        assertThat(almacen.tamano("almacen:00000000-0000-0000-0000-000000000000.pdf")).isZero();
        assertThat(almacen.tamanoMaximoExpediente()).isEqualTo(3 * 1024);
    }

    @Test
    @DisplayName("Eliminar solo actua sobre archivos del almacen")
    void eliminar() {
        AlmacenArchivos almacen = almacen();
        var guardado = almacen.guardar(new MockMultipartFile("archivo", "foto.png", "image/png", PNG));
        almacen.eliminar("/tramites/foto.png");
        assertThat(directorio.toFile().list()).hasSize(1);
        almacen.eliminar(guardado.ruta());
        assertThat(directorio.toFile().list()).isEmpty();
    }
}
