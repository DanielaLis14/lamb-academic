package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Enlaces de SharePoint u OneDrive: solo los dominios institucionales, como exige CK_DOCUMENTOS_ORIGEN. */
class EnlaceSharePointTest {

    @Test
    @DisplayName("Acepta SharePoint y OneDrive de la universidad, sin espacios alrededor")
    void aceptaDominiosInstitucionales() {
        assertThat(EnlaceSharePoint.validar("  https://upeuedupe.sharepoint.com/:b:/s/tramites/Ea1?e=x  "))
                .isEqualTo("https://upeuedupe.sharepoint.com/:b:/s/tramites/Ea1?e=x");
        assertThat(EnlaceSharePoint.validar("https://upeuedupe-my.sharepoint.com/personal/ana/Documents/fut.pdf"))
                .startsWith("https://upeuedupe-my.sharepoint.com/");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "http://upeuedupe.sharepoint.com/x",
            "https://upeuedupe.sharepoint.com.evil.com/x",
            "https://evil.com/upeuedupe.sharepoint.com/x",
            "https://usuario@upeuedupe.sharepoint.com/x",
            "https://upeuedupe.sharepoint.com:8443/x",
            "https://otra.sharepoint.com/x",
            "https://upeuedupe.sharepoint.com",
            "javascript:alert(1)",
            "no es un enlace"})
    @DisplayName("Rechaza esquemas, dominios, usuarios o puertos que no son institucionales")
    void rechazaNoInstitucionales(String enlace) {
        assertThatThrownBy(() -> EnlaceSharePoint.validar(enlace))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("de la universidad");
    }

    @Test
    @DisplayName("El prefijo interno almacen: nunca es un enlace")
    void rechazaPrefijoDelAlmacen() {
        assertThatThrownBy(() -> EnlaceSharePoint.validar("almacen:00000000-0000-0000-0000-000000000000.pdf"))
                .isInstanceOf(ReglaNegocioException.class).hasMessageContaining("reservado");
        assertThatThrownBy(() -> EnlaceSharePoint.validar("ALMACEN:x")).isInstanceOf(ReglaNegocioException.class);
    }

    @Test
    @DisplayName("El nombre interno es estable por enlace y distinto entre enlaces")
    void nombreInterno() {
        String a = EnlaceSharePoint.nombreInterno("https://upeuedupe.sharepoint.com/a");
        assertThat(a).matches("sharepoint-[0-9a-f]{16}")
                .isEqualTo(EnlaceSharePoint.nombreInterno("https://upeuedupe.sharepoint.com/a"))
                .isNotEqualTo(EnlaceSharePoint.nombreInterno("https://upeuedupe.sharepoint.com/b"));
    }
}
