# Sistema de Webhooks para Generación de Videos

## Descripción General

El sistema de webhooks de generación de videos permite la comunicación asíncrona entre el servidor de Racky.app y el servidor externo de RCK Description que procesa la generación de videos. Este documento describe la arquitectura completa, el flujo de datos y cómo consultar los eventos de webhook registrados.

---

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  Frontend       │         │  Racky Backend       │         │  RCK Server     │
│  (React App)    │         │  (Node.js/Express)   │         │  (Python)       │
└────────┬────────┘         └──────────┬───────────┘         └────────┬────────┘
         │                             │                              │
         │ POST /api/videos/          │                              │
         │ bulk-generate              │                              │
         ├────────────────────────────>│                              │
         │                             │                              │
         │                             │ 1. Create AIVideo records    │
         │                             │    (status: 'generating')    │
         │                             │                              │
         │                             │ 2. POST /api/v1/             │
         │                             │    create-images-batch       │
         │                             ├─────────────────────────────>│
         │                             │                              │
         │                             │ 3. Return job_ids            │
         │                             │<─────────────────────────────┤
         │                             │                              │
         │ Response with videoIds     │                              │
         │<────────────────────────────┤                              │
         │                             │                              │
         │                             │                              │
         │                             │      (Processing videos...)  │
         │                             │                              │
         │                             │                              │
         │                             │ 4a. POST /internal/videos/   │
         │                             │     success (webhook)        │
         │                             │<─────────────────────────────┤
         │                             │                              │
         │                             │ OR                           │
         │                             │                              │
         │                             │ 4b. POST /internal/videos/   │
         │                             │     failure (webhook)        │
         │                             │<─────────────────────────────┤
         │                             │                              │
         │                             │ 5. Update AIVideo & Product  │
         │                             │    Save WebhookEvent         │
         │                             │                              │
