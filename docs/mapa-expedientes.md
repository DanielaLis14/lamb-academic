# Mapa del módulo de expedientes

Referencia rápida de dónde vive cada pieza del módulo de expedientes, con archivo y número de línea exacto
(verificado contra el commit `02a8c99`). Si el código cambia, las líneas pueden moverse.

**Abreviaturas de rutas**

| Alias | Ruta real |
|---|---|
| `BE/` | `backend/src/main/java/pe/edu/upeu/lambacademic/` |
| `BE-EXP/` | `backend/src/main/java/pe/edu/upeu/lambacademic/baseuniversal/expediente/` |
| `FE/` | `frontend/src/app/` |
| `FE-EXP/` | `frontend/src/app/features/base-universal/expediente/` |
| `SQL/` | `infra/oracle/` |

En las tablas de botones, la línea del HTML es la de la etiqueta de apertura (`<button>` o `<a>`) y la línea del
TS es la de la firma del método.

---

## 1. Código de trámite (TR-AAAA-NNNNN) en cada capa

### Base de datos

| Archivo | Línea | Qué hace |
|---|---|---|
| `SQL/V2__integracion_modulos.sql` | 109 | `UK_EXPEDIENTES_CODIGO` impide que dos expedientes tengan el mismo código. |
| `SQL/V5__catalogos_expediente.sql` | 12 | Comentario de cabecera que anuncia que el servidor genera el código con `SEQ_CODIGO_TRAMITE`. |
| `SQL/V5__catalogos_expediente.sql` | 149 | Bloque PL/SQL anónimo que crea la secuencia. |
| `SQL/V5__catalogos_expediente.sql` | 152 | Calcula el valor inicial: el mayor `NNNNN` existente + 1, para no chocar con códigos previos. |
| `SQL/V5__catalogos_expediente.sql` | 155 | `CREATE SEQUENCE SEQ_CODIGO_TRAMITE ... INCREMENT BY 1 NOCACHE NOCYCLE`. |

### Backend

| Archivo | Línea | Qué hace |
|---|---|---|
| `BE-EXP/entity/Expediente.java` | 39 | Mapea la columna `CODIGO_TRAMITE` (obligatoria y única) al campo `codigoTramite`. |
| `BE-EXP/repository/ExpedienteRepository.java` | 46 | Consulta nativa `SELECT SEQ_CODIGO_TRAMITE.NEXTVAL FROM DUAL`. |
| `BE-EXP/repository/ExpedienteRepository.java` | 47 | Método `siguienteNumeroTramite()` que devuelve ese número. |
| `BE-EXP/repository/ExpedienteRepository.java` | 23 | La proyección del listado incluye `e.codigoTramite` en `ExpedienteResumen`. |
| `BE-EXP/service/ExpedienteService.java` | 461 | `guardarNuevo()`: punto único donde se asigna el código antes de guardar. |
| `BE-EXP/service/ExpedienteService.java` | 462 | Pide el siguiente número a la secuencia. |
| `BE-EXP/service/ExpedienteService.java` | 463 | Arma el texto con `String.format("TR-%d-%05d", año de registro, número)`. |
| `BE-EXP/service/ExpedienteService.java` | 133 | `registrar()` (JSON) termina llamando a `guardarNuevo()`. |
| `BE-EXP/service/ExpedienteService.java` | 176 | `registrarConArchivos()` (multipart) termina llamando a `guardarNuevo()`. |
| `BE-EXP/service/ExpedienteService.java` | 73 | `codigoTramite` está entre los campos por los que se puede ordenar la búsqueda. |
| `BE-EXP/dto/ExpedienteRequest.java` | 15 | DTO de entrada JSON **sin** `codigoTramite` (el comentario de la línea 12 lo explica). |
| `BE-EXP/dto/ExpedienteArchivosRequest.java` | 16 | DTO de entrada multipart **sin** `codigoTramite` (comentario en la línea 13). |
| `BE-EXP/dto/ExpedienteResponse.java` | 12 | El DTO de salida sí devuelve el código generado. |
| `BE-EXP/dto/ExpedienteResumen.java` | 10 | El DTO del listado también devuelve el código. |

