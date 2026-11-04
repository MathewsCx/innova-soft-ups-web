# InnovaSoft UPS

Sitio web académico de cuatro secciones para presentar una iniciativa de aprendizaje y desarrollo de software. Implementado con HTML semántico, CSS mobile-first y JavaScript nativo; no requiere instalar paquetes de ejecución.

## Ejecutar

Abre `index.html` en un navegador. Si tienes Python 3 instalado y prefieres servir el sitio localmente, desde esta carpeta ejecuta:

```powershell
python -m http.server 8000
```

Después visita `http://localhost:8000`.

Las fotografías y las fuentes tipográficas se cargan desde Unsplash y Google Fonts, por lo que requieren conexión a internet. El formulario valida nombre, correo y mensaje en el navegador; no envía ni almacena datos.

## Estructura

- `index.html`: contenido, navegación y formulario.
- `styles.css`: diseño mobile-first, variables, foco visible y adaptaciones para 720 px y 1024 px.
- `app.js`: menú móvil y validación accesible del formulario.
- `.gitignore`: exclusiones para archivos del sistema, secretos locales y artefactos de dependencias.
- `api/`: backend REST independiente para la Tarea de la Unidad 2; no se publica como parte del sitio estático.

## API de la Unidad 2

El backend de gestión de tareas académicas está en [`api/`](./api/README.md). Utiliza Node.js 20 o posterior, Express, Socket.IO y SQLite. Para instalarlo y ejecutarlo, abre PowerShell desde la carpeta `api`:

```powershell
npm install
npm test
npm start
```

La API escucha en `http://localhost:3000`. Las instrucciones de instalación, rutas, ejemplos JSON, eventos de Socket.IO y colección de Postman están documentados en el README de la API. La base SQLite y sus archivos temporales se guardan localmente y están excluidos de Git.

## Antes de entregar

- Comprobar que termine correctamente el despliegue de GitHub Pages y abrir la URL de demostración.
- Adjuntar el informe y las evidencias que correspondan en la plataforma de entrega.

## Verificación local

Revisión manual en navegador realizada el 18 de octubre de 2026:

- A 375 px, 768 px y 1200 px no se observó desbordamiento horizontal.
- En una ventana de 320 px de ancho, equivalente al escenario de reflujo del 400 % desde 1280 px, tampoco se observó desbordamiento.
- El enlace para saltar al contenido transfiere el foco al elemento principal; el menú móvil abre y se cierra con `Escape`.
- El formulario muestra errores para campos vacíos y correo inválido, y valida datos correctos sin enviarlos a un servidor.
- El texto visible cumple la relación de contraste AA correspondiente al tamaño; no se encontraron textos pequeños por debajo de 4.5:1. El texto numerado de las iniciativas alcanza 5.58:1 sobre el fondo de papel.
- El documento tiene idioma declarado, jerarquía de encabezados, identificadores únicos y enlaces internos válidos; las etiquetas de los campos están asociadas.

El repositorio público está en https://github.com/MathewsCx/innova-soft-ups-web y la URL de demostración en GitHub Pages es https://mathewscx.github.io/innova-soft-ups-web/. El sitio se publica automáticamente desde la rama `main`. Los archivos de evidencia e informes de la entrega se mantienen fuera del repositorio.

## Publicación en GitHub

El repositorio está conectado al remoto `origin`. El workflow `.github/workflows/deploy-pages.yml` publica únicamente `index.html`, `styles.css` y `app.js` al subir cambios a `main`; la API no se despliega en GitHub Pages. GitHub Pages debe tener configurado **Settings → Pages → Build and deployment → Source: GitHub Actions**.

```powershell
git add .
git commit -m "Actualizar sitio académico InnovaSoft UPS"
git push
```