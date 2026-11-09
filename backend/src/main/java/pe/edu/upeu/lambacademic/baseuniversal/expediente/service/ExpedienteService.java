package pe.edu.upeu.lambacademic.baseuniversal.expediente.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;
import pe.edu.upeu.lambacademic.baseuniversal.alumno.repository.AlumnoRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoArchivoRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteArchivosRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteEstadoReporte;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteRequest;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.DocumentoAdjunto;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.EstadoExpediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoArchivo;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.mapper.ExpedienteMapper;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.CategoriaTramiteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.DestinatarioRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.ExpedienteRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoDocumentoInstitucionalRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.repository.TipoSolicitudRepository;
import pe.edu.upeu.lambacademic.baseuniversal.persona.entity.Persona;
import pe.edu.upeu.lambacademic.baseuniversal.persona.repository.PersonaRepository;
import pe.edu.upeu.lambacademic.exception.AccesoDenegadoException;
import pe.edu.upeu.lambacademic.exception.ReglaNegocioException;
import pe.edu.upeu.lambacademic.exception.ResourceNotFoundException;
import pe.edu.upeu.lambacademic.exception.SolicitudIncompletaException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Operacion cabecera-detalle Expediente - DocumentoAdjunto (origen: LP2_L, reescrita).
 * registrar() es atomico: si un documento viola una regla, no queda ni la cabecera
 * ni ningun documento (rollback por excepcion no controlada, S4 2.5).
 *
 * Desde V5 cada expediente tiene categoria, tipo de solicitud y destinatario de los catalogos, el codigo
 * TR-AAAA-NNNNN lo genera el servidor y cada documento lleva su tipo institucional. Un documento tiene un
 * archivo cargado, una ruta declarada (registros previos) o un enlace institucional de SharePoint.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExpedienteService {

    private static final int MAX_DOCUMENTOS = 20;

    private static final Set<String> CAMPOS_ORDENABLES = Set.of("fechaRegistro", "codigoTramite", "estado", "id");

    /** Un titular no tiene dos expedientes del mismo tipo en estos estados (UX_EXPEDIENTES_TIPO_EN_CURSO). */
    private static final Set<EstadoExpediente> ESTADOS_EN_CURSO =
            EnumSet.of(EstadoExpediente.REGISTRADO, EstadoExpediente.EN_REVISION, EstadoExpediente.OBSERVADO);

    private static final Map<EstadoExpediente, Set<EstadoExpediente>> TRANSICIONES = Map.of(
            EstadoExpediente.REGISTRADO, Set.of(EstadoExpediente.EN_REVISION, EstadoExpediente.ARCHIVADO),
            EstadoExpediente.EN_REVISION, Set.of(EstadoExpediente.OBSERVADO, EstadoExpediente.APROBADO),
            EstadoExpediente.OBSERVADO, Set.of(EstadoExpediente.EN_REVISION, EstadoExpediente.ARCHIVADO),
            EstadoExpediente.APROBADO, Set.of(EstadoExpediente.ARCHIVADO),
            EstadoExpediente.ARCHIVADO, Set.of());

    private final ExpedienteRepository expedienteRepository;
    private final PersonaRepository personaRepository;
    private final AlumnoRepository alumnoRepository;
    private final CategoriaTramiteRepository categoriaRepository;
    private final TipoSolicitudRepository tipoSolicitudRepository;
    private final DestinatarioRepository destinatarioRepository;
    private final TipoDocumentoInstitucionalRepository tipoDocumentoRepository;
    private final ExpedienteMapper mapper;
    private final AlmacenArchivos almacen;

    /** Archivo de un documento listo para descargar por el endpoint protegido. */
    public record ArchivoDescarga(Resource recurso, String nombreArchivo, TipoArchivo tipo) {
    }

    /** Categoria, tipo de solicitud y destinatario ya validados contra los catalogos. */
    private record Clasificacion(CategoriaTramite categoria, TipoSolicitud tipo, Destinatario destinatario) {
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
        Persona persona = titular(request.personaId(), personaRestringida);
        Clasificacion clasificacion = clasificar(request.categoriaId(), request.tipoSolicitudId(),
                request.destinatarioId());
        exigirSinDuplicado(persona, clasificacion.tipo());
        Map<Long, TipoDocumentoInstitucional> tipos = tiposDocumento(request.documentos().stream()
                .map(DocumentoAdjuntoRequest::tipoDocumentoInstitucionalId).toList());
        exigirRequisitos(clasificacion.tipo(), tipos.keySet());

        Expediente expediente = nuevoExpediente(request.asunto(), persona, clasificacion);
        Set<String> archivos = new HashSet<>();
        for (DocumentoAdjuntoRequest datos : request.documentos()) {
            DocumentoAdjunto documento = documentoPorMetadatos(datos, archivos);
            documento.setTipoDocumentoInstitucional(tipos.get(datos.tipoDocumentoInstitucionalId()));
            expediente.agregarDocumento(documento);
        }
        return guardarNuevo(expediente);
    }

    /**
     * Registro con archivos reales y enlaces en una sola transaccion. Todas las reglas se revisan antes de
     * guardar el primer archivo; si la transaccion no se confirma, los archivos ya guardados se borran.
     * Las partes "archivos" se asignan, en orden, a los documentos sin enlace.
     */
    @Transactional
    public ExpedienteResponse registrarConArchivos(ExpedienteArchivosRequest datos, List<MultipartFile> archivos,
                                                   Long personaRestringida) {
        List<MultipartFile> recibidos = archivos == null ? List.of() : archivos;
        List<DocumentoArchivoRequest> documentos = datos.documentos();
        if (documentos.size() > MAX_DOCUMENTOS) {
            throw new ReglaNegocioException("Un expediente admite como maximo " + MAX_DOCUMENTOS + " documentos");
        }
        long sinEnlace = documentos.stream().filter(d -> !EnlaceSharePoint.indicado(d.enlace())).count();
        if (recibidos.size() != sinEnlace) {
            throw new ReglaNegocioException("Adjunta un archivo por cada documento sin enlace de SharePoint ("
                    + sinEnlace + " documento(s) sin enlace, " + recibidos.size() + " archivo(s) recibidos)");
        }
        Persona persona = titular(datos.personaId(), personaRestringida);
        Clasificacion clasificacion = clasificar(datos.categoriaId(), datos.tipoSolicitudId(), datos.destinatarioId());
        exigirSinDuplicado(persona, clasificacion.tipo());
        Map<Long, TipoDocumentoInstitucional> tipos = tiposDocumento(documentos.stream()
                .map(DocumentoArchivoRequest::tipoDocumentoInstitucionalId).toList());
        exigirRequisitos(clasificacion.tipo(), tipos.keySet());
        exigirTamanoTotal(0, recibidos.stream().mapToLong(MultipartFile::getSize).sum());
        List<String> enlaces = documentos.stream()
                .map(d -> EnlaceSharePoint.indicado(d.enlace()) ? EnlaceSharePoint.validar(d.enlace()) : null)
                .toList();

        Expediente expediente = nuevoExpediente(datos.asunto(), persona, clasificacion);
        Set<String> nombresArchivo = new HashSet<>();
        Iterator<MultipartFile> siguienteArchivo = recibidos.iterator();
        for (int i = 0; i < documentos.size(); i++) {
            DocumentoArchivoRequest datosDocumento = documentos.get(i);
            DocumentoAdjunto documento = enlaces.get(i) != null
                    ? documentoConEnlace(datosDocumento.nombre(), enlaces.get(i), nombresArchivo)
                    : documentoConArchivo(datosDocumento.nombre(), siguienteArchivo.next(), nombresArchivo);
            documento.setTipoDocumentoInstitucional(tipos.get(datosDocumento.tipoDocumentoInstitucionalId()));
            expediente.agregarDocumento(documento);
        }
        return guardarNuevo(expediente);
    }

    /** Agrega un documento por metadatos (ruta declarada o enlace) a un expediente que admite cambios. */
    @Transactional
    public ExpedienteResponse agregarDocumento(Long id, DocumentoAdjuntoRequest request, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        exigirCupo(expediente);
        TipoDocumentoInstitucional tipo = tipoDocumento(request.tipoDocumentoInstitucionalId());
        DocumentoAdjunto documento = documentoPorMetadatos(request, nombresArchivo(expediente, null));
        documento.setTipoDocumentoInstitucional(tipo);
        expediente.agregarDocumento(documento);
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /**
     * Agrega un documento con su archivo real (PDF, PNG o JPG) o con un enlace de SharePoint, solo uno de los
     * dos, a un expediente que admite cambios. El archivo cuenta para el tamano total del expediente.
     */
    @Transactional
    public ExpedienteResponse agregarArchivo(Long id, String nombre, Long tipoDocumentoInstitucionalId,
                                             MultipartFile archivo, String enlace, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        exigirCupo(expediente);
        if (nombre == null || nombre.isBlank() || nombre.length() > 150) {
            throw new ReglaNegocioException("Indica el nombre del documento (hasta 150 caracteres)");
        }
        boolean conEnlace = EnlaceSharePoint.indicado(enlace);
        if ((archivo != null) == conEnlace) {
            throw new ReglaNegocioException("Adjunta un archivo o pega un enlace de SharePoint (solo uno de los dos)");
        }
        TipoDocumentoInstitucional tipo = tipoDocumento(tipoDocumentoInstitucionalId);
        Set<String> nombresArchivo = nombresArchivo(expediente, null);
        DocumentoAdjunto documento;
        if (conEnlace) {
            documento = documentoConEnlace(nombre.strip(), EnlaceSharePoint.validar(enlace), nombresArchivo);
        } else {
            exigirTamanoTotal(tamanoUsado(expediente), archivo.getSize());
            documento = documentoConArchivo(nombre.strip(), archivo, nombresArchivo);
        }
        documento.setTipoDocumentoInstitucional(tipo);
        expediente.agregarDocumento(documento);
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /** Archivo de un documento: el titular y el personal autorizado; nunca por una ruta publica. */
    @Transactional(readOnly = true)
    public ArchivoDescarga descargar(Long id, Long documentoId, Long personaRestringida) {
        DocumentoAdjunto documento = documentoDe(buscarPropio(id, personaRestringida), documentoId);
        if (documento.tieneEnlace()) {
            throw new ResourceNotFoundException("El documento " + documentoId
                    + " es un enlace de SharePoint: se abre desde su enlace, no se descarga del almacen");
        }
        return new ArchivoDescarga(almacen.leer(documento.getRutaArchivo()), documento.getNombreArchivo(),
                documento.getTipoDocumento());
    }

    /**
     * Corrige un documento mientras el expediente admite cambios. Con archivo cargado solo cambian el nombre y
     * el tipo institucional; con ruta declarada o enlace tambien su origen. Los requisitos deben seguir cumplidos.
     */
    @Transactional
    public ExpedienteResponse actualizarDocumento(Long id, Long documentoId, DocumentoAdjuntoRequest request,
                                                  Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        DocumentoAdjunto documento = documentoDe(expediente, documentoId);
        TipoDocumentoInstitucional tipo = tipoDocumento(request.tipoDocumentoInstitucionalId());
        List<Long> tiposResultantes = tiposDeOtrosDocumentos(expediente, documentoId);
        tiposResultantes.add(tipo.getId());
        exigirRequisitosAlCorregir(expediente, tiposResultantes);

        if (AlmacenArchivos.esAlmacenado(documento.getRutaArchivo())) {
            // El archivo cargado no se reemplaza con metadatos.
            documento.setNombre(request.nombre());
            documento.setTipoDocumentoInstitucional(tipo);
            return mapper.toResponse(expedienteRepository.save(expediente));
        }
        DocumentoAdjunto corregido = documentoPorMetadatos(request, nombresArchivo(expediente, documentoId));
        documento.setNombre(corregido.getNombre());
        documento.setTipoDocumentoInstitucional(tipo);
        documento.setNombreArchivo(corregido.getNombreArchivo());
        documento.setTipoDocumento(corregido.getTipoDocumento());
        documento.setRutaArchivo(corregido.getRutaArchivo());
        documento.setEnlace(corregido.getEnlace());
        documento.setTamanoBytes(null);
        documento.setFechaCarga(LocalDateTime.now());
        return mapper.toResponse(expedienteRepository.save(expediente));
    }

    /** Quita un documento; el expediente nunca queda sin documentos ni sin sus documentos obligatorios. */
    @Transactional
    public ExpedienteResponse eliminarDocumento(Long id, Long documentoId, Long personaRestringida) {
        Expediente expediente = buscarPropio(id, personaRestringida);
        exigirEditable(expediente);
        DocumentoAdjunto documento = documentoDe(expediente, documentoId);
        if (expediente.getDocumentos().size() == 1) {
            throw new ReglaNegocioException("El expediente debe conservar al menos un documento");
        }
        exigirRequisitosAlCorregir(expediente, tiposDeOtrosDocumentos(expediente, documentoId));
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

    // ------------------------------------------------------------------ cabecera y catalogos

    private Persona titular(Long personaEnviada, Long personaRestringida) {
        Long personaId = personaRestringida != null ? personaRestringida : personaEnviada;
        if (personaId == null) {
            throw new ReglaNegocioException("Indica la persona titular del expediente");
        }
        Persona persona = personaRepository.findWithEscuelaById(personaId)
                .orElseThrow(() -> new ResourceNotFoundException("Persona", personaId));
        if (!Boolean.TRUE.equals(persona.getActivo())) {
            throw new ReglaNegocioException("La persona " + persona.getId() + " esta inactiva");
        }
        return persona;
    }

    /** Catalogos existentes (404) y activos (409); el tipo debe ser de la categoria (422). */
    private Clasificacion clasificar(Long categoriaId, Long tipoSolicitudId, Long destinatarioId) {
        CategoriaTramite categoria = categoriaRepository.findById(categoriaId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria de tramite", categoriaId));
        exigirActivo(categoria.getActivo(), "La categoria " + categoria.getNombre() + " esta inactiva");
        TipoSolicitud tipo = tipoSolicitudRepository.findDetalladoById(tipoSolicitudId)
                .orElseThrow(() -> new ResourceNotFoundException("Tipo de solicitud", tipoSolicitudId));
        exigirActivo(tipo.getActivo(), "El tipo de solicitud " + tipo.getNombre() + " esta inactivo");
        if (!Objects.equals(tipo.getCategoria().getId(), categoria.getId())) {
            throw new SolicitudIncompletaException("El tipo de solicitud " + tipo.getNombre()
                    + " no pertenece a la categoria " + categoria.getNombre());
        }
        Destinatario destinatario;
        if (destinatarioId == null) {
            destinatario = tipo.getDestinatarioSugerido();
            exigirActivo(destinatario.getActivo(), "El destinatario sugerido " + destinatario.getNombre()
                    + " esta inactivo; elige otro destinatario");
        } else {
            destinatario = destinatarioRepository.findById(destinatarioId)
                    .orElseThrow(() -> new ResourceNotFoundException("Destinatario", destinatarioId));
            exigirActivo(destinatario.getActivo(), "El destinatario " + destinatario.getNombre() + " esta inactivo");
        }
        return new Clasificacion(categoria, tipo, destinatario);
    }

    private void exigirSinDuplicado(Persona persona, TipoSolicitud tipo) {
        expedienteRepository.findByPersonaIdAndTipoSolicitudIdAndEstadoIn(persona.getId(), tipo.getId(),
                        ESTADOS_EN_CURSO).stream()
                .findFirst()
                .ifPresent(existente -> {
                    throw new ReglaNegocioException("Ya existe el expediente " + existente.getCodigoTramite()
                            + " de " + tipo.getNombre() + " en estado " + existente.getEstado()
                            + " para este titular. Debe aprobarse o archivarse antes de registrar otro del mismo tipo");
                });
    }

    /** Tipos de documento institucional existentes (404) y activos (409), por id. */
    private Map<Long, TipoDocumentoInstitucional> tiposDocumento(Collection<Long> ids) {
        Map<Long, TipoDocumentoInstitucional> encontrados = tipoDocumentoRepository.findAllById(new HashSet<>(ids))
                .stream()
                .collect(Collectors.toMap(TipoDocumentoInstitucional::getId, Function.identity()));
        for (Long id : new LinkedHashSet<>(ids)) {
            TipoDocumentoInstitucional tipo = encontrados.get(id);
            if (tipo == null) {
                throw new ResourceNotFoundException("Tipo de documento institucional", id);
            }
            exigirActivo(tipo.getActivo(), "El tipo de documento " + tipo.getNombre() + " esta inactivo");
        }
        return encontrados;
    }

    private TipoDocumentoInstitucional tipoDocumento(Long id) {
        if (id == null) {
            throw new ReglaNegocioException("Indica el tipo de documento institucional");
        }
        TipoDocumentoInstitucional tipo = tipoDocumentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tipo de documento institucional", id));
        exigirActivo(tipo.getActivo(), "El tipo de documento " + tipo.getNombre() + " esta inactivo");
        return tipo;
    }

    /** Nombres de los documentos obligatorios (vigentes) del tipo que no estan entre los tipos presentes. */
    private static List<String> faltantes(TipoSolicitud tipo, Collection<Long> tiposPresentes) {
        return tipo.requisitosVigentes().stream()
                .filter(r -> Boolean.TRUE.equals(r.getObligatorio()))
                .filter(r -> !tiposPresentes.contains(r.getTipoDocumento().getId()))
                .map(r -> r.getTipoDocumento().getNombre())
                .toList();
    }

    private static void exigirRequisitos(TipoSolicitud tipo, Collection<Long> tiposPresentes) {
        List<String> faltan = faltantes(tipo, tiposPresentes);
        if (!faltan.isEmpty()) {
            throw new SolicitudIncompletaException("Faltan documentos obligatorios para " + tipo.getNombre()
                    + ": " + String.join(", ", faltan));
        }
    }

    /** Al corregir o quitar: los expedientes previos a V5 (sin tipo) no tienen requisitos. */
    private static void exigirRequisitosAlCorregir(Expediente expediente, Collection<Long> tiposResultantes) {
        TipoSolicitud tipo = expediente.getTipoSolicitud();
        if (tipo == null) {
            return;
        }
        List<String> faltan = faltantes(tipo, tiposResultantes);
        if (!faltan.isEmpty()) {
            throw new SolicitudIncompletaException("El expediente debe conservar los documentos obligatorios de "
                    + tipo.getNombre() + ". Faltaria: " + String.join(", ", faltan));
        }
    }

    private static List<Long> tiposDeOtrosDocumentos(Expediente expediente, Long documentoId) {
        List<Long> tipos = new ArrayList<>();
        for (DocumentoAdjunto d : expediente.getDocumentos()) {
            if (!d.getId().equals(documentoId) && d.getTipoDocumentoInstitucional() != null) {
                tipos.add(d.getTipoDocumentoInstitucional().getId());
            }
        }
        return tipos;
    }

    private static void exigirActivo(Boolean activo, String mensaje) {
        if (!Boolean.TRUE.equals(activo)) {
            throw new ReglaNegocioException(mensaje);
        }
    }

    private static Expediente nuevoExpediente(String asunto, Persona persona, Clasificacion clasificacion) {
        Expediente expediente = new Expediente();
        expediente.setAsunto(asunto);
        expediente.setPersona(persona);
        expediente.setCategoria(clasificacion.categoria());
        expediente.setTipoSolicitud(clasificacion.tipo());
        expediente.setDestinatario(clasificacion.destinatario());
        expediente.setFechaRegistro(LocalDateTime.now());
        expediente.setEstado(EstadoExpediente.REGISTRADO);
        return expediente;
    }

    /** Codigo TR-AAAA-NNNNN con el anio del registro y la secuencia SEQ_CODIGO_TRAMITE. */
    private ExpedienteResponse guardarNuevo(Expediente expediente) {
        Long numero = expedienteRepository.siguienteNumeroTramite();
        expediente.setCodigoTramite(String.format(Locale.ROOT, "TR-%d-%05d",
                expediente.getFechaRegistro().getYear(), numero));
        Expediente guardado = expedienteRepository.save(expediente);
        log.info("Expediente registrado id={} codigo={} tipo={} documentos={}", guardado.getId(),
                guardado.getCodigoTramite(), guardado.getTipoSolicitud().getCodigo(), guardado.getTotalDocumentos());
        return mapper.toResponse(guardado);
    }

    // ------------------------------------------------------------------ documentos

    /** Documento por metadatos: ruta declarada (nombre, tipo y ruta del archivo) o enlace, no ambos. */
    private DocumentoAdjunto documentoPorMetadatos(DocumentoAdjuntoRequest datos, Set<String> nombresArchivo) {
        boolean conEnlace = EnlaceSharePoint.indicado(datos.enlace());
        boolean conRuta = conTexto(datos.nombreArchivo()) || datos.tipoDocumento() != null
                || conTexto(datos.rutaArchivo());
        if (conEnlace && conRuta) {
            throw new ReglaNegocioException("Un documento lleva la ruta de un archivo o un enlace de SharePoint, no ambos");
        }
        if (conEnlace) {
            return documentoConEnlace(datos.nombre(), EnlaceSharePoint.validar(datos.enlace()), nombresArchivo);
        }
        if (!conTexto(datos.nombreArchivo()) || datos.tipoDocumento() == null || !conTexto(datos.rutaArchivo())) {
            throw new ReglaNegocioException("Indica el nombre, el tipo y la ruta del archivo, o un enlace de SharePoint");
        }
        if (AlmacenArchivos.esAlmacenado(datos.rutaArchivo())) {
            throw new ReglaNegocioException("La ruta " + AlmacenArchivos.PREFIJO
                    + " esta reservada para los archivos cargados al sistema");
        }
        if (!datos.tipoDocumento().coincideCon(datos.nombreArchivo())) {
            throw new ReglaNegocioException("El archivo " + datos.nombreArchivo()
                    + " no corresponde al tipo " + datos.tipoDocumento());
        }
        registrarNombre(nombresArchivo, datos.nombreArchivo());
        DocumentoAdjunto documento = new DocumentoAdjunto();
        documento.setNombre(datos.nombre());
        documento.setNombreArchivo(datos.nombreArchivo());
        documento.setTipoDocumento(datos.tipoDocumento());
        documento.setRutaArchivo(datos.rutaArchivo());
        documento.setFechaCarga(LocalDateTime.now());
        return documento;
    }

    /** Enlace ya validado: sin archivo, sin tamano y con un nombre interno unico por enlace. */
    private static DocumentoAdjunto documentoConEnlace(String nombre, String enlace, Set<String> nombresArchivo) {
        String interno = EnlaceSharePoint.nombreInterno(enlace);
        if (!nombresArchivo.add(interno)) {
            throw new ReglaNegocioException("El enlace " + enlace + " esta repetido en el expediente");
        }
        DocumentoAdjunto documento = new DocumentoAdjunto();
        documento.setNombre(nombre);
        documento.setNombreArchivo(interno);
        documento.setEnlace(enlace);
        documento.setFechaCarga(LocalDateTime.now());
        return documento;
    }

    /** Guarda el archivo en el almacen; se borra si la transaccion no se confirma. */
    private DocumentoAdjunto documentoConArchivo(String nombre, MultipartFile archivo, Set<String> nombresArchivo) {
        AlmacenArchivos.ArchivoGuardado guardado = almacen.guardar(archivo);
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int estado) {
                if (estado != STATUS_COMMITTED) {
                    almacen.eliminar(guardado.ruta());
                }
            }
        });
        String nombreArchivo = AlmacenArchivos.nombreVisible(archivo);
        registrarNombre(nombresArchivo, nombreArchivo);
        DocumentoAdjunto documento = new DocumentoAdjunto();
        documento.setNombre(nombre);
        documento.setNombreArchivo(nombreArchivo);
        documento.setTipoDocumento(guardado.tipo());
        documento.setRutaArchivo(guardado.ruta());
        documento.setTamanoBytes(guardado.tamano());
        documento.setFechaCarga(LocalDateTime.now());
        return documento;
    }

    private static void registrarNombre(Set<String> nombresArchivo, String nombreArchivo) {
        if (!nombresArchivo.add(nombreArchivo.toLowerCase(Locale.ROOT))) {
            throw new ReglaNegocioException("El archivo " + nombreArchivo + " esta repetido en el expediente");
        }
    }

    private static Set<String> nombresArchivo(Expediente expediente, Long excluido) {
        Set<String> nombres = new HashSet<>();
        expediente.getDocumentos().stream()
                .filter(d -> !d.getId().equals(excluido))
                .forEach(d -> nombres.add(d.getNombreArchivo().toLowerCase(Locale.ROOT)));
        return nombres;
    }

    /** Bytes de los archivos cargados; los enlaces y las rutas declaradas no cuentan. */
    private long tamanoUsado(Expediente expediente) {
        long total = 0;
        for (DocumentoAdjunto d : expediente.getDocumentos()) {
            if (d.getTamanoBytes() != null) {
                total += d.getTamanoBytes();
            } else if (AlmacenArchivos.esAlmacenado(d.getRutaArchivo())) {
                total += almacen.tamano(d.getRutaArchivo());
            }
        }
        return total;
    }

    private void exigirTamanoTotal(long usado, long nuevo) {
        long maximo = almacen.tamanoMaximoExpediente();
        if (usado + nuevo > maximo) {
            throw new ReglaNegocioException("Los archivos del expediente sumarian " + megas(usado + nuevo)
                    + " y el maximo es " + megas(maximo) + " por expediente (los enlaces de SharePoint no cuentan)");
        }
    }

    private static String megas(long bytes) {
        return String.format(Locale.ROOT, "%.1f MB", bytes / (1024.0 * 1024.0));
    }

    private static boolean conTexto(String valor) {
        return valor != null && !valor.isBlank();
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

    private static void exigirCupo(Expediente expediente) {
        if (expediente.getDocumentos().size() >= MAX_DOCUMENTOS) {
            throw new ReglaNegocioException("El expediente ya tiene el maximo de " + MAX_DOCUMENTOS + " documentos");
        }
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