```

---

## Flujo Completo de Generación de Videos

### Fase 1: Iniciación (Usuario → Backend)

**Endpoint:** `POST /api/videos/bulk-generate`

**Request:**
```json
{
  "productIds": ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"],
  "templateId": "template_001",
  "templateName": "Product Showcase",
  "aspect_ratio": "9:16"
}
```

**Proceso interno:**

1. **Validación:** Verifica que los productos existan y pertenezcan al workspace del usuario
2. **Pre-creación:** Crea registros `AIVideo` con status `'generating'` ANTES de llamar al servidor externo
3. **Verificación de límites:** Valida contra los límites de suscripción del usuario
4. **Incremento de uso:** Actualiza los contadores de uso del workspace
5. **Llamada externa:** Envía datos al RCK Description Server
6. **Almacenamiento de job IDs:** Guarda los `job_ids` externos en `AIVideo.metadata.externalJobId`

**Ejemplo de AIVideo creado:**
```json
{
  "_id": "65abc123def456789012",
  "userId": "507f1f77bcf86cd799439011",
  "workspaceId": "507f1f77bcf86cd799439012",
  "productId": "507f1f77bcf86cd799439013",
  "template": "Product Showcase",
  "status": "generating",
  "metadata": {
    "templateId": "template_001",
    "externalJobId": "job_xyz789",
    "queuedAt": "2025-01-17T10:30:00.000Z",
    "aspect_ratio": "9:16"
  },
  "createdAt": "2025-01-17T10:30:00.000Z",
  "updatedAt": "2025-01-17T10:30:00.000Z"
}
```

---

### Fase 2: Procesamiento (RCK Server)

El servidor externo RCK Description Server:

1. Recibe la solicitud con los datos del producto
2. Procesa las imágenes del producto
3. Genera el video usando el template especificado
4. Sube el video a YouTube y/o S3
5. **Llama al webhook de Racky.app** cuando termina (éxito o fallo)

**Datos enviados al servidor externo:**
```json
{
  "id_product": 1348418133,  // Conversión de ObjectId a entero
  "title": "Producto ejemplo",
  "img_urls": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "user_id": "507f1f77bcf86cd799439011",
  "sku": "SKU-12345",
  "template_name": "Product Showcase",
  "videoId": "65abc123def456789012",  // ID del AIVideo para el callback
  "aspect_ratio": "9:16"
}
```

---

### Fase 3: Notificación por Webhook (RCK Server → Backend)

## Endpoints de Webhook Internos

### 🟢 POST /internal/videos/success

**Descripción:** Webhook llamado por RCK Description Server cuando un video se genera exitosamente.

**Autenticación:** ❌ NO PROTEGIDO (llamado por servicio externo)

**Payload:**
```json
{
  "videoId": "65abc123def456789012",           // REQUERIDO - AIVideo MongoDB _id
  "youtubeVideoId": "dQw4w9WgXcQ",             // OPCIONAL - ID del video en YouTube
  "localFilename": "/videos/product_123.mp4",  // OPCIONAL - Ruta en servidor externo
  "video_url": "https://cdn.example.com/video.mp4",  // OPCIONAL - URL directa del video
  "img_s3_url": "https://s3.amazonaws.com/thumbnail.jpg"  // OPCIONAL - Thumbnail S3
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Video status updated successfully",
  "data": {
    "videoId": "65abc123def456789012",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "localFilename": "/videos/product_123.mp4",
    "videoUrl": "https://cdn.example.com/video.mp4",
    "imgS3Url": "https://s3.amazonaws.com/thumbnail.jpg",
    "productId": "507f1f77bcf86cd799439013"
  }
}
```

**Acciones realizadas:**

1. **Valida el payload** con esquema Joi
2. **Verifica que videoId sea un ObjectId válido**
3. **Busca el registro AIVideo** en la base de datos
4. **Actualiza AIVideo:**
   - `status` → `'completed'`
   - `metadata.youtubeVideoId` → valor recibido
   - `metadata.localFilename` → valor recibido
   - `metadata.videoUrl` → valor recibido
   - `metadata.imgS3Url` → valor recibido
   - `metadata.completedAt` → timestamp actual
5. **Actualiza Product.videos array** (almacenamiento dual):
   - Busca el video con status `'pending'` o `'generating'`
   - Actualiza a status `'completed'`
   - Agrega URLs de video y thumbnail
6. **Registra el evento en WebhookEvent** (middleware automático)

---

### 🔴 POST /internal/videos/failure

**Descripción:** Webhook llamado por RCK Description Server cuando falla la generación de un video.

**Autenticación:** ❌ NO PROTEGIDO (llamado por servicio externo)

**Payload:**
```json
{
  "videoId": "65abc123def456789012",  // REQUERIDO - AIVideo MongoDB _id
  "error": "Failed to process video: insufficient image quality"  // OPCIONAL - Mensaje de error
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Video failure recorded successfully",
  "data": {
    "videoId": "65abc123def456789012",
    "productId": "507f1f77bcf86cd799439013",
    "error": "Failed to process video: insufficient image quality"
  }
}
```

**Acciones realizadas:**

1. **Valida el payload** con esquema Joi
2. **Verifica que videoId sea un ObjectId válido**
3. **Busca el registro AIVideo**
4. **Actualiza AIVideo:**
   - `status` → `'failed'`
   - `error` → mensaje recibido o mensaje por defecto
   - `metadata.failedAt` → timestamp actual
5. **Actualiza Product.videos array:**
   - Busca el video con status `'pending'` o `'generating'`
   - Actualiza a status `'failed'`
   - Agrega mensaje de error
6. **Registra el evento en WebhookEvent** (middleware automático)

---

## Sistema de Registro de Eventos (WebhookEvent)

### Descripción

Todos los webhooks entrantes se registran automáticamente en la base de datos mediante un middleware. Esto permite:

- ✅ **Auditoría completa** de todas las llamadas de webhook
- ✅ **Debugging** cuando hay problemas de integración
- ✅ **Análisis histórico** de eventos de generación de videos

### Modelo WebhookEvent

**Ubicación:** `/server/src/modules/videos/models/WebhookEvent.ts`

**Schema:**
```typescript
{
  endpoint: string,      // '/internal/videos/success' o '/internal/videos/failure'
  payload: Mixed,        // Body completo recibido en el webhook
  createdAt: Date        // Timestamp automático
}
```

**Ejemplo de registro:**
```json
{
  "_id": "65def456abc789012345",
  "endpoint": "/videos/success",
  "payload": {
    "videoId": "65abc123def456789012",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "video_url": "https://cdn.example.com/video.mp4"
  },
  "createdAt": "2025-01-17T10:35:42.123Z"
}
```

### Middleware webhookLogger

**Ubicación:** `/server/src/modules/videos/middleware/webhookLogger.ts`

**Funcionamiento:**

1. Intercepta cada request a los endpoints de webhook
2. Captura el `endpoint` (`req.path`) y el `payload` (`req.body`)
3. Guarda el evento en la base de datos de forma **asíncrona**
4. **NO interrumpe** el flujo del webhook si hay errores
5. Logs silenciosos para debugging sin afectar la respuesta

**Características:**
- ⚡ Uso de `setImmediate` para no bloquear el request
- 🛡️ Manejo de errores silencioso
- 📝 Logging para debugging

---

## Endpoints de Consulta de Eventos

### 🔍 GET /api/webhook-events

**Descripción:** Lista todos los eventos de webhook registrados con paginación.

**Autenticación:** ✅ REQUERIDO - Solo SUPERADMIN

**Query Parameters:**
- `page` (number, opcional): Número de página (default: 1)
- `limit` (number, opcional): Resultados por página (default: 20, max: 100)
- `endpoint` (string, opcional): Filtrar por endpoint específico

**Ejemplo de request:**
```bash
GET /api/webhook-events?page=1&limit=20&endpoint=/videos/success
Authorization: Bearer <token>
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "_id": "65def456abc789012345",
        "endpoint": "/videos/success",
        "payload": {
          "videoId": "65abc123def456789012",
          "youtubeVideoId": "dQw4w9WgXcQ",
          "video_url": "https://cdn.example.com/video.mp4"
        },
        "createdAt": "2025-01-17T10:35:42.123Z"
      },
      {
        "_id": "65def456abc789012346",
        "endpoint": "/videos/failure",
        "payload": {
          "videoId": "65abc123def456789013",
          "error": "Processing timeout"
        },
        "createdAt": "2025-01-17T10:33:15.456Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

---

### 🔍 GET /api/webhook-events/:id

**Descripción:** Obtiene un evento de webhook específico por su ID.

**Autenticación:** ✅ REQUERIDO - Solo SUPERADMIN

**Ejemplo de request:**
```bash
GET /api/webhook-events/65def456abc789012345
Authorization: Bearer <token>
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "data": {
    "_id": "65def456abc789012345",
    "endpoint": "/videos/success",
    "payload": {
      "videoId": "65abc123def456789012",
      "youtubeVideoId": "dQw4w9WgXcQ",
      "video_url": "https://cdn.example.com/video.mp4",
      "img_s3_url": "https://s3.amazonaws.com/thumbnail.jpg"
    },
    "createdAt": "2025-01-17T10:35:42.123Z"
  }
}
```

**Respuesta de error (404):**
```json
{
  "success": false,
  "message": "Webhook event not found"
}
```

---

## Almacenamiento Dual (AIVideo + Product.videos)

El sistema utiliza una estrategia de **almacenamiento dual** para optimizar diferentes casos de uso:

### 1. Colección AIVideo

**Propósito:** Gestión dedicada de videos con metadata completa

**Ventajas:**
- Queries eficientes centradas en videos
- Tracking completo del ciclo de vida
- Metadata extendida (job IDs, timestamps, errores)
- Análisis y reportes de generación de videos

**Ejemplo:**
```json
{
  "_id": "65abc123def456789012",
  "userId": "507f1f77bcf86cd799439011",
  "workspaceId": "507f1f77bcf86cd799439012",
  "productId": "507f1f77bcf86cd799439013",
  "template": "Product Showcase",
  "status": "completed",
  "metadata": {
    "templateId": "template_001",
    "externalJobId": "job_xyz789",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "videoUrl": "https://cdn.example.com/video.mp4",
    "imgS3Url": "https://s3.amazonaws.com/thumbnail.jpg",
    "queuedAt": "2025-01-17T10:30:00.000Z",
    "completedAt": "2025-01-17T10:35:42.000Z",
    "aspect_ratio": "9:16"
  },
  "createdAt": "2025-01-17T10:30:00.000Z",
  "updatedAt": "2025-01-17T10:35:42.000Z"
}
```

### 2. Product.videos Array

**Propósito:** Acceso rápido a videos desde el contexto del producto

**Ventajas:**
- Render rápido en páginas de producto (sin JOIN)
- Información esencial disponible inmediatamente
- Queries simples para frontend

**Ejemplo:**
```json
{
  "_id": "507f1f77bcf86cd799439013",
  "title": "Producto ejemplo",
  "videos": [
    {
      "templateId": "template_001",
      "templateName": "Product Showcase",
      "status": "completed",
      "videoUrl": "https://cdn.example.com/video.mp4",
      "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "imgS3Url": "https://s3.amazonaws.com/thumbnail.jpg",
      "createdAt": "2025-01-17T10:30:00.000Z",
      "completedAt": "2025-01-17T10:35:42.000Z"
    }
  ]
}
```

**Sincronización:** Ambos almacenamientos se actualizan simultáneamente en cada webhook para mantener consistencia.

---

## Estados del Video

Un video pasa por los siguientes estados durante su ciclo de vida:

```
┌─────────────┐
│   pending   │  ← Estado inicial (opcional, en algunos flujos)
└──────┬──────┘
       │
       v
┌─────────────┐
│ generating  │  ← Estado cuando se envía al RCK Server
└──────┬──────┘
       │
       ├────────────────┐
       │                │
       v                v
┌─────────────┐  ┌─────────────┐
│  completed  │  │   failed    │
└─────────────┘  └─────────────┘
```

**Estados:**
- `pending`: Video en cola, aún no enviado al servidor externo
- `generating`: Video siendo procesado por RCK Description Server
- `completed`: Video generado exitosamente
- `failed`: Error durante la generación

---

## Configuración de Entorno

### Variables Requeridas

**Backend (.env o server/.env):**
```bash
# URL del servidor RCK Description para generación de videos
RCK_DESCRIPTION_SERVER_URL=http://localhost:8000

# URL pública de este servidor (para callbacks de webhook)
SERVER_URL=http://localhost:5000
```

### URL de Callback

El servidor backend construye automáticamente la URL del webhook:

```typescript
const callbackUrl = `${env.SERVER_URL}/internal/videos/success`
// Resultado: http://localhost:5000/internal/videos/success
```

**⚠️ Importante:** En producción, `SERVER_URL` debe ser la URL pública accesible desde el servidor RCK Description.

---

## Manejo de Errores

### Errores Comunes en Webhooks

#### 1. videoId inválido
```json
{
  "success": false,
  "message": "Invalid videoId format"
}
```
**Causa:** El `videoId` no es un ObjectId válido de MongoDB

#### 2. Video no encontrado
```json
{
  "success": false,
  "message": "Video not found"
}
```
**Causa:** No existe un registro AIVideo con ese ID

#### 3. Validación fallida
```json
{
  "success": false,
  "message": "videoId is required"
}
```
**Causa:** Falta el campo requerido `videoId` en el payload

### Recuperación de Errores

Si el servidor externo falla al llamar al webhook:
- El video quedará en estado `'generating'` indefinidamente
- Se puede implementar un job periódico para detectar videos "huérfanos"
- Manualmente se puede marcar como `'failed'` desde el admin

---

## Casos de Uso

### 1. Consultar Historial de Webhooks

```bash
# Ver todos los webhooks de las últimas 24 horas
GET /api/webhook-events?page=1&limit=50

# Ver solo webhooks exitosos
GET /api/webhook-events?endpoint=/videos/success

# Ver solo webhooks fallidos
GET /api/webhook-events?endpoint=/videos/failure
```

### 2. Debugging de Video Específico

```bash
# 1. Obtener el videoId del video con problemas
GET /api/videos/:videoId

# 2. Buscar todos los eventos relacionados
GET /api/webhook-events?page=1&limit=100

# 3. Filtrar manualmente por videoId en los payloads
```

### 3. Monitoreo de Tasa de Éxito

```bash
# Obtener eventos recientes
GET /api/webhook-events?limit=100

# Contar success vs failure manualmente
# O implementar endpoint de estadísticas futuro
```

---

## Testing del Sistema

### Tests de Integración

**Ubicación:** `/server/src/__tests__/integration/videos.test.ts`

**Cobertura:**
- ✅ Webhook success actualiza AIVideo correctamente
- ✅ Webhook success actualiza Product.videos
- ✅ Webhook failure marca video como failed
- ✅ Validación de payloads inválidos
- ✅ Manejo de videoId no encontrado
- ✅ Registro automático en WebhookEvent

### Ejemplo de Test Manual

```bash
# Simular webhook de éxito
curl -X POST http://localhost:5000/internal/videos/success \
  -H "Content-Type: application/json" \
  -d '{
    "videoId": "65abc123def456789012",
    "youtubeVideoId": "dQw4w9WgXcQ",
    "video_url": "https://example.com/video.mp4"
  }'

# Verificar que se registró el evento
curl -X GET http://localhost:5000/api/webhook-events?limit=1 \
  -H "Authorization: Bearer <superadmin-token>"
```

---

## Arquitectura de Archivos

```
server/src/
├── modules/
│   └── videos/
│       ├── models/
│       │   ├── AIVideo.ts           # Modelo principal de videos
│       │   └── WebhookEvent.ts      # Modelo de registro de eventos
│       ├── routes/
│       │   ├── videos.ts            # Rutas protegidas de videos
│       │   ├── internal.ts          # Webhooks NO protegidos
│       │   └── webhookEvents.ts     # Consulta de eventos (SUPERADMIN)
│       ├── middleware/
│       │   └── webhookLogger.ts     # Middleware de registro automático
│       └── services/
│           └── videoService.ts      # Lógica de negocio de videos
├── common/
│   └── services/
│       └── rckDescriptionService.ts # Cliente API del RCK Server
└── index.ts                         # Registro de rutas
```

---

## Próximas Mejoras Potenciales

### 🔮 Funcionalidades Futuras

1. **Estadísticas de Webhooks:**
   - Endpoint `GET /api/webhook-events/stats`
   - Tasa de éxito/fallo
   - Tiempo promedio de procesamiento
   - Volumen por día/semana/mes

2. **Limpieza Automática:**
   - Job periódico para eliminar eventos antiguos
   - Configurable vía `WEBHOOK_EVENT_RETENTION_DAYS`

3. **Notificaciones:**
   - Email al usuario cuando el video está listo
   - Webhook a servicios de terceros (Slack, Discord)

4. **Retry Mechanism:**
   - Re-intentar generación de videos fallidos
   - Límite de intentos configurable

5. **Dashboard de Monitoreo:**
   - Vista en tiempo real de generación de videos
   - Gráficas de métricas de webhook

---

## Soporte y Troubleshooting

### Logs Relevantes

Buscar en logs del backend:
- `[Internal Webhook]` - Procesamiento de webhooks
- `[WebhookLogger]` - Registro de eventos
- `[Bulk Video Generation]` - Iniciación de generación
- `[VideoService]` - Lógica de servicio

### Problemas Comunes

**1. Los webhooks no llegan al backend**
- Verificar que `SERVER_URL` esté correctamente configurado
- Verificar que el servidor sea accesible desde RCK Description Server
- Revisar firewall/network settings

**2. Videos quedan en 'generating' indefinidamente**
- Revisar logs del RCK Description Server
- Verificar que el callback URL sea correcto
- Consultar eventos de webhook para ver si llegaron

**3. No se registran eventos en WebhookEvent**
- Verificar que el middleware `webhookLogger` esté aplicado
- Revisar logs para errores de MongoDB
- Verificar permisos de escritura en la colección

---

## Conclusión

El sistema de webhooks de generación de videos es una arquitectura robusta y extensible que:

✅ Maneja generación asíncrona de videos
✅ Registra todos los eventos para auditoría
✅ Proporciona endpoints de consulta para administradores
✅ Utiliza almacenamiento dual para optimizar queries
✅ Implementa manejo de errores completo
✅ Es fácil de monitorear y debuggear

Este sistema permite escalar la generación de videos sin bloquear la aplicación principal y proporciona visibilidad completa del proceso.
