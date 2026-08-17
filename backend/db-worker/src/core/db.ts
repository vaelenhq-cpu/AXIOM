export type SqlStatement = {
  sql: string;
  params?: unknown[];
};

export async function first<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  return await db
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

export async function all<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();

  return result.results ?? [];
}

export async function run(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
) {
  return await db
    .prepare(sql)
    .bind(...params)
    .run();
}

export async function atomic(
  db: D1Database,
  statements: SqlStatement[],
) {
  if (!statements.length) {
    return [];
  }

  const prepared = statements.map(
    (statement) =>
      db
        .prepare(statement.sql)
        .bind(...(statement.params ?? [])),
  );

  return await db.batch(prepared);
}
