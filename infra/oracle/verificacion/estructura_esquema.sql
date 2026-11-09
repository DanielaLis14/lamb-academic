-- Estructura del esquema LAMB_APP: columnas, restricciones con nombre, indices y secuencias. Solo lectura.
-- Complementa huella_datos.sql (que compara datos) para verificar que una reversion deja el esquema como estaba:
-- se guarda la salida antes y despues y se comparan los archivos.
-- Ejecutar como LAMB_APP:
--   Get-Content infra/oracle/verificacion/estructura_esquema.sql -Raw |
--     docker exec -i -e LAMB_CLAVE <contenedor> bash -c 'sqlplus -S -L "LAMB_APP/$LAMB_CLAVE@localhost:1521/FREEPDB1"'
-- Las restricciones NOT NULL sin nombre (SYS_C...) se omiten: su nombre cambia al recrearlas, y la columna
-- NULLABLE ya muestra si la columna admite NULL.
SET FEEDBACK OFF HEADING OFF PAGESIZE 0 LINESIZE 300 TRIMSPOOL ON
SELECT 'COLUMNA ' || table_name || '.' || column_name || ' ' || data_type
       || '(' || NVL(TO_CHAR(data_precision), TO_CHAR(char_length)) || ',' || data_scale || ') NULLABLE=' || nullable
  FROM user_tab_columns
 WHERE table_name NOT LIKE 'BIN$%'
 ORDER BY table_name, column_name;
SELECT 'RESTRICCION ' || table_name || ' ' || constraint_name || ' ' || constraint_type || ' ' || status
  FROM user_constraints
 WHERE generated = 'USER NAME' AND table_name NOT LIKE 'BIN$%'
 ORDER BY table_name, constraint_name;
SELECT 'INDICE ' || table_name || ' ' || index_name || ' ' || uniqueness
  FROM user_indexes
 WHERE generated = 'N' AND table_name NOT LIKE 'BIN$%'
 ORDER BY table_name, index_name;
SELECT 'SECUENCIA ' || sequence_name FROM user_sequences WHERE sequence_name NOT LIKE 'ISEQ$$%' ORDER BY 1;
EXIT
