package pe.edu.upeu.lambacademic.baseuniversal.expediente.mapper;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.CatalogoResumen;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.DocumentoAdjuntoResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.dto.ExpedienteResponse;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.DocumentoAdjunto;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Expediente;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoSolicitud;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.service.AlmacenArchivos;
import pe.edu.upeu.lambacademic.baseuniversal.persona.mapper.PersonaMapper;

@Mapper(componentModel = "spring", uses = PersonaMapper.class, imports = AlmacenArchivos.class)
public interface ExpedienteMapper {

    ExpedienteResponse toResponse(Expediente expediente);

    @Mapping(target = "rutaArchivo",
            expression = "java(AlmacenArchivos.esAlmacenado(documento.getRutaArchivo()) ? null : documento.getRutaArchivo())")
    @Mapping(target = "archivoDisponible", expression = "java(AlmacenArchivos.esAlmacenado(documento.getRutaArchivo()))")
    DocumentoAdjuntoResponse toResponse(DocumentoAdjunto documento);

    CatalogoResumen toResumen(CategoriaTramite categoria);

    CatalogoResumen toResumen(TipoSolicitud tipoSolicitud);

    CatalogoResumen toResumen(Destinatario destinatario);

    CatalogoResumen toResumen(TipoDocumentoInstitucional tipoDocumento);
}
