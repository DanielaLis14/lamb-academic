# LAMB Academic: integración completa (primera gran entrega)

Rama `integracion/lamb-academic-completo`, a partir de la referencia estable de Matrícula `68e0757`.
Un solo backend (Spring Boot 4, Spring Modulith) y una sola SPA (Angular 22). Ninguna entidad, controlador o
servicio se duplicó: cada aporte se adaptó a los contratos que ya existían.

## 1. Responsabilidades y nombres reales

| Integrante | CRUD independiente | Operación cabecera-detalle | Entidades reales en LAMB |
|---|---|---|---|
| Base Universal (Daniela) | Persona y Alumno | Expediente → DocumentoAdjunto | `PERSONA`, `ALUMNOS`, `EXPEDIENTES`, `DOCUMENTOS_ADJUNTOS` |
| Matrícula | Periodo | Matrícula → DetalleMatrícula | `PERIODOS`, `MATRICULAS`, `DETALLE_MATRICULA` |
| Finanzas (Cristian) | ConceptoPago | CargoEstudiante → DetalleCuenta | `CONCEPTOS_PAGO`, `CARGOS` y sus cuotas (`DetalleCargo`), `PAGOS` |
| Core Oferta | Curso | Sección → HorarioAula | `CURSOS`, `SECCIONES`, `HORARIOS` |
| Core Currículo | Docente | PlanEstudio → Prerrequisito | `PERSONA` de tipo DOCENTE, `PLANES_ESTUDIO`, `DETALLE_PLAN` (con `ID_PRERREQUISITO`) |

- **CargoEstudiante y DetalleCuenta.** En LAMB son el `Cargo` y sus cuotas (`DetalleCargo`). Cada pago se aplica a las cuotas en orden de vencimiento.
- **Docente.** El docente es una `Persona` de tipo DOCENTE. Ningún aporte traía una entidad Docente propia; el CRUD de `/api/v1/docentes` trabaja sobre esa persona.

## 2. Qué se tomó de cada aporte

- **Base Universal.**
  - Se tomaron las reglas de dueño de INTEGRACION.md: el estudiante registra a su nombre y recibe 403 sobre un expediente ajeno.
  - Se tomaron también la corrección y el retiro de documentos mientras el expediente está Registrado u Observado.
  - Las pantallas se rehicieron con el sistema visual de LAMB.
  - **Migración V5 de catálogos de trámite**, ver sección 10:
    - categoría, tipo de solicitud, destinatario y requisitos;
    - código TR-AAAA-NNNNN generado por el servidor;
    - 25 MB por expediente;
    - enlaces de SharePoint junto con la carga de archivos.
  - **Carga real de archivos** (PDF, PNG, JPG; 5 MB por archivo), ver sección 8. Los documentos registrados antes conservan solo su ruta declarada.
- **Core Currículo.**
  - Se integraron las mallas curriculares (listado con filtros, alta transaccional, detalle por ciclo y versionado) y la estructura institucional.
  - Se alinearon con el backend: créditos 1 a 10, código de hasta 25 caracteres y prerrequisito obligatorio de un ciclo anterior.
  - Escribir en mallas e institucional queda solo para ADMIN.
- **Core Oferta.**
  - Se tomó la estructura de CRUD con lista, formulario y baja para Curso.
  - Las secciones con sus horarios siguen en las pantallas existentes, que ya validan cruces de aula y docente.
  - La pantalla de programación del aporte no se incorporó: usaba contratos distintos de los reales.
- **Finanzas.**
  - Se incorporaron conceptos, cargos, pagos y estado de cuenta sobre la API real.
  - **No se incorporó** la pantalla del aporte que, ante un error del servidor, mostraba conceptos, saldos y un cargo inventados.

## 3. Cambios de API

