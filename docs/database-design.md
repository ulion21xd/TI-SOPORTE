# Diseño de base de datos V1 — Grupo Nodos IT Management

**Estado:** diseño documental con decisiones de negocio aprobadas y cuestiones abiertas identificadas; no es un schema Prisma ni una autorización para migrar datos.  
**Alcance:** análisis y documentación. No se han creado modelos, migraciones, endpoints ni reglas ejecutables.

## 1. Principios del diseño

- PostgreSQL es la fuente de verdad para los datos operativos. PDFs, imágenes y otros archivos binarios se guardan fuera de PostgreSQL; aquí solo se guardan metadatos y referencias.
- El producto del catálogo describe un tipo de equipo y su código Lucas. Cada unidad física es un activo distinto, con identificador interno único y serial opcional. Los seriales registrados no se duplican; los duplicados históricos se revisan antes de importar y no se eliminan ni sustituyen automáticamente.
- Los movimientos son un historial de eventos. Un movimiento nuevo agrega una fila; nunca reemplaza una ubicación anterior. La ubicación física actual y la persona responsable son dimensiones distintas, cada una consultable desde los últimos valores registrados en el historial.
- V1 inicia con una bodega central asociada a Matriz/Guayaquil. `AssetLocation` permite representar otras bodegas en el futuro; esta flexibilidad no implica operaciones multibodega en V1.
- Los recibos, movimientos, cambios de estado, mensajes y auditoría conservan autor y tiempo. Corregir un evento asentado debe dejar evidencia, no borrarlo ni reescribirlo silenciosamente.
- La identidad de WhatsApp se acepta solo cuando un identificador externo está enlazado a un contacto registrado y verificado. La interpretación de IA no concede identidad, permisos ni autorización para ejecutar acciones.
- Las referencias entre entidades deben tener claves foráneas. Las asociaciones opcionales no se representan como IDs libres dentro de JSON.
- UUID es una opción uniforme para las claves primarias. Usar `timestamptz` para instantes, `date` para fechas documentales, `text` para códigos que puedan tener ceros iniciales, `boolean` para flags y `jsonb` solo para snapshots/auditoría con forma deliberadamente variable.

## 2. Entidades propuestas y responsabilidad

Los campos son una propuesta inicial; `?` significa nullable. Se omiten campos mecánicos `id`, `createdAt` y `updatedAt` salvo donde el tiempo tenga significado de negocio. Las listas no pretenden fijar etiquetas, longitudes o reglas que aún no se hayan confirmado.

### Identidad, organización y contactos

| Entidad | Responsabilidad y campos principales recomendados |
|---|---|
| `User` | Cuenta interna. `id UUID`, `email text`, `displayName text`, `passwordHash text`, `isActive boolean`, `createdAt/updatedAt timestamptz`, `disabledAt timestamptz?`. Nunca guardar la contraseña en claro. |
| `Role` | Rol asignable a usuarios. `id UUID`, `key text` único, `name text`, `description text?`, `isActive boolean`. Los permisos detallados necesitan definición humana; no inferirlos del nombre del rol. |
| `UserRole` | Relación M:N entre `User` y `Role`: ambas FKs, `assignedAt timestamptz`, `assignedByUserId UUID?`. PK compuesta o UUID y unique `(userId, roleId)`. |
| `AuthSession` | Revocación de refresh tokens. `id UUID`, `userId UUID`, `tokenHash text` único, `expiresAt timestamptz`, `revokedAt timestamptz?`, `createdAt timestamptz`, `replacedBySessionId UUID?`. Persistir hash, nunca el token reutilizable. El JWT de acceso puede seguir siendo stateless. |
| `OrganizationSite` | Matriz o tienda. `id UUID`, `siteType SiteType`, `code text`, `name text`, `isActive boolean`, `address text?`. El código y la cantidad de sedes requieren validar la fuente real. |
| `Contact` | Persona registrada que puede abrir tickets o enlazarse a WhatsApp. `id UUID`, `contactType ContactType`, `displayName text`, `phoneE164 text?`, `email text?`, `isActive boolean`, `notes text?`, `userId UUID?` unique para enlazar una cuenta interna cuando corresponda. Evitar duplicar nombre/teléfono en tienda y proveedor si pertenecen a esta persona. |
| `StoreContact` | Asociación M:N entre `Contact` y `OrganizationSite` cuando el sitio es tienda/matriz: `(contactId, siteId)` unique, `relationshipLabel text?`, `isPrimary boolean?`. |
| `Supplier` | Proveedor mínimo para trazabilidad de recibos, no módulo de compras. `id UUID`, `name text`, `isActive boolean`, `externalCode text?`, `taxIdentifier text?`. La obligatoriedad/validación de códigos fiscales queda pendiente por país y datos disponibles. |
| `SupplierContact` | Asociación M:N entre proveedor y `Contact`: `(supplierId, contactId)` unique, `relationshipLabel text?`, `isPrimary boolean?`. |

`Contact.contactType` distingue `STORE`, `SUPPLIER`, `MANAGER`, `OFFICE_USER` e `IT`. La asociación con tienda/proveedor/cuenta se valida según el tipo; los contactos pueden tener más de una relación si el negocio lo permite. PostgreSQL `CHECK` no puede inspeccionar tablas de unión: si se exige una combinación estricta, deberá definirse mediante una estructura de subtipos o validación transaccional, no simularse con un CHECK local.

### Catálogo, ubicaciones, bodega y activos

