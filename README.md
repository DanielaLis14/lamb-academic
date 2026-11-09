# LAMB Academic

Sistema académico universitario integrado. Un solo backend REST (Spring Boot 4 + Spring Modulith, Java 21) sobre
Oracle, protegido con Keycloak, y una sola SPA Angular 22. Reúne Base Universal, Matrícula, Core Académico y Finanzas.

Esta guía levanta el sistema completo en una computadora nueva, con **sus propias claves** y **datos ficticios**.
Ningún dato ni clave de otra computadora viaja con el código.

## 1. Requisitos

| Software | Versión | Uso |
|---|---|---|
| Docker Desktop | reciente | Oracle 23ai Free, Keycloak 26 y su PostgreSQL |
| Java (JDK) | 21 | backend (`mvnw` descarga Maven; no hace falta instalarlo) |
| Node.js y npm | 24 | frontend |
| Python | 3.10 o superior | scripts de inicialización y pruebas (sin paquetes extra) |

Puertos que se usan (solo en `127.0.0.1`): 1522 Oracle, 48080 Keycloak, 45432 PostgreSQL de Keycloak,
8080 backend, 4200 frontend. Los comandos son para PowerShell en Windows; desde la raíz del proyecto.

## 2. Variables de entorno y claves

Los archivos `.env` y la carpeta `infra/secretos/` **no se versionan**. Cada integrante crea los suyos:

```powershell
Copy-Item infra\.env.example infra\.env
Copy-Item backend\.env.example backend\.env
```

1. En `infra/.env`, escriba dos claves propias: `ORACLE_PASSWORD` (usuario SYSTEM) y `APP_USER_PASSWORD`
   (usuario LAMB_APP). Al menos 12 caracteres, con mayúsculas, minúsculas y números.
2. En `backend/.env`, ponga en `LAMB_DB_PASSWORD` la misma clave que `APP_USER_PASSWORD`.
3. Genere las claves de Keycloak y de las cuentas de prueba. No se muestran en pantalla.
   - Las de Keycloak (administrador y su base de datos) se agregan a `infra/.env`.
   - Las de las cuentas de prueba quedan en `infra/secretos/keycloak-usuarios.env`.

   ```powershell
   python -I infra/keycloak/generar_secretos.py
   ```

4. Opcional: active el bloqueo que impide confirmar secretos por error: `git config core.hooksPath .githooks`.

Otras variables, todas opcionales:

| Variable | Valor por omisión | Para qué sirve |
|---|---|---|
| `LAMB_DB_URL` | `jdbc:oracle:thin:@localhost:1522/FREEPDB1` | Base de datos |
| `LAMB_KEYCLOAK_ISSUER` | `http://localhost:48080/realms/lamb-academic` | Servidor de identidad |
| `LAMB_ARCHIVOS_DIR` | `~/lamb-academic-archivos` | Almacén privado de los documentos de expedientes |

## 3. Docker: Oracle y Keycloak

```powershell
cd infra
docker compose -f compose-dev.yml up -d
cd ..
```

- **Oracle**: la primera vez tarda uno o dos minutos. Cree el esquema y cargue los datos de demostración:

  ```powershell
  python -I infra/oracle/inicializar_base.py
  ```

  El script ejecuta `V1`, `V2` y `V4` y, al final, `V3` (datos ficticios). Si `LAMB_APP` ya tiene tablas, se
  detiene sin cambiar nada. Para crear solo el esquema vacío, agregue `--sin-datos-demo`.
- **Keycloak**: importa el realm `lamb-academic` desde `infra/keycloak/realm/` (roles, cliente PKCE y tema UPeU).
  Después cree las cuentas de prueba, como se indica en la sección 6.

> Nunca use `docker compose down -v`: borra los volúmenes con los datos de Oracle y Keycloak.

## 4. Backend (Spring Boot)

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

- Salud: http://localhost:8080/actuator/health (debe responder `UP`).
- Documentación de la API: http://localhost:8080/swagger-ui.html.
- Pruebas sin base de datos:

  ```powershell
  .\mvnw.cmd test "-Dtest=!MatriculaOracleIntegrationTest,!MatriculaRollbackOracleIntegrationTest,!LambAcademicApplicationTests" "-Dsurefire.failIfNoSpecifiedTests=false"
  ```

  Las tres clases excluidas son pruebas contra Oracle: escriben y revierten datos en la base configurada.
  Ejecútelas solo contra su propia base de desarrollo.

## 5. Frontend (Angular)

```powershell
cd frontend
npm.cmd ci
npm.cmd start
```

- Abra http://localhost:4200. El inicio de sesión se hace en Keycloak; la SPA nunca recibe contraseñas.
- La SPA usa las direcciones de `frontend/src/environments/environment.ts`: backend 8080 y Keycloak 48080.
- Pruebas: `npx ng test --watch=false`. Compilación: `npx ng build`.

## 6. Cuentas de prueba propias

Con Keycloak y Oracle levantados:

```powershell
python -I infra/keycloak/sembrar_usuarios.py
python -I infra/keycloak/habilitar_docente.py --keycloak http://localhost:48080 --docente-id 4 --autorizo-keycloak-principal
python -I infra/pruebas/verificar_keycloak.py
```

El parámetro `--autorizo-keycloak-principal` es obligatorio porque el script protege el puerto 48080 contra
cambios accidentales. Aquí se trata de su propio Keycloak recién instalado.

