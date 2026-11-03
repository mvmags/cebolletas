# Cebolletas v10.8.1 — Entrega local

Implementación terminada el 2 de noviembre de 2026. El usuario subió la rama y creó el PR #83. Al actualizar este documento, el PR sigue abierto y sin fusionar; la verificación posterior al despliegue está pendiente. No se creó la etiqueta v10.8.1.

## Base y rama

- Producción: main, publicación desde la raíz de GitHub Pages, según la configuración verificada anteriormente en este chat.
- Base: ebeda11c7fd841e5efe6c36bc02c384a14313c44, merge del PR #82, etiqueta v10.8.0.
- git fetch origin --tags --prune y git pull --ff-only origin main: correctos; sin divergencia. main y origin/main coincidían con v10.8.0.
- La portada publicada en https://cebolletas.mx/ mostró Cebolletas Rancho Privado y Naturaleza, coherente con v10.8.0.
- No se encontraron AGENTS.md aplicables.
- Worktree: /Users/marcovelasco/code/cebolletas-v10.8.1.
- Rama: version-10.8.1-root-redirect.
- Commit de implementación: a6f405714f6d4799c098d42566f245c39cde8e1b.
- PR: https://github.com/mvmags/cebolletas/pull/83, hacia main.
- El commit remoto del PR coincide con el revisado localmente.
- Mensaje: feat: redirect root domain to cebolletas.com.
- Estado después del commit de implementación: limpio. Este documento se agregó después, por solicitud del usuario, y queda pendiente de commit y push.

## Alcance

Archivos de esta entrega:

- index.html: único cambio funcional.
- cebolletas-v10.8.1-handoff.md: documentación de entrega agregada por solicitud del usuario.

Destino constante y exacto: https://cebolletas.com/.

La página tiene lang=es, UTF-8, viewport, noindex/follow, canonical, meta-refresh inmediato, window.location.replace(), título, estilos mínimos propios y enlace visible. No copia parámetros ni fragmentos. No carga hojas de estilo, scripts, fuentes o imágenes externos. Los recursos de la portada anterior siguen conservados. No se creó una copia de respaldo separada de index.html.

Sin cambios: copal/, copal/manage/, reglamento/, CNAME, todos los recursos existentes y Supabase. No hubo acciones de DNS, configuración de www, hosting, proxy ni Edge Functions.

En el repositorio original había un archivo sin seguimiento: supabase/v10.8.1-supabase-2026-10-08.tar.gz. El usuario autorizó continuar en el worktree aislado dejando ese archivo intacto. Al terminar la implementación, el repositorio original seguía mostrando únicamente ese archivo sin seguimiento.

## Validación ejecutada

- Revisión de HTML con HTMLParser: etiquetas correctamente cerradas y estructura coherente; metadatos y destinos requeridos comprobados.
- Script inline: node --check pasó. Ejecución aislada con un objeto window simulado confirmó la llamada a replace con el destino exacto.
- CSS autocontenido: revisión visual y balance de llaves correctos.
- git diff --check y git diff --cached --check: correctos.
- git diff --name-only frente a la base, antes de agregar este documento: únicamente index.html. La entrega incluye además este archivo Markdown; no amplía el cambio funcional.
- git diff --quiet -- copal/ reglamento/ supabase/ CNAME assets/ images/: correcto.
- Respuesta HTTP local de /: 200 OK; comportamiento esperado, sin Location HTTP.
- Prueba real de navegador desde http://127.0.0.1:8080/?source=local-test#intro: terminó en https://cebolletas.com/, sin parámetros ni fragmentos y sin bucle observado. No se registraron errores/advertencias en los logs consultados de esa pestaña.
- https://cebolletas.com/ también cargó de forma independiente.
- Meta-refresh: probado con el mismo HTML servido en 8081 y una cabecera temporal Content-Security-Policy: script-src 'none'. La ejecución del script quedó bloqueada y el navegador llegó a https://cebolletas.com/. Esta prueba bloquea JavaScript por CSP; no cambia el ajuste global del navegador.
- Enlace alternativo: probado con el mismo HTML servido en 8082 con script-src 'none'; sandbox allow-same-origin, bloqueando además la navegación automática. El texto y enlace permanecen visibles; Tab alcanza el enlace y su destino es correcto.
- Los servidores auxiliares leen el index.html original del worktree; no guardan copias ni alteran el documento. Sus cabeceras de prueba no forman parte de la implementación.
- /copal/: carga localmente y muestra su página pública.
- /copal/manage/: carga localmente y muestra la pantalla de acceso administrativo. No se inició sesión ni se escribieron datos.
- /reglamento/: carga localmente y muestra su contenido.
- Esta comprobación de las páginas protegidas es de carga y preservación de archivos, no una prueba completa del flujo de reservas o de Supabase.
- Evidencia visual: /Users/marcovelasco/code/cebolletas-v10.8.1-fallback-desktop.jpg.