| Entidad | Responsabilidad y campos principales recomendados |
|---|---|
| `CatalogProduct` | Tipo de equipo. `id UUID`, `lucasCode text`, `name text`, `description text?`, `manufacturer text?`, `model text?`, `isActive boolean`. `lucasCode` identifica el producto, nunca una unidad física. No cargar catálogo desde Excel sin validar formato, unicidad y vigencia. |
| `AssetLocation` | Lugar físico autorizado: bodega, sitio, reparación u otro autorizado. `id UUID`, `locationType AssetLocationType`, `code text?`, `name text`, `siteId UUID?`, `isActive boolean`. V1 tendrá un registro inicial para la bodega central en Matriz/Guayaquil; el modelo admite más ubicaciones/bodegas después, sin exigir flujos multibodega ahora. |
| `GoodsReceipt` | Entrada documental a bodega. `id UUID`, `supplierId UUID`, `receiptDate date`, `documentReference text`, `notes text?`, `status ReceiptStatus`, `createdByUserId UUID`, `createdAt timestamptz`, `postedAt timestamptz?`. No incluye órdenes, pagos ni contabilidad. |
| `GoodsReceiptUnit` | Una unidad física registrada dentro de un recibo: `id UUID`, `goodsReceiptId UUID`, `catalogProductId UUID`, `assetId UUID?` unique, `notes text?`. Una fila por unidad evita que una cantidad agregada se desincronice del inventario unitario. La unidad puede existir antes de asignarle ID interno; registrar/conciliar activos debe ser transaccional. |
| `Asset` | Unidad física. `id UUID`, `internalIdentifier text` único e inmutable, `catalogProductId UUID`, `serialNumber text?` con valor original, `serialNormalized text?` derivado para comparación y único cuando no sea NULL, `lifecycleStatus AssetStatus`, `createdAt timestamptz`, `retiredAt timestamptz?`. No guardar aquí la ubicación actual. `GoodsReceiptUnit.assetId` nullable permite activos heredados o de procedencia pendiente de confirmar. |
| `AssetMovement` | Evento append-only de recepción, asignación, devolución, transferencia, reparación o retiro. `id UUID`, `assetId UUID`, `movementType AssetMovementType`, `occurredAt timestamptz`, `recordedAt timestamptz`, `fromLocationId/toLocationId UUID?`, `fromResponsibleContactId/toResponsibleContactId UUID?`, `performedByUserId UUID`, `reason text?`, `ticketId UUID?`. La ubicación física y la persona responsable son campos independientes: pueden cambiar por separado; un movimiento registra estado anterior y posterior de ambas dimensiones. Primer ingreso puede no tener origen. |

La ubicación física actual se consulta como último `toLocationId`; la persona responsable actual, de forma independiente, como último `toResponsibleContactId`. La recepción inicial establece la bodega central como ubicación y normalmente deja sin persona responsable. Una asignación puede cambiar la persona, la ubicación o ambas; si un valor no cambia, el evento debe preservar el valor vigente según la regla transaccional que se implemente. No inferir la ubicación a partir de la persona ni al revés. `Asset.lifecycleStatus` describe condición/vida útil, no ubicación ni responsable.

Para comparar seriales sin alterar evidencia, conservar `serialNumber` exactamente como se registró y calcular `serialNormalized` en una columna distinta. Recomendación inicial: aplicar normalización Unicode consistente (NFKC), quitar espacios exteriores y comparar sin distinción de mayúsculas; preservar espacios y signos internos hasta validar ejemplos reales, para no colapsar seriales distintos. Aplicar el mismo procedimiento a la búsqueda y unicidad. Antes de importar, generar un reporte de colisiones sobre el valor normalizado y resolver cada caso con revisión humana; no inventar seriales, fusionar ni eliminar activos automáticamente.

### Documentos, soporte, WhatsApp y conocimiento

