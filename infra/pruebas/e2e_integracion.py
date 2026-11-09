"""Pruebas de punta a punta de la integracion (Base Universal, Core Academico, Finanzas y rol DOCENTE).

Usa tokens reales de Keycloak (PKCE) y el backend en ejecucion. REGISTRA DATOS (expedientes, un cargo de
tramite con un pago, un curso y un docente de prueba), por eso solo se ejecuta contra el entorno aislado:
se niega si el backend es el del puerto 8080 o Keycloak el del puerto 48080. No toca matriculas.

Requiere el rol DOCENTE habilitado en el Keycloak aislado (infra/keycloak/habilitar_docente.py).

Uso:
  LAMB_API_URL=http://localhost:8091 LAMB_KEYCLOAK_URL=http://localhost:48090 python -I infra/pruebas/e2e_integracion.py
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keycloak_pkce as kc  # noqa: E402

API = os.environ.get("LAMB_API_URL", "")
if not API or urllib.parse.urlsplit(API).port == 8080 or urllib.parse.urlsplit(kc.KEYCLOAK).port == 48080:
    sys.exit("Estas pruebas registran datos: indique LAMB_API_URL y LAMB_KEYCLOAK_URL del entorno aislado.")

SELLO = time.strftime("%m%d%H%M%S")
resultados = []


def llamar(usuario, metodo, ruta, cuerpo=None):
    cabeceras = {"Content-Type": "application/json", "Authorization": f"Bearer {TOKENS[usuario]}"}
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(API + ruta, data=datos, headers=cabeceras, method=metodo)
    try:
        with urllib.request.urlopen(req) as r:
            texto = r.read().decode()
            return r.status, (json.loads(texto) if texto else None)
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, texto


def caso(descripcion, estado, esperado, extra=""):
    ok = estado == esperado
    resultados.append(ok)
    print(f"[{'OK' if ok else 'FALLA'}] {estado} (esperado {esperado}) {descripcion}{' :: ' + extra if extra else ''}")
    return ok


def mensaje(cuerpo):
    return cuerpo.get("message", "") if isinstance(cuerpo, dict) else ""


TOKENS = {u: kc.login(u)["access_token"]
          for u in ["ana.quispe", "jose.apaza", "coordinador", "admin.lamb", "cajero", "docente.mendoza"]}

# ------------------------------------------------------------------ datos de referencia (solo lectura)
_, periodos = llamar("coordinador", "GET", "/api/v1/periodos")
activo = sorted([p for p in periodos if p["estado"] == "ACTIVO"], key=lambda p: p["fechaInicio"])[-1]
_, perfil = llamar("docente.mendoza", "GET", "/api/v1/auth/perfil")
docente_id = perfil["docenteId"]
_, secciones = llamar("coordinador", "GET", f"/api/v1/secciones?periodoId={activo['id']}")
propias = [s for s in secciones if s["docenteId"] == docente_id]
ajenas = [s for s in secciones if s["docenteId"] not in (None, docente_id)]
_, ana = llamar("coordinador", "GET", "/api/v1/alumnos/1001")
_, jose = llamar("coordinador", "GET", "/api/v1/alumnos/1033")
print(f"Periodo activo {activo['codigo']}; docente {docente_id} con {len(propias)} seccion(es) propias")

# ------------------------------------------------------------------ DOCENTE
estado, carga = llamar("docente.mendoza", "GET", f"/api/v1/docentes/mi-carga?periodoId={activo['id']}")
caso("Docente consulta su carga lectiva", estado, 200,
     f"{carga.get('totalSecciones')} secciones, {carga.get('horasSemanales')} h" if estado == 200 else mensaje(carga))
if estado == 200:
    caso("La carga solo contiene secciones que dicta", 0, 0 if all(s["docenteId"] == docente_id for s in carga["secciones"]) else 1)
if propias:
    estado, inscritos = llamar("docente.mendoza", "GET", f"/api/v1/matriculas/secciones/{propias[0]['id']}/inscritos")
    caso("Docente ve los inscritos de su seccion", estado, 200,
         f"{len(inscritos['inscritos'])} inscritos" if estado == 200 else mensaje(inscritos))
if ajenas:
    estado, r = llamar("docente.mendoza", "GET", f"/api/v1/matriculas/secciones/{ajenas[0]['id']}/inscritos")
    caso("Docente no ve los inscritos de una seccion ajena", estado, 403, mensaje(r))
    estado, r = llamar("docente.mendoza", "GET", f"/api/v1/docentes/{ajenas[0]['docenteId']}/carga?periodoId={activo['id']}")
    caso("Docente no consulta la carga de otro docente", estado, 403)
estado, _ = llamar("docente.mendoza", "GET", "/api/v1/matriculas")
caso("Docente no lista matriculas", estado, 403)
estado, _ = llamar("docente.mendoza", "GET", "/api/v1/expedientes")
caso("Docente no lista expedientes", estado, 403)
estado, _ = llamar("ana.quispe", "GET", f"/api/v1/docentes/mi-carga?periodoId={activo['id']}")
caso("Estudiante no usa la carga docente", estado, 403)

# ------------------------------------------------------------------ Catalogos de tramite (V5)
estado, categorias = llamar("docente.mendoza", "GET", "/api/v1/expedientes/catalogos/categorias")
caso("Cualquier sesion consulta los catalogos de tramite (docente)", estado, 200)
CATEGORIA = {c["codigo"]: c["id"] for c in categorias} if estado == 200 else {}
_, tipos = llamar("ana.quispe", "GET", f"/api/v1/expedientes/catalogos/categorias/{CATEGORIA['ACADEMICO']}/tipos-solicitud")
TIPO = {t["codigo"]: t for t in tipos}
_, documentos_cat = llamar("ana.quispe", "GET", "/api/v1/expedientes/catalogos/tipos-documento")
DOC = {d["codigo"]: d["id"] for d in documentos_cat}
justificacion = TIPO["JUSTIF_INASISTENCIA"]
caso("Justificacion de inasistencias: FUT obligatorio y certificado medico recomendado",
     sorted((r["codigo"], r["obligatorio"]) for r in justificacion["requisitos"]),
     sorted([("FUT", True), ("CERT_MEDICO", False)]))


def solicitud(tipo, asunto, documentos, categoria="ACADEMICO", **extra):
    return {"asunto": f"{asunto} (prueba {SELLO})", "categoriaId": CATEGORIA[categoria],
            "tipoSolicitudId": TIPO[tipo]["id"], "documentos": documentos, **extra}


# ------------------------------------------------------------------ Expediente -> DocumentoAdjunto
documento = {"nombre": "FUT", "tipoDocumentoInstitucionalId": DOC["FUT"], "nombreArchivo": "fut.pdf",
             "tipoDocumento": "PDF", "rutaArchivo": "/pruebas/fut.pdf"}
estado, exp = llamar("ana.quispe", "POST", "/api/v1/expedientes", solicitud(
    "RETIRO_CURSO", "Retiro de curso", [documento], personaId=jose["persona"]["id"], codigoTramite="NO-SE-USA"))
caso("Estudiante registra expediente (cabecera y documento juntos)", estado, 201, mensaje(exp))
exp_id = exp["id"] if estado == 201 else None
if exp_id:
    caso("El expediente queda a nombre del estudiante, no de la persona enviada",
         0, 0 if exp["persona"]["id"] == ana["persona"]["id"] else 1)
    caso("El servidor genera el codigo TR-AAAA-NNNNN e ignora el enviado",
         bool(re.fullmatch(r"TR-\d{4}-\d{5,}", exp["codigoTramite"])), True, exp["codigoTramite"])
    caso("Sin destinatario se usa el sugerido del tipo", exp["destinatario"]["codigo"], "COORD_ACADEMICA")
    estado, r = llamar("ana.quispe", "POST", "/api/v1/expedientes", solicitud("RETIRO_CURSO", "Duplicado", [documento]))
    caso("Otro expediente del mismo tipo en curso se rechaza y nombra el existente", (estado, exp["codigoTramite"] in mensaje(r)),
         (409, True), mensaje(r))
    estado, r = llamar("ana.quispe", "POST", "/api/v1/expedientes", solicitud(
        "JUSTIF_INASISTENCIA", "Sin FUT", [{**documento, "tipoDocumentoInstitucionalId": DOC["CERT_MEDICO"]}]))
    caso("Faltan documentos obligatorios (422) y se nombran", (estado, "FUT" in mensaje(r)), (422, True), mensaje(r))
    estado, r = llamar("ana.quispe", "POST", "/api/v1/expedientes", solicitud(
        "JUSTIF_INASISTENCIA", "Categoria ajena", [documento], categoria="ECONOMICO"))
    caso("El tipo de solicitud de otra categoria se rechaza (422)", estado, 422, mensaje(r))
    asunto_b = f"Documento mal tipado (prueba {SELLO})"
    estado, r = llamar("ana.quispe", "POST", "/api/v1/expedientes", solicitud(
        "JUSTIF_INASISTENCIA", "Documento mal tipado", [documento, {**documento, "nombreArchivo": "foto.jpg"}]))
    caso("Un documento invalido revierte todo el registro", estado, 409, mensaje(r))
    estado, r = llamar("coordinador", "GET", f"/api/v1/expedientes?estado=REGISTRADO")
    caso("El expediente rechazado no quedo guardado", 0, 0 if not any(e["asunto"] == asunto_b for e in r) else 1)
    doc_id = exp["documentos"][0]["id"]
    estado, r = llamar("ana.quispe", "DELETE", f"/api/v1/expedientes/{exp_id}/documentos/{doc_id}")
    caso("No se quita el unico documento", estado, 409, mensaje(r))
    estado, r = llamar("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos",
                       {**documento, "nombre": "Certificado", "tipoDocumentoInstitucionalId": DOC["OTRO"],
                        "nombreArchivo": "certificado.pdf"})
    caso("Estudiante agrega un documento", estado, 201, f"total {r.get('totalDocumentos')}" if estado == 201 else "")
    otro_id = next((d["id"] for d in r["documentos"] if d["nombre"] == "Certificado"), None) if estado == 201 else None
    estado, r = llamar("ana.quispe", "PUT", f"/api/v1/expedientes/{exp_id}/documentos/{doc_id}",
                       {**documento, "nombreArchivo": "certificado.pdf"})
    caso("Corregir con un archivo repetido se rechaza", estado, 409, mensaje(r))
    estado, r = llamar("ana.quispe", "PUT", f"/api/v1/expedientes/{exp_id}/documentos/{doc_id}",
                       {**documento, "nombre": "FUT firmado", "nombreArchivo": "fut-firmado.pdf"})
    caso("Estudiante corrige un documento", estado, 200)
    estado, r = llamar("ana.quispe", "DELETE", f"/api/v1/expedientes/{exp_id}/documentos/{doc_id}")
    caso("No se quita el unico documento obligatorio (FUT) (422)", estado, 422, mensaje(r))
    estado, r = llamar("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos",
                       {"nombre": "Anexo en SharePoint", "tipoDocumentoInstitucionalId": DOC["OTRO"],
                        "enlace": "https://upeuedupe.sharepoint.com/:b:/s/tramites/E2E" + SELLO})
    con_enlace = next((d for d in r["documentos"] if d["enlace"]), {}) if estado == 201 else {}
    caso("Agrega un documento con enlace de SharePoint (sin archivo ni tamano)", (estado, con_enlace.get("tamanoBytes"),
         con_enlace.get("archivoDisponible")), (201, None, False), mensaje(r))
    estado, r = llamar("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos",
                       {"nombre": "Drive", "tipoDocumentoInstitucionalId": DOC["OTRO"],
                        "enlace": "https://drive.google.com/file/d/123"})
    caso("Un enlace que no es de SharePoint de la universidad se rechaza", estado, 409, mensaje(r))
    if con_enlace:
        estado, _ = llamar("ana.quispe", "GET", f"/api/v1/expedientes/{exp_id}/documentos/{con_enlace['id']}/archivo")
        caso("Un documento con enlace no se descarga del almacen", estado, 404)
    if otro_id:
        estado, r = llamar("ana.quispe", "DELETE", f"/api/v1/expedientes/{exp_id}/documentos/{otro_id}")
        caso("Estudiante quita un documento", estado, 200, f"total {r.get('totalDocumentos')}" if estado == 200 else "")
    estado, _ = llamar("jose.apaza", "GET", f"/api/v1/expedientes/{exp_id}")
    caso("Otro estudiante no abre el expediente", estado, 403)
    estado, r = llamar("jose.apaza", "GET", "/api/v1/expedientes")
    caso("El listado de otro estudiante no incluye el expediente", 0, 0 if all(e["id"] != exp_id for e in r) else 1)
    estado, _ = llamar("ana.quispe", "PATCH", f"/api/v1/expedientes/{exp_id}/estado", {"estado": "APROBADO"})
    caso("Estudiante no cambia el estado", estado, 403)
    estado, r = llamar("coordinador", "PATCH", f"/api/v1/expedientes/{exp_id}/estado", {"estado": "EN_REVISION"})
    caso("Coordinacion pasa el expediente a revision", estado, 200)
    estado, r = llamar("ana.quispe", "POST", f"/api/v1/expedientes/{exp_id}/documentos",
                       {**documento, "nombreArchivo": "otro.pdf"})
    caso("En revision no se agregan documentos", estado, 409, mensaje(r))
    estado, _ = llamar("coordinador", "PATCH", f"/api/v1/expedientes/{exp_id}/estado", {"estado": "ARCHIVADO"})
    caso("Transicion no permitida (EN_REVISION -> ARCHIVADO)", estado, 409)
    # Cierre: un expediente archivado ya no bloquea otro del mismo tipo (el script se puede repetir).
    estado, _ = llamar("coordinador", "PATCH", f"/api/v1/expedientes/{exp_id}/estado", {"estado": "OBSERVADO"})
    caso("Coordinacion observa el expediente", estado, 200)
    estado, _ = llamar("coordinador", "PATCH", f"/api/v1/expedientes/{exp_id}/estado", {"estado": "ARCHIVADO"})
    caso("Coordinacion archiva el expediente de prueba", estado, 200)
estado, _ = llamar("cajero", "GET", "/api/v1/expedientes")
caso("Caja no accede a expedientes", estado, 403)

# ------------------------------------------------------------------ Finanzas: ConceptoPago y Cargo -> cuotas
estado, conceptos = llamar("cajero", "GET", "/api/v1/finanzas/conceptos")
caso("Caja lista conceptos de pago", estado, 200)
fijo = next((c for c in conceptos if c["activo"] and c["tipoCalculo"] == "FIJO" and c["monto"] > 0), None)
estado, _ = llamar("cajero", "POST", "/api/v1/finanzas/conceptos",
                   {"codigo": "E2E", "nombre": "x", "tipoCalculo": "FIJO", "monto": 1, "aplicaMatricula": False})
caso("Caja no crea conceptos (solo ADMIN)", estado, 403)
cargo_id = None
if fijo:
    estado, cargo = llamar("cajero", "POST", "/api/v1/finanzas/cargos", {
        "estudianteId": 1001, "procesoOrigen": "TRAMITE", "referenciaId": int(SELLO), "periodoId": activo["id"],
        "totalCreditos": None, "numeroCuotas": 2, "observacion": "Prueba e2e", "conceptos": [fijo["codigo"]]})
    caso("Caja registra un cargo de tramite con sus cuotas", estado, 201,
         f"{cargo.get('numeroCargo')} S/ {cargo.get('montoTotal')} en {len(cargo.get('cuotas', []))} cuotas"
         if estado == 201 else mensaje(cargo))
    if estado == 201:
        cargo_id = cargo["id"]
        caso("El total es el monto del concepto", 0, 0 if abs(cargo["montoTotal"] - fijo["monto"]) < 0.005 else 1)
        estado, r = llamar("cajero", "POST", "/api/v1/finanzas/cargos", {
            "estudianteId": 1001, "procesoOrigen": "TRAMITE", "referenciaId": int(SELLO), "periodoId": activo["id"],
            "numeroCuotas": 1, "conceptos": [fijo["codigo"]]})
        caso("No se duplica el cargo de la misma referencia", estado, 409, mensaje(r))
        pago = round(cargo["cuotas"][0]["montoCuota"], 2)
        estado, r = llamar("cajero", "POST", f"/api/v1/finanzas/cargos/{cargo_id}/pagos",
                           {"monto": pago, "medioPago": "EFECTIVO", "referencia": "E2E"})
        caso("Caja registra un pago parcial", estado, 201,
             f"estado {r.get('estado')}, saldo {r.get('saldoPendiente')}" if estado == 201 else mensaje(r))
        estado, r = llamar("cajero", "POST", f"/api/v1/finanzas/cargos/{cargo_id}/pagos",
                           {"monto": cargo["montoTotal"], "medioPago": "EFECTIVO"})
        caso("Un pago mayor al saldo se rechaza", estado, 409, mensaje(r))
        estado, r = llamar("cajero", "PATCH", f"/api/v1/finanzas/cargos/{cargo_id}/anular")
        caso("Un cargo con pagos no se anula", estado, 409, mensaje(r))
        estado, r = llamar("ana.quispe", "GET", f"/api/v1/finanzas/cargos/{cargo_id}")
        caso("El estudiante consulta su cargo", estado, 200)
        estado, _ = llamar("jose.apaza", "GET", f"/api/v1/finanzas/cargos/{cargo_id}")
        caso("Otro estudiante no consulta el cargo", estado, 403)
        estado, _ = llamar("ana.quispe", "POST", f"/api/v1/finanzas/cargos/{cargo_id}/pagos",
                           {"monto": 1, "medioPago": "EFECTIVO"})
        caso("El estudiante no registra pagos", estado, 403)
        estado, s = llamar("ana.quispe", "GET", "/api/v1/finanzas/cargos/estudiante/1001/saldo")
        caso("El estudiante consulta su saldo", estado, 200, f"saldo {s.get('saldoPendiente')}" if estado == 200 else "")
_, de_matricula = llamar("cajero", "GET", "/api/v1/finanzas/cargos?procesoOrigen=MATRICULA&estado=EMITIDO")
if de_matricula:
    estado, r = llamar("cajero", "PATCH", f"/api/v1/finanzas/cargos/{de_matricula[0]['id']}/anular")
    caso("El cargo de una matricula no se anula desde Finanzas", estado, 409, mensaje(r))
estado, r = llamar("cajero", "POST", "/api/v1/finanzas/cargos", {
    "estudianteId": 1001, "procesoOrigen": "MATRICULA", "periodoId": activo["id"], "numeroCuotas": 1})
caso("No se registra a mano un cargo de matricula", estado, 409)

# ------------------------------------------------------------------ Core Academico: Curso y Docente
estado, curso = llamar("admin.lamb", "POST", "/api/v1/cursos", {
    "codigo": f"E2E{SELLO[-6:]}", "nombre": "Curso de prueba e2e", "creditos": 3, "horasTeoricas": 2, "horasPracticas": 2})
caso("Admin registra un curso", estado, 201)
if estado == 201:
    estado, _ = llamar("coordinador", "PUT", f"/api/v1/cursos/{curso['id']}", {**curso, "nombre": "x"})
    caso("Coordinacion no edita el catalogo de cursos", estado, 403)
    estado, _ = llamar("admin.lamb", "DELETE", f"/api/v1/cursos/{curso['id']}")
    caso("Admin desactiva un curso sin secciones", estado, 204)
if propias:
    estado, r = llamar("admin.lamb", "DELETE", f"/api/v1/cursos/{propias[0]['curso']['id']}")
    caso("Un curso con secciones abiertas no se desactiva", estado, 409, mensaje(r))
estado, r = llamar("admin.lamb", "DELETE", f"/api/v1/docentes/{docente_id}")
caso("Un docente con secciones vigentes no se da de baja", estado, 409, mensaje(r))
estado, nuevo = llamar("admin.lamb", "POST", "/api/v1/docentes", {
    "tipoDocumento": "DNI", "numeroDocumento": f"9{SELLO[-7:]}", "nombres": "Docente", "apellidoPaterno": "Prueba E2E",
    "apellidoMaterno": None, "email": None, "telefono": None, "direccion": None, "fechaNacimiento": None, "idEscuela": None})
caso("Admin registra un docente (persona de tipo DOCENTE)", estado, 201)
if estado == 201:
    caso("El docente queda como persona DOCENTE", 0, 0 if nuevo["tipoPersona"] == "DOCENTE" else 1)
    estado, _ = llamar("coordinador", "POST", "/api/v1/docentes", {})
    caso("Coordinacion no registra docentes", estado, 403)
    estado, _ = llamar("admin.lamb", "DELETE", f"/api/v1/docentes/{nuevo['id']}")
    caso("Admin da de baja a un docente sin secciones", estado, 204)
estado, r = llamar("admin.lamb", "GET", f"/api/v1/docentes/{ana['persona']['id']}")
caso("Una persona que no es docente no se consulta como docente", estado, 404)

print(f"\n{sum(resultados)}/{len(resultados)} casos correctos")
sys.exit(0 if all(resultados) else 1)