| Método y ruta | Rol | Descripción |
|---|---|---|
| `POST/PUT/DELETE /api/v1/docentes[/{id}]` | ADMIN | CRUD de docente. La baja se rechaza si el docente tiene secciones vigentes. |
| `GET /api/v1/docentes/mi-carga?periodoId` | DOCENTE | Carga del docente del token (claim `docente_id`). |
| `GET /api/v1/matriculas/secciones/{id}/inscritos` | DOCENTE, COORDINADOR, ADMIN | Inscritos vigentes de una sección. El DOCENTE solo ve las secciones que dicta. |
| `PUT/DELETE /api/v1/expedientes/{id}/documentos/{docId}` | ESTUDIANTE, COORDINADOR, ADMIN | Corrige o retira un documento. Exige estado Registrado u Observado y al menos un documento. |
| `GET/POST /api/v1/expedientes...` | ESTUDIANTE (solo los suyos), COORDINADOR, ADMIN | El titular se toma del token del estudiante. |
| `PATCH /api/v1/expedientes/{id}/estado`, `GET /resumen` | COORDINADOR, ADMIN | Revisión y reporte. |
| `GET /api/v1/auth/perfil` | sesión | Agrega `docenteId` y el rol DOCENTE. |

**Reglas nuevas:**
- Un curso con secciones programadas en periodos no cerrados no se desactiva.
- El cargo de una matrícula solo se anula al anular la matrícula.

## 4. Rol DOCENTE (Keycloak)

- `infra/keycloak/realm/lamb-academic-realm.json` incluye el rol DOCENTE y el mapper `docente_id`, para instalaciones nuevas.
- `infra/keycloak/habilitar_docente.py` configura un Keycloak existente de forma idempotente:
  - crea el rol, el atributo `docenteId` y el mapper;
  - crea el usuario `docente.mendoza`.
- El script se niega a usar el puerto 48080 sin `--autorizo-keycloak-principal`. La clave del usuario sale de `infra/secretos` (`generar_secretos.py`) y no se imprime.
- Primero se probó en el Keycloak aislado (48090). Luego, con autorización, se aplicó al Keycloak principal (48080), solo en el realm `lamb-academic`.
- Antes del cambio se respaldó la base de Keycloak (`pg_dump`) y una instantánea legible del realm, en `infra/backups/keycloak-antes-docente-<fecha>/` (carpeta ignorada por Git).
- `infra/keycloak/instantanea_realm.py` guarda y compara instantáneas sin claves. La comparación antes/después muestra solo adiciones: el rol DOCENTE, el mapper `docente_id`, el atributo `docenteId` y el usuario `docente.mendoza` (PERSONA 4).
- DOCENTE no es compuesto, no tiene roles de cliente ni grupos.
- `infra/pruebas/verificar_docente.py` comprueba el rol sin modificar datos: solo consultas y escrituras que SecurityConfig rechaza.

## 5. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| Backend sin Oracle (`mvnw test`, excluye las pruebas de integración con Oracle) | 119/119 |
| Frontend (`ng test`) | 173/173 |
| `ng build` | correcto |
| `matriz_accesos.py` contra el entorno aislado (regresión de Matrícula) | 27/27 |
| `e2e_integracion.py` contra el entorno aislado | 48/48 |
| Revisión en navegador (DOCENTE, COORDINADOR, ESTUDIANTE, CAJERO; 375 px sin desplazamiento horizontal) | correcta |
| `verificar_docente.py` contra el entorno principal (solo lectura) | 47/47 |
| `matriz_accesos.py` contra el entorno principal, con DOCENTE ya habilitado | 27/27 |
| `verificar_keycloak.py` contra el Keycloak principal | 8/8 |
| Roles y claims de los 6 usuarios de prueba | 6/6 |
| Rutas de la SPA con la cuenta docente | 16/16 |
| Consultas de los cuatro módulos en el entorno principal (solo lectura) | 23/23 |

## 6. Cómo ejecutar las pruebas aisladas

```bash
docker start lamb-prueba-oracle lamb-prueba-keycloak-db lamb-prueba-keycloak
python -I infra/keycloak/habilitar_docente.py --keycloak http://localhost:48090 --docente-id 4
# backend con LAMB_DB_URL=jdbc:oracle:thin:@localhost:1542/FREEPDB1 y LAMB_KEYCLOAK_ISSUER=http://localhost:48090/realms/lamb-academic
LAMB_API_URL=http://localhost:8091 LAMB_KEYCLOAK_URL=http://localhost:48090 python -I infra/pruebas/e2e_integracion.py
```

`e2e_integracion.py` registra datos (expedientes, un cargo de trámite con un pago, un curso y un docente de prueba). Por eso se niega a usar el backend 8080 o el Keycloak 48080. No toca matrículas.

