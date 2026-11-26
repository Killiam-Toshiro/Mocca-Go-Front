# Paleta y tokens de color de Mocca Go

**Estado:** aprobada por el usuario el 2026-11-10 (decisión D-027). Identidad: naranja ámbar con marrones claros («café con leche»).

## Una sola fuente de verdad

Todos los colores de la app se definen **solo** en el bloque `:root` de `src/app/globals.css`. Los componentes usan nombres de rol (`bg-primary`, `text-muted-foreground`, `text-brand-strong`…), nunca valores sueltos como `#fd8000` ni clases como `bg-orange-500`. Cambiar la identidad visual = editar ese bloque. No hay que tocar componentes.

Excepción: el ícono de la pestaña (`src/app/icon.svg`) y los activos de `docs/brand/` no pueden leer variables CSS; llevan los mismos valores escritos a mano (ver «Cómo cambiar un color»).

## Tokens

| Token | Valor | Rol | Clase de Tailwind |
|---|---|---|---|
| `--background` | `#fbf5ee` crema | Fondo de la app | `bg-background` |
| `--foreground` | `#2e1b0f` espresso | Texto principal | `text-foreground` |
| `--card` / `--popover` | `#fffdfa` blanco cálido | Tarjetas, formularios, encabezado | `bg-card` |
| `--secondary` / `--muted` / `--accent` | `#f3e6d8` café con leche | Menú lateral, zonas suaves, fondo al pasar el cursor | `bg-secondary`, `bg-accent` |
| `--muted-foreground` | `#735c49` tostado | Texto secundario | `text-muted-foreground` |
| `--primary` | `#fd8000` ámbar | Botón principal, ítem activo del menú | `bg-primary` |
| `--primary-foreground` | `#2e1b0f` espresso | Texto sobre el ámbar | `text-primary-foreground` |
| `--brand` | `#fd8000` ámbar | Logo (igual a `--primary`) | `fill-brand`, `bg-brand` |
| `--brand-strong` | `#a94400` naranja tostado | Enlaces y texto de marca («Go») | `text-brand-strong` |
| `--destructive` | `#b42318` rojo | Errores y acciones destructivas | `text-destructive`, `bg-destructive` |
| `--destructive-foreground` | `#ffffff` | Texto sobre el rojo | `text-destructive-foreground` |
| `--border` | `#e6d5c3` | Líneas decorativas | `border` |
| `--input` | `#9c8470` | Borde de campos (3:1 sobre fondos claros) | `border-input` |
| `--ring` | `#c25a00` | Anillo de foco | `ring-ring` |
| `--font-display` | Georgia, serif | Logo y títulos de marca (provisional) | `font-display` |

## Contrastes (WCAG 2.2 AA)

| Par | Contraste | Mínimo |
|---|---|---|
| espresso sobre crema | 15.2 | 4.5 |
| espresso sobre ámbar (botón) | 6.5 | 4.5 |
| tostado sobre crema / café con leche | 5.8 / 5.1 | 4.5 |
| naranja tostado sobre crema / blanco cálido / café con leche | 5.5 / 5.9 / 4.9 | 4.5 |
| rojo sobre crema · blanco sobre rojo | 6.1 · 6.6 | 4.5 |
| borde de campo sobre blanco cálido / crema | 3.5 / 3.3 | 3 |
| anillo de foco sobre blanco cálido / crema / café con leche | 4.4 / 4.1 / 3.6 | 3 |

**Reglas que salen de estos números**
- **Nunca texto blanco sobre el ámbar** (2.5): el botón principal lleva texto espresso.
- **Nunca texto o enlaces en ámbar sobre fondos claros** (2.4): para texto de marca se usa `--brand-strong`. El ámbar solo se usa como relleno (botón, logo, ítem activo).
- Los errores usan rojo, no naranja, para no confundirse con la marca.

## Cómo cambiar un color

1. Edita el valor en `:root` de `src/app/globals.css` (hex de 6 dígitos).
2. Ejecuta `npm test`: `src/lib/design/tokens.test.ts` lee esos valores y comprueba los pares de la tabla de contrastes (texto ≥ 4.5, componentes ≥ 3). Si falla, el nuevo color no es legible; ajústalo.
3. Si cambiaste `--brand` o `--foreground`, actualiza a mano `src/app/icon.svg`, `docs/brand/mocca-go-icono.svg` y `docs/brand/mocca-go-logo.svg`.
4. Actualiza esta tabla y, si es una decisión de identidad, `docs/decisions.md`.
5. Corre `npm run e2e` si cambió algo que afecte la disposición (no solo colores).

## Cómo agregar un token

Añade la variable en `:root` y su alias en `@theme inline` (`--color-nombre: var(--nombre);`), de modo que Tailwind genere `bg-nombre`, `text-nombre`, etc. Agrega sus pares a `tokens.test.ts`. Ejemplos previstos: `--success` y `--warning` para estados de pedido (incremento 3), `--brand-soft` para insignias.

## Logo

Taza de café con vapor, en espresso, dentro de un círculo ámbar, con el nombre «Mocca **Go**» al lado («Go» en naranja tostado).
- En la app: componente `src/components/logo.tsx` (`Logo` y `LogoMark`), que usa los tokens (`fill-brand`, `fill-foreground`, `text-brand-strong`, `font-display`).
- Ícono de la pestaña: `src/app/icon.svg`.
- Para usos externos: `docs/brand/mocca-go-logo.svg` y `docs/brand/mocca-go-icono.svg`.
- La tipografía del nombre (Georgia) es provisional; se cambia en `--font-display`.

## Pendientes de identidad

- Modo oscuro: fuera de alcance por ahora (la app es solo clara). Si se agrega, se redefinen los tokens en `.dark`/`prefers-color-scheme`.
- Tipografía definitiva de marca.
- Colores de estado de pedido (nuevo, preparando, en camino…): se definen en el incremento 3 junto con la pantalla de seguimiento.