### Frontend

| Archivo | Línea | Qué hace |
|---|---|---|
| `FE-EXP/expediente.model.ts` | 94 | `ExpedienteRequest` del frontend, sin `codigoTramite`. |
| `FE-EXP/expediente.model.ts` | 161 | `ExpedienteArchivosRequest` (lo que envía el formulario), sin `codigoTramite`. |
| `FE-EXP/expediente.model.ts` | 107 | `ExpedienteResumen.codigoTramite` recibido en el listado. |
| `FE-EXP/expediente.model.ts` | 120 | `Expediente.codigoTramite` recibido en el detalle. |
| `FE-EXP/expediente-form.html` | 8 | Texto que avisa al usuario que el código lo asigna el sistema. |
| `FE-EXP/expediente-form.ts` | 221 | Aviso de éxito "Expediente TR-… registrado" con el código que devolvió el backend. |
| `FE-EXP/expediente-list.html` | 79 | Columna "Código" de la tabla del listado. |
| `FE-EXP/expediente-detalle.html` | 5 | Título `<h1>` de la página de detalle. |
| `FE-EXP/expediente-detalle.ts` | 230 | Título del diálogo de confirmación al cambiar de estado ("Pasar TR-… a …"). |

---

## 2. Botones del módulo

### Lista (`expediente-list`)

| Botón | HTML (línea) | Método / destino | TS (línea) | Qué hace |
|---|---|---|---|---|
| Nuevo expediente | `FE-EXP/expediente-list.html` 11 | `routerLink="/expedientes/nuevo"` | — | Navega al formulario de registro. |
| Filtrar | `FE-EXP/expediente-list.html` 49 | `(ngSubmit)="cargar()"` del form en la línea 30 | `FE-EXP/expediente-list.ts` 51 | Vuelve a pedir la lista con estado y rango de fechas. |
| Select "Estado" | `FE-EXP/expediente-list.html` 34 | `(ngModelChange)="cargar()"` | `FE-EXP/expediente-list.ts` 51 | Recarga la lista en cuanto cambia el estado elegido. |
| Ver | `FE-EXP/expediente-list.html` 93 | `[routerLink]="['/expedientes', e.id]"` | — | Abre el detalle del expediente de esa fila. |

### Formulario (`expediente-form`)

| Botón | HTML (línea) | Método / destino | TS (línea) | Qué hace |
|---|---|---|---|---|
| Quitar (por línea) | `FE-EXP/expediente-form.html` 151 | `quitarLinea(i)` | `FE-EXP/expediente-form.ts` 180 | Elimina la línea del FormArray; se deshabilita si solo queda una. |
| Agregar documento | `FE-EXP/expediente-form.html` 166 | `agregarLinea()` | `FE-EXP/expediente-form.ts` 165 | Añade una línea con el primer requisito faltante preseleccionado; se deshabilita al llegar a 20. |
| Input de archivo | `FE-EXP/expediente-form.html` 131 | `elegirArchivo(i, $event)` | `FE-EXP/expediente-form.ts` 184 | Guarda el archivo en la línea y propone su nombre si estaba vacío. |
| Registrar expediente | `FE-EXP/expediente-form.html` 248 | `(ngSubmit)="guardar()"` del form en la línea 13 | `FE-EXP/expediente-form.ts` 194 | Valida y envía cabecera, documentos y archivos en un solo multipart (`registrarConArchivos`, `expediente-service.ts` 45). |
| Cancelar | `FE-EXP/expediente-form.html` 251 | `routerLink="/expedientes"` | — | Vuelve al listado sin guardar. |

### Detalle (`expediente-detalle`)

