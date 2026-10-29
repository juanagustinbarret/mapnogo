import { conCors, origenesPermitidos } from "../_shared/cors.ts";

// Access-Control-Allow-Origin lo agrega conCors según el origen del pedido.
const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonObject = Record<string, unknown>;

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function jsonResponse(body: JsonObject, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function makeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const atender = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const apiKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const adminIdsRaw = Deno.env.get("MAPNOGO_ADMIN_USER_IDS");

  if (!supabaseUrl || !apiKey || !adminIdsRaw) {
    console.error("Falta configuración de la función.");
    return jsonResponse({
      error: "La función no está configurada completamente.",
    }, 500);
  }

  const adminIds = new Set(
    adminIdsRaw.split(",").map((id) => id.trim()).filter(Boolean),
  );

  if (adminIds.size === 0 || [...adminIds].some((id) => !isUuid(id))) {
    return jsonResponse({
      error: "La lista de administradores no es válida.",
    }, 500);
  }

  // Validar la sesión del usuario que realiza la solicitud.
  const authorization = req.headers.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return jsonResponse({ error: "Sesión no válida." }, 401);
  }

  const userToken = match[1];

  let callerResponse: Response;

  try {
    callerResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${userToken}`,
      },
    });
  } catch {
    return jsonResponse({
      error: "No se pudo verificar la sesión. Intentá nuevamente.",
    }, 503);
  }

  if (!callerResponse.ok) {
    return jsonResponse({ error: "Sesión no válida." }, 401);
  }

  let caller: JsonObject;

  try {
    caller = await callerResponse.json();
  } catch {
    return jsonResponse({ error: "No se pudo verificar la sesión." }, 401);
  }

  if (!isUuid(caller.id)) {
    return jsonResponse({ error: "Sesión no válida." }, 401);
  }

  // Solo los usuarios incluidos en la lista privada pueden administrar.
  if (!adminIds.has(caller.id)) {
    return jsonResponse({
      error: "No tenés permisos para crear comerciantes.",
    }, 403);
  }

  let createdUserId: string | null = null;
  let createdCommerceId: string | null = null;

  // Peticiones administrativas autenticadas con service_role.
  async function adminRequest(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      prefer?: string;
    } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (options.prefer) {
      headers.Prefer = options.prefer;
    }

    let response: Response;

    try {
      response = await fetch(`${supabaseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      });
    } catch {
      throw new ApiError(
        "No se pudo confirmar una operación con Supabase. Revisá los registros antes de reintentar.",
        503,
      );
    }

    const text = await response.text();
    let result: unknown = null;

    try {
      result = text ? JSON.parse(text) : null;
    } catch {
      result = null;
    }

    if (!response.ok) {
      console.error("Falló una petición administrativa.", {
        path,
        status: response.status,
      });

      if (path === "/auth/v1/admin/users" && response.status >= 500) {
        throw new ApiError(
          "No se pudo confirmar la creación de la cuenta. Verificá Auth antes de reintentar.",
          503,
        );
      }

      throw new ApiError(
        response.status >= 500
          ? "Supabase tuvo un error interno. Intentá nuevamente más tarde."
          : "Supabase rechazó una operación. Revisá los datos ingresados.",
        response.status >= 500 ? 502 : 400,
      );
    }

    return result;
  }

  // Limpieza de los registros identificados si una operación posterior falla.
  async function cleanup(): Promise<void> {
    if (createdCommerceId) {
      await adminRequest(
        `/rest/v1/suscripciones?comercio_id=eq.${createdCommerceId}`,
        { method: "DELETE" },
      );

      await adminRequest(
        `/rest/v1/comercios?id=eq.${createdCommerceId}`,
        { method: "DELETE" },
      );
    }

    if (createdUserId) {
      await adminRequest(
        `/rest/v1/profiles?id=eq.${createdUserId}`,
        { method: "DELETE" },
      );

      await adminRequest(
        `/auth/v1/admin/users/${createdUserId}`,
        { method: "DELETE" },
      );
    }
  }

  try {
    let payload: JsonObject;

    try {
      const parsed = await req.json();

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid body");
      }

      payload = parsed as JsonObject;
    } catch {
      return jsonResponse({
        error: "El cuerpo de la solicitud no es válido.",
      }, 400);
    }

    const email = typeof payload.email === "string"
      ? payload.email.trim().toLowerCase()
      : "";

    const password = typeof payload.password === "string"
      ? payload.password
      : "";

    const profileName = typeof payload.profile_name === "string"
      ? payload.profile_name.trim()
      : "";

    const planId = payload.plan_id;
    const dueDate = payload.proximo_vencimiento;
    const comercio = payload.comercio;

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return jsonResponse({ error: "Ingresá un correo válido." }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({
        error: "La contraseña debe tener al menos 8 caracteres.",
      }, 400);
    }

    if (!profileName || profileName.length > 150) {
      return jsonResponse({
        error: "Ingresá el nombre del comerciante.",
      }, 400);
    }

    if (!isUuid(planId) || !isDateOnly(dueDate)) {
      return jsonResponse({
        error: "El plan o la fecha de vencimiento no son válidos.",
      }, 400);
    }

    if (
      !comercio ||
      typeof comercio !== "object" ||
      Array.isArray(comercio)
    ) {
      return jsonResponse({
        error: "Faltan los datos del comercio.",
      }, 400);
    }

    const data = comercio as JsonObject;

    const name = typeof data.nombre === "string"
      ? data.nombre.trim()
      : "";

    const address = typeof data.direccion === "string"
      ? data.direccion.trim()
      : "";

    const rubroId = data.rubro_id;

    if (
      !name ||
      name.length > 200 ||
      !address ||
      address.length > 500 ||
      !isUuid(rubroId)
    ) {
      return jsonResponse({
        error: "Completá el nombre, el rubro y la dirección.",
      }, 400);
    }

    const slug = makeSlug(name);

    if (!slug) {
      return jsonResponse({
        error: "No se pudo generar un identificador para el comercio.",
      }, 400);
    }

    const lat = data.latitud;
    const lng = data.longitud;

    if (
      (lat != null &&
        (typeof lat !== "number" ||
          !Number.isFinite(lat) ||
          lat < -90 ||
          lat > 90)) ||
      (lng != null &&
        (typeof lng !== "number" ||
          !Number.isFinite(lng) ||
          lng < -180 ||
          lng > 180)) ||
      ((lat == null) !== (lng == null))
    ) {
      return jsonResponse({
        error: "Las coordenadas no son válidas.",
      }, 400);
    }

    // Verificar que el plan exista y esté activo.
    const plans = await adminRequest(
      `/rest/v1/planes?id=eq.${planId}&estado=eq.true&select=id,precio_mensual,estado`,
    ) as JsonObject[];

    const planPrice = plans?.[0]?.precio_mensual;

    if (
      !Array.isArray(plans) ||
      plans.length !== 1 ||
      typeof planPrice !== "number" ||
      !Number.isFinite(planPrice) ||
      planPrice < 0
    ) {
      return jsonResponse({
        error: "El plan seleccionado no existe, no está activo o no tiene un precio válido.",
      }, 400);
    }

    // Verificar que el rubro exista y esté activo.
    const rubros = await adminRequest(
      `/rest/v1/rubros?id=eq.${rubroId}&estado=eq.true&select=id,estado`,
    ) as JsonObject[];

    if (!Array.isArray(rubros) || rubros.length !== 1) {
      return jsonResponse({
        error: "El rubro seleccionado no existe o está inactivo.",
      }, 400);
    }

    // Evitar crear un slug duplicado.
    const existing = await adminRequest(
      `/rest/v1/comercios?slug=eq.${encodeURIComponent(slug)}&select=id`,
    ) as JsonObject[];

    if (Array.isArray(existing) && existing.length > 0) {
      return jsonResponse({
        error: "Ya existe un comercio con un nombre identificador similar.",
      }, 409);
    }

    // 1. Crear la cuenta Auth AUTO-CONFIRMADA e indicando a Supabase que SUPRIMA el correo saliente
    const authResult = await adminRequest("/auth/v1/admin/users", {
      method: "POST",
      body: {
        email,
        password,
        email_confirm: true,
        suppress_send_email: true, // <-- Evita que intente enviar mail vía Resend y salte el error 550
        user_metadata: {
          nombre: profileName,
          rol: "comerciante",
        },
      },
    }) as JsonObject;

    if (!authResult?.id || !isUuid(authResult.id)) {
      throw new ApiError(
        "Supabase no devolvió un identificador de usuario válido.",
        502,
      );
    }

    createdUserId = authResult.id;

    // 2. Garantizar/Crear explícitamente el perfil del comerciante para dar acceso al panel
    await adminRequest(
      "/rest/v1/profiles",
      {
        method: "POST",
        prefer: "resolution=merge-duplicates",
        body: {
          id: createdUserId,
          nombre: profileName,
          rol: "comerciante",
          email: email,
        },
      },
    );

    // 3. Crear el comercio y asociarlo al nuevo usuario.
    const commerceResult = await adminRequest(
      "/rest/v1/comercios?select=id",
      {
        method: "POST",
        prefer: "return=representation",
        body: {
          nombre: name,
          slug,
          rubro_id: rubroId,
          descripcion_corta:
            typeof data.descripcion_corta === "string"
              ? data.descripcion_corta.trim()
              : null,
          direccion: address,
          whatsapp:
            typeof data.whatsapp === "string"
              ? data.whatsapp.trim()
              : null,
          email_comercial: email,
          latitud: lat ?? null,
          longitud: lng ?? null,
          propietario_id: createdUserId,
          aprobado: true,
          habilitado_admin: true,
          galeria_urls: [],
          servicios: [],
          medios_pago: [],
        },
      },
    ) as JsonObject[];

    if (
      !Array.isArray(commerceResult) ||
      !commerceResult[0]?.id ||
      !isUuid(commerceResult[0].id)
    ) {
      throw new ApiError(
        "No se pudo confirmar la creación del comercio.",
        502,
      );
    }

    createdCommerceId = commerceResult[0].id;

    // 4. Registrar la suscripción con el precio real del plan.
    await adminRequest("/rest/v1/suscripciones", {
      method: "POST",
      body: {
        comercio_id: createdCommerceId,
        plan_id: planId,
        precio_acordado: planPrice,
        estado: "pendiente",
        proximo_vencimiento: dueDate,
      },
    });

    return jsonResponse({
      success: true,
      message: "Comerciante creado correctamente.",
      userId: createdUserId,
      comercioId: createdCommerceId,
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;

    console.error("Error en admin-crear-comerciante.", {
      status,
      message: error instanceof Error
        ? error.message
        : "Error desconocido.",
    });

    if (createdUserId) {
      try {
        await cleanup();
      } catch {
        console.error(
          "La limpieza no se completó. Revisar los registros antes de reintentar.",
        );
      }
    }

    return jsonResponse({
      error: error instanceof ApiError
        ? error.message
        : "Ocurrió un error interno. Revisá los registros de la función.",
    }, status);
  }
};

Deno.serve(async (req: Request) =>
  conCors(
    req,
    await atender(req),
    origenesPermitidos(Deno.env.get("ORIGENES_PERMITIDOS")),
  )
);