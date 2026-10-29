# Grupo Nodos · IT Management

Base técnica inicial para el sistema interno de gestión de IT. El proyecto está organizado como monorepo npm y mantiene separados el backend REST, el panel administrativo y el servicio de bot.

## Stack

- Node.js, TypeScript y NestJS para `api` y `whatsapp-bot`.
- React, TypeScript y Vite para `admin-web`.
- PostgreSQL local con Docker Compose y Prisma como ORM.
- REST como interfaz inicial; no se habilita WebSocket hasta que sea necesario.

## Estructura

```text
apps/
  api/                 API REST NestJS
  admin-web/           panel React + Vite
  whatsapp-bot/        servicio NestJS independiente
packages/
  shared-types/        reservado para tipos compartidos
  shared-validation/   reservado para validaciones compartidas
  shared-config/       reservado para configuración compartida
prisma/                schema Prisma sin modelos de dominio
docs/                  documentación de arquitectura
docker/                recursos Docker adicionales
```

## Inicio rápido

Requisitos: Node.js 20+, npm 10+ y Docker Compose.

El panel administrativo puede ejecutarse de forma independiente con `npm run dev:admin`: su primera vista usa tickets de demostración en memoria. La API y el bot también pueden iniciar sin PostgreSQL en esta etapa; sus rutas actuales solo exponen estado de salud y todavía no leen/escriben datos. PostgreSQL será necesario al integrar persistencia real. Para levantar la base local cuando corresponda, ejecuta `npm run db:up` (y `npm run db:down` para detenerla). No se ejecutan migraciones automáticamente al iniciar las aplicaciones.

```bash
cp .env.example .env
npm install
npm run db:up
npm run dev
```

En PowerShell, la copia inicial puede hacerse con `Copy-Item .env.example .env`.

La API está en `http://localhost:3000`, el bot en `http://localhost:3001` y el panel Vite en `http://localhost:5173`.

Comandos útiles: `npm run dev:api`, `npm run dev:admin`, `npm run dev:bot`, `npm run build`, `npm run typecheck`, `npm run prisma:validate`, `npm run prisma:generate` y `npm run db:down`.

Consulta [docs/architecture.md](docs/architecture.md) para detalles. No se incluyen módulos de negocio, modelos Prisma, autenticación funcional ni integración con WhatsApp.
