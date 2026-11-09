package pe.edu.upeu.lambacademic.baseuniversal.expediente.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.TipoDocumentoInstitucional;

import java.util.List;

public interface TipoDocumentoInstitucionalRepository extends JpaRepository<TipoDocumentoInstitucional, Long> {

    List<TipoDocumentoInstitucional> findByActivoTrueOrderByNombreAsc();
}
