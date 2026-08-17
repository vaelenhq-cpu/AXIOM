import { WorkerEntrypoint } from "cloudflare:workers";

export interface Env {
  DB: D1Database;
}

type BatchStatement = {
  sql: string;
  params?: unknown[];
};

export default class AxiomDbWorker extends WorkerEntrypoint<Env> {

  async fetch(): Promise<Response> {
    return Response.json({
      service: "AXIOM DB Worker",
      status: "ok",
      database: "Cloudflare D1",
    });
  }

  async dbCheck() {
    return await this.env.DB
      .prepare(`
        SELECT
          CURRENT_TIMESTAMP AS now,
          1 AS connection_ok
      `)
      .first();
  }

  async first(
    sql: string,
    params: unknown[] = [],
  ) {
    return await this.env.DB
      .prepare(sql)
      .bind(...params)
      .first();
  }

  async all(
    sql: string,
    params: unknown[] = [],
  ) {
    const result = await this.env.DB
      .prepare(sql)
      .bind(...params)
      .all();

    return result.results ?? [];
  }

  async run(
    sql: string,
    params: unknown[] = [],
  ) {
    const result = await this.env.DB
      .prepare(sql)
      .bind(...params)
      .run();

    return result.meta;
  }

  async batch(
    statements: BatchStatement[],
  ) {
    if (!statements.length) {
      throw new Error(
        "statements must contain at least one statement"
      );
    }

    const prepared = statements.map(
      (item) =>
        this.env.DB
          .prepare(item.sql)
          .bind(...(item.params ?? []))
    );

    return await this.env.DB.batch(prepared);
  }
}
