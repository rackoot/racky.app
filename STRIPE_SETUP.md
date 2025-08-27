# Configuración de Stripe para Racky

Esta guía explica cómo configurar Stripe para habilitar el flujo de compra embebido en Racky.

## Estado Actual de la Implementación ✅

### Backend Completado
- ✅ **Servicio de Stripe** (`/server/src/common/services/stripeService.ts`)
  - Creación de sessiones de checkout embebidas
  - Manejo de webhooks para eventos de pago
  - Creación/actualización de subscripciones
  - Integración con modelo Workspace

- ✅ **Rutas de Billing** (`/server/src/modules/subscriptions/routes/billing.ts`)
  - Endpoint `/api/billing/create-checkout-session` con soporte embebido
  - Webhook handler `/api/billing/stripe/webhook`
  - Fallback a modo demo cuando Stripe no está configurado

- ✅ **Modelos Actualizados**
  - Workspace con campo `stripeCustomerId`
  - Subscription con campos de Stripe integration

### Frontend Completado
- ✅ **Componente EmbeddedCheckout** (`/client/src/components/pricing/embedded-checkout.tsx`)
  - Integración con Stripe Elements
  - Manejo de estados (loading, error, success)
  - Fallback a demo mode cuando Stripe no está configurado

- ✅ **ContributorSelector Actualizado** 
  - Flujo completo: selección → configuración → checkout embebido
  - Transición suave entre pasos sin redirecciones

## Configuración para Producción

### 1. Crear Cuenta de Stripe
1. Registrarse en [stripe.com](https://stripe.com)
2. Completar verificación de negocio
3. Configurar información de pago y bancaria

### 2. Obtener Claves API
```bash
# Test Environment
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Production Environment  
STRIPE_SECRET_KEY=sk_live_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Configurar Productos y Precios en Stripe
```javascript
// Crear productos para cada tipo de contributor
const products = [
  {
    name: "Junior Contributor",
    description: "Essential marketplace automation",
    prices: {
      monthly: "$29/month",
      yearly: "$290/year" // ~17% discount
    }
  },
  {
    name: "Senior Contributor", 
    description: "Advanced automation with AI",
    prices: {
      monthly: "$79/month",
      yearly: "$790/year"
    }
  }
]
```

### 4. Configurar Webhooks
1. En Stripe Dashboard → Developers → Webhooks
2. Agregar endpoint: `https://yourdomain.com/api/billing/stripe/webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

**✅ Nota Importante - Webhook Configuración**
El webhook `/api/billing/stripe/webhook` está configurado especialmente para evitar problemas de autenticación:
- **NO requiere token JWT** - Stripe no puede enviar tokens de autorización
- **Validación por firma** - Usa `stripe-signature` header para autenticación
- **Raw body required** - El endpoint está configurado antes del middleware JSON parser
- **Sin middleware de workspace** - Acceso directo sin restricciones de workspace

### 5. Variables de Entorno
```bash
# Backend (.env)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## Flujo de Usuario Implementado

### 1. Selección de Plan
- Usuario ve tres opciones: Junior, Senior, Executive
- Puede alternar entre facturación mensual/anual
- Executive plan redirige a formulario de contacto

### 2. Configuración de Contributors  
- Slider para seleccionar cantidad (1-5 contributors)
- Vista previa de precio total y acciones mensuales
- Cálculo dinámico de costos

### 3. Checkout Embebido
- **Modo Producción**: Stripe Elements embebido en la página
- **Modo Demo**: Formulario simulado para desarrollo
- Sin redirecciones externas, experiencia fluida

### 4. Post-Pago
- Webhook procesa el pago exitoso
- Crea/actualiza subscription en base de datos
- Usuario redirigido al dashboard con mensaje de éxito

## Modo Demo vs Producción

### Modo Demo (Stripe no configurado)
- Checkout simulado con botón "Complete Demo Payment"
- No se procesen pagos reales
- Útil para desarrollo y demos

### Modo Producción (Stripe configurado)
- Checkout real de Stripe embebido
- Pagos procesan correctamente
- Webhooks actualizan subscripciones

## Testing

### Test Cards (Modo Test)
```
Successful Payment: 4242 4242 4242 4242
Declined Card: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
```

### Verificar Implementación
1. Usar claves de test de Stripe
2. Completar flujo de checkout
3. Verificar webhook events en Stripe Dashboard
4. Confirmar subscription en database

## Próximos Pasos (Opcionales)

1. **Mejorar UX**
   - Loading states más detallados
   - Mejor manejo de errores
   - Animaciones entre estados

2. **Funcionalidades Adicionales**
   - Actualizar cantidad de contributors
   - Cancelar subscripciones
   - Historial de pagos

3. **Analytics**
   - Tracking de conversión
   - Métricas de abandono de checkout
   - Revenue analytics

## Estructura de Archivos

```
server/src/
├── common/services/stripeService.ts      # Lógica core de Stripe
├── modules/subscriptions/routes/billing.ts # Endpoints de billing
├── modules/workspaces/models/Workspace.ts # Modelo con stripeCustomerId

client/src/
├── components/pricing/
│   ├── embedded-checkout.tsx            # Checkout embebido
│   └── contributor-selector.tsx         # Selector actualizado
```

El sistema está **completamente implementado** y listo para usar. Solo requiere configuración de Stripe para funcionar en producción.