## 7. Pendiente

- Migración V5 de expedientes: el código está listo (sección 10). Falta probarla contra Oracle en la base aislada
  (huella, V5, rollback, huella, V5) y aplicarla en desarrollo, solo con autorización.
- Expedientes: en el formulario, cálculo en vivo del tamaño total y de «requisitos X de Y», y preselección del
  requisito que falta.
- Registro de resultados de curso por el docente (hoy lo hace coordinación).

## 8. Pulido visual y carga de archivos

**Diseño.**
- El encabezado muestra el logo UPeU y el módulo real de cada pantalla (ya no siempre «Matrícula»).
- Cada ruta tiene su título de pestaña.
- Tipografía en rem, mayor contraste en etiquetas y textos secundarios, e importes alineados y sin cortes.
- Menú lateral fijo, con grupos plegables cuando el rol tiene más de ocho opciones.
- Nueva pantalla «Mi plan de estudios» para el estudiante.
- Finanzas resalta las cuotas vencidas y muestra el avance de pago de cada cargo.

**Archivos de expedientes, sin cambios de esquema.**
- `POST /api/v1/expedientes` y `POST /api/v1/expedientes/{id}/documentos` aceptan `multipart/form-data`.
- `GET /api/v1/expedientes/{id}/documentos/{docId}/archivo` descarga el archivo. Lo hacen el titular, coordinación o administración; nunca hay una ruta pública.
- Los archivos se guardan en `lamb.archivos.directorio` (variable `LAMB_ARCHIVOS_DIR`; por omisión, `~/lamb-academic-archivos`), fuera de la aplicación.
- El nombre en disco lo genera el servidor (UUID) y el tipo se decide por la firma del contenido.
- En `RUTA_ARCHIVO` se registra `almacen:<clave>`. Esa ruta no se acepta en los metadatos enviados por el usuario.
- Si el registro se revierte, los archivos ya guardados se borran. Al quitar un documento, su archivo se borra al confirmar la operación.

| Prueba | Resultado |
|---|---|
| Backend (`mvnw test`, sin las pruebas de integración con Oracle) | 130/130 |
| Frontend (`ng test`) | 182/182 |
| `e2e_archivos_persistencia.py` (archivos, horarios, prerrequisitos y pagos), entorno aislado | 39/39 |
| Regresión en el entorno aislado con el build nuevo: matriz / integración / docente | 27/27, 48/48, 47/47 |

## 9. Cierre para la revisión del equipo

**Instalación desde cero, comprobada.**
- `V1__esquema_base_matricula.sql` crea las tablas base de Matrícula, que antes no tenían script. Con V1, V2, V4 y
  V3, una base nueva queda igual a la de desarrollo: el backend arranca con `ddl-auto: validate`.
- `V3` agrega el periodo 2026-II (id 4) y el alumno ficticio José Apaza (1033), que usan las cuentas de prueba.
  El historial de Luis queda con IS101 aprobado.
- `infra/oracle/inicializar_base.py` aplica los scripts en orden y se niega si `LAMB_APP` ya tiene tablas.
- `matriz_accesos.py` busca las matrículas y los cargos de prueba en lugar de usar ids de una base concreta.

**Interfaz.**
- La pantalla de inicio reparte los accesos rápidos entre los módulos del rol: una opción de cada grupo por turno.
- La lista de secciones muestra un resumen: secciones, abiertas, abiertas sin vacantes y vacantes disponibles.
  Cada sección abierta y llena lleva la etiqueta «Sin vacantes». Los filtros muestran los estados en español.

| Prueba | Resultado |
|---|---|
| Backend (`mvnw test`, sin las clases que usan Oracle) | 130/130 |
| Pruebas de integración con Oracle (`MatriculaOracle…`, `MatriculaRollback…`, contexto), en la base aislada | 9/9 |
| Frontend (`ng test`) | 185/185 |
| `ng build`, también desde una copia limpia con `npm ci` | correcto |
| Instalación nueva (Oracle, Keycloak y backend creados solo con los scripts): `verificar_keycloak.py` | 8/8 |
| Instalación desde el ZIP, sin matrículas: `matriz_accesos.py` | 22/22 (5 casos omitidos por falta de datos) |
| Instalación desde el ZIP, tras una matrícula de Ana y otra de José: `matriz_accesos.py` / `verificar_docente.py` | 27/27, 47/47 |
| Instalación desde el ZIP: `e2e_integracion.py` / `e2e_archivos_persistencia.py` | 48/48, 39/39 |
| Instalación desde el ZIP: prerrequisito, cruce de horario, vacantes y matrícula duplicada | correcto |