| Botón | HTML (línea) | Método | TS (línea) | Qué hace |
|---|---|---|---|---|
| Pasar a {estado} | `FE-EXP/expediente-detalle.html` 13 | `cambiarEstado(destino)` | `FE-EXP/expediente-detalle.ts` 226 | Confirma en un diálogo y llama `PATCH /{id}/estado` (`expediente-service.ts` 105). |
| Agregar documento | `FE-EXP/expediente-detalle.html` 84 | `nuevoDocumento()` | `FE-EXP/expediente-detalle.ts` 127 | Abre la fila de subida vacía (`editando = 0`). |
| Descargar | `FE-EXP/expediente-detalle.html` 129 | `descargar(d)` | `FE-EXP/expediente-detalle.ts` 181 | Descarga el archivo con el token y lo guarda en el equipo (`expediente-service.ts` 87). |
| Abrir en SharePoint | `FE-EXP/expediente-detalle.html` 134 | `[href]="d.enlace"` | — | Abre el enlace de SharePoint en otra pestaña. |
| Corregir | `FE-EXP/expediente-detalle.html` 145 | `editar(d)` | `FE-EXP/expediente-detalle.ts` 133 | Pone la fila en modo edición según su origen (archivo, enlace o ruta). |
| Quitar | `FE-EXP/expediente-detalle.html` 149 | `eliminar(d)` | `FE-EXP/expediente-detalle.ts` 206 | Confirma y llama `DELETE /{id}/documentos/{documentoId}` (`expediente-service.ts` 101). |
| Radios Archivo / Enlace (subida) | `FE-EXP/expediente-detalle.html` 187 y 188 | `cambiarOrigenSubida()` | `FE-EXP/expediente-detalle.ts` 161 | Limpia el mensaje de error del otro origen. |
| Input de archivo (subida) | `FE-EXP/expediente-detalle.html` 192 | `elegirArchivo($event)` | `FE-EXP/expediente-detalle.ts` 151 | Valida el archivo elegido y propone su nombre. |
| Agregar (fila de subida) | `FE-EXP/expediente-detalle.html` 206 | `subirDocumento()` | `FE-EXP/expediente-detalle.ts` 165 | Valida y envía el documento nuevo por multipart (`expediente-service.ts` 72). |
| Cancelar (fila de subida) | `FE-EXP/expediente-detalle.html` 209 | `cancelarEdicion()` | `FE-EXP/expediente-detalle.ts` 188 | Cierra la fila de subida sin guardar. |
| Guardar (fila en edición) | `FE-EXP/expediente-detalle.html` 279 | `guardarDocumento()` | `FE-EXP/expediente-detalle.ts` 192 | Envía la corrección con `PUT /{id}/documentos/{documentoId}` (`expediente-service.ts` 97). |
| Cancelar (fila en edición) | `FE-EXP/expediente-detalle.html` 282 | `cancelarEdicion()` | `FE-EXP/expediente-detalle.ts` 188 | Cierra la edición sin guardar. |

Todas las acciones del detalle que modifican datos pasan por `ejecutar()` (`FE-EXP/expediente-detalle.ts` 243), que
bloquea los botones con `procesando` y refresca el expediente con la respuesta.

---

## 3. Roles: qué se oculta en el frontend y qué valida el backend

### Frontend (solo presentación; no es la barrera de seguridad)

