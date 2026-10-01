# Maquetas UX/UI · PEDSAR

41 pantallas HTML que completan el rediseño de Figma (paleta **Grafito y cian**, tipografía **Inter**).
Usan los mismos tokens, componentes e íconos (lucide) que el archivo de Figma y que la app.

| Grupo | Pantallas |
|---|---|
| Sitio público | Nosotros, Contacto, Privacidad, 404 |
| Autenticación | Iniciar sesión, Crear cuenta, Recuperar, Nueva contraseña |
| Portal del estudiante | Inicio, Mis cursos, Aula virtual, Evaluaciones, Rendir evaluación, Certificados, Ver certificado, Pagos |
| Portal del instructor | Inicio, Contenidos, Sesiones y horarios, Asistencia, Crear evaluación, Estudiantes y notas |
| Administración | Panel, Reportes, Cursos, Categorías, Certificados, Inscripciones y pagos, Cupones, Usuarios y roles, Auditoría |
| Cuenta | Mi perfil, Notificaciones |
| Móvil (390 px) | Inicio, Catálogo, Detalle, Pago con Yape, Portal, Aula virtual, Verificar, Login |

## Ver las maquetas

```bash
python -m http.server 5510 --directory diseno/maquetas
```

Abrir http://localhost:5510 (galería con miniaturas). Cada archivo de `desktop/` mide 1440 px y cada uno de `movil/` 390 px.

## Importar a Figma con html.to.design

1. Instalar el plugin **html.to.design** en Figma y su extensión para Chrome.
2. Con el servidor local encendido, abrir una pantalla (por ejemplo `desktop/admin-panel.html`) en Chrome.
3. Capturarla con la extensión (ancho 1440 para desktop, 390 para móvil) e importar el resultado desde el plugin.
4. Colocarla en la página «02 · Pantallas desktop» o «03 · Pantallas móvil» del archivo *PEDSAR · Rediseño UX/UI 2026*.

La importación por URL del plugin necesita una dirección pública; `localhost` solo funciona con la extensión.

## Regenerar o editar

Las pantallas se generan con Node a partir de `fuente/`:

```bash
node diseno/maquetas/fuente/generar.mjs
```

- `pedsar.css` — tokens (mismas variables que Figma) y estilos de componentes.
- `fuente/lib.mjs` — componentes (botón, badge, campo, tabla, menú lateral…) y layouts.
- `fuente/<módulo>.mjs` — contenido de cada pantalla.
