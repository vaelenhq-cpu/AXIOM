import {
  all,
  first,
  run,
} from "../core/db";

import {
  generateId,
} from "../core/ids";

import {
  NotFoundError,
  PermissionError,
  ValidationError,
} from "../core/errors";

import {
  requireTenant,
  TenantContext,
} from "../core/tenant";


type TableColumn = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: unknown;
  pk: number;
};


type ResourceBase = {
  tenant: TenantContext;
  resource: string;
};


type ResourceListInput =
  ResourceBase & {
    limit?: number;
    offset?: number;
    orderBy?: string;
    descending?: boolean;
    filters?: Record<
      string,
      unknown
    >;
  };


type ResourceGetInput =
  ResourceBase & {
    id: string;
  };


type ResourceCreateInput =
  ResourceBase & {
    data: Record<
      string,
      unknown
    >;
  };


type ResourceUpdateInput =
  ResourceBase & {
    id: string;
    data: Record<
      string,
      unknown
    >;
  };


type ResourceDeleteInput =
  ResourceBase & {
    id: string;
  };


const SENSITIVE_PATTERNS = [
  "auth",
  "session",
  "secret",
  "oauth",
  "token",
  "password",
  "api_key",
  "api_keys",
  "booking_key",
  "booking_keys",
  "driver_account",
  "driver_accounts",
];


const COMMAND_ONLY = new Set([
  "bookings",
  "booking_services",
  "booking_events",

  "transfers",

  "operations",
  "operation_assignments",
  "operation_events",

  "tour_bookings",

  "audit_logs",
  "outbox_events",
]);


const DELETE_DENIED = new Set([
  ...COMMAND_ONLY,

  "payments",
  "transactions",

  "webhook_deliveries",
]);


function validateResourceName(
  value: string,
): string {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/
      .test(value)
  ) {
    throw new ValidationError(
      "Invalid resource name",
    );
  }

  const normalized =
    value.toLowerCase();

  for (
    const pattern
    of SENSITIVE_PATTERNS
  ) {
    if (
      normalized.includes(
        pattern,
      )
    ) {
      throw new PermissionError(
        "Resource is protected",
      );
    }
  }

  return normalized;
}


async function tableColumns(
  db: D1Database,
  resource: string,
): Promise<TableColumn[]> {
  const table =
    validateResourceName(
      resource,
    );

  const result =
    await db
      .prepare(
        `PRAGMA table_info(${table})`,
      )
      .all<TableColumn>();

  const columns =
    result.results ?? [];

  if (!columns.length) {
    throw new NotFoundError(
      "Resource table not found",
    );
  }

  return columns;
}


function columnNames(
  columns: TableColumn[],
): Set<string> {
  return new Set(
    columns.map(
      (column) =>
        column.name,
    ),
  );
}


function ensureTenantTable(
  columns: TableColumn[],
) {
  if (
    !columns.some(
      (column) =>
        column.name ===
        "company_id",
    )
  ) {
    throw new PermissionError(
      "Resource is not tenant scoped",
    );
  }
}


function ensureIdColumn(
  columns: TableColumn[],
) {
  if (
    !columns.some(
      (column) =>
        column.name === "id",
    )
  ) {
    throw new ValidationError(
      "Resource does not contain id column",
    );
  }
}


function ensureWritable(
  resource: string,
) {
  if (
    COMMAND_ONLY.has(
      resource,
    )
  ) {
    throw new PermissionError(
      "Resource must be changed through an AXIOM command",
    );
  }
}


export async function resourceCatalog(
  db: D1Database,
  input: {
    tenant: TenantContext;
  },
) {
  requireTenant(
    input.tenant,
  );

  const tables =
    await all<{
      name: string;
    }>(
      db,
      `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
        AND name NOT LIKE '_cf_%'
      ORDER BY name
      `,
    );

  const resources: {
    name: string;
    writable: boolean;
  }[] = [];

  for (
    const row
    of tables
  ) {
    let name: string;

    try {
      name =
        validateResourceName(
          row.name,
        );
    } catch {
      continue;
    }

    try {
      const columns =
        await tableColumns(
          db,
          name,
        );

      if (
        !columns.some(
          (column) =>
            column.name ===
            "company_id",
        )
      ) {
        continue;
      }

      resources.push({
        name,
        writable:
          !COMMAND_ONLY.has(
            name,
          ),
      });
    } catch {
      continue;
    }
  }

  return resources;
}