| Archivo | Línea | Qué hace |
|---|---|---|
| `FE/core/auth/roles.ts` | 18 | `ROLES_COORDINACION` = COORDINADOR y ADMIN. |
| `FE/core/auth/roles.ts` | 22 | `ROLES_EXPEDIENTE` = ESTUDIANTE, COORDINADOR y ADMIN. |
| `FE/core/guards/rol-guard.ts` | 9 | `rolGuard()` redirige a `/sin-permiso` si el usuario no tiene ninguno de los roles. |
| `FE/app.routes.ts` | 291 | Protege `/expedientes` con `rolGuard(...ROLES_EXPEDIENTE)`. |
| `FE/app.routes.ts` | 298 | Protege `/expedientes/nuevo` con el mismo guard. |
| `FE/app.routes.ts` | 305 | Protege `/expedientes/:id` con el mismo guard. |
| `FE/core/layout/menu.ts` | 91 | El ítem del menú solo aparece para `ROLES_EXPEDIENTE`. |
| `FE/core/layout/menu.ts` | 88 | Para el estudiante el ítem se llama "Mis expedientes". |
| `FE-EXP/expediente-list.ts` | 35 | `esCoordinacion` calcula si el usuario es COORDINADOR o ADMIN. |
| `FE-EXP/expediente-list.ts` | 60 | Solo coordinación pide el resumen por estado. |
| `FE-EXP/expediente-list.html` | 17 | Los indicadores por estado solo se muestran a coordinación. |
| `FE-EXP/expediente-list.html` | 67 | La columna "Titular" (cabecera) solo se muestra a coordinación. |
| `FE-EXP/expediente-list.html` | 86 | La celda "Titular" de cada fila solo se muestra a coordinación. |
| `FE-EXP/expediente-form.ts` | 66 | `esCoordinacion` en el formulario. |
| `FE-EXP/expediente-form.html` | 57 | El selector de titular solo se muestra a coordinación. |
| `FE-EXP/expediente-form.ts` | 118 | Para coordinación el titular pasa a ser obligatorio y se cargan las personas (línea 119). |
| `FE-EXP/expediente-form.ts` | 207 | El estudiante envía `personaId: null` (el backend usa la persona de su token). |
| `FE-EXP/expediente-detalle.ts` | 73 | `esCoordinacion` en el detalle. |
| `FE-EXP/expediente-detalle.ts` | 102 | `destinos` devuelve las transiciones permitidas solo si es coordinación; si no, lista vacía. |
| `FE-EXP/expediente-detalle.html` | 10 | Los botones "Pasar a …" solo se pintan si `destinos()` tiene elementos. |
| `FE-EXP/expediente-detalle.ts` | 98 | `editable` depende del estado (REGISTRADO u OBSERVADO), no del rol. |
| `FE-EXP/expediente-detalle.html` | 83 | "Agregar documento" visible solo si es editable, hay cupo y no hay otra edición abierta. |
| `FE-EXP/expediente-detalle.html` | 99 | La columna de acciones (cabecera) solo existe si el expediente es editable. |
| `FE-EXP/expediente-detalle.html` | 143 | Los botones Corregir / Quitar de cada fila solo existen si es editable. |

### Backend (la validación real)

| Archivo | Línea | Qué hace |
|---|---|---|
| `BE/SecurityConfig.java` | 89 | Los GET de catálogos solo exigen sesión iniciada. |
| `BE/SecurityConfig.java` | 90 | `GET /expedientes/resumen` solo para COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 91 | `PATCH /expedientes/*/estado` solo para COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 92 | Los demás GET de expedientes para ESTUDIANTE, COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 93 | POST de expediente y de documentos para ESTUDIANTE, COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 95 | PUT de documentos para ESTUDIANTE, COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 97 | DELETE de documentos para ESTUDIANTE, COORDINADOR y ADMIN. |
| `BE/SecurityConfig.java` | 99 | Cualquier otra ruta de expedientes queda solo para ADMIN. |
| `BE/compartido/seguridad/IdentidadToken.java` | 52 | `estudianteRestringido()` devuelve el alumno del token si es solo ESTUDIANTE, o null si es personal. |
| `BE-EXP/controller/ExpedienteController.java` | 168 | `personaRestringida()` convierte ese alumno en su PERSONA.ID y lo pasa a cada operación. |
| `BE-EXP/service/ExpedienteService.java` | 106 | `personaDeAlumno()` responde 403 si la cuenta apunta a un alumno inexistente. |
| `BE-EXP/service/ExpedienteService.java` | 328 | `titular()` ignora la persona enviada y usa la del token cuando es estudiante. |
| `BE-EXP/service/ExpedienteService.java` | 300 | `buscar()` fuerza el filtro a la persona del estudiante. |
| `BE-EXP/service/ExpedienteService.java` | 603 | `buscarPropio()` lanza `AccesoDenegadoException` si el expediente es de otro estudiante. |
| `BE-EXP/service/ExpedienteService.java` | 611 | `exigirEditable()` rechaza cambios en documentos fuera de REGISTRADO u OBSERVADO (409). |
| `BE-EXP/service/ExpedienteService.java` | 288 | `cambiarEstado()` valida que la transición esté en `TRANSICIONES` (línea 79). |
| `BE/exception/GlobalExceptionHandler.java` | 57 | `AccesoDenegadoException` se responde como 403 (línea 60). |

---