## 10. Base Universal: migración V5 de expedientes (catálogos de trámite)

**Base de datos (`V5__catalogos_expediente.sql`, reversión `V5__rollback.sql`).**
- **Catálogos.** `CATEGORIAS_TRAMITE`, `TIPOS_SOLICITUD` (cada tipo con su categoría y su destinatario sugerido),
  `DESTINATARIOS` y `TIPOS_DOCUMENTO_INSTITUCIONAL`.
- **Requisitos.** `REQUISITOS_TIPO_SOLICITUD` relaciona cada tipo de solicitud con sus tipos de documento (PK
  compuesta y FK a ambas tablas). `OBLIGATORIO` = 1 indica que se exige y 0 que solo se recomienda.
- **Columnas nuevas, todas nullable.**
  - En `EXPEDIENTES`: categoría, tipo de solicitud y destinatario.
  - En `DOCUMENTOS_ADJUNTOS`: tipo de documento institucional, `TAMANO_BYTES` y `ENLACE`.
  - `TIPO_DOCUMENTO` y `RUTA_ARCHIVO` pasan a admitir NULL, solo para los documentos con enlace
    (`CK_DOCUMENTOS_ORIGEN`: archivo **o** enlace institucional).
- **Registros anteriores.** Los expedientes y documentos que ya existían no cambian.
- **Código de trámite.** `SEQ_CODIGO_TRAMITE` empieza después del mayor `TR-AAAA-NNNNN` que ya exista.
- **Un expediente en curso por tipo.** `UX_EXPEDIENTES_TIPO_EN_CURSO` impide que un titular tenga dos expedientes del
  mismo tipo en REGISTRADO, EN_REVISION u OBSERVADO, aunque lleguen dos registros a la vez.
- **Datos iniciales.**

  | Categoría | Tipo de solicitud | Destinatario sugerido | Obligatorios | Recomendados |
  |---|---|---|---|---|
  | Académico | Justificación de inasistencias | Coordinación Académica | FUT | Certificado médico |
  | Académico | Convalidación de cursos | Dirección de Escuela | FUT, Sílabo, Récord de notas, Voucher | — |
  | Académico | Retiro de curso | Coordinación Académica | FUT | — |
  | Académico | Examen rezagado | Coordinación Académica | FUT, Voucher | Certificado médico |
  | Académico | Reserva de matrícula | Secretaría Académica | FUT, Voucher | — |
  | Económico | Devolución de pago | Tesorería | FUT, DNI, Voucher | — |
  | Económico | Fraccionamiento de deuda | Tesorería | FUT | — |
  | Económico | Beca o descuento | Bienestar Universitario | FUT, Récord de notas | Carta de motivos |
  | Constancias | Constancia de estudios | Secretaría Académica | FUT, Voucher | — |
  | Constancias | Certificado de estudios | Secretaría Académica | FUT, Voucher | — |

  El DNI solo se pide para la devolución de dinero, porque la sesión ya identifica al estudiante. «Otro documento»
  existe como tipo y nunca es obligatorio.
- **Instalación.** `inicializar_base.py` aplica V5 después de V4. Una base que ya existía la recibe a mano, con la
  orden del README.
- **Reversión.** `V5__rollback.sql` borra los documentos con enlace (sin la columna `ENLACE` no tienen contenido) y
  recalcula `TOTAL_DOCUMENTOS`.

**Backend (`baseuniversal/expediente`).**
- **Catálogos.** `GET /api/v1/expedientes/catalogos/...` para cualquier sesión (`CatalogoExpedienteController`).
- **Código de trámite.** Lo genera el servidor; se quitó `codigoTramite` del registro JSON y multipart, junto con su
  validación de duplicado.
