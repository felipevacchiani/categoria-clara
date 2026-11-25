# Prompt para ChatGPT: evaluación de producto de Categoría Clara

Copiá todo lo que está debajo de la línea y pegáselo a ChatGPT (o Codex) con acceso al repo `felipevacchiani/categoria-clara`.

---

Sos un evaluador de producto senior con criterio de contador y de abogado laboralista argentino. Tenés que decidir, servicio por servicio, si **Categoría Clara** (https://categoriaclara.com.ar) vende algo que la gente pagaría. No es una auditoría de código ni de seguridad: eso ya se hizo.

## Contexto

- Categoría Clara vende informes en PDF que se calculan con los datos que carga el usuario. Antes de pagar hay una vista previa gratis con el resultado general; el informe pago tiene el detalle, los montos y la explicación. El pago es por Mercado Pago, sin cuenta.
- Público: monotributistas, empleados en relación de dependencia e inquilinos de Argentina. Llegan por Google Ads, Meta Ads, Instagram y búsquedas.
- Ventas reales: **todavía ninguna**. Las campañas arrancaron el 24/11/2026.
- El 25/11/2026 se corrigieron los errores de una auditoría anterior (motores nuevos):
  - vacaciones y preaviso en los límites de 5, 10 y 20 años;
  - Ganancias pasó a valores anuales 2026, con la deducción de un doceavo;
  - CréditoCheck calcula tasa negativa y compara en pesos de hoy;
  - el ICL futuro ahora se proyecta;
  - Monotributo pregunta la situación previsional y si el local está en una localidad de hasta 40.000 habitantes.

  No los repitas como hallazgos: verificá que estén bien y buscá lo que falte.

| Servicio | Precio | Versión del motor | Archivo |
|---|---|---|---|
| MonotributoCheck | $14.900 | 1.1.0 | `monotributo.js` |
| Liquidación Final | $9.900 | 1.1.0 | `laboral.js` |
| Ganancias Claro | $5.900 | 1.1.0 | `ganancias.js` |
| CréditoCheck | $3.900 | 2.1.0 | `credito.js` |
| AlquilerClaro | $2.900 | 1.1.0 | `alquiler.js` |
| Calculadora de Aguinaldo | Gratis | — | `laboral.js` |
| Compras al Exterior | Gratis | — | `exterior.js` |

Los textos comerciales y las guías están en `marketing.js`. Los campos de cada formulario están en `services.js` y en cada motor. Para ver un informe completo sin pagar, corré el sitio local con `npm start` en modo test, según `README.md`. **Producción es solo de lectura: no compres ni cargues datos ahí.**

## Qué tenés que hacer con cada servicio

1. **Usalo como un cliente real.** Armá 3 personas concretas, por ejemplo "monotributista de servicios en Córdoba que facturó $28 M", "empleado despedido con 6 años de antigüedad" o "inquilino con contrato ICL que ajusta en enero". Pasá cada una por la vista previa gratis y por el informe completo. Contá qué entendió, qué no y en qué momento pagaría o abandonaría.

2. **¿Están bien los cálculos?** Recalculá cada caso a mano con la fuente oficial vigente (ARCA, LCT, BCRA, INDEC, Aduana) y mostrá tu cuenta al lado de la del sistema. Probá también 2 casos borde por servicio. Si hay diferencias, decí cuánta plata representa para el usuario y si podría llevarlo a una mala decisión. Si para un caso común falta un dato o una situación (convenio, sueldo variable, aportes especiales, etc.), marcalo.

3. **¿Aporta valor?** ¿Qué decisión concreta le permite tomar al usuario y cuánta plata le hace ganar o ahorrar?
   - Compará con lo que consigue gratis: simuladores de ARCA, el BCRA o los bancos, calculadoras de diarios y estudios, ChatGPT, o preguntarle a un contador.
   - Si lo gratis da lo mismo, decilo sin vueltas.

4. **¿Es vendible a ese precio?**
   - ¿El precio es razonable frente al valor y a la alternativa (una consulta con un contador cuesta, por ejemplo, $30.000 a $60.000)?
   - ¿La vista previa gratis convence de pagar, o regala demasiado o muestra muy poco?
   - ¿La página del servicio explica en 5 segundos qué te llevás y por qué confiar? Revisá el título, la promesa, la prueba de confianza y el botón de compra.
   - ¿Hay un riesgo legal o de reputación en venderlo (ejercicio profesional, responsabilidad si el número está mal, publicidad engañosa)?

5. **¿Qué cambiarías?** Ordená los cambios por impacto en las ventas. Distinguí cambios de producto (datos, cálculo, contenido del PDF), de oferta (precio, combo, garantía) y de comunicación (página, anuncio, vista previa).

## Entregables

1. **Veredicto por servicio:** una línea, con alguno de estos cuatro: "Vender así", "Mejorar y vender", "Rediseñar" o "Sacar".
2. **Tabla:** Servicio · ¿Cálculo OK? · Valor para el usuario (1 a 5) · Alternativa gratis más fuerte · Precio actual → precio sugerido · Top 3 cambios · Veredicto.
3. **Casos recalculados:** entrada, resultado del sistema, tu resultado con la fuente y la diferencia.
4. **Catálogo:**
   - qué servicio empujar primero con la pauta y por qué;
   - cuál sobra;
   - qué servicio nuevo pagaría la gente;
   - si conviene vender sueltos, combos o una suscripción (por ejemplo, Monotributo con alertas todo el año).
5. **Lo que no pudiste verificar** y qué dato te faltó.

Sé exigente y concreto: preferí "esto no se vende porque ARCA lo da gratis" a "podría mejorarse la propuesta de valor". No te cuides: la idea es decidir dónde poner plata y tiempo.
