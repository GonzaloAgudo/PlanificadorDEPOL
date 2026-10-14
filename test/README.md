# Pruebas de la lógica de dominio

Batería de pruebas unitarias sobre los módulos que contienen las reglas del
dominio: el baremo de las pruebas físicas, los datos del temario oficial y el
motor de recomendaciones.

## Cómo ejecutarlas

```
node --import ./test/enlace.mjs --test "test/*.test.mjs"
```

Con informe de cobertura:

```
node --import ./test/enlace.mjs --test --experimental-test-coverage "test/*.test.mjs"
```

Necesita Node 22.15 o superior (usa `module.registerHooks`). No hay que
instalar nada: el corredor de pruebas viene incorporado en Node.

## Qué hay aquí

- `dominio.test.mjs` — los 23 casos de prueba.
- `doble-firestore.mjs` — doble de prueba que reemplaza a Cloud Firestore.
  Guarda los datos en memoria y reproduce las consultas con filtros de
  igualdad, que es lo único que usa `recomendaciones.js`. Rechaza a propósito
  cualquier otro operador: si el código de producción pasa a usar consultas
  más complejas, las pruebas fallan en lugar de seguir pasando contra un
  doble que ya no representa al original.
- `enlace.mjs` — gancho de resolución de módulos. `recomendaciones.js` importa
  el SDK de Firestore desde la CDN de Google; este gancho intercepta esa
  importación y la redirige al doble. Así las pruebas corren contra el código
  de producción sin modificarlo y sin necesidad de red ni de cuenta.

## Qué no cubren

La fórmula de cálculo de notas vive dentro de `js/calcular-nota.js` y no se
exporta, así que los casos PU-21 a PU-23 trabajan sobre una copia de la
fórmula, no sobre el código que se ejecuta de verdad. Conviene extraerla a su
propio módulo, como están `baremo-fisicas` o `temario-oficial`.