## 4. FormArray, validadores, resumen en vivo y preselección

| Archivo | Línea | Qué hace |
|---|---|---|
| `FE-EXP/expediente-form.ts` | 94 | Crea el FormArray `documentos` con una línea inicial y tres validadores: `alMenosUnaLinea`, `archivosDistintos` y `requisitosYTamano`. |
| `FE-EXP/expediente-form.ts` | 132 | `linea()` arma cada FormGroup (nombre, tipo, origen, archivo, enlace) con el validador `contenidoValido`. |
| `FE-EXP/expediente-form.ts` | 128 | Getter `documentos` que usa la plantilla para llegar al FormArray. |
| `FE-EXP/expediente-form.html` | 92 | `formArrayName="documentos"` enlaza la tabla al FormArray. |
| `FE-EXP/expediente-form.html` | 102 | `@for` que pinta una fila por cada control del FormArray. |
| `FE/shared/validadores.ts` | 33 | `alMenosUnaLinea`: devuelve `{ sinLineas: true }` si el FormArray está vacío. |
| `FE-EXP/expediente-form.ts` | 20 | Importa `alMenosUnaLinea` desde `shared/validadores`. |
| `FE-EXP/expediente-form.ts` | 29 | `contenidoValido`: cada línea debe tener un archivo válido o un enlace institucional, según su origen. |
| `FE-EXP/expediente-form.ts` | 39 | `archivosDistintos`: marca `archivoRepetido` si dos líneas suben archivos con el mismo nombre. |
| `FE-EXP/expediente-form.ts` | 80 | `requisitosYTamano`: marca `tamanoTotal` y `requisitos` usando el mismo cálculo del resumen. |
| `FE-EXP/expediente-form.ts` | 98 | `lineas`: convierte los cambios del FormArray en una señal. |
| `FE-EXP/expediente-form.ts` | 102 | `resumen`: `computed` que recalcula el resumen al cambiar las líneas o el tipo elegido. |
| `FE-EXP/resumen-expediente.ts` | 35 | `resumirExpediente()`: función pura que calcula todo el resumen. |
| `FE-EXP/resumen-expediente.ts` | 36 | Suma el tamaño de los archivos; las líneas con enlace no cuentan. |
| `FE-EXP/resumen-expediente.ts` | 50 | Calcula el porcentaje de la barra (tope 100). |
| `FE-EXP/resumen-expediente.ts` | 51 | Marca `excedido` si se pasa de 25 MB. |
| `FE-EXP/resumen-expediente.ts` | 54 | `cumplidos`: cuántos requisitos obligatorios ya tienen una línea de su tipo. |
| `FE-EXP/resumen-expediente.ts` | 55 | `faltantes`: obligatorios sin línea, en orden de catálogo. |
| `FE-EXP/expediente.model.ts` | 176 | `TAMANO_MAXIMO_EXPEDIENTE` = 25 MB. |
| `FE-EXP/expediente-form.html` | 176 | Muestra "N de 20 documentos". |
| `FE-EXP/expediente-form.html` | 180 | Muestra "Tamaño total: X de 25 MB". |
| `FE-EXP/expediente-form.html` | 183 | Barra de progreso que se pinta en rojo con `barra-excedida`. |
| `FE-EXP/expediente-form.html` | 199 | Muestra "Requisitos cumplidos: X de Y". |
| `FE-EXP/expediente-form.html` | 204 | Lista de obligatorios con la etiqueta Cumplido / Falta. |
| `FE-EXP/expediente-form.html` | 234 | Mensaje de error con los nombres de los obligatorios que faltan. |
| `FE-EXP/expediente-form.html` | 240 | Mensaje de error cuando los archivos superan 25 MB. |
| `FE-EXP/expediente-form.ts` | 161 | Al cambiar el tipo, vuelve a validar el FormArray porque los requisitos cambian. |
| `FE-EXP/expediente-form.ts` | 165 | `agregarLinea()`: crea la línea nueva. |
| `FE-EXP/expediente-form.ts` | 168 | Toma el primer requisito obligatorio que aún falta. |
| `FE-EXP/expediente-form.ts` | 169 | Lo preselecciona como tipo de documento de la línea nueva. |
| `FE-EXP/expediente-form.ts` | 159 | Preselecciona también el destinatario sugerido del tipo de solicitud. |

