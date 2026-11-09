"""Verifica el rol DOCENTE con tokens reales (PKCE) contra el backend en ejecucion. NO MODIFICA DATOS.

Solo hace consultas y operaciones que SecurityConfig rechaza por rol antes de llegar al servicio (403): ninguna
escritura llega a Oracle. Sirve para el entorno principal y para el aislado.

Uso: python -I infra/pruebas/verificar_docente.py   (LAMB_API_URL y LAMB_KEYCLOAK_URL opcionales)
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import keycloak_pkce as kc  # noqa: E402

API = os.environ.get("LAMB_API_URL", "http://localhost:8080")
resultados = []


def llamar(token, metodo, ruta, cuerpo=None):
    cabeceras = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
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


def caso(descripcion, obtenido, esperado, extra=""):
    ok = obtenido == esperado
    resultados.append(ok)
    print(f"[{'OK' if ok else 'FALLA'}] {obtenido} (esperado {esperado}) {descripcion}{' :: ' + extra if extra else ''}")


docente = kc.login("docente.mendoza")["access_token"]
coordinador = kc.login("coordinador")["access_token"]
claims = kc.claims(docente)
caso("El token del docente trae el rol DOCENTE y ningun rol de personal", sorted(
    r for r in claims["realm_access"]["roles"] if r.isupper()), ["DOCENTE"])

estado, perfil = llamar(docente, "GET", "/api/v1/auth/perfil")
caso("Perfil del docente", estado, 200, f"roles {perfil.get('roles')}, docenteId {perfil.get('docenteId')}")
docente_id = perfil["docenteId"]

_, periodos = llamar(coordinador, "GET", "/api/v1/periodos")
activo = sorted([p for p in periodos if p["estado"] == "ACTIVO"], key=lambda p: p["fechaInicio"])[-1]
_, secciones = llamar(coordinador, "GET", f"/api/v1/secciones?periodoId={activo['id']}")
propias = sorted(s["id"] for s in secciones if s["docenteId"] == docente_id)
ajenas = [s for s in secciones if s["docenteId"] not in (None, docente_id)]

# ---- Lo que el docente SI puede consultar: lo suyo
estado, carga = llamar(docente, "GET", f"/api/v1/docentes/mi-carga?periodoId={activo['id']}")
caso(f"Carga lectiva propia en {activo['codigo']}", estado, 200,
     f"{carga.get('totalSecciones')} secciones, {carga.get('horasSemanales')} h semanales")
caso("La carga trae exactamente sus secciones (segun coordinacion)", sorted(s["id"] for s in carga["secciones"]), propias)
caso("Cada seccion de la carga trae curso y horarios con aula",
     all(s["curso"]["codigo"] and s["horarios"] and all(h["aula"] for h in s["horarios"]) for s in carga["secciones"]), True)
for seccion_id in propias:
    estado, inscritos = llamar(docente, "GET", f"/api/v1/matriculas/secciones/{seccion_id}/inscritos")
    _, de_coordinacion = llamar(coordinador, "GET", f"/api/v1/matriculas/secciones/{seccion_id}/inscritos")
    caso(f"Inscritos de su seccion {seccion_id}", estado, 200, f"{len(inscritos['inscritos'])} estudiante(s)")
    caso(f"Ve los mismos inscritos que coordinacion en {seccion_id}",
         [i["detalleId"] for i in inscritos["inscritos"]], [i["detalleId"] for i in de_coordinacion["inscritos"]])

# ---- Lo que NO puede consultar: datos de otros docentes, de alumnos y de personal (403)
for s in ajenas[:2]:
    estado, r = llamar(docente, "GET", f"/api/v1/matriculas/secciones/{s['id']}/inscritos")
    caso(f"Inscritos de la seccion ajena {s['id']}", estado, 403, r.get("message", "") if isinstance(r, dict) else "")
if ajenas:
    estado, _ = llamar(docente, "GET", f"/api/v1/docentes/{ajenas[0]['docenteId']}/carga?periodoId={activo['id']}")
    caso("Carga de otro docente", estado, 403)
estado, _ = llamar(docente, "GET", f"/api/v1/docentes/{docente_id}/carga?periodoId={activo['id']}")
caso("Carga por id (ruta de coordinacion), aunque sea la propia", estado, 403)
for ruta in ["/api/v1/matriculas", "/api/v1/matriculas/93", "/api/v1/matriculas/contexto?estudianteId=1001",
             "/api/v1/matriculas/reporte", "/api/v1/secciones/resumen", "/api/v1/expedientes",
             "/api/v1/finanzas/cargos", "/api/v1/finanzas/cargos/estudiante/1001", "/api/v1/personas",
             "/api/v1/alumnos", "/actuator/env"]:
    estado, _ = llamar(docente, "GET", ruta)
    caso(f"GET {ruta}", estado, 403)

# ---- Escrituras: SecurityConfig las rechaza por rol antes del servicio (no llegan a Oracle)
for metodo, ruta in [("POST", "/api/v1/periodos"), ("POST", "/api/v1/cursos"), ("PUT", "/api/v1/cursos/1"),
                     ("DELETE", "/api/v1/cursos/1"), ("POST", "/api/v1/secciones"), ("PUT", "/api/v1/secciones/1001"),
                     ("DELETE", "/api/v1/secciones/1001"), ("POST", "/api/v1/docentes"), ("PUT", f"/api/v1/docentes/{docente_id}"),
                     ("DELETE", f"/api/v1/docentes/{docente_id}"), ("POST", "/api/v1/planes-estudio"),
                     ("POST", "/api/v1/matriculas"), ("PATCH", "/api/v1/matriculas/93/anular"),
                     ("PATCH", "/api/v1/matriculas/93/detalles/1/resultado"), ("POST", "/api/v1/expedientes"),
                     ("POST", "/api/v1/finanzas/cargos/1/pagos"), ("POST", "/api/v1/personas"),
                     ("PUT", "/api/v1/alumnos/1001")]:
    estado, _ = llamar(docente, metodo, ruta, {})
    caso(f"{metodo} {ruta}", estado, 403)

# ---- Catalogos publicos para cualquier sesion (lectura): los usa la vista de su carga
for ruta in ["/api/v1/periodos", f"/api/v1/secciones?periodoId={activo['id']}", "/api/v1/cursos"]:
    estado, _ = llamar(docente, "GET", ruta)
    caso(f"Lectura de catalogo {ruta}", estado, 200)

print(f"\n{sum(resultados)}/{len(resultados)} casos correctos")
sys.exit(0 if all(resultados) else 1)
