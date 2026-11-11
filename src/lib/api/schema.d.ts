/* eslint-disable */
// GENERADO por scripts/gen-api.mts a partir de docs/openapi.json. No editar a mano.

export interface paths {
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Disponibilidad del proceso (público)
         * @description Indica que el proceso HTTP responde; no comprueba la BD.
         */
        get: operations["HealthController_getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Disponibilidad de PostgreSQL (público)
         * @description Ejecuta `SELECT 1` con un límite de 2 segundos.
         */
        get: operations["HealthController_getReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Iniciar sesión (público)
         * @description Usuario (personal) o correo (clientes) y contraseña producen un JWT asociado a una sesión; se envía exactamente uno de `username` o `email`. Cinco fallos bloquean la cuenta 15 minutos.
         */
        post: operations["AuthController_login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Identidad de la sesión (cualquier rol) */
        get: operations["AuthController_me"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cerrar sesión (cualquier rol)
         * @description Revoca la sesión; el mismo JWT devuelve 401 después.
         */
        post: operations["AuthController_logout"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Cambiar mi contraseña (cualquier rol)
         * @description Verifica la contraseña actual con el mismo contador de fallos del login (cinco fallos bloquean la cuenta 15 minutos), exige una nueva distinta y revoca las demás sesiones; la actual sigue válida.
         */
        patch: operations["AuthController_changePassword"];
        trace?: never;
    };
    "/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar usuarios paginados (solo admin)
         * @description Con `search` (usuario, nombre, teléfono y correo) y `role` (uno o varios separados por coma) el filtro lo hace el servidor; sin ellos devuelve todos, ordenados por `username`.
         */
        get: operations["UsersController_list"];
        put?: never;
        /**
         * Crear usuario (solo admin)
         * @description No hay registro público; el admin comunica la contraseña.
         */
        post: operations["UsersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar usuario (solo admin) */
        get: operations["UsersController_findOne"];
        put?: never;
        post?: never;
        /**
         * Eliminar usuario sin historial (solo admin)
         * @description Sus sesiones dejan de ser válidas de inmediato.
         */
        delete: operations["UsersController_remove"];
        options?: never;
        head?: never;
        /**
         * Editar username, contraseña, nombre o teléfono (solo admin)
         * @description No cambia el rol. Una contraseña nueva revoca las demás sesiones del usuario editado y reinicia su bloqueo de intentos. En un cliente, nombre y teléfono se guardan en su ficha (2 a 100 caracteres de nombre; 2 a 80 en el personal) y el username no se edita.
         */
        patch: operations["UsersController_update"];
        trace?: never;
    };
    "/users/{id}/role": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Cambiar rol (solo admin)
         * @description Revoca todas las sesiones del usuario: debe iniciar sesión de nuevo y sus canales en vivo se cierran. Un admin no cambia su propio rol.
         */
        patch: operations["UsersController_changeRole"];
        trace?: never;
    };
    "/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar catálogo paginado (admin u operador)
         * @description Ordenado por SKU; incluye el saldo de cada producto.
         */
        get: operations["ProductsController_list"];
        put?: never;
        /**
         * Crear producto (solo admin)
         * @description Nace activo, sin «agotado» y con stock 0. Simple: `cost` obligatorio. Combo: `components` obligatorio y `cost` se calcula.
         */
        post: operations["ProductsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/products/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar producto y saldo (admin u operador) */
        get: operations["ProductsController_findOne"];
        put?: never;
        post?: never;
        /**
         * Eliminar producto sin movimientos (solo admin)
         * @description Con historial responde 409: se desactiva con /status.
         */
        delete: operations["ProductsController_remove"];
        options?: never;
        head?: never;
        /**
         * Editar nombre, descripción, categoría, precio o costo (solo admin)
         * @description No modifica SKU, estado, «agotado», stock ni componentes. `cost` no se admite en combos y la categoría no pasa hacia ni desde `combo`.
         */
        patch: operations["ProductsController_update"];
        trace?: never;
    };
    "/products/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Activar o desactivar producto (solo admin)
         * @description Desactivar conserva saldo e historial.
         */
        patch: operations["ProductsController_setStatus"];
        trace?: never;
    };
    "/products/{id}/sold-out": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Marcar o desmarcar «agotado» (admin u operador)
         * @description Idempotente. Responde el producto con su `available` resultante.
         */
        patch: operations["ProductsController_setSoldOut"];
        trace?: never;
    };
    "/products/{id}/components": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * Reemplazar la composición de un combo (solo admin)
         * @description 2 a 10 productos simples, activos y distintos, con cantidad de 1 a 10. Si la composición es inválida se conserva la anterior.
         */
        put: operations["ProductsController_replaceComponents"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/menu": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Menú vendible (público)
         * @description Productos activos ordenados por categoría (combo, café, bebida, panadería, pastelería, snack) y nombre, con su disponibilidad. No incluye costo, saldo ni estado interno.
         */
        get: operations["MenuController_menu"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/movements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Historial paginado (admin u operador)
         * @description Más reciente primero; filtros por producto y tipo.
         */
        get: operations["MovementsController_list"];
        put?: never;
        /**
         * Registrar entrada o salida (admin u operador)
         * @description Actualiza el saldo y guarda el movimiento en una transacción. No es idempotente: repetirlo registra otro movimiento.
         */
        post: operations["MovementsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Registrar cliente (público)
         * @description Crea la cuenta con correo y contraseña. No inicia sesión: después se llama a `POST /auth/login` con `email` y `password`.
         */
        post: operations["CustomersController_register"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/customers/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar mi perfil (solo cliente) */
        get: operations["CustomersController_profile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Editar mi nombre o teléfono (solo cliente)
         * @description El correo no se puede cambiar.
         */
        patch: operations["CustomersController_update"];
        trace?: never;
    };
    "/delivery-zones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Zonas y puntos de entrega (público)
         * @description Solo zonas y puntos activos, ordenados por nombre. Las zonas sin puntos activos se omiten.
         */
        get: operations["DeliveryZonesController_publicZones"];
        put?: never;
        /** Crear zona (solo admin) */
        post: operations["DeliveryZonesController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/delivery-zones/all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Todas las zonas y puntos (solo admin)
         * @description Incluye inactivos y zonas sin puntos.
         */
        get: operations["DeliveryZonesController_allZones"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/delivery-zones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Eliminar una zona sin puntos (solo admin) */
        delete: operations["DeliveryZonesController_remove"];
        options?: never;
        head?: never;
        /** Editar, activar o desactivar una zona (solo admin) */
        patch: operations["DeliveryZonesController_update"];
        trace?: never;
    };
    "/delivery-points": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Crear punto de entrega (solo admin) */
        post: operations["DeliveryPointsController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/delivery-points/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Eliminar un punto (solo admin) */
        delete: operations["DeliveryPointsController_remove"];
        options?: never;
        head?: never;
        /** Editar, mover, activar o desactivar un punto (solo admin) */
        patch: operations["DeliveryPointsController_update"];
        trace?: never;
    };
    "/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar pedidos (cliente: los suyos; admin y operador: todos)
         * @description Más reciente primero; filtro opcional por estado.
         */
        get: operations["OrdersController_list"];
        put?: never;
        /**
         * Crear pedido y pagar con tarjeta de demostración (solo cliente)
         * @description Calcula el total con los precios del menú, cobra con la tarjeta de prueba y descuenta el saldo con movimientos `OUT` en una sola transacción.
         */
        post: operations["OrdersController_create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Canal en tiempo real del cliente (SSE, solo cliente)
         * @description Envía `ready` al abrir y tras cada reconexión de la escucha (el cliente vuelve a consultar sus pedidos), un evento `order` con número, estado y hora cada vez que cambia el estado de uno de **sus** pedidos, y un comentario de latido cada 25 segundos. Máximo 5 canales por usuario.
         */
        get: operations["OrdersController_stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Consultar un pedido */
        get: operations["OrdersController_findOne"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/survey": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Responder la encuesta de un pedido entregado (solo cliente)
         * @description Calificación de 1 a 5 y comentario opcional. Una sola respuesta por pedido; no se edita.
         */
        post: operations["OrdersController_survey"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/orders/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancelar un pedido y devolver el saldo
         * @description El cliente solo cancela el suyo en `recibido`; admin y operador, en `recibido` o `en_preparacion`, con `reason`. Registra movimientos `IN` y reembolsa el pago de demostración.
         */
        post: operations["OrdersController_cancel"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/kitchen/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Cola de cocina (operador y admin)
         * @description Por defecto `recibido` y `en_preparacion`, el pedido más antiguo primero; con `status` también se pueden ver los `listo`.
         */
        get: operations["KitchenController_queue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/kitchen/orders/{id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Empezar a preparar un pedido (recibido → en_preparacion)
         * @description Registra quién y cuándo, y avisa al cliente y a la cocina.
         */
        post: operations["KitchenController_start"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/kitchen/orders/{id}/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Marcar un pedido como listo (en_preparacion → listo)
         * @description Registra quién y cuándo, y avisa al cliente y a la cocina.
         */
        post: operations["KitchenController_ready"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/kitchen/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Canal en tiempo real de la cocina (SSE)
         * @description Envía `ready` al abrir y tras cada reconexión de la escucha (el cliente vuelve a consultar la cola), un evento `order` por cada pedido nuevo, cambio de estado o cancelación, y un comentario de latido cada 25 segundos. Máximo 5 canales por usuario.
         */
        get: operations["KitchenController_stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/surveys": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar respuestas de la encuesta (solo admin)
         * @description La más reciente primero; filtros por calificación y por rango de fechas (hora de Colombia, ambos días inclusive).
         */
        get: operations["SurveysController_list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Cola de despacho: pedidos listos por zona
         * @description Zonas ordenadas por su pedido más antiguo; `suggestedZoneId` es la zona del `listo` más antiguo.
         */
        get: operations["DispatchController_queue"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/rounds": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Listar rondas
         * @description El repartidor ve las suyas (por defecto las activas); admin y operador ven todas. La más reciente primero.
         */
        get: operations["DispatchController_rounds"];
        put?: never;
        /**
         * Crear una ronda y salir a repartir (repartidor)
         * @description Sin `orderIds` toma la sugerencia (zona del `listo` más antiguo y hasta 5 pedidos); con `orderIds` arma una ruta propia de una sola zona. Los pedidos pasan a `en_camino` con ETA de 15 minutos. Máximo 2 rondas activas.
         */
        post: operations["DispatchController_createRound"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/rounds/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Detalle de una ronda con sus pedidos */
        get: operations["DispatchController_round"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/orders/{id}/deliver": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Marcar un pedido como entregado (en_camino → entregado) */
        post: operations["DispatchController_deliver"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/orders/{id}/fail": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Marcar un pedido como no entregado (en_camino → no_entregado)
         * @description Exige un motivo. No mueve inventario ni pago.
         */
        post: operations["DispatchController_fail"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/dispatch/stream": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Canal en tiempo real del repartidor (SSE)
         * @description Mismo formato que el canal de la cocina: `ready`, un evento `order` por cada cambio de estado y latido cada 25 segundos. Máximo 5 canales por usuario.
         */
        get: operations["DispatchController_stream"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Métricas del negocio (solo admin)
         * @description Ventas, margen, tiempos de despacho, satisfacción, recompra y resultado de los pedidos creados en el periodo (hora de Colombia). Por defecto, los últimos 30 días; máximo 366.
         */
        get: operations["MetricsController_report"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        HealthResponse: {
            /**
             * @example ok
             * @enum {string}
             */
            status: "ok";
        };
        ErrorResponse: {
            /** @example 400 */
            statusCode: number;
            /**
             * @description Mensaje del error. En errores de validación es una lista de mensajes.
             * @example Credenciales inválidas.
             */
            message: string | string[];
            /** @example Bad Request */
            error?: string;
        };
        LoginDto: {
            /**
             * @description Personal (admin, operador, repartidor). Excluyente con `email`.
             * @example admin
             */
            username?: string;
            /**
             * Format: email
             * @description Clientes. Excluyente con `username`; no distingue mayúsculas.
             * @example ana.perez@u.icesi.edu.co
             */
            email?: string;
            /** Format: password */
            password: string;
        };
        LoginResponse: {
            /**
             * @description JWT HS256 de acceso.
             * @example eyJhbGciOi…
             */
            accessToken: string;
            /**
             * @example Bearer
             * @enum {string}
             */
            tokenType: "Bearer";
            /**
             * @description Segundos de validez del JWT.
             * @example 900
             */
            expiresIn: number;
        };
        IdentityResponse: {
            /** Format: uuid */
            id: string;
            /** @example admin */
            username: string;
            /**
             * @example admin
             * @enum {string}
             */
            role: "admin" | "operador" | "repartidor" | "cliente";
        };
        ChangePasswordDto: {
            /** Format: password */
            currentPassword: string;
            /**
             * Format: password
             * @description Debe ser distinta de la actual.
             */
            newPassword: string;
        };
        CreateUserDto: {
            /**
             * @description Minúsculas ASCII, dígitos y `._-`, empezando por letra o dígito.
             * @example nuevo_operador
             */
            username: string;
            /**
             * Format: password
             * @description Contraseña inicial; se guarda con hash scrypt.
             */
            password: string;
            /**
             * @description Rol de personal. `cliente` solo nace del registro propio.
             * @example operador
             * @enum {string}
             */
            role: "admin" | "operador" | "repartidor";
            /**
             * @description Obligatorio para el rol `repartidor`. Celular colombiano o internacional; se guarda en E.164.
             * @example 300 123 4567
             */
            phone?: string;
            /**
             * @description Obligatorio para el rol `repartidor`; lo ve el cliente cuando su pedido va en camino.
             * @example Carlos Gómez
             */
            fullName?: string;
        };
        UserResponse: {
            /** Format: uuid */
            id: string;
            /** @example operador */
            username: string;
            /**
             * @example operador
             * @enum {string}
             */
            role: "admin" | "operador" | "repartidor" | "cliente";
            /**
             * Format: email
             * @description Solo clientes; el personal devuelve `null`.
             * @example null
             */
            email: string | null;
            /**
             * @description Clientes: su nombre. Personal: el que le asignó el admin (obligatorio para repartidores) o `null`.
             * @example null
             */
            fullName: string | null;
            /**
             * @description Formato E.164. Clientes: su teléfono. Personal: el que le asignó el admin (obligatorio para repartidores) o `null`.
             * @example null
             */
            phone: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UserPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["UserResponse"][];
        };
        UpdateUserDto: {
            /**
             * @description Envía al menos un campo.
             * @example operador_renombrado
             */
            username?: string;
            /**
             * Format: password
             * @description Contraseña nueva; revoca las demás sesiones del usuario editado.
             */
            password?: string;
            /**
             * @description Teléfono de contacto (personal o cliente); se guarda en E.164.
             * @example +57 300 123 4567
             */
            phone?: string;
            /** @description Nombre de contacto: 2 a 80 caracteres para el personal y 2 a 100 para un cliente. */
            fullName?: string;
        };
        ChangeRoleDto: {
            /**
             * @description Rol de personal; un cliente no cambia de rol.
             * @example admin
             * @enum {string}
             */
            role: "admin" | "operador" | "repartidor";
        };
        ComponentInputDto: {
            /**
             * Format: uuid
             * @description Producto simple y activo.
             */
            productId: string;
            /** @example 1 */
            quantity: number;
        };
        CreateProductDto: {
            /**
             * @description Mayúsculas, dígitos y `._-`; único e inmutable.
             * @example INV-100
             */
            sku: string;
            /**
             * @description Al menos un carácter visible; sin NUL.
             * @example Cable HDMI
             */
            name: string;
            /**
             * @description Opcional; sin NUL.
             * @example Dos metros
             */
            description?: string | null;
            /**
             * @example cafe
             * @enum {string}
             */
            category: "combo" | "cafe" | "bebida" | "panaderia" | "pasteleria" | "snack";
            /**
             * @description Pesos COP, entero. Obligatorio en productos simples. En un combo es opcional: si se omite, vale la suma de los precios de sus componentes al crearlo.
             * @example 4500
             */
            price?: number;
            /**
             * @description Costo variable unitario en pesos COP. Obligatorio en productos simples; no se admite en combos (se calcula).
             * @example 1600
             */
            cost?: number;
            /** @description Obligatorio en combos (2 a 10 productos distintos); no se admite en productos simples. */
            components?: components["schemas"]["ComponentInputDto"][];
        };
        ComponentResponse: {
            /** Format: uuid */
            productId: string;
            /** @example CAF-CAPU */
            sku: string;
            /** @example Capuchino */
            name: string;
            /** @example 1 */
            quantity: number;
        };
        ProductResponse: {
            /** Format: uuid */
            id: string;
            /** @example CAF-CAPU */
            sku: string;
            /** @example Capuchino */
            name: string;
            /** @example Café con leche */
            description: string | null;
            /**
             * @example cafe
             * @enum {string}
             */
            category: "combo" | "cafe" | "bebida" | "panaderia" | "pasteleria" | "snack";
            /**
             * @description Pesos COP.
             * @example 4500
             */
            price: number;
            /**
             * @description Costo variable unitario; en un combo se calcula.
             * @example 1600
             */
            cost: number;
            /**
             * @description `cost ÷ price × 100` con un decimal; null si el precio es 0.
             * @example 35.6
             */
            costPercent: number | null;
            /**
             * @description Interruptor manual «agotado» de la cocina.
             * @example false
             */
            soldOut: boolean;
            /**
             * @description Calculado: activo, no agotado, con precio y con saldo (en un combo, saldo de todos sus componentes).
             * @example true
             */
            available: boolean;
            /** @example true */
            active: boolean;
            /**
             * @description Saldo de solo lectura; solo cambia con movimientos. En un combo es calculado.
             * @example 0
             */
            stock: number;
            /** @description [] si es simple. */
            components: components["schemas"]["ComponentResponse"][];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ProductPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["ProductResponse"][];
        };
        UpdateProductDto: {
            /**
             * @description No admite null. Envía al menos uno de `name`, `description`, `category`, `price` o `cost`.
             * @example Cable HDMI 2 m
             */
            name?: string;
            /**
             * @description `null` borra la descripción; sin NUL.
             * @example Dos metros
             */
            description?: string | null;
            /**
             * @description No se puede pasar hacia ni desde `combo`.
             * @enum {string}
             */
            category?: "combo" | "cafe" | "bebida" | "panaderia" | "pasteleria" | "snack";
            /** @example 4500 */
            price?: number;
            /**
             * @description No se admite en combos (se calcula).
             * @example 1600
             */
            cost?: number;
        };
        SetProductStatusDto: {
            /** @example false */
            active: boolean;
        };
        SetSoldOutDto: {
            /** @example true */
            soldOut: boolean;
        };
        ReplaceComponentsDto: {
            /** @description 2 a 10 productos simples, activos y distintos. */
            components: components["schemas"]["ComponentInputDto"][];
        };
        MenuComponentResponse: {
            /** @example Capuchino */
            name: string;
            /** @example 1 */
            quantity: number;
        };
        MenuItemResponse: {
            /** Format: uuid */
            id: string;
            /** @example CAF-CAPU */
            sku: string;
            /** @example Capuchino */
            name: string;
            /** @example Café con leche */
            description: string | null;
            /**
             * @example cafe
             * @enum {string}
             */
            category: "combo" | "cafe" | "bebida" | "panaderia" | "pasteleria" | "snack";
            /**
             * @description Pesos COP.
             * @example 4500
             */
            price: number;
            /** @example true */
            available: boolean;
            components: components["schemas"]["MenuComponentResponse"][];
        };
        MenuResponse: {
            data: components["schemas"]["MenuItemResponse"][];
        };
        CreateMovementDto: {
            /**
             * Format: uuid
             * @description UUID v4 del producto.
             */
            productId: string;
            /**
             * @description `IN` suma al saldo y `OUT` resta; nunca queda negativo.
             * @example IN
             * @enum {string}
             */
            type: "IN" | "OUT";
            /**
             * @description Número JSON entero, no texto.
             * @example 10
             */
            quantity: number;
            /**
             * @description Al menos un carácter visible; sin NUL.
             * @example Compra a proveedor
             */
            reason: string;
        };
        MovementUserResponse: {
            /** Format: uuid */
            id: string;
            /** @example operador */
            username: string;
        };
        MovementResponse: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            productId: string;
            /**
             * @example IN
             * @enum {string}
             */
            type: "IN" | "OUT";
            /** @example 10 */
            quantity: number;
            /** @example Compra a proveedor */
            reason: string;
            /**
             * Format: uuid
             * @description Pedido que originó el movimiento; null si es manual.
             */
            orderId: string | null;
            /** @description Responsable, tomado de la sesión. */
            user: components["schemas"]["MovementUserResponse"];
            /** Format: date-time */
            createdAt: string;
        };
        CreatedMovementResponse: {
            movement: components["schemas"]["MovementResponse"];
            /**
             * @description Saldo confirmado por esta transacción.
             * @example 10
             */
            stock: number;
        };
        MovementPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["MovementResponse"][];
        };
        RegisterCustomerDto: {
            /**
             * Format: email
             * @description Se guarda en minúsculas y es único.
             * @example ana.perez@u.icesi.edu.co
             */
            email: string;
            /**
             * Format: password
             * @description Se guarda con hash scrypt.
             */
            password: string;
            /** @example Ana Pérez */
            fullName: string;
            /**
             * @description Celular colombiano o número internacional (`+…`). Se guarda en formato E.164, p. ej. `+573001234567`.
             * @example 300 123 4567
             */
            phone: string;
        };
        CustomerResponse: {
            /** Format: uuid */
            id: string;
            /**
             * Format: email
             * @example ana.perez@u.icesi.edu.co
             */
            email: string;
            /** @example Ana Pérez */
            fullName: string;
            /**
             * @description Formato E.164.
             * @example +573001234567
             */
            phone: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        UpdateCustomerDto: {
            /** @description Envía al menos `fullName` o `phone`. */
            fullName?: string;
            /**
             * @description Celular colombiano o número internacional; se guarda en E.164.
             * @example +57 300 123 4567
             */
            phone?: string;
        };
        PublicPointResponse: {
            /** Format: uuid */
            id: string;
            /** @example Edificio A */
            name: string;
            /** @example Se entrega en la plazoleta de auditorios */
            hint: string | null;
            /**
             * @description Número de pisos; null si el lugar no tiene pisos.
             * @example 2
             */
            floors: number | null;
        };
        PublicZoneResponse: {
            /** Format: uuid */
            id: string;
            /** @example Zona 1 */
            name: string;
            points: components["schemas"]["PublicPointResponse"][];
        };
        PublicZonesResponse: {
            data: components["schemas"]["PublicZoneResponse"][];
        };
        PointResponse: {
            /** Format: uuid */
            id: string;
            /** @example Edificio A */
            name: string;
            /** @example Se entrega en la plazoleta de auditorios */
            hint: string | null;
            /**
             * @description Número de pisos; null si el lugar no tiene pisos.
             * @example 2
             */
            floors: number | null;
            /** Format: uuid */
            zoneId: string;
            /** @example true */
            active: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        ZoneResponse: {
            /** Format: uuid */
            id: string;
            /** @example Zona 1 */
            name: string;
            /** @example true */
            active: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            points: components["schemas"]["PointResponse"][];
        };
        ZonesResponse: {
            data: components["schemas"]["ZoneResponse"][];
        };
        CreateZoneDto: {
            /** @example Zona 1 */
            name: string;
        };
        UpdateZoneDto: {
            /** @example Zona 1 */
            name?: string;
            /** @example true */
            active?: boolean;
        };
        CreatePointDto: {
            /** Format: uuid */
            zoneId: string;
            /** @example Edificio A */
            name: string;
            /** @example Se entrega en la plazoleta */
            hint?: string | null;
            /**
             * @description Número de pisos; null o ausente si el lugar no tiene pisos.
             * @example 4
             */
            floors?: number | null;
        };
        UpdatePointDto: {
            /**
             * Format: uuid
             * @description Mueve el punto.
             */
            zoneId?: string;
            /** @example Edificio A */
            name?: string;
            /** @description null borra la indicación. */
            hint?: string | null;
            /** @description null significa «sin pisos». */
            floors?: number | null;
            /** @example true */
            active?: boolean;
        };
        OrderLineDto: {
            /**
             * Format: uuid
             * @description Producto del menú.
             */
            productId: string;
            /** @example 2 */
            quantity: number;
        };
        PaymentDto: {
            /**
             * @example tarjeta_demo
             * @enum {string}
             */
            method: "tarjeta_demo";
            /**
             * @description Tarjeta de prueba: `4242424242424242` aprueba y `4000000000000002` rechaza (402). No se guarda.
             * @example 4242424242424242
             */
            cardNumber: string;
        };
        CreateOrderDto: {
            items: components["schemas"]["OrderLineDto"][];
            /**
             * Format: uuid
             * @description Punto de entrega (015).
             */
            pointId: string;
            /**
             * @description Obligatorio si el punto tiene pisos; no se envía si no.
             * @example 2
             */
            floor?: number;
            /**
             * @description Indicación para ubicar al cliente.
             * @example Junto a la entrada del salón 302
             */
            deliveryNote?: string;
            /**
             * @description Nota para la cocina.
             * @example Sin azúcar
             */
            note?: string;
            payment: components["schemas"]["PaymentDto"];
        };
        OrderComponentResponse: {
            /** Format: uuid */
            productId: string;
            /** @example CAF-CAPU */
            sku: string;
            /** @example Capuchino */
            name: string;
            /** @description Por unidad del combo. */
            quantity: number;
        };
        OrderItemResponse: {
            /** Format: uuid */
            productId: string;
            /** @example CAF-CAPU */
            sku: string;
            /** @example Capuchino (caliente) */
            name: string;
            /** @example cafe */
            category: string;
            /** @example 2 */
            quantity: number;
            /**
             * @description Pesos COP al momento de comprar.
             * @example 4500
             */
            unitPrice: number;
            /** @example 9000 */
            lineTotal: number;
            /** @description [] si es simple. */
            components: components["schemas"]["OrderComponentResponse"][];
        };
        OrderCourierResponse: {
            /** @example Carlos Gómez */
            fullName: string;
            /** @example +573001234500 */
            phone: string;
            /**
             * @description Enlace para escribirle por WhatsApp.
             * @example https://wa.me/573001234500
             */
            whatsappUrl: string;
        };
        OrderDeliveryResponse: {
            /** Format: uuid */
            pointId: string;
            /** @example Edificio A */
            pointName: string;
            /** @example Zona 1 */
            zoneName: string;
            /** @example 2 */
            floor: number | null;
            deliveryNote: string | null;
            /**
             * Format: date-time
             * @description Hora estimada de llegada; solo mientras el pedido va `en_camino`.
             */
            etaAt: string | null;
            /** @description Repartidor; solo mientras el pedido va `en_camino`. */
            courier: components["schemas"]["OrderCourierResponse"] | null;
        };
        OrderPaymentResponse: {
            /** @example tarjeta_demo */
            method: string;
            /** @example 4242 */
            last4: string;
            /** @enum {string} */
            status: "aprobado" | "reembolsado";
        };
        OrderCustomerResponse: {
            /** @example Ana Pérez */
            name: string;
            /** @example +573001112233 */
            phone: string;
        };
        OrderSurveyResponse: {
            /** @example 5 */
            rating: number;
            /** @example Llegó caliente y rápido */
            comment: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        OrderEventResponse: {
            /** @enum {string} */
            status: "recibido" | "en_preparacion" | "listo" | "en_camino" | "entregado" | "no_entregado" | "cancelado";
            /** Format: date-time */
            at: string;
        };
        OrderResponse: {
            /** Format: uuid */
            id: string;
            /**
             * @description Consecutivo legible.
             * @example 1001
             */
            number: number;
            /**
             * @example recibido
             * @enum {string}
             */
            status: "recibido" | "en_preparacion" | "listo" | "en_camino" | "entregado" | "no_entregado" | "cancelado";
            /**
             * @description Pesos COP.
             * @example 9000
             */
            total: number;
            items: components["schemas"]["OrderItemResponse"][];
            delivery: components["schemas"]["OrderDeliveryResponse"];
            /** @example Sin azúcar */
            note: string | null;
            payment: components["schemas"]["OrderPaymentResponse"];
            customer: components["schemas"]["OrderCustomerResponse"];
            cancelReason: string | null;
            /** @description Motivo, solo en pedidos `no_entregado`. */
            failureReason: string | null;
            /** @description Encuesta del cliente; `null` mientras no la responda. Con el pedido `entregado` y `survey` en `null`, el front pide la calificación. */
            survey: components["schemas"]["OrderSurveyResponse"] | null;
            events: components["schemas"]["OrderEventResponse"][];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        OrderPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["OrderResponse"][];
        };
        CreateSurveyDto: {
            /** @example 5 */
            rating: number;
            /** @example Llegó caliente y rápido */
            comment?: string;
        };
        SurveyResponse: {
            /** Format: uuid */
            orderId: string;
            /** @example 5 */
            rating: number;
            /** @example Llegó caliente y rápido */
            comment: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        CancelOrderDto: {
            /**
             * @description Obligatorio para admin y operador.
             * @example El cliente lo solicitó por teléfono
             */
            reason?: string;
        };
        SurveyCustomerResponse: {
            /** @example Ana Pérez */
            name: string;
        };
        SurveyRowResponse: {
            /** Format: uuid */
            orderId: string;
            /** @example 5 */
            rating: number;
            /** @example Llegó caliente y rápido */
            comment: string | null;
            /** Format: date-time */
            createdAt: string;
            /** @example 1042 */
            number: number;
            customer: components["schemas"]["SurveyCustomerResponse"];
            /** @example Zona 1 */
            zoneName: string;
        };
        SurveyPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["SurveyRowResponse"][];
        };
        ZoneQueueResponse: {
            /** Format: uuid */
            zoneId: string;
            /** @example Zona 1 */
            zoneName: string;
            /**
             * @description Número del pedido `listo` más antiguo de la zona.
             * @example 1042
             */
            oldestNumber: number;
            /** @description Del más antiguo al más nuevo. */
            orders: components["schemas"]["OrderResponse"][];
        };
        QueueResponse: {
            /**
             * Format: uuid
             * @description Zona del pedido `listo` más antiguo; `null` si no hay pedidos.
             */
            suggestedZoneId: string | null;
            /** @description Zonas ordenadas por su pedido más antiguo. */
            zones: components["schemas"]["ZoneQueueResponse"][];
        };
        CreateRoundDto: {
            /** @description Ruta propia: pedidos `listo` de una sola zona. Si se omite, se usa la sugerencia (zona del pedido `listo` más antiguo y hasta 5 de sus pedidos). */
            orderIds?: string[];
        };
        RoundZoneResponse: {
            /** Format: uuid */
            id: string;
            /** @example Zona 1 */
            name: string;
        };
        RoundCourierResponse: {
            /** Format: uuid */
            id: string;
            /** @example Carlos Gómez */
            fullName: string | null;
            /** @example +573001234500 */
            phone: string | null;
        };
        RoundResponse: {
            /** Format: uuid */
            id: string;
            /**
             * @example activa
             * @enum {string}
             */
            status: "activa" | "finalizada";
            zone: components["schemas"]["RoundZoneResponse"];
            courier: components["schemas"]["RoundCourierResponse"];
            /** Format: date-time */
            startedAt: string;
            /**
             * Format: date-time
             * @description Salida más 15 minutos (constante).
             */
            etaAt: string;
            /** Format: date-time */
            finishedAt: string | null;
            orders: components["schemas"]["OrderResponse"][];
        };
        RoundPageResponse: {
            /** @example 1 */
            page: number;
            /** @example 20 */
            limit: number;
            /** @example 3 */
            total: number;
            /** @example 1 */
            totalPages: number;
            data: components["schemas"]["RoundResponse"][];
        };
        FailOrderDto: {
            /** @example El cliente no estaba en el punto de entrega */
            reason: string;
        };
        MetricsPeriodResponse: {
            /** @example 2026-10-07 */
            from: string;
            /** @example 2026-11-05 */
            to: string;
            /** @example 30 */
            days: number;
            /** Format: uuid */
            zoneId: string | null;
        };
        DailyPointResponse: {
            /** @example 2026-10-07 */
            date: string;
            /** @example 4 */
            orders: number;
            /** @example 34800 */
            revenue: number;
        };
        SalesResponse: {
            /**
             * @description Pedidos con pago aprobado.
             * @example 120
             */
            orders: number;
            /** @example 1044000 */
            revenue: number;
            /** @example 8700 */
            averageTicket: number;
            /** @description Con ceros. */
            daily: components["schemas"]["DailyPointResponse"][];
        };
        CategoryMarginResponse: {
            /** @example 500000 */
            revenue: number;
            /** @example 150000 */
            variableCost: number;
            /** @example 350000 */
            margin: number;
            /** @example 0.3 */
            variableCostRate: number | null;
            /** @example cafe */
            category: string;
        };
        MarginResponse: {
            /** @example 500000 */
            revenue: number;
            /** @example 150000 */
            variableCost: number;
            /** @example 350000 */
            margin: number;
            /** @example 0.3 */
            variableCostRate: number | null;
            byCategory: components["schemas"]["CategoryMarginResponse"][];
        };
        TotalMinutesResponse: {
            /** @example 21.4 */
            average: number | null;
            /** @example 20 */
            median: number | null;
            /** @example 29.5 */
            p90: number | null;
        };
        StageMinutesResponse: {
            /** @example 8.1 */
            kitchen: number | null;
            /** @example 4.2 */
            waiting: number | null;
            /** @example 9.1 */
            delivery: number | null;
        };
        ZoneTimingResponse: {
            /** @example 100 */
            delivered: number;
            /**
             * @description Proporción de entregas con reparto de 15 minutos o menos.
             * @example 0.91
             */
            onTimeRate: number | null;
            totalMinutes: components["schemas"]["TotalMinutesResponse"];
            stageMinutes: components["schemas"]["StageMinutesResponse"];
            /** @example Zona 1 */
            zoneName: string;
        };
        DeliveryResponse: {
            /** @example 100 */
            delivered: number;
            /**
             * @description Proporción de entregas con reparto de 15 minutos o menos.
             * @example 0.91
             */
            onTimeRate: number | null;
            totalMinutes: components["schemas"]["TotalMinutesResponse"];
            stageMinutes: components["schemas"]["StageMinutesResponse"];
            /** @example 15 */
            onTimeThresholdMinutes: number;
            byZone: components["schemas"]["ZoneTimingResponse"][];
        };
        DistributionResponse: {
            /** @example 1 */
            1: number;
            /** @example 2 */
            2: number;
            /** @example 6 */
            3: number;
            /** @example 20 */
            4: number;
            /** @example 41 */
            5: number;
        };
        SatisfactionResponse: {
            /** @example 70 */
            responses: number;
            /** @example 4.4 */
            average: number | null;
            /** @example 0.7 */
            responseRate: number | null;
            distribution: components["schemas"]["DistributionResponse"];
        };
        RetentionResponse: {
            /** @example 60 */
            customers: number;
            /** @example 49 */
            repeatCustomers: number;
            /** @example 0.8167 */
            repeatRate: number | null;
        };
        OutcomesResponse: {
            /** @example 100 */
            entregado: number;
            /** @example 3 */
            no_entregado: number;
            /** @example 6 */
            cancelado: number;
            /**
             * @description recibido, en_preparacion, listo o en_camino.
             * @example 5
             */
            enCurso: number;
        };
        MetricsResponse: {
            period: components["schemas"]["MetricsPeriodResponse"];
            sales: components["schemas"]["SalesResponse"];
            margin: components["schemas"]["MarginResponse"];
            delivery: components["schemas"]["DeliveryResponse"];
            satisfaction: components["schemas"]["SatisfactionResponse"];
            retention: components["schemas"]["RetentionResponse"];
            outcomes: components["schemas"]["OutcomesResponse"];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    HealthController_getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    HealthController_getReadiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Base de datos no disponible. */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_login: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LoginDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LoginResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Credenciales inválidas, usuario inexistente o cuenta bloqueada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_me: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["IdentityResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_logout: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Sesión revocada. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    AuthController_changePassword: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangePasswordDto"];
            };
        };
        responses: {
            /** @description Contraseña cambiada. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Campos inválidos o la contraseña nueva es igual a la actual. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La contraseña actual no es correcta o la cuenta está bloqueada. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_list: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                /** @description Texto parcial, sin distinguir mayúsculas, en el usuario, el nombre, el teléfono y el correo del cliente. Con 3 o más dígitos también busca en los dígitos del teléfono. Si queda vacío tras recortarlo se ignora. */
                search?: string;
                /** @description Uno o varios roles separados por coma (`admin`, `operador`, `repartidor`, `cliente`); los repetidos cuentan una vez. */
                role?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateUserDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El username ya existe. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del usuario. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Usuario no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del usuario. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Usuario eliminado. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Usuario no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Es el último admin, es tu propio usuario o tiene historial (movimientos, pedidos, rondas o encuestas). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del usuario. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateUserDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Usuario no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El username ya existe. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    UsersController_changeRole: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del usuario. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ChangeRoleDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["UserResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Usuario no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description No se puede degradar al último admin, es tu propio rol o el usuario es un cliente. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_list: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                /** @description Texto parcial en SKU o nombre, sin distinguir mayúsculas. */
                search?: string;
                /** @description Filtra por estado; sin él se listan activos e inactivos. */
                active?: "true" | "false";
                category?: "combo" | "cafe" | "bebida" | "panaderia" | "pasteleria" | "snack";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateProductDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El SKU ya existe. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Producto eliminado. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El producto tiene movimientos o es componente de un combo; no se elimina. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateProductDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_setStatus: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetProductStatusDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_setSoldOut: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SetSoldOutDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    ProductsController_replaceComponents: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del producto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ReplaceComponentsDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El producto no es un combo. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MenuController_menu: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MenuResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MovementsController_list: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                /** @description Filtra por producto. */
                productId?: string;
                /** @description Filtra por tipo. */
                type?: "IN" | "OUT";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MovementPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MovementsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateMovementDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedMovementResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto inactivo, saldo insuficiente o saldo máximo excedido. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    CustomersController_register: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegisterCustomerDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El correo ya está registrado. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Más de 5 registros por minuto desde la misma IP. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    CustomersController_profile: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Perfil de cliente no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    CustomersController_update: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateCustomerDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CustomerResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Perfil de cliente no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryZonesController_publicZones: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicZonesResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryZonesController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateZoneDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ZoneResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ya existe una zona con ese nombre. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryZonesController_allZones: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ZonesResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryZonesController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 de la zona. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Zona eliminada. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Zona no encontrada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La zona tiene puntos. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryZonesController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 de la zona. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateZoneDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ZoneResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Zona no encontrada. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ya existe una zona con ese nombre. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryPointsController_create: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreatePointDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PointResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Punto o zona no encontrados. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ya existe un punto con ese nombre. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryPointsController_remove: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del punto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Punto eliminado. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Punto no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DeliveryPointsController_update: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del punto. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdatePointDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PointResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Punto o zona no encontrados. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ya existe un punto con ese nombre. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_list: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                status?: "recibido" | "en_preparacion" | "listo" | "en_camino" | "entregado" | "no_entregado" | "cancelado";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_create: {
        parameters: {
            query?: never;
            header: {
                /** @description UUID generado por el cliente. Repetirlo con el mismo contenido devuelve el pedido ya creado (200). */
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateOrderDto"];
            };
        };
        responses: {
            /** @description Repetición con la misma clave y el mismo contenido. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pago rechazado (tarjeta de prueba `4000000000000002`). */
            402: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto o punto de entrega no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Producto no disponible, saldo insuficiente, punto inactivo o clave de idempotencia usada con otro contenido. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiadas peticiones desde la misma IP (20 por minuto). */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_stream: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Flujo `text/event-stream`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiados canales abiertos o aperturas por minuto. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_findOne: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido no encontrado (o es de otro cliente). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_survey: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateSurveyDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveyResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido no encontrado (o es de otro cliente). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no está `entregado` o ya tiene respuesta. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    OrdersController_cancel: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CancelOrderDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido no encontrado (o es de otro cliente). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no se puede cancelar en su estado actual. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    KitchenController_queue: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                /** @description Por defecto se listan `recibido` y `en_preparacion`, el más antiguo primero. */
                status?: "recibido" | "en_preparacion" | "listo";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    KitchenController_start: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no está en estado `recibido`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    KitchenController_ready: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido no encontrado. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no está en estado `en_preparacion`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    KitchenController_stream: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Flujo `text/event-stream`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiados canales abiertos o aperturas por minuto. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    SurveysController_list: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                rating?: number;
                /** @description Desde este día, inclusive (hora de Colombia). */
                from?: string;
                /** @description Hasta este día, inclusive (hora de Colombia). */
                to?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SurveyPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_queue: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["QueueResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_rounds: {
        parameters: {
            query?: {
                /** @description Página, en dígitos sin signos ni ceros iniciales. */
                page?: number;
                /** @description Registros por página, en dígitos sin ceros iniciales. */
                limit?: number;
                /** @description El repartidor ve por defecto sus rondas `activa`; admin y operador ven todas si no se filtra. */
                status?: "activa" | "finalizada";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoundPageResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_createRound: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateRoundDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoundResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Algún pedido de `orderIds` no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Sin pedidos listos, pedidos no listos o de varias zonas, perfil incompleto o 2 rondas activas. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_round: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 de la ronda. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RoundResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Ronda no encontrada (o de otro repartidor). */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_deliver: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido inexistente o de una ronda ajena. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no está `en_camino`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_fail: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description UUID v4 del pedido. */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FailOrderDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["OrderResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Pedido inexistente o de una ronda ajena. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El pedido no está `en_camino`. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    DispatchController_stream: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Flujo `text/event-stream`. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": string;
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Demasiados canales abiertos o aperturas por minuto. */
            429: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/event-stream": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    MetricsController_report: {
        parameters: {
            query?: {
                /** @description Primer día del periodo (hora de Colombia). Por defecto, 29 días antes de `to`. */
                from?: string;
                /** @description Último día del periodo, inclusive. Por defecto, hoy. */
                to?: string;
                /** @description Limita las cifras a los pedidos de una zona de entrega. */
                zoneId?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["MetricsResponse"];
                };
            };
            /** @description Parámetros inválidos, campos faltantes o campos no permitidos. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description JWT ausente, alterado, expirado o de una sesión cerrada. */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description El rol vigente no tiene permiso para esta operación. */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description La zona indicada no existe. */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
