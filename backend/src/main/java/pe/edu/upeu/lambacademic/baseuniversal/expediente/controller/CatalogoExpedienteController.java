package pe.edu.upeu.lambacademic.baseuniversal.expediente.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CatalogoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.TipoSolicitudResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.service.CatalogoExpedienteService;

import java.time.Duration;
import java.util.List;

/** Catalogos de tramite (V5): lectura para cualquier usuario autenticado (SecurityConfig). */
@Tag(name = "Catalogos de expediente", description = "Categorias, tipos de solicitud, destinatarios y documentos")
@RestController
@RequestMapping("/api/v1/expedientes/catalogos")
@RequiredArgsConstructor
public class CatalogoExpedienteController {

    /**
     * Catalogos de solo lectura que cambian poco: el navegador los reutiliza 5 minutos. "private" porque exigen
     * sesion (ningun cache compartido los guarda). Solo se aplica a estos GET, nunca a endpoints que escriben.
     */
    private static final CacheControl CACHE_CATALOGOS = CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate();

    private final CatalogoExpedienteService service;

    @Operation(summary = "Categorias de tramite activas")
    @GetMapping("/categorias")
    public ResponseEntity<List<CatalogoResponse>> categorias() {
        return conCache(service.categorias());
    }

    @Operation(summary = "Tipos de solicitud activos de una categoria, con destinatario sugerido y requisitos")
    @GetMapping("/categorias/{categoriaId}/tipos-solicitud")
    public ResponseEntity<List<TipoSolicitudResponse>> tiposSolicitud(@PathVariable Long categoriaId) {
        return conCache(service.tiposSolicitud(categoriaId));
    }

    @Operation(summary = "Destinatarios activos")
    @GetMapping("/destinatarios")
    public ResponseEntity<List<CatalogoResponse>> destinatarios() {
        return conCache(service.destinatarios());
    }

    @Operation(summary = "Tipos de documento institucional activos")
    @GetMapping("/tipos-documento")
    public ResponseEntity<List<CatalogoResponse>> tiposDocumento() {
        return conCache(service.tiposDocumento());
    }

    private static <T> ResponseEntity<T> conCache(T cuerpo) {
        return ResponseEntity.ok().cacheControl(CACHE_CATALOGOS).body(cuerpo);
    }
}