export async function resourceList(
  db: D1Database,
  input: ResourceListInput,
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const resource =
    validateResourceName(
      input.resource,
    );

  const columns =
    await tableColumns(
      db,
      resource,
    );

  ensureTenantTable(
    columns,
  );

  const allowed =
    columnNames(
      columns,
    );

  const limit =
    Math.min(
      Math.max(
        Number(
          input.limit ?? 100,
        ),
        1,
      ),
      200,
    );

  const offset =
    Math.max(
      Number(
        input.offset ?? 0,
      ),
      0,
    );

  let orderBy =
    input.orderBy ??
    (
      allowed.has(
        "created_at",
      )
        ? "created_at"
        : "id"
    );

  if (
    !allowed.has(
      orderBy,
    )
  ) {
    orderBy =
      allowed.has(
        "created_at",
      )
        ? "created_at"
        : "id";
  }

  const direction =
    input.descending === false
      ? "ASC"
      : "DESC";

  const where = [
    "company_id = ?",
  ];

  const params: unknown[] = [
    tenant.companyId,
  ];

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      input.filters ?? {},
    )
  ) {
    if (
      key === "company_id"
      ||
      !allowed.has(key)
    ) {
      continue;
    }

    where.push(
      `${key} = ?`,
    );

    params.push(
      value,
    );
  }

  params.push(
    limit,
    offset,
  );

  return await all(
    db,
    `
    SELECT *
    FROM ${resource}
    WHERE ${where.join(" AND ")}
    ORDER BY ${orderBy} ${direction}
    LIMIT ?
    OFFSET ?
    `,
    params,
  );
}