---

## 5. Catálogos en cascada y reglas de negocio

### Catálogos en cascada (categoría → tipo de solicitud → destinatario y requisitos)

| Archivo | Línea | Qué hace |
|---|---|---|
| `FE-EXP/expediente-form.ts` | 105 | Al abrir el formulario carga las categorías. |
| `FE-EXP/expediente-form.ts` | 109 | Carga los tipos de documento institucional. |
| `FE-EXP/expediente-form.ts` | 113 | Carga los destinatarios. |
| `FE-EXP/expediente-form.ts` | 124 | Escucha cambios de categoría y llama `elegirCategoria()`. |
| `FE-EXP/expediente-form.ts` | 145 | `elegirCategoria()`: vacía los tipos, borra el tipo elegido y pide los de la nueva categoría (línea 149). |
| `FE-EXP/expediente-form.ts` | 125 | Escucha cambios de tipo y llama `elegirTipo()`. |
| `FE-EXP/expediente-form.ts` | 156 | `elegirTipo()`: guarda el tipo con sus requisitos y propone el destinatario sugerido. |
| `FE-EXP/expediente-form.html` | 35 | El select de tipo dice "Primero elige la categoría" mientras no haya categoría. |
| `FE-EXP/expediente-service.ts` | 57 | `tiposSolicitud(categoriaId)` llama `/catalogos/categorias/{id}/tipos-solicitud`. |
| `BE-EXP/controller/CatalogoExpedienteController.java` | 30 | Los catálogos se guardan 5 minutos en la caché privada del navegador. |
| `BE-EXP/controller/CatalogoExpedienteController.java` | 35 | `GET /catalogos/categorias`. |
| `BE-EXP/controller/CatalogoExpedienteController.java` | 41 | `GET /catalogos/categorias/{categoriaId}/tipos-solicitud`. |
| `BE-EXP/controller/CatalogoExpedienteController.java` | 47 | `GET /catalogos/destinatarios`. |
| `BE-EXP/controller/CatalogoExpedienteController.java` | 53 | `GET /catalogos/tipos-documento`. |
| `BE-EXP/service/CatalogoExpedienteService.java` | 41 | `tiposSolicitud()`: devuelve solo los tipos activos de la categoría. |
| `BE-EXP/service/CatalogoExpedienteService.java` | 44 | Una categoría inactiva devuelve lista vacía. |
| `BE-EXP/service/CatalogoExpedienteService.java` | 66 | `tipoResponse()` añade el destinatario sugerido (si está activo, línea 68) y los requisitos vigentes (línea 71). |
| `BE-EXP/service/ExpedienteService.java` | 342 | `clasificar()` vuelve a validar la cascada al registrar: existencia (404) y activo (409). |
| `BE-EXP/service/ExpedienteService.java` | 349 | Si el tipo no pertenece a la categoría lanza `SolicitudIncompletaException` (422). |
| `BE-EXP/service/ExpedienteService.java` | 354 | Sin destinatario enviado usa el sugerido del tipo. |

### Regla 409: un solo expediente en curso por titular y tipo

| Archivo | Línea | Qué hace |
|---|---|---|
| `BE-EXP/service/ExpedienteService.java` | 76 | `ESTADOS_EN_CURSO` = REGISTRADO, EN_REVISION y OBSERVADO. |
| `BE-EXP/service/ExpedienteService.java` | 366 | `exigirSinDuplicado()`: busca un expediente del mismo titular y tipo en esos estados. |
| `BE-EXP/service/ExpedienteService.java` | 371 | Si existe, lanza `ReglaNegocioException` citando su código y estado. |
| `BE-EXP/service/ExpedienteService.java` | 121 | Se aplica en `registrar()`. |
| `BE-EXP/service/ExpedienteService.java` | 156 | Se aplica en `registrarConArchivos()`. |
| `BE-EXP/repository/ExpedienteRepository.java` | 42 | `findByPersonaIdAndTipoSolicitudIdAndEstadoIn()` hace la consulta. |
| `BE/exception/GlobalExceptionHandler.java` | 44 | `ReglaNegocioException` se responde como 409 CONFLICT (línea 47). |
| `SQL/V5__catalogos_expediente.sql` | 113 | Índice único `UX_EXPEDIENTES_TIPO_EN_CURSO`: Oracle repite la regla como última defensa. |
| `BE/exception/GlobalExceptionHandler.java` | 99 | Si Oracle rechaza por ese índice, `DataIntegrityViolationException` también responde 409 (línea 103). |

