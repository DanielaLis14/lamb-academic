package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import pe.edu.upeu.lambacademic.baseuniversal.alumno.repository.AlumnoRepository;
import org.springframework.core.io.Resource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteArchivosRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteEstadoReporte;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.DocumentoAdjunto;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.mapper.ExpedienteMapper;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.ExpedienteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.persona.entity.Persona;
import pe.edu.upeu.lambacademic.baseuniversal.persona.repository.PersonaRepository;
import pe.edu.upeu.lambacademic.exception.AccesoDenegadoException;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Operacion cabecera-detalle Expediente - DocumentoAdjunto (origen: LP2_L, reescrita).
 * registrar() es atomico: si un documento viola una regla, no queda ni la cabecera
 * ni ningun documento (rollback por excepcion no controlada, S4 2.5).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExpedienteService {

    private static final int MAX_DOCUMENTOS = 20;

    private static final Set<String> CAMPOS_ORDENABLES = Set.of("fechaRegistro", "codigoTramite", "estado", "id");

    private static final Map<EstadoExpediente, Set<EstadoExpediente>> TRANSICIONES = Map.of(
            EstadoExpediente.REGISTRADO, Set.of(EstadoExpediente.EN_REVISION, EstadoExpediente.ARCHIVADO),
            EstadoExpediente.EN_REVISION, Set.of(EstadoExpediente.OBSERVADO, EstadoExpediente.APROBADO),
            EstadoExpediente.OBSERVADO, Set.of(EstadoExpediente.EN_REVISION, EstadoExpediente.ARCHIVADO),
            EstadoExpediente.APROBADO, Set.of(EstadoExpediente.ARCHIVADO),
            EstadoExpediente.ARCHIVADO, Set.of());

    private final ExpedienteRepository expedienteRepository;
    private final PersonaRepository personaRepository;
    private final AlumnoRepository alumnoRepository;
    private final ExpedienteMapper mapper;
    private final AlmacenArchivos almacen;

    /** Archivo de un documento listo para descargar por el endpoint protegido. */
    public record ArchivoDescarga(Resource recurso, String nombreArchivo, TipoArchivo tipo) {
    }

    /** PERSONA.ID del alumno autenticado: un ESTUDIANTE solo opera sobre sus propios expedientes. */
    @Transactional(readOnly = true)
    public Long personaDeAlumno(Long alumnoId) {
        return alumnoRepository.findWithPersonaById(alumnoId)
                .map(alumno -> alumno.getPersona().getId())
                .orElseThrow(() -> new AccesoDenegadoException("Tu cuenta está vinculada a un alumno que no existe"));
    }

    /**
     * personaRestringida null: personal, que indica la persona titular en el cuerpo. Con valor, el
     * expediente se registra a nombre del estudiante autenticado y se ignora la persona enviada.
     */
    @Transactional
    public ExpedienteResponse registrar(ExpedienteRequest request, Long personaRestringida) {
        return registrarInterno(request, personaRestringida, false);
    }

    /**
     * Registro con archivos reales en una sola transaccion. Cada archivo se guarda en el almacen privado y,
     * si la transaccion no se confirma (regla incumplida, error de base), los archivos ya guardados se borran.
     */
    @Transactional
    public ExpedienteResponse registrarConArchivos(ExpedienteArchivosRequest datos, List<MultipartFile> archivos,
                                                   Long personaRestringida) {
        if (archivos == null || archivos.isEmpty()) {
            throw new ReglaNegocioException("Adjunta al menos un archivo");
        }
        if (archivos.size() != datos.nombres().size()) {
            throw new ReglaNegocioException("Cada archivo necesita su nombre de documento");
        }
        if (archivos.size() > MAX_DOCUMENTOS) {
            throw new ReglaNegocioException("Un expediente admite como maximo " + MAX_DOCUMENTOS + " documentos");
        }
        if (expedienteRepository.existsByCodigoTramite(datos.codigoTramite())) {
            throw new ReglaNegocioException("Ya existe un expediente con codigo " + datos.codigoTramite());
        }
        List<DocumentoAdjuntoRequest> documentos = new ArrayList<>();
        for (int i = 0; i < archivos.size(); i++) {
            documentos.add(documentoDeArchivo(datos.nombres().get(i), archivos.get(i)));
        }
        return registrarInterno(new ExpedienteRequest(datos.codigoTramite(), datos.asunto(), datos.personaId(),
                documentos), personaRestringida, true);
    }

    private ExpedienteResponse registrarInterno(ExpedienteRequest request, Long personaRestringida,
                                                boolean desdeAlmacen) {
        if (expedienteRepository.existsByCodigoTramite(request.codigoTramite())) {
            throw new ReglaNegocioException("Ya existe un expediente con codigo " + request.codigoTramite());
        }
        Long personaId = personaRestringida != null ? personaRestringida : request.personaId();
        if (personaId == null) {
            throw new ReglaNegocioException("Indica la persona titular del expediente");
        }
        Persona persona = personaRepository.findWithEscuelaById(personaId)
                .orElseThrow(() -> new ResourceNotFoundException("Persona", personaId));
        if (!Boolean.TRUE.equals(persona.getActivo())) {
            throw new ReglaNegocioException("La persona " + persona.getId() + " esta inactiva");
        }

        Expediente expediente = new Expediente();
        expediente.setCodigoTramite(request.codigoTramite());
        expediente.setAsunto(request.asunto());
        expediente.setPersona(persona);
        expediente.setFechaRegistro(LocalDateTime.now());
        expediente.setEstado(EstadoExpediente.REGISTRADO);

        Set<String> archivos = new HashSet<>();
        for (DocumentoAdjuntoRequest documento : request.documentos()) {
            validarDocumento(documento, archivos, desdeAlmacen);
            expediente.agregarDocumento(nuevoDocumento(documento));
        }

        Expediente guardado = expedienteRepository.save(expediente);
        log.info("Expediente registrado id={} codigo={} documentos={}", guardado.getId(),
                guardado.getCodigoTramite(), guardado.getTotalDocumentos());
        return mapper.toResponse(guardado);
    }

    /** Agrega un documento a un expediente que todavia admite cambios. */
    @Transactional
    public ExpedienteResponse agregarDocumento(Long id, DocumentoAdjuntoRequest request, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        if (expediente.getDocumentos().size() >= MAX_DOCUMENTOS) {
            throw new ReglaNegocioException("El expediente ya tiene el maximo de " + MAX_DOCUMENTOS + " documentos");
        }
        Set<String> archivos = new HashSet<>();
        expediente.getDocumentos().forEach(d -> archivos.add(d.getNombreArchivo().toLowerCase()));
        validarDocumento(request, archivos, false);
        expediente.agregarDocumento(nuevoDocumento(request));
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /** Agrega un documento con su archivo real (PDF, PNG o JPG) a un expediente que admite cambios. */
    @Transactional
    public ExpedienteResponse agregarArchivo(Long id, String nombre, MultipartFile archivo, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        if (expediente.getDocumentos().size() >= MAX_DOCUMENTOS) {
            throw new ReglaNegocioException("El expediente ya tiene el maximo de " + MAX_DOCUMENTOS + " documentos");
        }
        if (nombre == null || nombre.isBlank() || nombre.length() > 150) {
            throw new ReglaNegocioException("Indica el nombre del documento (hasta 150 caracteres)");
        }
        Set<String> archivos = new HashSet<>();
        expediente.getDocumentos().forEach(d -> archivos.add(d.getNombreArchivo().toLowerCase()));
        DocumentoAdjuntoRequest documento = documentoDeArchivo(nombre.strip(), archivo);
        validarDocumento(documento, archivos, true);
        expediente.agregarDocumento(nuevoDocumento(documento));
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /** Archivo de un documento: el titular y el personal autorizado; nunca por una ruta publica. */
    @Transactional(readOnly = true)
    public ArchivoDescarga descargar(Long id, Long documentoId, Long personaRestringida) {
        DocumentoAdjunto documento = documentoDe(buscarPropio(id, personaRestringida), documentoId);
        return new ArchivoDescarga(almacen.leer(documento.getRutaArchivo()), documento.getNombreArchivo(),
                documento.getTipoDocumento());
    }

    /** Corrige los metadatos de un documento mientras el expediente admite cambios. */
    @Transactional
    public ExpedienteResponse actualizarDocumento(Long id, Long documentoId, DocumentoAdjuntoRequest request,
                                                  Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        DocumentoAdjunto documento = documentoDe(expediente, documentoId);
        if (AlmacenArchivos.esAlmacenado(documento.getRutaArchivo())) {
            // El archivo cargado no se reemplaza con metadatos: solo se corrige el nombre del documento.
            documento.setNombre(request.nombre());
            return mapper.toResponse(expedienteRepository.save(expediente));
        }
        Set<String> archivos = new HashSet<>();
        expediente.getDocumentos().stream()
                .filter(d -> !d.getId().equals(documentoId))
                .forEach(d -> archivos.add(d.getNombreArchivo().toLowerCase()));
        validarDocumento(request, archivos, false);
        documento.setNombre(request.nombre());
        documento.setNombreArchivo(request.nombreArchivo());
        documento.setTipoDocumento(request.tipoDocumento());
        documento.setRutaArchivo(request.rutaArchivo());
        documento.setFechaCarga(LocalDateTime.now());
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /** Quita un documento; el expediente nunca queda sin documentos. */
    @Transactional
    public ExpedienteResponse eliminarDocumento(Long id, Long documentoId, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        DocumentoAdjunto documento = documentoDe(expediente, documentoId);
        if (expediente.getDocumentos().size() == 1) {
            throw new ReglaNegocioException("El expediente debe conservar al menos un documento");
        }
        expediente.getDocumentos().remove(documento);
        expediente.setTotalDocumentos(expediente.getDocumentos().size());
        ExpedienteResponse respuesta = mapper.toResponse(expedienteRepository.save(expediente));
        eliminarArchivoAlConfirmar(documento.getRutaArchivo());
        return respuesta;
    }

    @Transactional
    public ExpedienteResponse cambiarEstado(Long id, EstadoExpediente nuevo) {
        Expediente expediente = buscarOFallar(id);
        if (!TRANSICIONES.get(expediente.getEstado()).contains(nuevo)) {
            throw new ReglaNegocioException("No se permite pasar el expediente de "
                    + expediente.getEstado() + " a " + nuevo);
        }
        log.info("Expediente id={} cambia de estado {} -> {}", id, expediente.getEstado(), nuevo);
        expediente.setEstado(nuevo);
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    @Transactional(readOnly = true)
    public List<ExpedienteResumen> buscar(Long personaId, EstadoExpediente estado, LocalDateTime desde,
                                          LocalDateTime hasta, String sortBy, String dir, Long personaRestringida) {
        if (personaRestringida != null) {
            personaId = personaRestringida;
        }
        if (desde != null && hasta != null && desde.isAfter(hasta)) {
            throw new ReglaNegocioException("El rango de fechas es invalido: 'desde' es posterior a 'hasta'");
        }
        Sort.Direction direccion = "asc".equalsIgnoreCase(dir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String campo = CAMPOS_ORDENABLES.contains(sortBy) ? sortBy : "fechaRegistro";
        return expedienteRepository.buscar(personaId, estado, desde, hasta, Sort.by(direccion, campo));
    }

    @Transactional(readOnly = true)
    public ExpedienteResponse obtener(Long id, Long personaRestringida) {
        return mapper.toResponse(buscarPropio(id, personaRestringida));
    }

    @Transactional(readOnly = true)
    public List<DocumentoAdjuntoResponse> listarDocumentos(Long id, Long personaRestringida) {
        return buscarPropio(id, personaRestringida).getDocumentos().stream().map(mapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ExpedienteEstadoReporte> resumen() {
        return expedienteRepository.resumenPorEstado();
    }

    private DocumentoAdjuntoRequest documentoDeArchivo(String nombre, MultipartFile archivo) {
        AlmacenArchivos.ArchivoGuardado guardado = almacen.guardar(archivo);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int estado) {
                if (estado != STATUS_COMMITTED) {
                    almacen.eliminar(guardado.ruta());
                }
            }
        });
        return new DocumentoAdjuntoRequest(nombre, AlmacenArchivos.nombreVisible(archivo), guardado.tipo(),
                guardado.ruta());
    }

    private void eliminarArchivoAlConfirmar(String ruta) {
        if (!AlmacenArchivos.esAlmacenado(ruta)) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                almacen.eliminar(ruta);
            }
        });
    }

    private void validarDocumento(DocumentoAdjuntoRequest documento, Set<String> archivosRegistrados,
                                  boolean desdeAlmacen) {
        if (!desdeAlmacen && AlmacenArchivos.esAlmacenado(documento.rutaArchivo())) {
            throw new ReglaNegocioException("La ruta " + AlmacenArchivos.PREFIJO
                    + " esta reservada para los archivos cargados al sistema");
        }
        if (!documento.tipoDocumento().coincideCon(documento.nombreArchivo())) {
            throw new ReglaNegocioException("El archivo " + documento.nombreArchivo()
                    + " no corresponde al tipo " + documento.tipoDocumento());
        }
        if (!archivosRegistrados.add(documento.nombreArchivo().toLowerCase())) {
            throw new ReglaNegocioException("El archivo " + documento.nombreArchivo()
                    + " esta repetido en el expediente");
        }
    }

    private DocumentoAdjunto nuevoDocumento(DocumentoAdjuntoRequest request) {
        DocumentoAdjunto documento = mapper.toEntity(request);
        documento.setFechaCarga(LocalDateTime.now());
        return documento;
    }

    private Expediente buscarPropio(Long id, Long personaRestringida) {
        Expediente expediente = buscarOFallar(id);
        if (personaRestringida != null && !personaRestringida.equals(expediente.getPersona().getId())) {
            throw new AccesoDenegadoException("No tienes acceso a un expediente de otro estudiante");
        }
        return expediente;
    }

    private static void exigirEditable(Expediente expediente) {
        if (expediente.getEstado() != EstadoExpediente.REGISTRADO
                && expediente.getEstado() != EstadoExpediente.OBSERVADO) {
            throw new ReglaNegocioException("El expediente en estado " + expediente.getEstado()
                    + " no admite cambios en sus documentos");
        }
    }

    private static DocumentoAdjunto documentoDe(Expediente expediente, Long documentoId) {
        return expediente.getDocumentos().stream()
                .filter(d -> d.getId().equals(documentoId))
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Documento " + documentoId
                        + " del expediente " + expediente.getId()));
    }

    private Expediente buscarOFallar(Long id) {
        return expedienteRepository.findDetalladoById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expediente", id));
    }
}
