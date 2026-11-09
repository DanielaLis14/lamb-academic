"""Habilita el rol DOCENTE en el realm lamb-academic (idempotente).

- Crea el rol de realm DOCENTE.
- Declara en el perfil de usuario el atributo docenteId (PERSONA.ID del docente), editable solo por el
  administrador, y el mapper docente_id del cliente lamb-frontend que lo publica en el token.
- Crea o actualiza el usuario de demostracion docente.mendoza con el rol DOCENTE y su docenteId.
  Su clave sale de infra/secretos/keycloak-usuarios.env (DOCENTE_PASSWORD, generar_secretos.py) y nunca
  se imprime. No modifica ningun otro usuario ni ninguna clave existente.

El Keycloak principal (puerto 48080) solo se modifica con --autorizo-keycloak-principal: sin esa opcion el
script se niega. Para verificar la configuracion use el Keycloak aislado de pruebas.

Uso:
  python -I infra/keycloak/habilitar_docente.py --keycloak http://localhost:48090 --docente-id 1207
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REALM = "lamb-academic"
CLIENTE = "lamb-frontend"
PUERTO_PRINCIPAL = 48080

USUARIO = ("docente.mendoza", "Carlos", "Mendoza Ramos", "docente.mendoza@demo.lamb.pe")

MAPPER = {
    "name": "docente_id",
    "protocol": "openid-connect",
    "protocolMapper": "oidc-usermodel-attribute-mapper",
    "consentRequired": False,
    "config": {
        "user.attribute": "docenteId",
        "claim.name": "docente_id",
        "jsonType.label": "long",
        "access.token.claim": "true",
        "id.token.claim": "true",
        "userinfo.token.claim": "true",
        "introspection.token.claim": "true",
        "multivalued": "false",
    },
}


def leer_env(ruta):
    valores = {}
    for linea in open(ruta, encoding="utf-8"):
        if "=" in linea and not linea.lstrip().startswith("#"):
            k, v = linea.rstrip("\n").split("=", 1)
            valores[k.strip()] = v
    return valores


class Keycloak:
    def __init__(self, url, usuario, clave):
        self.url, self.usuario, self.clave = url.rstrip("/"), usuario, clave

    def pedir(self, metodo, ruta, cuerpo=None, form=None, token=True):
        datos, cabeceras = None, {}
        if form is not None:
            datos = urllib.parse.urlencode(form).encode()
            cabeceras["Content-Type"] = "application/x-www-form-urlencoded"
        elif cuerpo is not None:
            datos = json.dumps(cuerpo).encode()
            cabeceras["Content-Type"] = "application/json"
        if token:
            cabeceras["Authorization"] = f"Bearer {self.token()}"
        req = urllib.request.Request(self.url + ruta, data=datos, headers=cabeceras, method=metodo)
        try:
            with urllib.request.urlopen(req) as r:
                texto = r.read().decode()
                return r.status, (json.loads(texto) if texto else None)
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode()

    def token(self):
        # Un token por llamada: el de admin-cli dura 60 s y el script es corto.
        estado, tok = self.pedir("POST", "/realms/master/protocol/openid-connect/token", token=False, form={
            "grant_type": "password", "client_id": "admin-cli", "username": self.usuario, "password": self.clave})
        if estado != 200:
            sys.exit(f"No se pudo autenticar como administrador de Keycloak (HTTP {estado})")
        return tok["access_token"]


def exigir(estado, esperados, que):
    if estado not in esperados:
        sys.exit(f"{que}: ERROR HTTP {estado}")


def main():
    parser = argparse.ArgumentParser(description="Habilita el rol DOCENTE en el realm lamb-academic.")
    parser.add_argument("--keycloak", required=True, help="URL del Keycloak, por ejemplo http://localhost:48090")
    parser.add_argument("--docente-id", type=int, required=True, help="PERSONA.ID del docente de demostracion")
    parser.add_argument("--autorizo-keycloak-principal", action="store_true",
                        help="Permite modificar el Keycloak principal (puerto 48080)")
    args = parser.parse_args()

    puerto = urllib.parse.urlsplit(args.keycloak).port
    if puerto == PUERTO_PRINCIPAL and not args.autorizo_keycloak_principal:
        sys.exit("El puerto 48080 es el Keycloak principal: se requiere --autorizo-keycloak-principal.")

    infra = leer_env(os.path.join(RAIZ, ".env"))
    claves = leer_env(os.path.join(RAIZ, "secretos", "keycloak-usuarios.env"))
    if not claves.get("DOCENTE_PASSWORD"):
        sys.exit("Falta DOCENTE_PASSWORD en infra/secretos/keycloak-usuarios.env: ejecute generar_secretos.py.")
    kc = Keycloak(args.keycloak, infra.get("KC_ADMIN_USERNAME", "admin"), infra["KC_ADMIN_PASSWORD"])
    base = f"/admin/realms/{REALM}"

    estado, _ = kc.pedir("GET", f"{base}/roles/DOCENTE")
    if estado == 404:
        estado, _ = kc.pedir("POST", f"{base}/roles", {
            "name": "DOCENTE",
            "description": "Docente: su carga lectiva y los estudiantes de las secciones que dicta"})
        exigir(estado, (201,), "rol DOCENTE")
        print("rol DOCENTE: creado")
    else:
        exigir(estado, (200,), "rol DOCENTE")
        print("rol DOCENTE: ya existia")

    _, perfil = kc.pedir("GET", f"{base}/users/profile")
    if not any(a["name"] == "docenteId" for a in perfil["attributes"]):
        perfil["attributes"].append({
            "name": "docenteId",
            "displayName": "Id de docente LAMB (PERSONA.ID)",
            "permissions": {"view": ["admin"], "edit": ["admin"]},
            "validations": {"integer": {"min": "1"}},
            "multivalued": False,
        })
        estado, _ = kc.pedir("PUT", f"{base}/users/profile", perfil)
        exigir(estado, (200,), "perfil de usuario")
        print("perfil de usuario: atributo docenteId declarado")
    else:
        print("perfil de usuario: atributo docenteId ya declarado")

    _, clientes = kc.pedir("GET", f"{base}/clients?clientId={CLIENTE}")
    if not clientes:
        sys.exit(f"No existe el cliente {CLIENTE} en el realm {REALM}")
    cid = clientes[0]["id"]
    _, mappers = kc.pedir("GET", f"{base}/clients/{cid}/protocol-mappers/models")
    if not any(m["name"] == MAPPER["name"] for m in mappers):
        estado, _ = kc.pedir("POST", f"{base}/clients/{cid}/protocol-mappers/models", MAPPER)
        exigir(estado, (201,), "mapper docente_id")
        print("cliente lamb-frontend: mapper docente_id creado")
    else:
        print("cliente lamb-frontend: mapper docente_id ya existia")

    username, nombre, apellido, email = USUARIO
    representacion = {
        "username": username, "firstName": nombre, "lastName": apellido, "email": email,
        "emailVerified": True, "enabled": True, "requiredActions": [],
        "attributes": {"docenteId": [str(args.docente_id)]},
    }
    _, encontrados = kc.pedir("GET", f"{base}/users?exact=true&username={urllib.parse.quote(username)}")
    if encontrados:
        uid = encontrados[0]["id"]
        estado, _ = kc.pedir("PUT", f"{base}/users/{uid}", representacion)
        accion = "actualizado"
    else:
        estado, _ = kc.pedir("POST", f"{base}/users", representacion)
        _, encontrados = kc.pedir("GET", f"{base}/users?exact=true&username={urllib.parse.quote(username)}")
        uid = encontrados[0]["id"]
        accion = "creado"
        exigir(estado, (201,), username)
    exigir(estado, (201, 204), username)
    if accion == "creado":
        estado, _ = kc.pedir("PUT", f"{base}/users/{uid}/reset-password",
                             {"type": "password", "value": claves["DOCENTE_PASSWORD"], "temporary": False})
        exigir(estado, (204,), f"{username}: clave inicial")
    _, rol = kc.pedir("GET", f"{base}/roles/DOCENTE")
    kc.pedir("POST", f"{base}/users/{uid}/role-mappings/realm", [rol])
    print(f"{username}: {accion}, rol DOCENTE, docenteId {args.docente_id}")


if __name__ == "__main__":
    main()
