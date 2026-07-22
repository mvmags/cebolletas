# Guía de publicación

## 1. Subir la carpeta al repositorio GitHub

Repositorio: https://github.com/mvmags/cebolletas

### Opción A: usando Git

1. Clona el repositorio:
   git clone https://github.com/mvmags/cebolletas.git
2. Entra al repositorio:
   cd cebolletas
3. Copia dentro la carpeta cebolletas-copal y renómbrala como copal.
4. Verifica que exista: copal/index.html
5. Ejecuta:
   git add copal
   git commit -m "Add Cebolletas Copal microsite"
   git push origin main

### Opción B: desde github.com

1. Abre el repositorio.
2. Selecciona Add file > Upload files.
3. Arrastra la carpeta completa.
4. Antes de confirmar, revisa que las rutas empiecen con copal/.
5. Escribe el mensaje Add Cebolletas Copal microsite y confirma el commit.

Importante: guardar archivos en GitHub no los publica automáticamente en GoDaddy.

## 2. Publicar en GoDaddy

1. Abre GoDaddy > Mis productos > Web Hosting > Administrar.
2. Abre cPanel Admin > File Manager.
3. Entra a la raíz documental de cebolletas.mx. Normalmente es public_html, pero si el dominio es adicional puede ser otra carpeta.
4. Crea la carpeta copal.
5. Sube el contenido del paquete dentro de esa carpeta.
6. La ruta final debe ser public_html/copal/index.html, no public_html/copal/cebolletas-copal/index.html.
7. Comprueba https://cebolletas.mx/copal/ en una ventana privada.

## 3. Configurar la URL

Si cebolletas.mx ya apunta al mismo hosting y los archivos están en la raíz documental correcta, no necesitas una redirección: Apache mostrará automáticamente copal/index.html.

Para forzar que /copal redirija a /copal/ se puede agregar en el archivo .htaccess de la raíz:

RewriteEngine On
RewriteRule ^copal$ /copal/ [R=301,L]

No agregues una redirección hacia la URL temporal de ChatGPT; el sitio debe servirse directamente desde GoDaddy.

## 4. Verificación

- https://cebolletas.mx/copal/ carga sin error 404.
- La imagen y el logo aparecen.
- El selector Español/English funciona.
- El menú móvil abre.
- La página principal cebolletas.mx sigue funcionando.
- La conexión usa HTTPS sin advertencias.
