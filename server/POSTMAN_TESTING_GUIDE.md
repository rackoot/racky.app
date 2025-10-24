# Guía de Testing - Filtros VTEX con Postman

## 📋 Descripción

Esta guía explica cómo usar la colección de Postman para probar los nuevos endpoints de filtros VTEX implementados en la Fase 2.

## 🚀 Setup Inicial

### 1. Importar la Colección en Postman

1. Abre Postman
2. Click en **Import** (arriba a la izquierda)
3. Selecciona el archivo: `/server/postman_vtex_filters_testing.json`
4. La colección "Racky - VTEX Filters Testing" aparecerá en tu sidebar

### 2. Configurar Variables de Colección

Antes de empezar, necesitas configurar tus credenciales de VTEX:

1. Click derecho en la colección "Racky - VTEX Filters Testing"
2. Selecciona **Edit**
3. Ve a la pestaña **Variables**
4. Completa las siguientes variables:

| Variable | Valor de Ejemplo | Descripción |
|----------|------------------|-------------|
| `base_url` | `http://localhost:5000/api` | Ya configurado por defecto |
| `vtex_account_name` | `mitienda` | Tu cuenta VTEX (sin el dominio completo) |
| `vtex_app_key` | `vtexappkey-mitienda-XXXXX` | App Key de VTEX |
| `vtex_app_token` | `XXXXXXXXXXXXXXXXXX` | App Token de VTEX |

**Nota**: Las variables `jwt_token`, `workspace_id` y `connection_id` se llenan automáticamente al ejecutar los requests correspondientes.

### 3. Asegúrate que el Servidor Esté Corriendo

```bash
cd /home/tobias/Code/racky.app/server
npm run dev
```

Deberías ver: `Server is running on port 5000`

## 📝 Flujo de Testing Paso a Paso

### Paso 1: Autenticación 🔐

**Carpeta: 1. Authentication**

#### Opción A: Registrar Nuevo Usuario

1. Abre el request **"Register User"**
2. Modifica el email en el body si quieres (por defecto: `test@racky.app`)
3. Click **Send**
4. ✅ El `jwt_token` se guarda automáticamente en las variables

#### Opción B: Login con Usuario Existente

1. Abre el request **"Login"**
2. Usa las credenciales de tu usuario
3. Click **Send**
4. ✅ El `jwt_token` se guarda automáticamente

**Verifica en Console**: Deberías ver "JWT Token saved: eyJhbGciOi..."

---

### Paso 2: Obtener Workspace ID 🏢

**Carpeta: 2. Workspaces**

1. Abre el request **"Get My Workspaces"**
2. Click **Send**
3. ✅ El `workspace_id` se guarda automáticamente del primer workspace
4. En la consola verás: "Workspace ID saved: 673abc..."

**¿Qué es el Workspace?** Racky es multi-tenant. Cada workspace es un espacio de trabajo aislado donde se guardan tus productos, conexiones, etc.

---

### Paso 3: Configurar Conexión VTEX 🔌

**Carpeta: 3. VTEX Store Setup**

#### 3.1 Verificar Conexiones Existentes

1. Abre **"Get All Connections"**
2. Click **Send**
3. Si ya tienes una conexión VTEX:
   - ✅ El `connection_id` se guarda automáticamente
   - Pasa al **Paso 4**
4. Si no tienes conexiones, continúa con 3.2

#### 3.2 Probar Credenciales VTEX (Opcional pero Recomendado)

1. Abre **"Test VTEX Credentials"**
2. Verifica que las variables VTEX estén configuradas (ver Setup Inicial)
3. Click **Send**
4. Deberías ver: `"success": true, "message": "Successfully connected to VTEX..."`

