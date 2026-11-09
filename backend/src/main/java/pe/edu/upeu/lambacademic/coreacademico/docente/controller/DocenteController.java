package pe.edu.upeu.lambacademic.coreacademico.docente.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import pe.edu.upeu.lambacademic.baseuniversal.persona.dto.DocenteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.persona.dto.PersonaResponse;
import pe.edu.upeu.lambacademic.compartido.seguridad.IdentidadToken;
import pe.edu.upeu.lambacademic.coreacademico.docente.dto.CargaDocenteResponse;
import pe.edu.upeu.lambacademic.coreacademico.docente.service.DocenteService;
import pe.edu.upeu.lambacademic.exception.AccesoDenegadoException;

import java.util.List;

@Tag(name = "Docentes", description = "Plana docente y carga lectiva (Core Academico - Curriculo)")
@RestController
@RequestMapping("/api/v1/docentes")
@RequiredArgsConstructor
public class DocenteController {

    private final DocenteService service;

    @Operation(summary = "Lista la plana docente (personas de tipo DOCENTE)")
    @GetMapping
    public List<PersonaResponse> listar(@RequestParam(required = false) Boolean activo,
                                        @RequestParam(required = false) String q) {
        return service.listar(activo, q);
    }

    @Operation(summary = "Carga lectiva del docente autenticado (claim docente_id) en un periodo")
    @GetMapping("/mi-carga")
    public CargaDocenteResponse miCarga(@RequestParam Long periodoId, @AuthenticationPrincipal Jwt jwt) {
        Long docente = IdentidadToken.docenteRestringido(jwt);
        if (docente == null) {
            throw new AccesoDenegadoException("Solo un docente consulta su propia carga; usa /docentes/{id}/carga");
        }
        return service.carga(docente, periodoId);
    }

    @Operation(summary = "Consulta un docente")
    @GetMapping("/{id}")
    public PersonaResponse obtener(@PathVariable Long id) {
        return service.obtener(id);
    }

    @Operation(summary = "Registra un docente (persona de tipo DOCENTE)")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PersonaResponse crear(@Valid @RequestBody DocenteRequest request) {
        return service.crear(request);
    }

    @Operation(summary = "Actualiza los datos de un docente")
    @PutMapping("/{id}")
    public PersonaResponse actualizar(@PathVariable Long id, @Valid @RequestBody DocenteRequest request) {
        return service.actualizar(id, request);
    }

    @Operation(summary = "Baja logica de un docente sin secciones vigentes")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desactivar(@PathVariable Long id) {
        service.desactivar(id);
    }

    @Operation(summary = "Carga lectiva del docente: secciones y horas semanales en un periodo")
    @GetMapping("/{id}/carga")
    public CargaDocenteResponse carga(@PathVariable Long id, @RequestParam Long periodoId) {
        return service.carga(id, periodoId);
    }
}