| Usuario | Rol | Datos que ve |
|---|---|---|
| `ana.quispe` | ESTUDIANTE | Alumna 1001 (Ana Lucía Quispe) |
| `jose.apaza` | ESTUDIANTE | Alumno 1033 (José Miguel Apaza) |
| `docente.mendoza` | DOCENTE | Docente 4 (Carlos Mendoza): sus secciones e inscritos |
| `coordinador` | COORDINADOR | Gestión académica, matrícula y expedientes |
| `admin.lamb` | ADMIN | Todo el sistema |
| `cajero` | CAJERO | Cargos, pagos y conceptos |

Las claves de estas cuentas están en `infra/secretos/keycloak-usuarios.env`, solo en su computadora.
La consola de Keycloak está en http://localhost:48080, con el usuario `admin` y la clave `KC_ADMIN_PASSWORD` de `infra/.env`.

Para agregar otra cuenta desde la consola (realm `lamb-academic`):
1. Cree el usuario y asígnele su clave.
2. Asígnele uno de los roles de la tabla.
3. Si es estudiante, agregue el atributo `alumnoId` con el `ID` de la tabla `ALUMNOS`. Si es docente, agregue
   `docenteId` con el `ID` de `PERSONA`.

## 7. Responsabilidades del equipo

| Integrante | Módulo | CRUD | Operación cabecera-detalle |
|---|---|---|---|
| Daniela | Base Universal | Personas y Alumnos | Expediente → DocumentoAdjunto (carga y descarga protegida de archivos) |
| Moisés | Matrícula | Periodo académico | Matrícula → DetalleMatrícula (créditos, vacantes, prerrequisitos, cruces de horario) |
| Cristian | Finanzas | Concepto de pago | CargoEstudiante → DetalleCuenta (cargos, cuotas, pagos y saldos) |
| Integrante de Core Académico (Oferta) | Oferta y programación | Curso | Sección → HorarioAula (docente, aula, vacantes, conflictos) |
| Integrante de Core Académico (Currículo) | Currículo y plana docente | Docente | PlanEstudio → Prerrequisito (ciclos, créditos, versionado) |

Para ver cómo se integró cada aporte y qué endpoints usa, consulte [docs/INTEGRACION_COMPLETA.md](docs/INTEGRACION_COMPLETA.md).

## 8. Datos de ejemplo y scripts

| Archivo | Contenido |
|---|---|
| `infra/oracle/V1__esquema_base_matricula.sql` | Tablas base de Matrícula (solo bases nuevas) |
| `infra/oracle/V2__integracion_modulos.sql` | Tablas de Base Universal, Core Académico y Finanzas |
| `infra/oracle/V4__resultado_detalle_matricula.sql` | Resultado final del curso (prerrequisitos aprobados) |
| `infra/oracle/V3__datos_demo.sql` | Datos **ficticios**, ver detalle debajo de la tabla |
| `infra/oracle/inicializar_base.py` | Ejecuta los scripts anteriores en orden sobre una base nueva |
| `infra/keycloak/realm/lamb-academic-realm.json` | Realm sin usuarios ni claves |
| `infra/keycloak/*.py` | Claves locales, cuentas de prueba y rol DOCENTE |
| `infra/pruebas/*.py` | Pruebas HTTP de extremo a extremo (ver abajo) |

Contenido de `V3__datos_demo.sql`:
- una escuela;
- cuatro alumnos y dos docentes;
- seis cursos y una malla con prerrequisitos;
- los periodos 2026-I (cerrado) y 2026-II (activo), con siete secciones y sus horarios;
- tres conceptos de pago.

Escenarios de demostración que deja listos:
- IS103-A tiene solo 2 vacantes.
- IS104-A se cruza en horario con IS101-A.
- IS201 exige IS101, que Luis ya aprobó.

**La base de cada integrante empieza solo con estos datos.** Las matrículas, cargos y expedientes que existan en
otra computadora no se copian, y no se deben exportar: pueden contener datos personales. Por eso, en una
instalación nueva, los reportes de matrícula no muestran registros históricos por revisar.

**Pruebas de extremo a extremo.** Con el backend levantado y las cuentas creadas:

```powershell
python -I infra/pruebas/matriz_accesos.py
```

Las pruebas `matriz_accesos.py` y `verificar_docente.py` solo leen datos. En `matriz_accesos.py`, los casos que
necesitan una matrícula o un cargo de Ana y de José se omiten hasta que existan; puede crearlos registrando una
matrícula con cada cuenta.

Las pruebas `e2e_integracion.py` y `e2e_archivos_persistencia.py` **registran datos** de prueba. Por eso se niegan a
usar los puertos 8080 y 48080. Ejecútelas solo contra un backend y un Keycloak de prueba, indicando sus direcciones
en `LAMB_API_URL` y `LAMB_KEYCLOAK_URL`.

## Documentación

[ARQUITECTURA_LAMB.md](ARQUITECTURA_LAMB.md) · [CONTRATOS_REST.md](CONTRATOS_REST.md) ·
[MODULOS_LAMB.md](MODULOS_LAMB.md) · [MATRIZ_REQUISITOS.md](MATRIZ_REQUISITOS.md) ·
[RESULTADOS_PRUEBAS.md](RESULTADOS_PRUEBAS.md) · [PENDIENTES.md](PENDIENTES.md) ·
[docs/INTEGRACION_COMPLETA.md](docs/INTEGRACION_COMPLETA.md) · [docs/SEGURIDAD_KEYCLOAK.md](docs/SEGURIDAD_KEYCLOAK.md)