Las restricciones iniciales de red del entorno se resolvieron mediante permisos aprobados. No queda ningún comando bloqueado que el usuario deba ejecutar manualmente.

## Vista previa

La validación usó un servidor en http://127.0.0.1:8080/. Para iniciarlo nuevamente:

```bash
cd /Users/marcovelasco/code/cebolletas-v10.8.1
python3 -m http.server 8080 --bind 127.0.0.1
```

Abrir http://127.0.0.1:8080/ navega al sitio .com real. Para revisar las rutas conservadas:

- http://127.0.0.1:8080/copal/
- http://127.0.0.1:8080/copal/manage/
- http://127.0.0.1:8080/reglamento/

## Estado del PR y siguientes pasos

El usuario ya subió la rama y creó el [PR #83](https://github.com/mvmags/cebolletas/pull/83). La revisión confirmó que el PR apunta a main, contiene el commit de implementación esperado y puede fusionarse sin conflictos. No se reportaron estados de CI ni ejecuciones de workflows de PR en las consultas realizadas.

Este documento queda en el worktree, sin staging, commit ni push. Para incluirlo en el PR:

```bash
cd /Users/marcovelasco/code/cebolletas-v10.8.1
git add cebolletas-v10.8.1-handoff.md
git diff --cached --check
git commit -m "docs: add v10.8.1 redirect handoff"
git push origin version-10.8.1-root-redirect
```

El usuario indicó que fusionará el PR con main después de subir este documento. La fusión iniciará el proceso existente de GitHub Pages. La revisión en producción debe realizarse cuando el despliegue termine correctamente. La etiqueta v10.8.1 no forma parte de estos pasos.

## Comprobaciones después del despliegue

```bash
curl -sSIL https://www.cebolletas.mx/ | grep -Ei '^(HTTP|location:)'
curl -sSIL https://www.cebolletas.mx/copal/ | grep -Ei '^(HTTP|location:)'
curl -sSIL https://www.cebolletas.mx/copal/manage/ | grep -Ei '^(HTTP|location:)'
```

Verificar en navegador:

- https://cebolletas.mx/ → https://cebolletas.com/.
- https://www.cebolletas.mx/ → 301 existente a cebolletas.mx/ → navegación a https://cebolletas.com/.
- https://cebolletas.mx/copal/ y https://cebolletas.mx/copal/manage/ siguen disponibles.
- https://www.cebolletas.mx/copal/ y https://www.cebolletas.mx/copal/manage/ siguen canonicalizando hacia sus rutas equivalentes en el apex .mx.
- https://cebolletas.mx/reglamento/ sigue disponible.

Estas comprobaciones posteriores al despliegue siguen pendientes. El PR sigue abierto al actualizar este documento; subir la rama por sí solo no publica el cambio en producción. No se espera un 301/308 de la respuesta raíz apex: el documento devuelve inicialmente 200 y navega en el navegador.
