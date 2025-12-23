# Indicadores Sugeridos para Dashboard de Asistentes

Documento de referencia con indicadores clave que serían útiles para monitorear el congreso en tiempo real.

---

## 📊 Indicadores Generales

### 1. Resumen de Registro
- **Total registrados / Total esperados** (con porcentaje)
- **Participantes pendientes de registrarse**
- **Tasa de asistencia global**

**Utilidad**: Vista rápida del nivel de asistencia al congreso. Permite saber si la mayoría ha llegado o si aún se esperan participantes.

### 2. Ocupación por Sala
- **Porcentaje de ocupación actual**
- **Capacidad disponible** (si se definen límites de aforo)
- **Tendencia**: ↗️ subiendo / ↘️ bajando / → estable

**Utilidad**: Monitoreo de aforo en tiempo real. Útil para controlar que no se superen capacidades máximas y para redistribuir participantes si es necesario.

---

## 🎯 Indicadores por Permisos

### 3. Aprovechamiento de Permisos
- **Master Class**: X de Y con permiso han entrado (%)
- **Cena**: X de Y con permiso han entrado (%)
- **Participantes con permisos sin usar**

**Utilidad**: Permite saber si los participantes están aprovechando los permisos que tienen. Útil para decisiones logísticas (comida, materiales, etc.).

---

## ⏱️ Indicadores de Actividad

### 4. Actividad Reciente
- **Últimos 5-10 accesos** (feed en tiempo real)
- **Hora del último escaneo**
- **Accesos por hora** (gráfico simple)

**Utilidad**: Ver la actividad en vivo. Detectar picos de llegadas (hora punta) o momentos de poca actividad.

### 5. Intentos Fallidos
- **Total de accesos denegados hoy**
- **Razones principales de denegación**
  - Sin permiso para la sala
  - No registrado previamente
  - Intento de salida sin haber entrado
  - Intento de entrada estando ya dentro
- **Participantes con múltiples intentos fallidos**

**Utilidad**: Identificar problemas comunes. Si muchos intentos fallan por la misma razón, puede indicar un problema de proceso o comunicación con los participantes.

---

## 📈 Comparativas

### 6. Vista Comparativa
- **Gráfico de barras** comparando ocupación en las 3 salas
- **Sala más concurrida / menos concurrida**
- **Distribución porcentual de participantes**

**Utilidad**: Comparación visual rápida. Útil para balancear recursos (personal, materiales) entre salas.

---

## 🔔 Alertas (Opcional)

### 7. Notificaciones Visuales
- ⚠️ **Sala cerca del límite de aforo** (>90% de capacidad)
- ℹ️ **Eventos importantes pendientes**
- 🔴 **Problemas de acceso recurrentes** (mismo participante con múltiples fallos)

**Utilidad**: Atención proactiva a situaciones que requieren intervención inmediata.

---

## 📋 Recomendación de Implementación Inicial

**Prioridad 1** (Implementar primero):
1. ✅ **Resumen de registro** (total registrados/esperados)
2. ✅ **Porcentaje de ocupación por sala**
3. ✅ **Aprovechamiento de permisos** (MC y Cena)
4. ✅ **Feed de últimos accesos**

Estos 4 indicadores proporcionan una visión completa del estado del congreso sin sobrecargar la interfaz.

**Prioridad 2** (Después):
- Intentos fallidos con razones
- Vista comparativa (gráfico de barras)

**Prioridad 3** (Opcional/Avanzado):
- Accesos por hora (gráfico temporal)
- Sistema de alertas visuales
- Tendencias de ocupación

---

## 💡 Notas de Implementación

### Datos Necesarios
Para implementar estos indicadores necesitaremos:
- **Total de participantes esperados**: Puede ser el total importado desde Excel
- **Capacidades máximas por sala**: Opcional, se puede configurar manualmente
- **Logs de acceso**: Ya están implementados en `access_logs` collection

### Queries de Firestore
La mayoría de estos indicadores se pueden calcular con:
- Queries sobre la colección `participants` (con filtros en `estado`)
- Queries sobre `access_logs` para actividad reciente y errores
- Agregaciones en el cliente (React Native)

### Performance
Para no sobrecargar:
- Usar suscripciones en tiempo real solo para datos críticos (ocupación actual)
- Cachear cálculos que no cambian frecuentemente (total esperados)
- Actualizar feeds de actividad con debounce/throttle si es necesario
