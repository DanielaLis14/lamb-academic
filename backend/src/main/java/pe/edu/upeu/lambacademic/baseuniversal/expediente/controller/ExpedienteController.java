package pe.edu.upeu.lambacademic.baseuniversal.expediente.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CambioEstadoExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoRequest;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteArchivosRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteEstadoReporte;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.service.ExpedienteService;
import pe.edu.upeu.lambacademic.compartido.seguridad.IdentidadToken;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

@Tag(name = "Expedientes", description = "Cabecera-detalle Expediente - DocumentoAdjunto (Base Universal)")
@RestController
@RequestMapping("/api/v1/expedientes")
@RequiredArgsConstructor
public class ExpedienteController {

    private final ExpedienteService service;

    @Operation(summary = "Registra un expediente con sus documentos en una sola transaccion")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpedienteResponse registrar(@Valid @RequestBody ExpedienteRequest request,
                                        @AuthenticationPrincipal Jwt jwt) {
        return service.registrar(request, personaRestringida(jwt));
    }

    @Operation(summary = "Registra un expediente con archivos reales (PDF, PNG o JPG) en una sola transaccion")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExpedienteResponse registrarConArchivos(@Valid @RequestPart("datos") ExpedienteArchivosRequest datos,
                                                   @RequestPart("archivos") List<MultipartFile> archivos,
                                                   @AuthenticationPrincipal Jwt jwt) {
        return service.registrarConArchivos(datos, archivos, personaRestringida(jwt));
    }

    @Operation(summary = "Agrega un documento con su archivo a un expediente REGISTRADO u OBSERVADO")
    @PostMapping(value = "/{id}/documentos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ExpedienteResponse agregarArchivo(@PathVariable Long id, @RequestPart("nombre") String nombre,
                                             @RequestPart("archivo") MultipartFile archivo,
                                             @AuthenticationPrincipal Jwt jwt) {
        return service.agregarArchivo(id, nombre, archivo, personaRestringida(jwt));
    }

    @Operation(summary = "Descarga el archivo de un documento (titular, coordinacion o administracion)")
    @GetMapping("/{id}/documentos/{documentoId}/archivo")
    public ResponseEntity<Resource> descargar(@PathVariable Long id, @PathVariable Long documentoId,
                                              @AuthenticationPrincipal Jwt jwt) {
        ExpedienteService.ArchivoDescarga archivo = service.descargar(id, documentoId, personaRestringida(jwt));
        MediaType tipo = switch (archivo.tipo()) {
            case PDF -> MediaType.APPLICATION_PDF;
            case PNG -> MediaType.IMAGE_PNG;
            case JPG -> MediaType.IMAGE_JPEG;
            case DOCX -> MediaType.APPLICATION_OCTET_STREAM;
        };
        return ResponseEntity.ok()
                .contentType(tipo)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(archivo.nombreArchivo(), StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore().cachePrivate())
                .body(archivo.recurso());
    }

    @Operation(summary = "Busca expedientes con filtros combinados (personaId, estado, desde, hasta) y orden")
    @GetMapping
    public List<ExpedienteResumen> buscar(
            @RequestParam(required = false) Long personaId,
            @RequestParam(required = false) EstadoExpediente estado,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            @RequestParam(defaultValue = "fechaRegistro") String sortBy,
            @RequestParam(defaultValue = "desc") String dir,
            @AuthenticationPrincipal Jwt jwt) {
        return service.buscar(personaId, estado, desde, hasta, sortBy, dir, personaRestringida(jwt));
    }

    @Operation(summary = "Reporte agregado: expedientes y documentos por estado")
    @GetMapping("/resumen")
    public List<ExpedienteEstadoReporte> resumen() {
        return service.resumen();
    }

    @Operation(summary = "Consulta un expediente con sus documentos")
    @GetMapping("/{id}")
    public ExpedienteResponse obtener(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return service.obtener(id, personaRestringida(jwt));
    }

    @Operation(summary = "Lista los documentos de un expediente")
    @GetMapping("/{id}/documentos")
    public List<DocumentoAdjuntoResponse> listarDocumentos(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return service.listarDocumentos(id, personaRestringida(jwt));
    }

    @Operation(summary = "Agrega un documento a un expediente REGISTRADO u OBSERVADO")
    @PostMapping("/{id}/documentos")
    @ResponseStatus(HttpStatus.CREATED)
    public ExpedienteResponse agregarDocumento(@PathVariable Long id,
                                               @Valid @RequestBody DocumentoAdjuntoRequest request,
                                               @AuthenticationPrincipal Jwt jwt) {
        return service.agregarDocumento(id, request, personaRestringida(jwt));
    }

    @Operation(summary = "Corrige los metadatos de un documento de un expediente REGISTRADO u OBSERVADO")
    @PutMapping("/{id}/documentos/{documentoId}")
    public ExpedienteResponse actualizarDocumento(@PathVariable Long id, @PathVariable Long documentoId,
                                                  @Valid @RequestBody DocumentoAdjuntoRequest request,
                                                  @AuthenticationPrincipal Jwt jwt) {
        return service.actualizarDocumento(id, documentoId, request, personaRestringida(jwt));
    }

    @Operation(summary = "Quita un documento de un expediente REGISTRADO u OBSERVADO (conserva al menos uno)")
    @DeleteMapping("/{id}/documentos/{documentoId}")
    public ExpedienteResponse eliminarDocumento(@PathVariable Long id, @PathVariable Long documentoId,
                                                @AuthenticationPrincipal Jwt jwt) {
        return service.eliminarDocumento(id, documentoId, personaRestringida(jwt));
    }

    @Operation(summary = "Cambia el estado del expediente segun el flujo permitido")
    @PatchMapping("/{id}/estado")
    public ExpedienteResponse cambiarEstado(@PathVariable Long id,
                                            @Valid @RequestBody CambioEstadoExpedienteRequest request) {
        return service.cambiarEstado(id, request.estado());
    }

    private Long personaRestringida(Jwt jwt) {
        Long alumno = IdentidadToken.estudianteRestringido(jwt);
        return alumno == null ? null : service.personaDeAlumno(alumno);
    }
}