- **Reglas nuevas.**
  - Los catálogos deben existir (404) y estar activos (409).
  - El tipo de solicitud debe pertenecer a la categoría (422).
  - No puede haber otro expediente del mismo tipo en curso (409, con el código del existente).
  - Deben estar todos los documentos obligatorios (422, con los nombres de los que faltan). La regla también se
    aplica al quitar un documento o cambiarle el tipo.
  - Máximo 25 MB por expediente (`lamb.archivos.tamano-maximo-expediente`). En el registro, todas las reglas se
    revisan antes de guardar el primer archivo.
- **Excepción nueva.** `SolicitudIncompletaException`, que responde 422 en `GlobalExceptionHandler`.
- **Enlaces de SharePoint** (`EnlaceSharePoint`). Solo se aceptan `upeuedupe.sharepoint.com` y
  `upeuedupe-my.sharepoint.com`, sin el prefijo `almacen:`. Un enlace no cuenta para los 25 MB y no se descarga.
- **Sin cambios.** Los estados y transiciones, las reglas de dueño (persona del token y 403 sobre expedientes
  ajenos), el almacén (firma, UUID y borrado al revertir) y los roles.

**Frontend.**
- **Formulario.**
  - Selectores de categoría y tipo de solicitud. El destinatario se propone con el sugerido y se puede cambiar.
  - Se muestran los documentos obligatorios y los recomendados.
  - Cada documento lleva su tipo institucional y, a elección, un archivo o un enlace.
  - Ya no hay campo de código de trámite.
- **Detalle.**
  - Muestra la categoría, el tipo y el destinatario.
  - Cada documento muestra su tipo y, si es un enlace, un botón «Abrir en SharePoint».
  - Al agregar un documento se elige archivo o enlace; al corregirlo se cambia según su origen.
- **Mensajes.** Los errores 422 muestran el mensaje del servidor.

**Scripts e2e.** `e2e_integracion.py`, `e2e_archivos_persistencia.py`, `e2e_repetible.py` y `e2e_demo.py` usan el
contrato nuevo y buscan los catálogos por código. Cubren las reglas nuevas y archivan sus expedientes al terminar,
así que se pueden repetir sin chocar con la regla de duplicado.

| Prueba | Resultado |
|---|---|
| Backend (`mvnw test`, sin las clases que usan Oracle) | 166/166 (antes 130) |
| Frontend (`ng test`) | 188/188 (antes 185) |
| `ng build` | correcto |
| V5 en una base local nueva (V1–V4 y V3), con dos expedientes en formato anterior (uno `TR-2026-00007`) | aplicada; los registros previos no cambian y la secuencia empieza en 8 |
| Verificación de V5: tildes, 23 requisitos, restricciones de origen (6 casos) y un expediente en curso por tipo (3 casos) | correcta |
| Rollback de V5, también con un documento con enlace; huella de datos y estructura antes/después (`estructura_esquema.sql`) | idénticas (88 objetos); el documento con enlace se borra y el total se recalcula |
| V5 aplicada otra vez | correcta |
| Backend completo (`mvnw test`, con las 3 clases de Oracle y la validación del esquema de Hibernate) | 175/175 |
| `matriz_accesos.py` / `verificar_docente.py` / `verificar_keycloak.py` | 22/22 (5 omitidos por falta de datos), 47/47, 8/8 |
| `e2e_integracion.py` (dos ejecuciones seguidas) / `e2e_archivos_persistencia.py` | 60/60 y 60/60 / 48/48 |
| `e2e_repetible.py` | 87/88: los 6 casos de expedientes pasan. El caso de «matrícula previa 1» supone la base de desarrollo original; en una instalación nueva, la matrícula 1 es la de Luis (V3) |

**Corrección encontrada al probar con Oracle.** La primera aplicación de V5 falló con `ORA-12704: character set
mismatch`. En los datos iniciales, `UNISTR(...)` (NVARCHAR2) se combinaba con textos VARCHAR2 en `UNION ALL`. Se
envolvió en `TO_CHAR(UNISTR(...))`. La V5 parcial se revirtió con `V5__rollback.sql` y la base quedó idéntica a la
huella inicial.

**`e2e_demo.py`** no se ejecutó: es histórico, no usa token (es anterior a Keycloak) y no es repetible. Solo se
actualizaron sus cuerpos al contrato nuevo.
