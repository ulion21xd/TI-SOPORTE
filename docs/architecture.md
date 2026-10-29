# Arquitectura inicial

El repositorio usa npm workspaces para mantener aplicaciones separadas dentro de un único monorepo:

- `apps/api`: API REST con NestJS y TypeScript.
- `apps/admin-web`: interfaz administrativa React, TypeScript y Vite.
- `apps/whatsapp-bot`: servicio NestJS independiente, preparado para futuras integraciones; no conecta con WhatsApp.
- `packages/shared-types`, `packages/shared-validation` y `packages/shared-config`: espacios reservados para código compartido. Permanecen sin lógica de negocio.
- `prisma`: configuración inicial de Prisma para PostgreSQL, sin modelos de dominio.
- `docker`: espacio para recursos adicionales de contenedores. PostgreSQL local se define en `docker-compose.yml`.

Los servicios HTTP son independientes. La API y el bot exponen endpoints básicos de estado para comprobar que arrancaron. La comunicación entre ellos y cualquier canal WebSocket se definirán cuando exista una necesidad concreta.

## Requisitos y arranque

Se requiere Node.js 20 o superior, npm 10 o superior y Docker con Compose.

1. Copiar `.env.example` a `.env`.
2. Instalar dependencias con `npm install`.
3. Arrancar PostgreSQL con `npm run db:up`.
4. Ejecutar `npm run dev` para levantar API, panel y bot; o usar `npm run dev:api`, `npm run dev:admin` y `npm run dev:bot` por separado.
5. Validar Prisma con `npm run prisma:validate` y generar el cliente con `npm run prisma:generate`.

La API queda en `http://localhost:3000`, el bot en `http://localhost:3001` y Vite en `http://localhost:5173`. Las variables JWT son marcadores de entorno: aún no hay autenticación implementada.
