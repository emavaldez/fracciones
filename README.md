# Pizzería La Fracción 🍕

Juego web para aprender y practicar operaciones con fracciones, pensado para 1.° y 2.° año de la secundaria.
El jugador atiende una pizzería: cada sector de la cocina es un tema y cada ejercicio es una comanda.

## Qué tiene

- **9 sectores, 36 niveles** (3 niveles + 1 jefe por sector). Todos abiertos desde el principio: se elige qué jugar.
  1. El Mostrador: leer fracciones, equivalentes, simplificar, comparar (también con negativos)
  2. La Mesa de Amasado: números mixtos, decimales finitos y periódicos
  3. El Horno: suma y resta
  4. La Tabla de Cortar: multiplicación, división, inverso, “fracción de”
  5. La Cámara de Fermentación: potencias, exponente 0 y negativo, propiedades
  6. La Huerta: raíces cuadradas, cúbicas, de decimales, propiedades y trampas
  7. La Cocina a Full: operaciones combinadas (términos, paréntesis, corchetes)
  8. La Receta Secreta: ecuaciones (uno y dos pasos, x en los dos miembros, potencias y raíces)
  9. El Delivery: problemas con enunciado, incluidos los de plantear la ecuación y resolverla
- **Ecuaciones paso a paso**: en La Receta Secreta y en los problemas del Delivery, la ecuación se despeja en una mesa de trabajo.
  Se arrastra un término al otro lado del `=` (o se lo toca y se elige qué hacer) y el juego pregunta cómo llega: sumando o restando,
  multiplicando o dividiendo, como raíz o como potencia. Las cuentas para juntar términos las hace el jugador con el teclado.
  Cada error se explica en el momento, se puede deshacer, la pista sugiere el próximo paso y al final se muestran todos los pasos.
  Quien ya sabe el resultado puede tocar "Saltear pasos" y escribirlo directo.
- **Ejercicios generados al azar**: cada partida es distinta.
- **Explicación de errores**: si la respuesta coincide con un error típico (sumar denominadores, multiplicar en vez de dividir, elevar solo el numerador, olvidarse del signo, etc.), el juego dice exactamente qué pasó. Siempre muestra la resolución paso a paso y la regla para recordar.
- **Revancha**: si se erra una comanda, más adelante aparece otra parecida.
- **Pistas**, rachas, propinas, rangos, jefes con 3 vidas, sonidos y confeti.
- **Recetas**: la teoría de cada sector con ejemplos.
- Teclado propio en pantalla (pensado para el celular) y teclado físico en la compu.
- No guarda nada: el progreso dura mientras la página está abierta.

### Teclado físico

| Tecla | Acción |
| --- | --- |
| Números | Escribir |
| `/`, `Tab`, flechas | Pasar del numerador al denominador (y a la parte entera en los mixtos) |
| `-` | Cambiar el signo |
| `,` o `.` | Coma decimal |
| `Enter` | Servir / siguiente comanda |
| `1`–`4` | Elegir opción en las preguntas de opción múltiple |

### Links directos a un nivel

Sirve para que un docente comparta un tema puntual: `https://tu-sitio.vercel.app/#nivel=3-2`
(sector 3, nivel 2). Los jefes se abren con `J`: `#nivel=5-J`.

## Correrlo en la compu

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev      # abre el juego en http://localhost:5173
npm test         # prueba miles de ejercicios generados
npm run build    # genera la versión para publicar en dist/
```

En modo desarrollo, `http://localhost:5173/#galeria` muestra un ejemplo de cada tipo de ejercicio con su explicación.
`npm run dump` imprime ejemplos en texto, útil para revisarlos.

## Publicarlo en Vercel

1. Subí este repositorio a GitHub.
2. En [vercel.com](https://vercel.com), elegí **Add New → Project** e importá el repositorio.
3. Vercel detecta Vite solo. Dejá la configuración como viene:
   - Build command: `npm run build`
   - Output directory: `dist`
4. Tocá **Deploy**. Cada `git push` a la rama principal vuelve a publicar el sitio.

## Cómo está hecho

React + TypeScript + Vite, sin backend.

```
src/
  math/        fracciones exactas, árbol de expresiones para dibujar la matemática, azar con semilla
  game/
    gen/       generadores de ejercicios, uno por sector (w1.ts … w9.ts)
    worlds.ts  sectores, niveles y jefes
    recipes.ts la teoría de cada sector
    check.ts   corrección de respuestas y diagnóstico de errores
    board.ts   la mesa de ecuaciones: movimientos, cuentas, sugerencias (sin interfaz, con pruebas)
  components/  dibujo de fracciones/potencias/raíces, pizzas, teclado
  screens/     portada, mapa, partida, resultados
tests/         pruebas de los generadores
```

Cada generador devuelve una comanda con: consigna, expresión, respuesta, pista, pasos de resolución, regla y una
lista de **errores típicos** (`traps`): el valor al que se llega con ese error y el mensaje que explica qué pasó.

Las pruebas generan cientos de ejercicios por tipo y verifican que la respuesta correcta se acepte, que ningún
error típico coincida con la respuesta, y que **todas las igualdades de las explicaciones sean verdaderas**.
Para la mesa de ecuaciones, resuelven miles de ecuaciones siguiendo las pistas y también haciendo movimientos al azar,
y comprueban que después de cada paso la ecuación siga teniendo la misma solución.

### Agregar un tipo de ejercicio

1. Escribí un generador en `src/game/gen/` con `gen("id-unico", (r) => ({ ... }))`.
2. Sumalo a un nivel en `src/game/worlds.ts`.
3. Corré `npm test`.