### Regla 422: faltan documentos obligatorios

| Archivo | Línea | Qué hace |
|---|---|---|
| `BE-EXP/service/ExpedienteService.java` | 403 | `faltantes()`: nombres de los requisitos obligatorios vigentes que no tienen documento de su tipo. |
| `BE-EXP/service/ExpedienteService.java` | 411 | `exigirRequisitos()`: lanza `SolicitudIncompletaException` si falta alguno (línea 414). |
| `BE-EXP/service/ExpedienteService.java` | 124 | Se aplica en `registrar()`. |
| `BE-EXP/service/ExpedienteService.java` | 159 | Se aplica en `registrarConArchivos()`. |
| `BE-EXP/service/ExpedienteService.java` | 420 | `exigirRequisitosAlCorregir()`: la misma regla al corregir o quitar (no aplica a expedientes previos a V5). |
| `BE-EXP/service/ExpedienteService.java` | 248 | Se aplica al corregir un documento. |
| `BE-EXP/service/ExpedienteService.java` | 277 | Se aplica al quitar un documento. |
| `BE/exception/GlobalExceptionHandler.java` | 50 | `SolicitudIncompletaException` se responde como 422 (línea 54). |
| `FE-EXP/expediente-form.ts` | 84 | El frontend adelanta la misma regla con el error `requisitos` del FormArray. |

### Validación del enlace de SharePoint

| Archivo | Línea | Qué hace |
|---|---|---|
| `BE-EXP/service/EnlaceSharePoint.java` | 20 | `DOMINIOS`: solo `upeuedupe.sharepoint.com` y `upeuedupe-my.sharepoint.com`. |
| `BE-EXP/service/EnlaceSharePoint.java` | 31 | `validar()`: limpia espacios y rechaza cualquier enlace no institucional (409). |
| `BE-EXP/service/EnlaceSharePoint.java` | 33 | Rechaza el prefijo reservado del almacén interno. |
| `BE-EXP/service/EnlaceSharePoint.java` | 37 | Rechaza enlaces de más de 1000 caracteres. |
| `BE-EXP/service/EnlaceSharePoint.java` | 47 | Exige https, sin usuario, sin puerto, dominio permitido y que empiece exactamente por `https://dominio/`. |
| `BE-EXP/service/EnlaceSharePoint.java` | 60 | `nombreInterno()`: genera un nombre único por enlace con SHA-256. |
| `BE-EXP/service/ExpedienteService.java` | 162 | Valida los enlaces del registro multipart antes de guardar cualquier archivo. |
| `BE-EXP/service/ExpedienteService.java` | 213 | Valida el enlace al agregar un documento desde el detalle. |
| `BE-EXP/service/ExpedienteService.java` | 482 | Valida el enlace en los documentos por metadatos (JSON). |
| `BE-EXP/service/ExpedienteService.java` | 508 | Rechaza el mismo enlace repetido dentro del expediente. |
| `SQL/V5__catalogos_expediente.sql` | 139 | `CK_DOCUMENTOS_ORIGEN`: Oracle exige archivo o enlace con uno de los dos dominios. |
| `FE-EXP/expediente.model.ts` | 179 | `DOMINIOS_SHAREPOINT` del frontend, igual al backend. |
| `FE-EXP/documento-form.ts` | 20 | `problemaEnlace()`: replica en el navegador las mismas reglas de `EnlaceSharePoint.validar`. |
| `FE-EXP/documento-form.ts` | 41 | `enlaceValido`: validador de Angular basado en `problemaEnlace()` (lo usa la edición del detalle). |
| `FE-EXP/expediente-form.ts` | 33 | `contenidoValido` usa `problemaEnlace()` en las líneas con origen "enlace". |
| `FE-EXP/expediente-detalle.ts` | 168 | `subirDocumento()` revisa el enlace antes de enviarlo. |