| Entidad | Responsabilidad y campos principales recomendados |
|---|---|
| `StoredFile` | Metadatos de un objeto almacenado fuera de la BD. `id UUID`, `storageKey text`, `originalName text`, `mimeType text`, `sizeBytes bigint`, `checksum text?`, `createdAt timestamptz`, `uploadedByUserId UUID?`. No guardar bytes, credenciales ni URLs públicas permanentes. El backend controla acceso y caducidad de URL firmada. |
| `DeliveryAct` | Acta de entrega/asignación o devolución/recepción generada a partir de movimientos. `id UUID`, `actNumber text?`, `actType DeliveryActType`, `createdAt timestamptz`, `createdByUserId UUID`, `templateVersion text?`, `pdfFileId UUID?` unique, `finalizedAt timestamptz?`. PDF opcional mientras borrador; evidencia asociada al registro, no fuente de inventario. |
| `DeliveryActItem` | Activos/movimientos cubiertos por el acta. `deliveryActId UUID`, `assetMovementId UUID` unique, PK compuesta. Relaciona el acta con el movimiento de asignación o devolución correspondiente; no copia descripción de producto, serial, ubicación ni responsable. |
| `Ticket` | Solicitud de soporte. `id UUID`, `ticketNumber text` unique, `subject text`, `status TicketStatus`, `priority TicketPriority`, `siteId UUID?`, `contactId UUID?`, `assetId UUID?`, `createdByUserId UUID?`, `openedAt timestamptz`, `resolvedAt timestamptz?`, `closedAt timestamptz?`. Activo, tienda y contacto son opcionales e independientes. |
| `TicketStatusEvent` | Historial de estados. `id UUID`, `ticketId UUID`, `fromStatus TicketStatus?`, `toStatus TicketStatus`, `changedAt timestamptz`, `changedByUserId UUID?`, `reason text?`. Crear evento inicial al crear ticket; no actualizar ni reemplazar eventos anteriores. |
| `WhatsAppIdentity` | Vinculación autorizada de un contacto a la identidad externa. `id UUID`, `contactId UUID`, `externalId text`, `phoneE164 text?`, `status WhatsAppIdentityStatus`, `verificationMethod text?`, `verifiedAt timestamptz?`, `verifiedByUserId UUID?`, `revokedAt timestamptz?`. Solo `VERIFIED` permite intentar acciones; la API también debe validar permisos y alcance. El identificador externo canónico debe ser único; el mapeo pendiente/revocado no autoriza acciones. |
| `Conversation` | Conversación de canal con identidad ya registrada. `id UUID`, `whatsAppIdentityId UUID`, `externalConversationId text?`, `status ConversationStatus`, `openedAt timestamptz`, `closedAt timestamptz?`. No se asume que una conversación equivalga a un ticket. |
| `Message` | Mensaje interno/de ticket/de canal. `id UUID`, `ticketId UUID?`, `conversationId UUID?`, `direction MessageDirection`, `channel MessageChannel`, `authorType MessageAuthorType`, `authorUserId UUID?`, `authorContactId UUID?`, `externalMessageId text?`, `body text?`, `sentAt/receivedAt timestamptz?`, `createdAt timestamptz`, `isInternal boolean`. Mensajes sin texto pueden tener adjuntos; deben cumplir que estén asociados al ticket, conversación o ambos según canal. |
| `MessageAttachment` | Asociación de adjuntos: `messageId UUID`, `storedFileId UUID`, PK compuesta. FK impide perder metadatos referenciados. |
| `TicketAttachment` | Adjunto del ticket que no pertenece a un mensaje específico: `ticketId UUID`, `storedFileId UUID`, `uploadedByUserId UUID?`, `createdAt timestamptz`, PK compuesta. Evita asociación polimórfica no validable en una tabla de archivos genérica. |
| `TicketDiagnostic` | Diagnóstico básico/manual o sugerido: `id UUID`, `ticketId UUID`, `method DiagnosticMethod`, `summary text`, `decision DiagnosticDecision`, `createdByUserId UUID?`, `createdAt timestamptz`, `reviewedByUserId UUID?`, `reviewedAt timestamptz?`. Una sugerencia de IA no cambia permisos ni ejecuta acciones por sí sola. |
| `QuickReply` | Respuesta aprobada reutilizable. `id UUID`, `key text` unique, `title text`, `body text`, `isActive boolean`, `createdByUserId UUID`, `updatedAt timestamptz`. No guardar secretos ni contraseñas. |
| `KnowledgeArticle` | Metadatos y estado de artículo. `id UUID`, `slug text` unique, `status ArticleStatus`, `createdByUserId UUID`, `createdAt/updatedAt timestamptz`. |
| `KnowledgeArticleRevision` | Contenido versionado: `id UUID`, `articleId UUID`, `version integer`, `title text`, `body text`, `createdByUserId UUID`, `createdAt timestamptz`, `publishedAt timestamptz?`; unique `(articleId, version)`. Publicar una revisión no borra la anterior. |
| `AuditEvent` | Auditoría de cambios importantes. `id UUID`, `actorUserId UUID?`, `action text`, `entityType text`, `entityId UUID`, `occurredAt timestamptz`, `requestId text?`, `before jsonb?`, `after jsonb?`. Append-only y con política de redacción de PII/secrets. La referencia polimórfica a entidad no tiene FK; el servicio valida objetivo y la retención evita borrados que rompan evidencia. |

`Message` unifica el historial para que una conversación de WhatsApp vinculada a un ticket no requiera duplicar el mismo cuerpo en dos tablas. `TicketStatusEvent` es el historial específico de transición de estado; `AuditEvent` captura cambios administrativos y operativos seleccionados, no cada lectura ni copia íntegra de cada mensaje.

## 3. Relaciones y cardinalidades

