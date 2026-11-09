package pe.edu.upeu.lambacademic.baseuniversal.expediente.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.CategoriaTramite;

import java.util.List;

public interface CategoriaTramiteRepository extends JpaRepository<CategoriaTramite, Long> {

    List<CategoriaTramite> findByActivoTrueOrderByNombreAsc();
}