---

## 6. Estilos de botones y componentes compartidos

### Clases de botón en `frontend/src/styles.css`

| Clase | Línea | Qué hace |
|---|---|---|
| `.boton` | 297 | Estilo base: borde gris, fondo blanco, alto mínimo de 36 px y ícono con espacio. |
| `.boton:hover:not(:disabled)` | 315 | Fondo azul claro al pasar el cursor. |
| `.boton:disabled` / `[aria-disabled='true']` | 321 | Botón deshabilitado semitransparente y con cursor bloqueado. |
| `.boton svg` | 327 | Íconos Lucide de 16 px dentro del botón. |
| `.boton-primario` | 333 | Botón relleno azul marino para la acción principal. |
| `.boton-primario:hover` | 339 | Azul más oscuro al pasar el cursor. |
| `.boton-peligro` | 345 | Texto y borde rojos para acciones destructivas (Quitar). |
| `.boton-peligro:hover` | 350 | Fondo rojo claro al pasar el cursor. |
| `.boton-texto` | 356 | Botón sin borde ni fondo, como enlace (Ver, Descargar, Corregir). |
| `.boton-texto:hover` | 362 | Mantiene el borde transparente al pasar el cursor. |
| `.boton-pequeno` | 366 | Versión compacta de 30 px para tablas. |
| `.acciones` | 204 | Contenedor flex de botones (encabezado y pie del formulario). |
| `.tabla .col-acciones` | 535 | Columna de acciones de las tablas. |

### Otras clases que usa el módulo en `styles.css`

| Clase | Línea | Qué hace |
|---|---|---|
| `.etiqueta-estado` | 558 | Píldora de estado (también se usa en la lista de requisitos). |
| `.estado-neutro` | 571 | Color gris para "Opcional". |
| `.estado-activo` | 576 | Color verde para "Cumplido" / "Incluido". |
| `.estado-alerta` | 586 | Color de alerta para "Falta". |
| `.progreso .barra` | 860 | Barra del tamaño total. |
| `.origen-documento` | 899 | Grupo de radios Archivo / Enlace. |
| `.resumen-expediente` | 917 | Caja del resumen en vivo. |
| `.resumen-cifras` | 928 | Bloque de documentos y tamaño dentro del resumen. |
| `.progreso .barra.barra-excedida > span` | 944 | Pinta la barra en rojo al pasar de 25 MB. |
| `.lista-requisitos` | 948 | Lista de requisitos obligatorios y recomendados. |

### Componentes y utilidades compartidas que usa el módulo

| Archivo | Línea | Usado en | Qué hace |
|---|---|---|---|
| `FE/shared/componentes/etiqueta-estado.ts` | 41 (selector), 46 (clase) | `expediente-list.html` 23 y 91, `expediente-detalle.html` 40 | `<app-etiqueta-estado>` pinta el estado del expediente como píldora de color. |
| `FE/shared/componentes/estado-vacio.ts` | 8 (selector), 42 (clase) | `expediente-list.html` 103 | `<app-estado-vacio>` muestra el mensaje cuando la lista no tiene expedientes. |
| `FE/shared/componentes/confirmar-dialogo.ts` | 63 (`confirmar()`), 19 (selector), 57 (clase) | `expediente-detalle.ts` 211 y 229 | Abre el diálogo de confirmación de Angular Material antes de quitar un documento o cambiar el estado. |
| `FE/shared/validadores.ts` | 33 | `expediente-form.ts` 94 | `alMenosUnaLinea` exige al menos una línea en el FormArray. |
| `FE/core/services/error-http.ts` | 23 | lista, formulario y detalle | `mensajeHttp()` convierte el error del backend (409, 422, 403…) en un texto para el usuario. |
| `FE/core/guards/rol-guard.ts` | 9 | `app.routes.ts` 291, 298 y 305 | `rolGuard()` impide entrar a las rutas sin el rol adecuado. |
