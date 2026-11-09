"""Pruebas de punta a punta de la carga de archivos y de la persistencia de horarios, mallas y pagos.

REGISTRA DATOS (expedientes con archivos, una seccion temporal, una malla de prueba y un cargo de tramite
con pagos), por eso solo se ejecuta contra el entorno aislado: se niega con el backend 8080 o Keycloak
48080. Con LAMB_ARCHIVOS_DIR (el mismo directorio que usa el backend aislado) comprueba ademas que un
registro rechazado no deja archivos huerfanos. No toca matriculas.

Uso:
  LAMB_API_URL=http://localhost:8091 LAMB_KEYCLOAK_URL=http://localhost:48090 \
  LAMB_ARCHIVOS_DIR=<directorio del almacen aislado> python -I infra/pruebas/e2e_archivos_persistencia.py
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keycloak_pkce as kc  # noqa: E402

API = os.environ.get("LAMB_API_URL", "")
ALMACEN = os.environ.get("LAMB_ARCHIVOS_DIR")
if not API or urllib.parse.urlsplit(API).port == 8080 or urllib.parse.urlsplit(kc.KEYCLOAK).port == 48080:
    sys.exit("Estas pruebas registran datos: indique LAMB_API_URL y LAMB_KEYCLOAK_URL del entorno aislado.")

SELLO = time.strftime("%m%d%H%M%S")
PDF = b"%PDF-1.7\n1 0 obj << >> endobj\n%%EOF\n"
PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + b"\x00" * 32
resultados = []


def peticion(usuario, metodo, ruta, cuerpo=None, tipo="application/json", crudo=False):
    cabeceras = {"Authorization": f"Bearer {TOKENS[usuario]}"}
    datos = None
    if cuerpo is not None:
        datos = cuerpo if isinstance(cuerpo, bytes) else json.dumps(cuerpo).encode()
        cabeceras["Content-Type"] = tipo
    req = urllib.request.Request(API + ruta, data=datos, headers=cabeceras, method=metodo)
    try:
        with urllib.request.urlopen(req) as r:
            contenido = r.read()
            if crudo:
                return r.status, contenido, dict(r.headers)
            return r.status, (json.loads(contenido) if contenido else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode(errors="replace")
        try:
            cuerpo_error = json.loads(texto)
        except ValueError:
            cuerpo_error = texto
        return (e.code, cuerpo_error, {}) if crudo else (e.code, cuerpo_error)


def multipart(partes):
    """partes: [(nombre, archivo o None, tipo, bytes)] -> (cuerpo, content-type)."""
    limite = uuid.uuid4().hex
    cuerpo = b""
    for nombre, archivo, tipo, datos in partes:
        cuerpo += f"--{limite}\r\nContent-Disposition: form-data; name=\"{nombre}\"".encode()
        if archivo is not None:
            cuerpo += f"; filename=\"{archivo}\"".encode()
        cuerpo += f"\r\nContent-Type: {tipo}\r\n\r\n".encode() + datos + b"\r\n"
    return cuerpo + f"--{limite}--\r\n".encode(), f"multipart/form-data; boundary={limite}"


def registrar_con_archivos(usuario, codigo, archivos, persona=None):
    datos = {"codigoTramite": codigo, "asunto": "Prueba de archivos e2e", "personaId": persona,
             "nombres": [n for n, _, _, _ in archivos]}
    partes = [("datos", None, "application/json", json.dumps(datos).encode())]
    partes += [("archivos", archivo, tipo, contenido) for _, archivo, tipo, contenido in archivos]
    cuerpo, tipo = multipart(partes)
    return peticion(usuario, "POST", "/api/v1/expedientes", cuerpo, tipo)


def archivos_en_almacen():
    return len(os.listdir(ALMACEN)) if ALMACEN and os.path.isdir(ALMACEN) else None


def caso(descripcion, obtenido, esperado, extra=""):
    ok = obtenido == esperado
    resultados.append(ok)
    print(f"[{'OK' if ok else 'FALLA'}] {obtenido} (esperado {esperado}) {descripcion}{' :: ' + extra if extra else ''}")


def mensaje(cuerpo):
    return cuerpo.get("message", "") if isinstance(cuerpo, dict) else ""


TOKENS = {u: kc.login(u)["access_token"] for u in ["ana.quispe", "jose.apaza", "coordinador", "admin.lamb", "cajero",
                                                   "docente.mendoza"]}
_, periodos = peticion("coordinador", "GET", "/api/v1/periodos")
activo = sorted([p for p in periodos if p["estado"] == "ACTIVO"], key=lambda p: p["fechaInicio"])[-1]

print("--- A. Expedientes con archivos reales")
antes = archivos_en_almacen()
estado, exp = registrar_con_archivos("ana.quispe", f"ARC-{SELLO}-A", [
    ("DNI", "dni.pdf", "application/pdf", PDF), ("Foto", "foto.png", "image/png", PNG)])
caso("Estudiante registra expediente con PDF y PNG", estado, 201)
exp_id = exp["id"] if estado == 201 else None
if exp_id:
    docs = exp["documentos"]
    caso("Los documentos quedan con archivo y sin ruta visible",
         [(d["archivoDisponible"], d["rutaArchivo"], d["tipoDocumento"]) for d in docs],
         [(True, None, "PDF"), (True, None, "PNG")])
    if antes is not None:
        caso("El almacen tiene dos archivos nuevos", archivos_en_almacen() - antes, 2)
    estado, contenido, cabeceras = peticion("ana.quispe", "GET", f"/api/v1/expedientes/{exp_id}/documentos/{docs[0]['id']}/archivo",
                                            crudo=True)
    caso("La titular descarga su PDF y recibe el mismo contenido", (estado, contenido == PDF), (200, True),
         cabeceras.get("Content-Type", ""))
    caso("La descarga va como adjunto y sin deteccion de tipo",
         ("attachment" in cabeceras.get("Content-Disposition", ""), cabeceras.get("X-Content-Type-Options")),
         (True, "nosniff"))
    estado, _, _ = peticion("coordinador", "GET", f"/api/v1/expedientes/{exp_id}/documentos/{docs[1]['id']}/archivo", crudo=True)
    caso("Coordinacion descarga el archivo", estado, 200)
    estado, _, _ = peticion("jose.apaza", "GET", f"/api/v1/expedientes/{exp_id}/documentos/{docs[0]['id']}/archivo", crudo=True)
    caso("Otro estudiante no descarga el archivo", estado, 403)
    for usuario in ("docente.mendoza", "cajero"):
        estado, _, _ = peticion(usuario, "GET", f"/api/v1/expedientes/{exp_id}/documentos/{docs[0]['id']}/archivo", crudo=True)
        caso(f"{usuario} no descarga archivos de expedientes", estado, 403)
    cuerpo, tipo = multipart([("nombre", None, "text/plain", "Certificado".encode()),
                              ("archivo", "certificado.pdf", "application/pdf", PDF)])
    estado, r = peticion("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos", cuerpo, tipo)
    caso("Agrega un documento con archivo al expediente", estado, 201, f"total {r.get('totalDocumentos')}" if estado == 201 else mensaje(r))
    estado, r = peticion("ana.quispe", "PUT", f"/api/v1/expedientes/{exp_id}/documentos/{docs[0]['id']}",
                         {"nombre": "DNI vigente", "nombreArchivo": "otro.png", "tipoDocumento": "PNG", "rutaArchivo": "/otra"})
    corregido = next(d for d in r["documentos"] if d["id"] == docs[0]["id"]) if estado == 200 else {}
    caso("Corregir un documento con archivo solo cambia el nombre",
         (corregido.get("nombre"), corregido.get("nombreArchivo"), corregido.get("archivoDisponible")),
         ("DNI vigente", "dni.pdf", True))
    estado, r = peticion("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos",
                         {"nombre": "x", "nombreArchivo": "x.pdf", "tipoDocumento": "PDF",
                          "rutaArchivo": "almacen:" + str(uuid.uuid4()) + ".pdf"})
    caso("No se acepta una ruta del almacen escrita por el usuario", estado, 409, mensaje(r))
    previo = archivos_en_almacen()
    estado, r = peticion("ana.quispe", "DELETE", f"/api/v1/expedientes/{exp_id}/documentos/{docs[1]['id']}")
    caso("Quitar un documento con archivo", estado, 200)
    if previo is not None:
        caso("El archivo del documento quitado se borra del almacen", previo - archivos_en_almacen(), 1)

previo = archivos_en_almacen()
estado, r = registrar_con_archivos("ana.quispe", f"ARC-{SELLO}-B", [
    ("DNI", "dni.pdf", "application/pdf", PDF), ("Falso", "virus.pdf", "application/pdf", b"MZ ejecutable")])
caso("Un archivo con contenido falso rechaza todo el registro", estado, 409, mensaje(r))
_, lista = peticion("coordinador", "GET", "/api/v1/expedientes")
caso("El expediente rechazado no se guardo", any(e["codigoTramite"] == f"ARC-{SELLO}-B" for e in lista), False)
if previo is not None:
    caso("No quedan archivos huerfanos del registro rechazado", archivos_en_almacen(), previo)
estado, r = registrar_con_archivos("ana.quispe", f"ARC-{SELLO}-C", [("Grande", "grande.pdf", "application/pdf",
                                                                     PDF + b"0" * (6 * 1024 * 1024))])
caso("Un archivo de mas de 5 MB se rechaza", estado, 413, mensaje(r))
estado, r = registrar_con_archivos("docente.mendoza", f"ARC-{SELLO}-D", [("DNI", "dni.pdf", "application/pdf", PDF)])
caso("Un docente no registra expedientes", estado, 403)

print("--- B. Persistencia de horarios de seccion y de prerrequisitos de mallas")
_, cursos = peticion("coordinador", "GET", "/api/v1/cursos?activo=true")
curso = cursos[0]
horarios = [{"diaSemana": "SABADO", "horaInicio": "07:00", "horaFin": "09:00", "aula": f"E2E-{SELLO[-4:]}"},
            {"diaSemana": "SABADO", "horaInicio": "10:00", "horaFin": "12:00", "aula": f"E2E-{SELLO[-4:]}"}]
estado, seccion = peticion("coordinador", "POST", "/api/v1/secciones", {
    "cursoId": curso["id"], "periodoId": activo["id"], "grupo": f"Z{SELLO[-4:]}", "docenteId": None,
    "limiteVacantes": 20, "horarios": horarios})
caso("Coordinacion programa una seccion con dos bloques horarios", estado, 201, mensaje(seccion) if estado != 201 else "")
if estado == 201:
    _, leida = peticion("coordinador", "GET", f"/api/v1/secciones/{seccion['id']}")
    caso("Los horarios se leen igual desde la base",
         sorted((h["diaSemana"], h["horaInicio"][:5], h["horaFin"][:5], h["aula"]) for h in leida["horarios"]),
         sorted((h["diaSemana"], h["horaInicio"], h["horaFin"], h["aula"]) for h in horarios))
    estado, actualizada = peticion("coordinador", "PUT", f"/api/v1/secciones/{seccion['id']}",
                                   {"docenteId": None, "limiteVacantes": 25})
    caso("Cambiar las vacantes conserva los horarios", (estado, len(actualizada.get("horarios", [])), actualizada.get("limiteVacantes")),
         (200, 2, 25))
    estado, r = peticion("coordinador", "POST", "/api/v1/secciones", {
        "cursoId": curso["id"], "periodoId": activo["id"], "grupo": f"Y{SELLO[-4:]}", "docenteId": None,
        "limiteVacantes": 20, "horarios": [{**horarios[0], "horaInicio": "08:00", "horaFin": "10:00"}]})
    caso("Otra seccion en la misma aula y hora se rechaza", estado, 409, mensaje(r))
    estado, _ = peticion("coordinador", "DELETE", f"/api/v1/secciones/{seccion['id']}")
    caso("La seccion temporal sin matriculas se elimina", estado, 204)

_, escuelas = peticion("admin.lamb", "GET", "/api/v1/escuelas")
_, catalogo = peticion("admin.lamb", "GET", "/api/v1/cursos?activo=true")
# La malla de prueba va en una escuela de prueba: ninguna escuela real queda con una malla vigente inventada.
estado, escuela_prueba = peticion("admin.lamb", "POST", "/api/v1/escuelas", {
    "idFacultad": escuelas[0]["idFacultad"], "codigo": f"E2E{SELLO[-6:]}", "nombre": "Escuela de prueba e2e (no oficial)",
    "nivel": "PREGRADO"})
caso("Admin registra una escuela de prueba para la malla", estado, 201, mensaje(escuela_prueba) if estado != 201 else "")
if estado == 201 and len(catalogo) >= 4:
    c = catalogo[:4]
    plan = {"idEscuela": escuela_prueba["id"], "codigo": f"E2E-{SELLO}", "nombre": "Malla de prueba e2e (no oficial)", "anio": 2027,
            "detalles": [{"idCurso": c[0]["id"], "ciclo": 1, "creditos": 4, "tipo": "OBLIGATORIO", "idPrerrequisito": None},
                         {"idCurso": c[1]["id"], "ciclo": 1, "creditos": 4, "tipo": "OBLIGATORIO", "idPrerrequisito": None},
                         {"idCurso": c[2]["id"], "ciclo": 2, "creditos": 4, "tipo": "OBLIGATORIO", "idPrerrequisito": c[0]["id"]},
                         {"idCurso": c[3]["id"], "ciclo": 2, "creditos": 4, "tipo": "OBLIGATORIO", "idPrerrequisito": c[1]["id"]}]}
    invalido = {**plan, "codigo": f"E2E-{SELLO}-X",
                "detalles": [*plan["detalles"][:3], {**plan["detalles"][3], "idPrerrequisito": c[2]["id"]}]}
    estado, r = peticion("admin.lamb", "POST", "/api/v1/planes-estudio", invalido)
    caso("Un prerrequisito del mismo ciclo rechaza toda la malla", estado, 409, mensaje(r))
    _, planes = peticion("admin.lamb", "GET", f"/api/v1/planes-estudio?q=E2E-{SELLO}-X")
    caso("La malla rechazada no se guardo", len(planes), 0)
    estado, creada = peticion("admin.lamb", "POST", "/api/v1/planes-estudio", plan)
    caso("Admin registra una malla de prueba con prerrequisitos", estado, 201, mensaje(creada) if estado != 201 else "")
    if estado == 201:
        _, leida = peticion("admin.lamb", "GET", f"/api/v1/planes-estudio/{creada['id']}")
        caso("Los prerrequisitos se leen igual desde la base",
             sorted((d["idCurso"], d["ciclo"], d["idPrerrequisito"]) for d in leida["detalles"]),
             sorted((d["idCurso"], d["ciclo"], d["idPrerrequisito"]) for d in plan["detalles"]))
        estado, version = peticion("admin.lamb", "POST", f"/api/v1/planes-estudio/{creada['id']}/versionar")
        caso("Versionar copia los prerrequisitos a la nueva version",
             (estado, sorted((d["idCurso"], d["idPrerrequisito"]) for d in version.get("detalles", []))),
             (201, sorted((d["idCurso"], d["idPrerrequisito"]) for d in plan["detalles"])))
        if estado == 201:
            _, previa = peticion("admin.lamb", "GET", f"/api/v1/planes-estudio/{creada['id']}")
            caso("La version anterior queda obsoleta", previa["estado"], "OBSOLETO")

print("--- D. Consistencia de pagos")
_, conceptos = peticion("cajero", "GET", "/api/v1/finanzas/conceptos")
fijo = next(c for c in conceptos if c["activo"] and c["tipoCalculo"] == "FIJO" and c["monto"] > 0)
estado, cargo = peticion("cajero", "POST", "/api/v1/finanzas/cargos", {
    "estudianteId": 1033, "procesoOrigen": "OTRO", "referenciaId": int(SELLO) + 7, "periodoId": activo["id"],
    "numeroCuotas": 3, "observacion": "Prueba e2e de pagos", "conceptos": [fijo["codigo"]]})
caso("Caja registra un cargo en tres cuotas", estado, 201)
if estado == 201:
    caso("La suma de las cuotas es el total del cargo", round(sum(q["montoCuota"] for q in cargo["cuotas"]), 2),
         round(cargo["montoTotal"], 2))
    primero = round(cargo["cuotas"][0]["montoCuota"] + 0.01, 2)
    peticion("cajero", "POST", f"/api/v1/finanzas/cargos/{cargo['id']}/pagos", {"monto": primero, "medioPago": "EFECTIVO"})
    _, parcial = peticion("cajero", "GET", f"/api/v1/finanzas/cargos/{cargo['id']}")
    caso("Un pago mayor a la primera cuota la paga y abona a la segunda",
         [q["estado"] for q in parcial["cuotas"]], ["PAGADA", "PAGADA_PARCIAL", "PENDIENTE"])
    resto = round(parcial["saldoPendiente"], 2)
    estado, final = peticion("cajero", "POST", f"/api/v1/finanzas/cargos/{cargo['id']}/pagos",
                             {"monto": resto, "medioPago": "TRANSFERENCIA", "referencia": "E2E"})
    caso("Pagar el saldo exacto cierra el cargo", (estado, final.get("estado"), final.get("saldoPendiente")),
         (201, "PAGADO_TOTAL", 0))
    _, leido = peticion("cajero", "GET", f"/api/v1/finanzas/cargos/{cargo['id']}")
    _, pagos = peticion("cajero", "GET", f"/api/v1/finanzas/cargos/{cargo['id']}/pagos")
    caso("Leido de nuevo: todas las cuotas pagadas", {q["estado"] for q in leido["cuotas"]}, {"PAGADA"})
    caso("La suma de los pagos registrados es el total", round(sum(p["monto"] for p in pagos), 2), round(leido["montoTotal"], 2))
    caso("La suma de lo pagado en cuotas es el total", round(sum(q["montoPagado"] for q in leido["cuotas"]), 2),
         round(leido["montoTotal"], 2))
    estado, r = peticion("cajero", "POST", f"/api/v1/finanzas/cargos/{cargo['id']}/pagos", {"monto": 0.01, "medioPago": "EFECTIVO"})
    caso("Un cargo pagado no admite mas pagos", estado, 409, mensaje(r))

print(f"\n{sum(resultados)}/{len(resultados)} casos correctos")
sys.exit(0 if all(resultados) else 1)
