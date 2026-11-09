"""Crea el esquema de LAMB Academic en una base Oracle NUEVA (contenedor de compose-dev.yml).

Ejecuta, dentro del contenedor y como LAMB_APP, V1, V2 y V4 y, salvo --sin-datos-demo, V3 (personas ficticias).
La clave de LAMB_APP se lee de infra/.env (APP_USER_PASSWORD) y no se imprime.

Se niega a continuar si LAMB_APP ya tiene tablas: nunca modifica una base con datos.

Uso: python -I infra/oracle/inicializar_base.py [--contenedor lamb-academic-oracle] [--sin-datos-demo]
"""
import argparse
import os
import subprocess
import sys
import time

ORACLE = os.path.dirname(os.path.abspath(__file__))
ENV_INFRA = os.path.join(os.path.dirname(ORACLE), ".env")
SCRIPTS = ["V1__esquema_base_matricula", "V2__integracion_modulos", "V4__resultado_detalle_matricula"]
DEMO = "V3__datos_demo"
SALTO = chr(10)
RETORNO = chr(13)


def clave_app():
    if os.path.exists(ENV_INFRA):
        for linea in open(ENV_INFRA, encoding="utf-8"):
            if linea.startswith("APP_USER_PASSWORD="):
                valor = linea.strip().split("=", 1)[1].strip()
                if valor:
                    return valor
    sys.exit("Falta APP_USER_PASSWORD en infra/.env (copie infra/.env.example y complete las claves).")


def sqlplus(contenedor, clave, entrada):
    """Ejecuta sqlplus como LAMB_APP; la clave viaja como variable de entorno del proceso, no en la salida."""
    orden = ["docker", "exec", "-i", "-e", "LAMB_CLAVE", contenedor, "bash", "-c",
             'sqlplus -S -L "LAMB_APP/$LAMB_CLAVE@localhost:1521/FREEPDB1"']
    entrada = "SET DEFINE OFF" + SALTO + entrada.replace(RETORNO, "")
    r = subprocess.run(orden, input=entrada.encode("utf-8"), capture_output=True,
                       env={**os.environ, "LAMB_CLAVE": clave, "MSYS_NO_PATHCONV": "1"})
    return r.returncode, r.stdout.decode("utf-8", "replace"), r.stderr.decode("utf-8", "replace")


def main():
    parser = argparse.ArgumentParser(description="Inicializa el esquema LAMB_APP en una base Oracle nueva.")
    parser.add_argument("--contenedor", default="lamb-academic-oracle")
    parser.add_argument("--sin-datos-demo", action="store_true", help="No carga V3 (personas y oferta ficticias)")
    args = parser.parse_args()
    clave = clave_app()

    consulta = SALTO.join(["SET HEADING OFF FEEDBACK OFF", "SELECT 'TABLAS=' || COUNT(*) FROM USER_TABLES;", "EXIT", ""])
    for intento in range(60):
        _, salida, _ = sqlplus(args.contenedor, clave, consulta)
        if "TABLAS=" in salida:
            break
        if intento == 0:
            print("Esperando a que Oracle acepte conexiones de LAMB_APP...")
        time.sleep(5)
    else:
        sys.exit("No se pudo conectar como LAMB_APP. Revise que el contenedor este iniciado y que la clave de infra/.env sea la suya.")

    tablas = int(salida.split("TABLAS=")[1].split()[0])
    if tablas:
        sys.exit(f"LAMB_APP ya tiene {tablas} tablas: este script solo inicializa una base nueva. No se cambio nada.")

    for nombre in SCRIPTS + ([] if args.sin_datos_demo else [DEMO]):
        contenido = open(os.path.join(ORACLE, nombre + ".sql"), encoding="utf-8").read()
        codigo, salida, error = sqlplus(args.contenedor, clave, contenido)
        errores = [linea for linea in salida.splitlines() if linea.startswith(("ORA-", "SP2-"))]
        if codigo != 0 or errores:
            print(SALTO.join(errores[:5]) or error[:500])
            sys.exit(f"{nombre}: fallo. Los scripts anteriores ya se aplicaron; revise el error antes de repetir.")
        print(f"{nombre}: aplicado")
    print("Esquema listo." + ("" if args.sin_datos_demo else " Datos de demostracion cargados (personas ficticias)."))


if __name__ == "__main__":
    main()