Si falla, verifica:
- ✅ `vtex_account_name` es correcto (sin https://, sin .vtexcommercestable.com.br)
- ✅ `vtex_app_key` y `vtex_app_token` son válidos
- ✅ El App Key tiene permisos de lectura en Catalog API

#### 3.3 Crear Store Connection

1. Abre **"Create VTEX Store"**
2. Modifica `storeName` si quieres (opcional)
3. Click **Send**
4. ✅ El `connection_id` se guarda automáticamente
5. Verás: `"message": "Store created and marketplace connected successfully"`

---

### Paso 4: Obtener Filtros Disponibles 🔍

**Carpeta: 4. VTEX Filters (NEW)** ⭐ **NUEVOS ENDPOINTS**

#### 4.1 Obtener Categorías

1. Abre **"Get VTEX Categories"**
2. Click **Send**
3. En la consola verás la lista de categorías:
   ```
   Total categories found: 45
   - [1] Ropa (Level 0)
   - [2] Ropa > Hombre (Level 1)
   - [3] Ropa > Mujer (Level 1)
   ...
   ```
4. **Copia los IDs de las categorías** que quieras usar en el sync

#### 4.2 Obtener Marcas

1. Abre **"Get VTEX Brands"**
2. Click **Send**
3. En la consola verás la lista de marcas:
   ```
   Total brands found: 120
   - [10] Nike
   - [20] Adidas
   - [30] Puma
   ...
   ```
4. **Copia los IDs de las marcas** que quieras usar en el sync

---

### Paso 5: Sincronizar Productos con Filtros 🔄

**Carpeta: 5. Product Sync with Filters (UPDATED)** ⭐ **ENDPOINT ACTUALIZADO**

Ahora viene lo importante: probar las diferentes opciones de sincronización.

#### Test 1: Sync sin Filtros (Baseline)

1. Abre **"Sync Without Filters (Baseline)"**
2. Click **Send**
3. Verás en la consola:
   ```
   Sync Results:
   - Total Products: 156
   - New Products: 156
   - Updated Products: 0
   ```
4. **Esto sincroniza TODOS los productos activos** (comportamiento por defecto)

⏱️ **Tiempo estimado**: Depende del catálogo (con la nueva implementación puede tomar varios minutos para catálogos grandes debido a que ahora obtiene datos completos: producto + SKU + precio + inventario)

#### Test 2: Sync Solo Productos Activos + Inactivos

1. Abre **"Sync Active + Inactive Products"**
2. Click **Send**
3. Ahora sincroniza productos activos E inactivos
4. Compara el total con el Test 1

#### Test 3: Sync con Filtro de Categorías ⭐

1. Abre **"Sync with Category Filter"**
2. En el body, reemplaza los IDs de ejemplo con los IDs reales del Paso 4.1:
   ```json
   {
     "force": false,
     "filters": {
       "includeActive": true,
       "includeInactive": false,
       "categoryIds": ["1", "2", "3"],  // ← REEMPLAZA CON TUS IDs
       "brandIds": null
     }
   }
   ```
3. Click **Send**
4. Verás solo productos de esas categorías

**Ejemplo Real**:
```json
"categoryIds": ["12", "45", "78"]  // Solo Ropa, Zapatos, Accesorios
```

#### Test 4: Sync con Filtro de Marcas ⭐

1. Abre **"Sync with Brand Filter"**
2. En el body, reemplaza los IDs con los IDs reales del Paso 4.2:
   ```json
   {
     "force": false,
     "filters": {
       "includeActive": true,
       "includeInactive": false,
       "categoryIds": null,
       "brandIds": ["10", "20"]  // ← REEMPLAZA CON TUS IDs
     }
   }
   ```
3. Click **Send**
4. Verás solo productos de esas marcas

**Ejemplo Real**:
```json
"brandIds": ["2000001", "2000005"]  // Solo Nike y Adidas
```

#### Test 5: Sync con TODOS los Filtros Combinados ⭐⭐⭐

**Este es el más importante: combinar categorías Y marcas**

1. Abre **"Sync with ALL Filters Combined"**
2. Configura tanto categorías como marcas:
   ```json
   {
     "force": false,
     "filters": {
       "includeActive": true,
       "includeInactive": false,
       "categoryIds": ["12", "45"],      // Ropa y Zapatos
       "brandIds": ["2000001", "2000005"] // Nike y Adidas
     }
   }
   ```
3. Click **Send**
4. **Resultado**: Solo productos que cumplan TODAS las condiciones:
   - ✅ Productos activos
   - ✅ De categoría 12 o 45
   - ✅ De marca 2000001 o 2000005

#### Test 6: Force Sync (Limpiar y Re-importar) ⚠️

**CUIDADO**: Este elimina TODOS los productos existentes y los vuelve a importar.

1. Abre **"Force Sync (Delete & Replace All)"**
2. Click **Send**
3. Verás:
   ```
   Deleted Products: 156
   New Products: 156
   ```

**Cuándo usar Force Sync**:
- Cuando quieras empezar de cero
- Cuando cambias filtros radicalmente
- Para testing

---

### Paso 6: Verificar Resultados ✅

**Carpeta: 6. View Results**

#### Ver Todos los Productos

1. Abre **"Get All Products"**
2. Click **Send**
3. Verás la lista paginada de productos sincronizados
4. En consola verás el breakdown:
   ```
   Total Products: 45
   Page: 1 of 1
   Marketplace Breakdown: { vtex: 45 }
   ```

#### Ver Solo Productos VTEX

1. Abre **"Get Products by Marketplace (VTEX only)"**
2. Click **Send**
3. Solo muestra productos de VTEX

---

## 🎯 Casos de Uso Reales

### Caso 1: "Solo quiero productos de la categoría Electrónica de marca Samsung"

```json
POST /api/products/sync/{{connection_id}}
{
  "filters": {
    "includeActive": true,
    "includeInactive": false,
    "categoryIds": ["100"],  // ID de Electrónica
    "brandIds": ["5000"]     // ID de Samsung
  }
}
```

### Caso 2: "Quiero TODOS los productos de 3 marcas específicas (sin importar categoría)"

```json
POST /api/products/sync/{{connection_id}}
{
  "filters": {
    "includeActive": true,
    "includeInactive": false,
    "categoryIds": null,           // Todas las categorías
    "brandIds": ["10", "20", "30"] // 3 marcas específicas
  }
}
```

### Caso 3: "Quiero productos activos E inactivos de ciertas categorías"

```json
POST /api/products/sync/{{connection_id}}
{
  "filters": {
    "includeActive": true,
    "includeInactive": true,       // Incluir ambos
    "categoryIds": ["1", "2", "3"],
    "brandIds": null
  }
}
```

---

## 📊 Mejoras de la Fase 2

### Antes (Sin Filtros)
- ❌ Límite hardcodeado de 30 productos
- ❌ API pública sin autenticación
- ❌ Sin precios ni inventario
- ❌ Sin filtros de categoría/marca
- ❌ Importaba productos basura

### Ahora (Con Filtros)
- ✅ **Sin límite de productos** (usa paginación)
- ✅ **API privada autenticada** con AppKey/AppToken
- ✅ **Precios completos** (precio base, lista, costo)
- ✅ **Inventario en tiempo real** de todos los warehouses
- ✅ **Filtros de categoría** (multi-select)
- ✅ **Filtros de marca** (multi-select)
- ✅ **Filtros de estado** (activo/inactivo)
- ✅ **Imágenes del producto**
- ✅ **Datos completos del SKU**

---

## 🐛 Troubleshooting

### Error: "Not authorized, no token"
- ❌ No ejecutaste el Login/Register
- ✅ Ejecuta primero "Login" en la carpeta Authentication

### Error: "Workspace context required"
- ❌ El header `x-workspace-id` está vacío
- ✅ Ejecuta "Get My Workspaces" para obtener el workspace_id

### Error: "Store connection not found"
- ❌ El `connection_id` no es válido o no existe
- ✅ Ejecuta "Get All Connections" o "Create VTEX Store"

### Error: "VTEX authentication failed"
- ❌ Las credenciales VTEX son incorrectas
- ✅ Verifica en las variables de colección:
  - `vtex_account_name` (sin https://)
  - `vtex_app_key`
  - `vtex_app_token`

### El sync tarda mucho tiempo
- ℹ️ **Esto es normal ahora**. La Fase 2 obtiene datos completos de cada producto:
  1. Product metadata (GET /product/{id})
  2. SKU details (GET /sku/{id})
  3. Pricing (GET /pricing/prices/{id})
  4. Inventory (GET /logistics/inventory/{id})

  **4 llamadas por producto** → Para 100 productos = 400 requests API

- 💡 **Usa filtros** para reducir la cantidad de productos sincronizados

### No aparecen productos después del sync
1. Verifica que el sync terminó exitosamente (status 200)
2. Revisa los filtros - podrían ser muy restrictivos
3. Ejecuta "Get All Products" para confirmar

---

## 📚 Documentación Adicional

- **Especificación Completa**: `/docs/SELECTIVE_SYNC_FEATURE_SPECIFICATION.md`
- **Análisis VTEX**: `/docs/VTEX_INTEGRATION_ANALYSIS.md`
- **API Backend**: `/RACKY_BACKEND_API.md`

---

## ✅ Checklist de Testing Completo

- [ ] Login exitoso y token guardado
- [ ] Workspace ID obtenido
- [ ] Conexión VTEX creada o existente
- [ ] Categorías VTEX obtenidas (GET /categories)
- [ ] Marcas VTEX obtenidas (GET /brands)
- [ ] Sync sin filtros funciona
- [ ] Sync con filtro de categorías funciona
- [ ] Sync con filtro de marcas funciona
- [ ] Sync con ambos filtros funciona
- [ ] Productos aparecen en GET /products
- [ ] Productos tienen precios correctos
- [ ] Productos tienen inventario correcto
- [ ] Force sync elimina y re-importa correctamente

---

**¡Listo para probar!** 🚀

Si encuentras algún error, revisa los logs del servidor en la terminal donde ejecutaste `npm run dev`.