export async function resourceGet(
  db: D1Database,
  input: ResourceGetInput,
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const resource =
    validateResourceName(
      input.resource,
    );

  const columns =
    await tableColumns(
      db,
      resource,
    );

  ensureTenantTable(
    columns,
  );

  ensureIdColumn(
    columns,
  );

  const result =
    await first(
      db,
      `
      SELECT *
      FROM ${resource}
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [
        input.id,
        tenant.companyId,
      ],
    );

  if (!result) {
    throw new NotFoundError(
      "Resource not found",
    );
  }

  return result;
}


export async function resourceCreate(
  db: D1Database,
  input: ResourceCreateInput,
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const resource =
    validateResourceName(
      input.resource,
    );

  ensureWritable(
    resource,
  );

  const columns =
    await tableColumns(
      db,
      resource,
    );

  ensureTenantTable(
    columns,
  );

  ensureIdColumn(
    columns,
  );

  const allowed =
    columnNames(
      columns,
    );

  const payload:
    Record<string, unknown> = {};

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      input.data ?? {},
    )
  ) {
    if (
      key === "company_id"
      ||
      key === "created_at"
      ||
      key === "updated_at"
      ||
      !allowed.has(key)
    ) {
      continue;
    }

    payload[key] =
      value;
  }

  payload.company_id =
    tenant.companyId;

  if (!payload.id) {
    const prefix =
      resource.endsWith("s")
        ? resource.slice(
            0,
            -1,
          )
        : resource;

    payload.id =
      generateId(
        prefix,
      );
  }

  const names =
    Object.keys(
      payload,
    );

  if (!names.length) {
    throw new ValidationError(
      "Resource payload is empty",
    );
  }

  const placeholders =
    names
      .map(
        () => "?",
      )
      .join(", ");

  const values =
    names.map(
      (name) =>
        payload[name],
    );

  await run(
    db,
    `
    INSERT INTO ${resource}
    (${names.join(", ")})
    VALUES (${placeholders})
    `,
    values,
  );

  return await resourceGet(
    db,
    {
      tenant,
      resource,
      id:
        String(
          payload.id,
        ),
    },
  );
}


export async function resourceUpdate(
  db: D1Database,
  input: ResourceUpdateInput,
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const resource =
    validateResourceName(
      input.resource,
    );

  ensureWritable(
    resource,
  );

  const columns =
    await tableColumns(
      db,
      resource,
    );

  ensureTenantTable(
    columns,
  );

  ensureIdColumn(
    columns,
  );

  const allowed =
    columnNames(
      columns,
    );

  const payload:
    Record<string, unknown> = {};

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      input.data ?? {},
    )
  ) {
    if (
      key === "id"
      ||
      key === "company_id"
      ||
      key === "created_at"
      ||
      key === "updated_at"
      ||
      !allowed.has(key)
    ) {
      continue;
    }

    payload[key] =
      value;
  }

  const assignments =
    Object.keys(
      payload,
    ).map(
      (column) =>
        `${column} = ?`,
    );

  const values =
    Object.values(
      payload,
    );

  if (
    allowed.has(
      "updated_at",
    )
  ) {
    assignments.push(
      "updated_at = CURRENT_TIMESTAMP",
    );
  }

  if (
    assignments.length === 0
  ) {
    return await resourceGet(
      db,
      {
        tenant,
        resource,
        id: input.id,
      },
    );
  }

  values.push(
    input.id,
    tenant.companyId,
  );

  const result =
    await run(
      db,
      `
      UPDATE ${resource}
      SET ${assignments.join(", ")}
      WHERE id = ?
        AND company_id = ?
      `,
      values,
    );

  if (
    Number(
      result.meta
        ?.changes
        ?? 0,
    ) === 0
  ) {
    throw new NotFoundError(
      "Resource not found",
    );
  }

  return await resourceGet(
    db,
    {
      tenant,
      resource,
      id: input.id,
    },
  );
}


export async function resourceDelete(
  db: D1Database,
  input: ResourceDeleteInput,
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const resource =
    validateResourceName(
      input.resource,
    );

  ensureWritable(
    resource,
  );

  if (
    DELETE_DENIED.has(
      resource,
    )
  ) {
    throw new PermissionError(
      "Resource cannot be deleted directly",
    );
  }

  const columns =
    await tableColumns(
      db,
      resource,
    );

  ensureTenantTable(
    columns,
  );

  ensureIdColumn(
    columns,
  );

  const result =
    await run(
      db,
      `
      DELETE FROM ${resource}
      WHERE id = ?
        AND company_id = ?
      `,
      [
        input.id,
        tenant.companyId,
      ],
    );

  return {
    deleted:
      Number(
        result.meta
          ?.changes
          ?? 0,
      ) > 0,
  };
}


/*
 * =========================================================
 * COMPANY
 * companies tablosu company_id içermediği için generic
 * tenant resource katmanına dahil edilmez.
 * =========================================================
 */

export async function getCompany(
  db: D1Database,
  input: {
    tenant: TenantContext;
  },
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const company =
    await first(
      db,
      `
      SELECT *
      FROM companies
      WHERE id = ?
      LIMIT 1
      `,
      [
        tenant.companyId,
      ],
    );

  if (!company) {
    throw new NotFoundError(
      "Company not found",
    );
  }

  return company;
}


export async function updateCompany(
  db: D1Database,
  input: {
    tenant: TenantContext;
    data: Record<
      string,
      unknown
    >;
  },
) {
  const tenant =
    requireTenant(
      input.tenant,
    );

  const allowed =
    new Set([
      "name",
      "legal_name",
      "tax_number",
      "country_code",
      "timezone",
      "default_currency",
    ]);

  const payload:
    Record<string, unknown> = {};

  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      input.data ?? {},
    )
  ) {
    if (
      allowed.has(
        key,
      )
    ) {
      payload[key] =
        value;
    }
  }

  if (
    Object.keys(
      payload,
    ).length === 0
  ) {
    return await getCompany(
      db,
      {
        tenant,
      },
    );
  }

  const assignments =
    Object.keys(
      payload,
    ).map(
      (key) =>
        `${key} = ?`,
    );

  const values =
    Object.values(
      payload,
    );

  assignments.push(
    "updated_at = CURRENT_TIMESTAMP",
  );

  values.push(
    tenant.companyId,
  );

  await run(
    db,
    `
    UPDATE companies
    SET ${assignments.join(", ")}
    WHERE id = ?
    `,
    values,
  );

  return await getCompany(
    db,
    {
      tenant,
    },
  );
}