- `User` ↔ `Role`: M:N mediante `UserRole`. `User` → `AuthSession`: 1:N.
- `OrganizationSite` → `StoreContact` → `Contact`: M:N. `Supplier` → `SupplierContact` → `Contact`: M:N. Un contacto puede enlazarse a un `User`; definir si los vínculos tienda/proveedor pueden ser múltiples.
- `OrganizationSite` → `AssetLocation`: 1:N opcional. La bodega central inicial pertenece a Matriz/Guayaquil; el esquema admite más bodegas a futuro, aunque la operación V1 comienza con una sola.
- `CatalogProduct` → `Asset`: 1:N. El producto tiene un código Lucas; muchos activos físicos pueden compartirlo.
- `Supplier` → `GoodsReceipt`: 1:N. `GoodsReceipt` → `GoodsReceiptUnit`: 1:N. `CatalogProduct` → `GoodsReceiptUnit`: 1:N. Una unidad de recibo enlaza 0..1 `Asset`; un activo tiene 0..1 unidad de recibo registrada.
- `Asset` → `AssetMovement`: 1:N, ordenado por evento. Cada movimiento registra independientemente 0..1 ubicación física y 0..1 persona responsable de origen y destino; la regla de integridad debe evitar que un cambio de responsable borre la ubicación vigente.
- `AssetMovement` ↔ `DeliveryActItem` → `DeliveryAct`: un movimiento aparece como máximo en un ítem de acta; un acta cubre 1..N movimientos al finalizarse.
- `Ticket` → `TicketStatusEvent`, `Message`, `TicketDiagnostic`, `TicketAttachment`: 1:N. `Ticket` → `Asset`, `OrganizationSite`, `Contact`: cada uno 0..1 por ticket; cada activo/sitio/contacto puede relacionarse con varios tickets.
- `Contact` → `WhatsAppIdentity`: 1:N o 1:1 según política de números compartidos/cambios de número; `WhatsAppIdentity` → `Conversation`: 1:N; `Conversation` → `Message`: 1:N.
- `Message` puede apuntar a 0..1 `Ticket` y 0..1 `Conversation`; cuando un mensaje de WhatsApp pertenece a un ticket, se usa la misma fila con ambas FKs.
- `Message` ↔ `StoredFile` mediante `MessageAttachment`; `Ticket` ↔ `StoredFile` mediante `TicketAttachment`; `DeliveryAct` → `StoredFile` para su PDF final.
- `KnowledgeArticle` → `KnowledgeArticleRevision`: 1:N. `AuditEvent` registra actor/objetivo sin imponer una relación FK polimórfica.

## 4. Enumeraciones propuestas

Los estados de identidad WhatsApp y los dos tipos de acta reflejan decisiones aprobadas. Los demás valores son candidatos para revisión; no deben tratarse como aprobados por aparecer aquí. Conviene mantener los roles como filas administrables (`Role`) y no enumeración rígida.

