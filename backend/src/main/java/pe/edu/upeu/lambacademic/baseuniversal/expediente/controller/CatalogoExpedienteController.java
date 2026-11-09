package pe.edu.upeu.lambacademic.baseuniversal.expediente.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CatalogoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.TipoSolicitudResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.service.CatalogoExpedienteService;

import java.util.List;

/** Catalogos de tramite (V5): lectura para cualquier usuario autenticado (SecurityConfig). */
@Tag(name = "Catalogos de expediente", description = "Categorias, tipos de solicitud, destinatarios y documentos")
@RestController
@RequestMapping("/api/v1/expedientes/catalogos")
@RequiredArgsConstructor
public class CatalogoExpedienteController {

    private final CatalogoExpedienteService service;

    @Operation(summary = "Categorias de tramite activas")
    @GetMapping("/categorias")
    public List<CatalogoResponse> categorias() {
        return service.categorias();
    }

    @Operation(summary = "Tipos de solicitud activos de una categoria, con destinatario sugerido y requisitos")
    @GetMapping("/categorias/{categoriaId}/tipos-solicitud")
    public List<TipoSolicitudResponse> tiposSolicitud(@PathVariable Long categoriaId) {
        return service.tiposSolicitud(categoriaId);
    }

    @Operation(summary = "Destinatarios activos")
    @GetMapping("/destinatarios")
    public List<CatalogoResponse> destinatarios() {
        return service.destinatarios();
    }

    @Operation(summary = "Tipos de documento institucional activos")
    @GetMapping("/tipos-documento")
    public List<CatalogoResponse> tiposDocumento() {
        return service.tiposDocumento();
    }
}
