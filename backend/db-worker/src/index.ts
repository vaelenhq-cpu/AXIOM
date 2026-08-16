export interface Env {
  DB: D1Database;
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        service: "AXIOM DB Worker",
        status: "ok",
        database: "Cloudflare D1",
      });
    }

    if (url.pathname === "/db-check") {
      try {
        const result = await env.DB
          .prepare(`
            SELECT
              CURRENT_TIMESTAMP AS now,
              1 AS connection_ok
          `)
          .first();

        return Response.json({
          status: "ok",
          database: "Cloudflare D1",
          result,
        });
      } catch (error) {
        return Response.json(
          {
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : String(error),
          },
          {
            status: 500,
          },
        );
      }
    }

    return new Response(
      "AXIOM DB Worker",
      {
        status: 200,
      },
    );
  },
};
