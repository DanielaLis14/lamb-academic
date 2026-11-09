"""Instantanea legible del realm lamb-academic y comparacion entre dos instantaneas (solo lectura).

Guarda roles de realm, cliente lamb-frontend con sus mappers, perfil de usuario y cada usuario con su estado,
atributos y roles. No incluye claves ni credenciales. Complementa al respaldo completo de la base de Keycloak.

Uso:
  python -I infra/keycloak/instantanea_realm.py guardar ARCHIVO.json [--keycloak URL]
  python -I infra/keycloak/instantanea_realm.py comparar ANTES.json DESPUES.json
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


def leer_env(ruta):
    valores = {}
    for linea in open(ruta, encoding="utf-8"):
        if "=" in linea and not linea.lstrip().startswith("#"):
            k, v = linea.rstrip("\n").split("=", 1)
            valores[k.strip()] = v
    return valores


def obtener(url, ruta, token):
    req = urllib.request.Request(url + ruta, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())


def token_admin(url):
    infra = leer_env(os.path.join(RAIZ, ".env"))
    datos = urllib.parse.urlencode({"grant_type": "password", "client_id": "admin-cli",
                                    "username": infra.get("KC_ADMIN_USERNAME", "admin"),
                                    "password": infra["KC_ADMIN_PASSWORD"]}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(
                url + "/realms/master/protocol/openid-connect/token", data=datos)) as r:
            return json.loads(r.read().decode())["access_token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"No se pudo autenticar como administrador de Keycloak (HTTP {e.code})")


def guardar(archivo, url):
    token = token_admin(url)
    base = f"/admin/realms/{REALM}"
    realm = obtener(url, base, token)
    cliente = obtener(url, f"{base}/clients?clientId={CLIENTE}", token)[0]
    usuarios = []
    for u in sorted(obtener(url, f"{base}/users?max=1000&briefRepresentation=false", token), key=lambda u: u["username"]):
        roles = obtener(url, f"{base}/users/{u['id']}/role-mappings/realm", token)
        usuarios.append({
            "username": u["username"], "enabled": u.get("enabled"), "email": u.get("email"),
            "attributes": u.get("attributes", {}), "requiredActions": u.get("requiredActions", []),
            "rolesRealm": sorted(r["name"] for r in roles),
            "credenciales": sorted(c["type"] for c in obtener(url, f"{base}/users/{u['id']}/credentials", token)),
        })
    instantanea = {
        "realm": {k: realm.get(k) for k in ("realm", "enabled", "defaultLocale", "sslRequired", "accessTokenLifespan")},
        "rolesRealm": sorted((r["name"], r.get("description")) for r in obtener(url, f"{base}/roles", token)),
        "cliente": {k: cliente.get(k) for k in ("clientId", "publicClient", "standardFlowEnabled", "directAccessGrantsEnabled",
                                                 "redirectUris", "webOrigins", "attributes")},
        "mappers": sorted(({"name": m["name"], "config": m["config"]} for m in obtener(
            url, f"{base}/clients/{cliente['id']}/protocol-mappers/models", token)), key=lambda m: m["name"]),
        "perfilAtributos": [a["name"] for a in obtener(url, f"{base}/users/profile", token)["attributes"]],
        "usuarios": usuarios,
    }
    json.dump(instantanea, open(archivo, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"Instantanea guardada: {len(usuarios)} usuarios, {len(instantanea['rolesRealm'])} roles de realm")


def comparar(antes, despues):
    a = json.load(open(antes, encoding="utf-8"))
    d = json.load(open(despues, encoding="utf-8"))
    cambios = []
    for clave in ("realm", "cliente"):
        if a[clave] != d[clave]:
            cambios.append(f"{clave}: cambio la configuracion")
    roles_a, roles_d = {r[0] for r in a["rolesRealm"]}, {r[0] for r in d["rolesRealm"]}
    cambios += [f"rol eliminado: {r}" for r in sorted(roles_a - roles_d)]
    cambios += [f"rol agregado: {r}" for r in sorted(roles_d - roles_a)]
    cambios += [f"rol modificado: {r[0]}" for r in a["rolesRealm"] if r[0] in roles_d and r not in d["rolesRealm"]]
    mappers_a = {m["name"]: m for m in a["mappers"]}
    mappers_d = {m["name"]: m for m in d["mappers"]}
    cambios += [f"mapper eliminado: {n}" for n in sorted(set(mappers_a) - set(mappers_d))]
    cambios += [f"mapper agregado: {n}" for n in sorted(set(mappers_d) - set(mappers_a))]
    cambios += [f"mapper modificado: {n}" for n in sorted(set(mappers_a) & set(mappers_d)) if mappers_a[n] != mappers_d[n]]
    cambios += [f"atributo de perfil agregado: {n}" for n in d["perfilAtributos"] if n not in a["perfilAtributos"]]
    cambios += [f"atributo de perfil eliminado: {n}" for n in a["perfilAtributos"] if n not in d["perfilAtributos"]]
    usuarios_a = {u["username"]: u for u in a["usuarios"]}
    usuarios_d = {u["username"]: u for u in d["usuarios"]}
    cambios += [f"usuario eliminado: {n}" for n in sorted(set(usuarios_a) - set(usuarios_d))]
    cambios += [f"usuario agregado: {n} (roles {usuarios_d[n]['rolesRealm']})" for n in sorted(set(usuarios_d) - set(usuarios_a))]
    for n in sorted(set(usuarios_a) & set(usuarios_d)):
        for campo in ("enabled", "email", "attributes", "requiredActions", "rolesRealm", "credenciales"):
            if usuarios_a[n][campo] != usuarios_d[n][campo]:
                cambios.append(f"usuario {n}: cambio {campo}")
    print("\n".join(cambios) if cambios else "Sin diferencias")
    return cambios


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="accion", required=True)
    g = sub.add_parser("guardar")
    g.add_argument("archivo")
    g.add_argument("--keycloak", default=os.environ.get("LAMB_KEYCLOAK_URL", "http://localhost:48080"))
    c = sub.add_parser("comparar")
    c.add_argument("antes")
    c.add_argument("despues")
    args = parser.parse_args()
    if args.accion == "guardar":
        guardar(args.archivo, args.keycloak)
    else:
        comparar(args.antes, args.despues)


if __name__ == "__main__":
    main()
