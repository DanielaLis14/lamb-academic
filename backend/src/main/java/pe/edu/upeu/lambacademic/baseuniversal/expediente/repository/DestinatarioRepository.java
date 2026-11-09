package pe.edu.upeu.lambacademic.baseuniversal.expediente.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pe.edu.upeu.lambacademic.baseuniversal.expediente.entity.Destinatario;

import java.util.List;

public interface DestinatarioRepository extends JpaRepository<Destinatario, Long> {

    List<Destinatario> findByActivoTrueOrderByNombreAsc();
}
