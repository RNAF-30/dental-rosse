# Dental Rosse — sitio web publicable

## Incluye
- Sitio adaptable en español.
- Catálogo público con precios en USD.
- Formulario de pedidos guardado en SQLite.
- Panel privado con inicio de sesión, estados de pedidos y gestión de productos.
- Enlace de WhatsApp configurable.
- Contraseñas de administrador con hash bcrypt, sesiones HTTP-only y protección básica de seguridad.

## Requisitos
- Node.js 20 o superior.
- Hosting que permita ejecutar una aplicación Node.js y conservar almacenamiento persistente.
- Dominio propio (se compra por separado).

## Configuración local
1. Descomprime el proyecto.
2. Ejecuta `npm install`.
3. Copia `.env.example` a `.env`.
4. Edita `.env`:
   - `WHATSAPP_NUMBER`: ya configurado como `584242563196` (Venezuela, sin `+`).
   - `CONTACT_EMAIL`: `36rss76@gmail.com`.
   - `DOMAIN`: `dentalrosse.com` (dominio deseado; todavía debe registrarse y apuntarse al hosting).
   - `ADMIN_USERNAME`: usuario administrador.
   - `ADMIN_PASSWORD`: contraseña única de al menos 12 caracteres.
   - `SESSION_SECRET`: cadena aleatoria larga (mínimo 32 caracteres).
   - `NODE_ENV=production` cuando se publique detrás de HTTPS.
5. Ejecuta `npm start`.
6. Abre `http://localhost:3000`.

## Publicación
Usa un proveedor de hosting compatible con Node.js (por ejemplo, Render, Railway o un VPS). Configura las variables de entorno en el panel del proveedor, conecta un disco/volumen persistente para la carpeta `data/`, y activa HTTPS. Configura el dominio en el proveedor y después actualiza los registros DNS en el registrador del dominio. Los nombres de registros exactos dependen del proveedor; sigue sus instrucciones actuales.

**Importante:** SQLite requiere almacenamiento persistente. No uses un sistema de archivos efímero para producción. Programa copias de seguridad cifradas de `data/dental-rosse.sqlite` y `data/sessions.sqlite`. Para tráfico alto o varios servidores, migra a PostgreSQL y almacenamiento de sesiones compartido.

## Antes de lanzar
- Cambia el número de WhatsApp.
- Carga precios reales en USD desde el panel.
- Sustituye las tarjetas ilustrativas de galería por fotos propias con autorización.
- Publica dirección, email, teléfono, horarios y políticas reales si corresponde.
- Añade aviso de privacidad y términos adecuados a la jurisdicción.
- Prueba formulario, pedidos, login, HTTPS y restauración de copias de seguridad.
- No recolectes datos médicos, radiografías ni información identificable de pacientes con este formulario.
- No almacenes información clínica sensible en esta aplicación.

## Seguridad
El panel es de administración, no una cuenta pública. Cambia todas las credenciales de ejemplo antes de publicar. Usa HTTPS obligatorio, secretos fuertes, actualizaciones periódicas y copias de seguridad. Este proyecto es una base funcional que debe revisarse y probarse en el entorno de hosting antes de aceptar pedidos reales.


## Datos de publicación solicitados
- Dominio deseado: `dentalrosse.com` (disponibilidad no verificada).
- WhatsApp: `+584242563196` (configurado en formato internacional para el enlace).
- Correo de contacto: `36rss76@gmail.com` (dato de configuración; el formulario no envía emails automáticamente).
- Moneda: USD.

## Nota de contacto
El correo aparece en la configuración como dato de contacto, pero para enviar notificaciones por email hace falta integrar un proveedor de correo transaccional y configurar sus credenciales como variables secretas del hosting. No publiques claves dentro del código ni del repositorio.