| Enum | Valores iniciales propuestos |
|---|---|
| `SiteType` | `STORE`, `MATRIX` |
| `ContactType` | `STORE`, `SUPPLIER`, `MANAGER`, `OFFICE_USER`, `IT` |
| `AssetLocationType` | `WAREHOUSE`, `SITE`, `REPAIR`, `OTHER` |
| `AssetStatus` | Propuesta: `IN_SERVICE`, `UNDER_REPAIR`, `RETIRED`, `LOST`; estados y transiciones siguen pendientes. |
| `ReceiptStatus` | `DRAFT`, `POSTED`, `CANCELLED` |
| `AssetMovementType` | `RECEIPT`, `ASSIGNMENT`, `RETURN`, `TRANSFER`, `REPAIR_OUT`, `REPAIR_RETURN`, `RETIREMENT`, `CORRECTION` |
| `DeliveryActType` | **Aprobado:** `ASSIGNMENT` (entrega/asignación), `RETURN` (devolución/recepción). Un cambio de equipo conserva sus movimientos de devolución y asignación; si requiere un acta combinada, queda pendiente. |
| `TicketStatus` | `NEW`, `TRIAGED`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `WAITING_FOR_SUPPLIER`, `RESOLVED`, `CLOSED`, `CANCELLED` |
| `TicketPriority` | `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| `MessageChannel` | `INTERNAL`, `WHATSAPP` |
| `MessageDirection` | `INBOUND`, `OUTBOUND`, `INTERNAL`, `SYSTEM` |
| `MessageAuthorType` | `USER`, `CONTACT`, `BOT`, `SYSTEM` |
| `WhatsAppIdentityStatus` | **Aprobado como flujo propuesto:** `PENDING`, `VERIFIED`, `REVOKED`. Solo `VERIFIED` puede autorizar una acción, además de comprobar permisos y alcance en la API. |
| `ConversationStatus` | `OPEN`, `CLOSED` |
| `DiagnosticMethod` | `MANUAL`, `RULE_BASED`, `AI_ASSISTED` |
| `DiagnosticDecision` | `SUGGESTED`, `ACCEPTED`, `REJECTED` |
| `ArticleStatus` | `DRAFT`, `PUBLISHED`, `ARCHIVED` |

La relación exacta entre `channel`, `direction`, `authorType`, `conversationId`, `ticketId` e IDs de autor debe verificarse mediante validación de dominio y restricciones SQL. Por ejemplo, un mensaje interno no debe simular un `externalMessageId`, y un mensaje atribuido a `CONTACT` debe tener `authorContactId`.

## 5. Restricciones e índices recomendados

### Unicidad e integridad

- PK UUID para entidades; FK explícitas y `ON DELETE RESTRICT` para activos, entradas, movimientos, actas, tickets, mensajes y auditoría. Para usuarios/contactos desactivables, preferir baja lógica a borrar filas referenciadas.
- `User.email` único tras normalización acordada (por ejemplo lowercase/trim). `Role.key` único. `UserRole (userId, roleId)` único.
- `OrganizationSite.code` único dentro del ámbito confirmado (global o por tipo). `CatalogProduct.lucasCode` unique tras definir normalización; preservar códigos alfanuméricos y ceros iniciales.
- `Asset.internalIdentifier` unique e inmutable. Si un serial existe y se registra, su forma normalizada debe ser única entre activos; `serialNumber` conserva el texto original y `serialNormalized` se usa para búsqueda/comparación. Una restricción unique sobre `serialNormalized` nullable permite varios seriales ausentes, pero no dos seriales normalizados iguales. Antes de importar históricos, reportar colisiones y resolverlas manualmente; no inventar seriales, borrar filas ni fusionar activos automáticamente.
- `Supplier.externalCode` y `taxIdentifier` unique solo si se confirma formato, normalización y obligatoriedad; múltiples NULL no deben confundirse con códigos vacíos.
- `GoodsReceipt.documentReference` no necesariamente es globalmente único: un proveedor puede repetir secuencias. Considerar unique `(supplierId, documentReference)` después de revisar documentos reales; fecha no sustituye una referencia.
- `GoodsReceiptUnit.assetId` unique nullable: como máximo una unidad de entrada origina un activo. Validar que el activo enlazado tenga el mismo `catalogProductId` que la unidad, idealmente con FK compuesta o validación transaccional.
- Los campos de ubicación y responsable en `AssetMovement` son independientes, no XOR: un activo puede estar físicamente en un sitio y bajo responsabilidad de una persona. Validar coherencia entre el estado previo y el nuevo en transacción, incluida la preservación de ubicación si solo cambia el responsable. CHECK para `sizeBytes >= 0`, `version > 0`, fechas coherentes y número de relaciones de autor; definir casos de primer ingreso y ubicación/responsable desconocidos.
- Un acta finalizada debe tener PDF y al menos un ítem; usar una transacción/servicio al finalizar, ya que CHECK no valida filas de otra tabla. `assetMovementId` unique en `DeliveryActItem` evita que dos actas se atribuyan el mismo movimiento.
- `WhatsAppIdentity.externalId` unique (idealmente único también en estados revocados para evitar reciclar una identidad sin revisión). Una misma identidad no puede apuntar simultáneamente a dos contactos activos.
- `Ticket.ticketNumber`, `KnowledgeArticle.slug`, `KnowledgeArticleRevision (articleId, version)`, `QuickReply.key` y `(channel, externalMessageId)` unique según la semántica confirmada.
- No permitir DELETE/UPDATE de recibos asentados, movimientos, eventos de estado, revisiones publicadas ni auditoría por flujos normales. Correcciones deben ser eventos compensatorios y auditados.

### Índices de consulta

- Búsqueda de activos por `internalIdentifier` (unique), `catalogProductId` y `serialNormalized` (unique nullable); movimientos `(assetId, occurredAt DESC, recordedAt DESC)`. Los valores sin serial no reciben serial artificial.
- Ubicación y persona responsable vigentes pueden consultarse desde el último `AssetMovement`; considerar índices de movimientos `(assetId, recordedAt DESC)` y FKs `toLocationId`/`toResponsibleContactId` según consultas reales.
- Catálogo por `lucasCode` unique y nombre si se habilita búsqueda textual; no indexar textos descriptivos sin patrón de consulta confirmado.
- Recibos `(supplierId, receiptDate DESC)`, `(receiptDate DESC)` y unidades `(goodsReceiptId, catalogProductId)`.
- Tickets `(status, priority, openedAt DESC)`, `(siteId, openedAt DESC)`, `(contactId, openedAt DESC)`, `(assetId, openedAt DESC)` y `ticketNumber` unique.
- Eventos/mensajes `(ticketId, createdAt)`, `(conversationId, createdAt)`; identidad WhatsApp por `externalId` unique e índice `contactId`.
- Auditoría `(entityType, entityId, occurredAt DESC)` y `(actorUserId, occurredAt DESC)`; sesiones `(userId, expiresAt)` y token hash unique.
- Todas las FKs usadas para joins/consultas frecuentes deben tener índice explícito donde PostgreSQL no lo cree automáticamente. Confirmar con consultas reales y `EXPLAIN` antes de añadir índices adicionales.

Los `CHECK`, algunos índices parciales y las reglas transaccionales pueden necesitar SQL de migración manual porque no todas las formas se expresan directamente en Prisma Schema. Esto se documenta para la futura implementación, no se aplica en esta fase.

## 6. Flujos de datos principales

### 6.1 Registrar una entrada de bodega

1. Elegir proveedor registrado o crear su ficha mínima y, si aplica, registrar contactos. El registro de proveedor no abre un proceso de compras.
2. Crear `GoodsReceipt` en `DRAFT`. **Mínimo aprobado:** proveedor, fecha, referencia documental y equipos recibidos; cada unidad debe asociarse a `CatalogProduct`. Registrar también el usuario responsable. La referencia original se conserva tal como aparece; puede normalizarse aparte para detectar duplicados.
3. Registrar una `GoodsReceiptUnit` por cada unidad física recibida. El serial puede estar ausente; no generarlo artificialmente. No agregar costos ni orden de compra salvo decisión posterior.
4. Al confirmar la entrada, en una transacción comprobar proveedor, fecha, referencia, al menos una unidad recibida, productos válidos, colisiones de serial normalizado y ubicación destino inicial. V1 registra llegada a la bodega central de Matriz/Guayaquil. Marcar `POSTED` y `postedAt`; después de esto no editar silenciosamente.
5. Crear o conciliar `Asset` por unidad física cuando se asigne su identificador interno, enlazar `GoodsReceiptUnit.assetId` y registrar `AssetMovement(RECEIPT)` desde origen desconocido/vacío a la bodega central, con responsable sin asignar. Guardar autor y tiempo.
6. La consulta de procedencia va `Asset → GoodsReceiptUnit → GoodsReceipt → Supplier`; de allí salen proveedor, fecha y documento. No copiar esos tres valores al activo.

La unidad recibida debe quedar documentada aunque todavía no tenga activo/identificador interno; el momento límite para asignarlo y la conciliación de equipos históricos sin recibo requieren definición. La cancelación o corrección de entradas asentadas debe conservar evidencia y auditarse; el mecanismo exacto sigue pendiente.

### 6.2 Asignar, devolver o cambiar ubicación de un activo

1. Leer el último movimiento del activo y validar en una transacción que el destino/origen esperado todavía coincide; serializar escrituras concurrentes del mismo activo (por ejemplo, bloqueo de fila) para impedir dos asignaciones simultáneas.
2. Insertar una nueva fila `AssetMovement` con evento, origen y destino físico, persona responsable de origen y de destino (independientemente), autor, instante y motivo. No alterar la fila anterior. Una asignación puede registrar persona y ubicación; una transferencia de ubicación puede mantener la misma persona.
3. Para devolución, insertar `RETURN` desde el contacto actual a la ubicación receptora. Para transferencia, el origen debe corresponder a la tenencia vigente. Para reparación, usar movimiento específico y registrar estado de ciclo de vida si cambia.
4. Actualizar estado de ciclo de vida del activo, si corresponde, y escribir `AuditEvent` en la misma transacción. No guardar una segunda `currentLocationId` en `Asset` salvo que más adelante se justifique un read model mantenido transaccionalmente.
5. Consultar el historial ordenando por `occurredAt` y `recordedAt`; acordar política para eventos tardíos/backdating porque pueden alterar qué movimiento parece ser el actual.

### 6.3 Generar y relacionar un acta

1. Crear el movimiento de `ASSIGNMENT` para entrega/asignación o `RETURN` para devolución/recepción y el `DeliveryAct` del mismo tipo como borrador dentro del flujo autorizado. Un cambio de equipo conserva el movimiento de devolución del activo anterior y el de asignación del nuevo; ambos no se sustituyen entre sí.
2. Renderizar el formato de entrega existente a partir de usuario/contacto, activo y movimiento relacionados; no reconstruir el estado operativo leyendo un PDF previo.
3. Guardar el PDF en almacenamiento externo; registrar `StoredFile` (storage key privado, nombre, MIME, tamaño, hash opcional) y enlazarlo a `DeliveryAct.pdfFileId`.
4. Añadir `DeliveryActItem` por cada movimiento cubierto. Al finalizar, validar movimientos y participantes, fijar `templateVersion`, fecha, usuario y `finalizedAt` de forma transaccional. La generación debe conservar un snapshot evidencial mínimo si se necesita reproducir exactamente qué campos se imprimieron; decidir cuáles y cuánto tiempo retenerlos.
5. Reemplazo o corrección del PDF debe crear una versión/evidencia nueva y dejar auditoría; no sustituir el único archivo sin historial.

El formato actual, numeración, firmas requeridas, si un acta puede cubrir varios movimientos/equipos, si una sustitución puede representarse en un acta combinada y la validez de firma digital/física están pendientes de aprobación.

### 6.4 Registrar y actualizar un ticket

1. Crear `Ticket` con número asignado según una secuencia aprobada, estado inicial, prioridad y relaciones opcionales a sitio, contacto y activo. No exigir activo para registrar un incidente.
2. Crear el `TicketStatusEvent` inicial en la misma transacción. Cada transición futura inserta evento con estado previo/nuevo, actor, hora y motivo, y actualiza `Ticket.status` como estado actual de lectura; ambos cambios se hacen juntos.
3. Insertar `Message` para cada respuesta o mensaje relevante; mensajes entrantes de WhatsApp pueden enlazar ticket y conversación en la misma fila. Un mensaje privado interno debe distinguirse para no enviarse al solicitante.
4. Registrar adjuntos con `StoredFile` y relación `MessageAttachment` o `TicketAttachment`; validar tamaño/tipo, autorización de descarga y borrar/quarantinar el objeto externo si falla la transacción.
5. Diagnósticos se guardan como sugerencias/observaciones separadas de mensajes y solo se marcan aceptados tras decisión autorizada. Cambios importantes de asignación, prioridad, estado, activo asociado y cierre deben emitir auditoría.

La matriz de estados permitidos, prioridad, SLA, reasignación, re-apertura, categorías y quién puede cerrar cada ticket no se deben deducir del Excel.

### 6.5 Identificar un contacto de WhatsApp

1. Un usuario autorizado registra el `Contact` y lo relaciona con tienda, proveedor o cuenta interna. Estar registrado por sí solo no habilita acciones por WhatsApp.
2. La identidad externa se crea como `PENDING` y queda sin autorización. Personal autorizado compara la identidad externa exacta con los datos obtenidos por el método de verificación que se apruebe; solo después la asociación se marca `VERIFIED` con responsable y fecha. `verificationMethod` documenta el método, no un código secreto.
3. Al recibir un mensaje, resolver por coincidencia exacta del ID externo canónico con una identidad `VERIFIED`. Si no hay coincidencia, está `PENDING`/`REVOKED` o es ambigua, tratar como no autorizada: puede solicitarse revisión/verificación, pero no revelar datos ni ejecutar acciones autorizadas.
4. Para cada acción, la API comprueba nuevamente estado verificado, permisos/alcance y relación con sitio/activo/ticket. La IA puede interpretar intención o proponer texto, pero no confirmar identidad, otorgar permisos ni ejecutar la operación. No exponer contraseñas ni credenciales de AnyDesk, ni persistirlas.
5. Guardar mensaje y evento de conversación con IDs externos idempotentes para evitar duplicados por reintento del proveedor. Definir tratamiento de payloads, retención y eliminación antes de activar canal real.

### 6.6 Proveedor, entrada y activo

La ruta de trazabilidad es `Supplier 1—N GoodsReceipt 1—N GoodsReceiptUnit 0..1—1 Asset`. Cada unidad recibida conoce producto; el activo vinculado conserva identidad física (ID interno, serial) y movimientos. Un activo heredado puede carecer de unidad de recibo, pero su procedencia debe quedar marcada como desconocida/pendiente de revisión y no asociarse a un proveedor supuesto. En V1 el movimiento de recepción apunta a la ubicación de la bodega central de Matriz/Guayaquil.

## 7. Decisiones pendientes de aprobación humana

La columna **Aprobado** recoge reglas expresadas para V1. **Pendiente** enumera únicamente lo que todavía requiere definición. Las recomendaciones son propuestas para facilitar esa definición; no son reglas aprobadas.

| Tema | Aprobado | Pendiente | Recomendación inicial (no aprobada) |
|---|---|---|---|
| 1. Identificador interno | Cada activo físico tendrá identificador interno único. | Formato, prefijo, secuencia, momento de asignación y tratamiento de etiquetas ya impresas. | Usar un identificador inmutable, no derivado del serial ni del código Lucas; mantener cualquier etiqueta legible como valor único independiente de la PK UUID. |
| 2. Seriales históricos y faltantes | Serial opcional cuando no exista/no esté disponible; no habrá serial duplicado entre activos que sí tengan serial registrado. No inventar seriales ni borrar registros históricos automáticamente. | Resolución caso por caso de colisiones históricas y cómo registrar unidades sin serial o con dato ilegible/por verificar. | Preservar `serialNumber` original y comparar `serialNormalized`; generar reporte de colisiones antes de importar y detener la importación de los casos conflictivos hasta una decisión humana. Los seriales ausentes quedan NULL, nunca se fabrican. |
| 3. Entrada de bodega | Mínimo requerido: proveedor, fecha, referencia documental y equipos/unidades recibidos; V1 recibe en la bodega central de Matriz/Guayaquil. | Si se requieren PDF/foto del documento, nombre del receptor, fecha/hora de recepción, entrega parcial, devolución a proveedor, ajuste y momento de crear el `Asset`. | Exigir al menos una unidad por entrada y un producto de catálogo por unidad; guardar el documento como archivo externo solo si el proceso lo aprueba. Mantener fuera del alcance órdenes de compra/contabilidad. |
| 4. Tickets | Un ticket puede enlazar opcionalmente activo, tienda y contacto; se conservan mensajes, adjuntos e historial de estado. | Estados finales y transiciones permitidas, prioridad, categorías, SLA, asignación a técnicos, cierre/reapertura y reglas de escalamiento. | Mantener eventos append-only por transición y acordar una máquina de estados pequeña antes de implementar. Los valores en §4 son candidatos, no decisiones. |
| 5. Roles, permisos y autorización WhatsApp | Usuarios internos tienen roles. Solo contactos registrados y autorizados pueden ejecutar acciones; cada acción se valida en la API. | Roles/permisos exactos, quién autoriza o revoca una identidad de WhatsApp y qué acciones están permitidas a cada tipo de contacto. | Definir matriz de permisos de mínimo privilegio con un rol humano claramente responsable de aprobar/revocar identidades; mantener autorización separada de interpretación de IA. |
| 6. Verificación de nuevos contactos | Una identidad debe corresponder a registro verificado; `PENDING` y `REVOKED` no autorizan. La IA no confirma identidad ni concede permisos. | Método de verificación, responsable y comprobantes aceptables; re-verificación por cambio de número, teléfono compartido o sospecha de suplantación. | Evaluar verificación manual contra datos ya registrados o un desafío enviado al teléfono previamente confirmado. Elegir el método solo después de revisar factibilidad, seguridad y privacidad; no habilitar acciones mientras esté pendiente. |
| 7. Tiendas, matriz y responsables | Se distinguen tiendas y matriz; la bodega central V1 está en Matriz/Guayaquil. Ubicación física y persona responsable del activo son datos distintos. | Si departamentos y responsables forman jerarquía, códigos/sedes, relación contacto-sitio y si matriz comparte atributos con tiendas. | Mantener sitio organizacional (`OrganizationSite`) separado de ubicación física (`AssetLocation`); agregar departamentos solo si hay dueño, jerarquía y consultas concretas definidos. |
| 8. Actas y retención documental | V1 contempla actas de entrega/asignación y devolución/recepción. Cada acta se relaciona con su movimiento; se genera desde datos registrados. PDF es evidencia, no fuente principal. | Campos del formato existente, numeración, quién firma y cómo, una o varias unidades por acta, actas combinadas de sustitución, retención y tratamiento de correcciones. | Versionar actas/PDF, guardar metadatos y hash opcional y enlazar cada movimiento cubierto; definir plazo y firmas antes de cerrar una plantilla. |
| 9. Cancelar o corregir movimientos | No sobrescribir ni borrar movimientos anteriores; asignaciones, devoluciones y cambios de equipo conservan historial y auditoría. | Quién puede corregir/cancelar, estados que admiten reversión, si se requiere movimiento compensatorio y cómo corregir un error de fecha/destino. | Agregar un nuevo movimiento compensatorio con motivo, actor, hora y referencia al evento corregido; conservar original visible y auditar la operación. No editar el evento asentado. |
| 10. Mensajes y adjuntos | Mensajes e historial de tickets se conservan en la BD; archivos fuera de PostgreSQL y metadatos/referencias dentro. | Retención por canal/estado, borrado legal, exportación, acceso, límites/tipos de archivos y política de backups. | Definir plazos por clase de datos y permisos de descarga; no copiar cuerpos/secretos a auditoría y no eliminar referencias mientras exista obligación de evidencia. |
| 11. Categorías y estados de activos | Activo separado del producto; ubicación y responsable no se confunden; serial es opcional y no duplicado. | Categorías de catálogo/activo y estados de ciclo de vida (incluidos reparación, perdido, retirado, baja), transiciones y autorizaciones. | Separar categoría del producto, condición física y estado de ciclo de vida; registrar cambios operativos con eventos/auditoría. Los valores de §4 son solo candidatos. |
| 12. Datos maestros y demás operación | El Excel no se asume definitivo; proveedores se limitan a identificar recibos y contactos, sin compras completas. No guardar contraseñas de AnyDesk ni credenciales sensibles. | Reglas/campos del Excel, normalización de códigos Lucas, identificadores de proveedor, procedimiento de inventario inicial, acceso/retención de auditoría, almacenamiento externo, backups, zona horaria y política de credenciales/refresh tokens. | Perfilar y conciliar los datos antes de importarlos; usar trazabilidad de origen; aplicar allowlist/redacción en auditoría y mantener secretos fuera de mensajes, diagnósticos y snapshots. |

## 8. Riesgos y controles

| Riesgo | Efecto | Control recomendado |
|---|---|---|
| Confundir código Lucas y número de serie con identidad del activo | Duplicados o pérdida de trazabilidad por unidad | Tabla de catálogo separada; ID interno único; serial opcional con valor original y valor normalizado único cuando exista; revisión humana de colisiones previas a la importación. |
| Cargar Excel sin validar códigos, duplicados o semántica | Catálogo/contactos/activos incorrectos propagados | Perfilado y conciliación previa; staging/importación revisable; nunca asumir que código/nombre significa lo mismo que campo del sistema. |
| Actualizar ubicación actual sobrescribiendo eventos | Se pierde cadena de custodia | Ledger append-only, transacción por activo, corrección compensatoria, control de concurrencia y auditoría. |
| Fecha atrasada o dos movimientos simultáneos | Resultado ambiguo al inferir ubicación vigente | Separar `occurredAt` de `recordedAt`, exigir orden determinista y definir política para backdating/correcciones. |
| Recibo con cantidad agregada separada de activos | El conteo no corresponde a equipos físicos | Registrar una unidad de recibo por equipo; transacción y FK al activo; cotejar cantidades de documento y unidades. |
| Seriales históricos duplicados o serial normalizado de forma inconsistente | Confundir unidades, fallar la importación o bloquear el registro de un serial legítimo | Preservar texto original, comparar por columna normalizada única, perfilar colisiones antes de importar y resolver cada conflicto manualmente; no inventar seriales ni eliminar/unir activos automáticamente. |
| Referencias polimórficas para adjuntos/auditoría | FK no garantiza que exista el objeto destino | Asociaciones tipadas para archivos; reservar polimorfismo para auditoría con validación de servicio y retención. |
| Confundir ubicación física con persona responsable o duplicar estado actual en activo | Se asigna responsabilidad equivocada o divergen dos fuentes | Mantener `toLocationId` y `toResponsibleContactId` como dimensiones independientes en el historial; preservar ambas cuando solo una cambia y derivar los valores actuales del último movimiento. |
| Vincular WhatsApp por nombre, texto o inferencia | Divulgación a persona equivocada | Match exacto de identidad externa verificada, estado revocable, cero acciones con identidad desconocida/ambigua, autorización en API. |
| IA tratada como autoridad, o guardar secretos en texto/auditoría | Acciones no autorizadas y fuga de credenciales | API valida permisos; redactar datos; listas explícitas de secretos no almacenables; nunca contraseñas ni claves de AnyDesk. |
| Borrar o sobrescribir PDFs/adjuntos | Pérdida de evidencia o archivos huérfanos | Metadatos y hash opcional; permisos privados; versionado/ciclo de retención; tarea de conciliación para objetos externos huérfanos. |
| Auditoría con datos personales o sin política de borrado | Exposición y retención excesiva | Allowlist de campos auditables, redacción, acceso restringido, política legal de retención y no copiar cuerpos completos de mensajes por defecto. |

## 9. Coherencia con la arquitectura existente

El repositorio usa npm workspaces con aplicaciones separadas `apps/api`, `apps/admin-web` y `apps/whatsapp-bot`, PostgreSQL local por Docker Compose y Prisma bajo `prisma/`. Este documento conserva esa separación: la API central sería dueña de las reglas transaccionales; el panel y el bot consumen API autorizada; no se presupone acceso directo a PostgreSQL desde React o el bot. REST basta para estos flujos iniciales; WebSocket puede añadirse cuando haya un caso de actualización en tiempo real concreto.

El `prisma/schema.prisma` revisado contiene únicamente generator y datasource PostgreSQL, sin modelos. Esta propuesta no lo modifica y no supone endpoints, servicios ni configuración nueva. JWT/refresh tokens son coherentes con `User`, `Role` y `AuthSession`; no se modelan credenciales externas. No se diseña compras/contabilidad ni integración ejecutable con WhatsApp.
