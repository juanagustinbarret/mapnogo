# Logo de NOGOMAP

Rana sobre un mapa plegado, con un pin. Diseño propio, plano.

| Archivo | Uso |
|---|---|
| `logo.svg` | Diseño completo (también en `public/logo.svg`). PWA 192/512, imagen para compartir. |
| `logo-chico.svg` | Versión simplificada, grilla de 32 px: favicon SVG, 32 px y el encabezado (`src/components/LogoNogomap.tsx`). |
| `logo-16.svg` | Versión de 16 px alineada a píxeles (favicon 16 y .ico). |
| `logo-maskable.svg` | Fondo completo con el dibujo dentro de la zona segura (Android). |
| `logo-apple.svg` | Ícono de iOS (180 px, sin transparencia). |
| `badge.svg` | Insignia de las notificaciones: blanco sobre transparente. |

Colores: verde fondo `#15803d`, rana `#4ade80`, mapa `#fef3c7` / `#fde68a`, pin `#ef4444`.

Si se cambia algún ícono, subir el `?v=` en `index.html`, `public/manifest.json`
y `public/sw.js`, y cambiar `VERSION` en `public/sw.js`.
