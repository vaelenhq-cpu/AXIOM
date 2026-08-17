export interface Env {
  DB: D1Database;
}

type QueryRequest = {
  sql: string;
  params?: unknown[];
};

type BatchStatement = {
  sql: string;
  params?: unknown[];
};

type BatchRequest = {
  statements: BatchStatement[];
};

function json(
  data: unknown,
  status = 200,
): Response {
  return Response.json(data, { status });
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);

    /*
     * -------------------------------------------------------
     * Health
     * -------------------------------------------------------
     */

    if (
      request.method === "GET" &&
      url.pathname === "/health"
    ) {
      return json({
        service: "AXIOM DB Worker",
        status: "ok",
        database: "Cloudflare D1",
      });
    }

    if (
      request.method === "GET" &&
      url.pathname === "/db-check"
    ) {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              CURRENT_TIMESTAMP AS now,
              1 AS connection_ok
          `)
          .first();

        return json({
          status: "ok",
          database: "Cloudflare D1",
          result,
        });
      } catch (error) {
        return json(
          {
            status: "error",
            message: errorMessage(error),
          },
          500,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * First row
     * -------------------------------------------------------
     */

    if (
      request.method === "POST" &&
      url.pathname === "/query/first"
    ) {
      try {
        const body =
          await request.json<QueryRequest>();

        if (!body.sql) {
          return json(
            {
              status: "error",
              message: "sql is required",
            },
            400,
          );
        }

        const statement = env.DB
          .prepare(body.sql)
          .bind(...(body.params ?? []));

        const result =
          await statement.first();

        return json({
          status: "ok",
          result,
        });
      } catch (error) {
        return json(
          {
            status: "error",
            message: errorMessage(error),
          },
          500,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * Multiple rows
     * -------------------------------------------------------
     */

    if (
      request.method === "POST" &&
      url.pathname === "/query/all"
    ) {
      try {
        const body =
          await request.json<QueryRequest>();

        if (!body.sql) {
          return json(
            {
              status: "error",
              message: "sql is required",
            },
            400,
          );
        }

        const statement = env.DB
          .prepare(body.sql)
          .bind(...(body.params ?? []));

        const result =
          await statement.all();

        return json({
          status: "ok",
          results: result.results ?? [],
          meta: result.meta,
        });
      } catch (error) {
        return json(
          {
            status: "error",
            message: errorMessage(error),
          },
          500,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * INSERT / UPDATE / DELETE
     * -------------------------------------------------------
     */

    if (
      request.method === "POST" &&
      url.pathname === "/query/run"
    ) {
      try {
        const body =
          await request.json<QueryRequest>();

        if (!body.sql) {
          return json(
            {
              status: "error",
              message: "sql is required",
            },
            400,
          );
        }

        const statement = env.DB
          .prepare(body.sql)
          .bind(...(body.params ?? []));

        const result =
          await statement.run();

        return json({
          status: "ok",
          meta: result.meta,
        });
      } catch (error) {
        return json(
          {
            status: "error",
            message: errorMessage(error),
          },
          500,
        );
      }
    }

    /*
     * -------------------------------------------------------
     * Atomic batch / transaction
     * -------------------------------------------------------
     */

    if (
      request.method === "POST" &&
      url.pathname === "/query/batch"
    ) {
      try {
        const body =
          await request.json<BatchRequest>();

        if (
          !Array.isArray(body.statements) ||
          body.statements.length === 0
        ) {
          return json(
            {
              status: "error",
              message:
                "statements must contain at least one statement",
            },
            400,
          );
        }

        const prepared =
          body.statements.map((item) => {
            if (!item.sql) {
              throw new Error(
                "Every batch statement requires sql",
              );
            }

            return env.DB
              .prepare(item.sql)
              .bind(...(item.params ?? []));
          });

        const results =
          await env.DB.batch(prepared);

        return json({
          status: "ok",
          results,
        });
      } catch (error) {
        return json(
          {
            status: "error",
            message: errorMessage(error),
          },
          500,
        );
      }
    }

    return json(
      {
        service: "AXIOM DB Worker",
        status: "ok",
      },
    );
  },
};
