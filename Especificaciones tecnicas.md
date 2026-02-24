# **📱 Especificación Técnica: Catálogo Digital de Pedidos**

## **🎯 Objetivo**

Desarrollar una app móvil tipo catálogo para clientes mayoristas y usuarios finales que permita:

* Visualizar productos con info comercial y stock disponible.  
* Mostrar precios según tipo de cliente.  
* Generar pedidos con cálculos automáticos.  
* Enviar pedidos por WhatsApp al vendedor y confirmación al cliente.  
  Plataforma: AppSheet \+ Google Sheets (base de datos en nube).

## **🗄️ Arquitectura del Sistema**

## **Base de Datos (Google Sheets)**

| Tabla: Productos |  |
| :---- | :---- |
| ID Producto (clave) | Texto único |
| Foto | Imagen |
| Referencia | Texto |
| Nombre | Texto |
| Descripción | Texto corto |
| Categoría | Lista: "Ropa", "Accesorios", etc. |
| Stock Disponible | Número |
| Precio Mayorista | Número (COP) |
| Precio Usuario Final | Número (COP) |

| Tabla: Clientes |  |
| :---- | :---- |
| Identificación (clave) | Texto (cédula) |
| PIN | Texto (4 dígitos) |
| Nombre | Texto |
| Tipo Cliente | Lista: "Mayorista", "Usuario Final" |
| Teléfono WhatsApp | Texto (+57...) |

| Tabla: Pedidos |  |
| :---- | :---- |
| ID Pedido (clave, auto) | Texto |
| Identificación Cliente | Ref. Clientes |
| Fecha | Fecha/hora |
| Estado | Lista: "Pendiente", "Enviado", "Cancelado" |
| Total Pedido | Número (calculado) |

| Tabla: Detalle Pedido |  |
| :---- | :---- |
| ID Detalle (clave, auto) | Texto |
| ID Pedido | Ref. Pedidos |
| ID Producto | Ref. Productos |
| Cantidad | Número |
| Precio Unitario | Número (según cliente) |
| Subtotal | Número (calculado) |

## **🔐 Control de Acceso**

text

`Al abrir app:`  
`1. Pantalla login: ID Cliente + PIN`  
`2. Consulta tabla Clientes`  
`3. Si válido → redirige a catálogo con precios según tipo`  
`4. Si inválido → "Credenciales incorrectas"`

Expresión AppSheet: IF(AND(\[ID\]=Clientes\[ID\], \[PIN\]=Clientes\[PIN\]), "Acceso OK", "Error")

## **🛒 Flujo de Usuario Completo**

## **1\. Visualización Catálogo**

text

`Vista: Galería o Deck`  
`Muestra por producto:`  
`❖ Foto grande`  
`❖ Nombre + Ref.`  
`❖ Descripción`  
`❖ Precio (condicional):`  
  `IF(TipoCliente="Mayorista", PrecioMayorista, PrecioUsuarioFinal)`  
`❖ Stock: Verde si >0, Rojo si 0`  
`❖ Filtros: Categoría, búsqueda por nombre/ref.`

## **2\. Carrito de Compras**

text

`Botones por producto:`  
`➕ Agregar al carrito`  
`Vista Carrito:`  
`- Producto | Cantidad | Precio | Subtotal | 🗑️ Eliminar`  
`- Total acumulado (auto)`  
`- ⚠️ Validación: Cantidad ≤ Stock`  
`Botones: "Limpiar carrito" | "Confirmar pedido"`

## **3\. Confirmación Pedido**

text

`Muestra:`  
`CLIENTE: [Nombre]`  
`FECHA: [Hoy]`  
`PRODUCTOS:`  
`• [Prod] x[Cant] = $[Subtotal]`  
`TOTAL: $[Total]`

`Botones:`  
`✅ Enviar Pedido`  
`❌ Cancelar`

## **📤 Envío Automático WhatsApp**

## **Mensaje al Vendedor (número fijo admin):**

text

`PEDIDO # [ID Pedido]`  
`Cliente: [Nombre] ([ID])`  
`Fecha: [Fecha]`  
`Tel: [Tel Cliente]`

`PRODUCTOS:`  
`• [Nombre Prod] x[Cant] = $[Subtotal]`  
`• ...`

`TOTAL: $[Total]`

`Estado: Pendiente`

## **Confirmación al Cliente:**

text

`✅ Su pedido #[ID] fue recibido!`  
`Total: $[Total]`  
`Le contactaremos pronto.`  
`Gracias por su compra.`

AppSheet Action: LINKTOFORM("WhatsApp", "mensaje\_generado", "phone", \[TelAdmin\])

## **⚙️ Funcionalidades Técnicas**

| Feature | Implementación AppSheet |
| :---- | :---- |
| Cálculos auto | Virtual Columns: Subtotal \= Cantidad \* Precio |
| Precios dinámicos | IFS(\[TipoCliente\]="Mayorista", \[PrecioMayorista\], \[PrecioFinal\]) |
| Validaciones | Show\_If: Stock \>= Cantidad |
| Historial pedidos | Vista "Mis Pedidos" filtrada por \[ID Cliente\] |
| Offline | Sync on reopen |
| Multi-dispositivo | Tablets/celulares Android/iOS |

## **🧪 Pruebas Requeridas**

1. Login inválido → Error claro  
2. Pedido \> stock → Bloquea  
3. WhatsApp abre con mensaje correcto  
4. Precios cambian por tipo cliente  
5. Historial carga pedidos pasados

## **🚀 Implementación en AppSheet (Pasos)**

text

`1. Crear Google Sheet con 4 tabs (tablas arriba)`  
`2. New App → Start with your own data → Google Sheets`  
`3. Configurar Refs entre tablas`  
`4. Crear Views: Login, Catálogo, Carrito, Pedidos`  
`5. Actions: WhatsApp, Calcular totales`  
`6. Deploy → QR para clientes`

## **💼 Beneficios Negocio**

* 0 errores precios (automático por perfil)  
* Pedidos 24/7 sin llamadas  
* Stock real-time evita promesas incumplidas  
* Escalabilidad 1000s clientes sin programar

