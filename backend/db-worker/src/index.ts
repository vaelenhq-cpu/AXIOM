import {
  WorkerEntrypoint,
} from "cloudflare:workers";

import {
  createBooking,
} from "./modules/booking-create";

import {
  changeBookingStatus,
} from "./modules/bookings";

import {
  changeOperationStatus,
} from "./modules/operations";

import {
  reportDriverIssue,
} from "./modules/driver-operations";

import {
  reassignOperation,
} from "./modules/reassignment";

import {
  resourceCatalog,
  resourceList,
  resourceGet,
  resourceCreate,
  resourceUpdate,
  resourceDelete,
  getCompany,
  updateCompany,
} from "./modules/resources";

import {
  dashboardSummary,
  dispatchList,
} from "./modules/dashboard";


export interface Env {
  DB: D1Database;
}


type BatchStatement = {
  sql: string;
  params?: unknown[];
};


export default class AxiomDbWorker
  extends WorkerEntrypoint<Env> {

  async fetch(): Promise<Response> {
    return Response.json({
      service:
        "AXIOM Core DB Worker",

      status:
        "ok",

      database:
        "Cloudflare D1",

      architecture:
        "RPC Command + Resource Gateway",

      version:
        "1.0.0",
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


  /*
   * =====================================================
   * LOW LEVEL RPC
   * =====================================================
   */

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
    const result =
      await this.env.DB
        .prepare(sql)
        .bind(...params)
        .all();

    return result.results ?? [];
  }


  async run(
    sql: string,
    params: unknown[] = [],
  ) {
    const result =
      await this.env.DB
        .prepare(sql)
        .bind(...params)
        .run();

    return result.meta;
  }


  async batch(
    statements:
      BatchStatement[],
  ) {
    if (
      !Array.isArray(
        statements,
      )
      ||
      statements.length === 0
    ) {
      throw new Error(
        "statements must contain at least one statement",
      );
    }

    const prepared =
      statements.map(
        (statement) =>
          this.env.DB
            .prepare(
              statement.sql,
            )
            .bind(
              ...(
                statement.params
                ?? []
              ),
            ),
      );

    return await this.env.DB
      .batch(
        prepared,
      );
  }


  /*
   * =====================================================
   * AXIOM ATOMIC COMMANDS
   * =====================================================
   */

  async createBooking(
    input: Parameters<
      typeof createBooking
    >[1],
  ) {
    return await createBooking(
      this.env.DB,
      input,
    );
  }


  async changeBookingStatus(
    input: Parameters<
      typeof changeBookingStatus
    >[1],
  ) {
    return await changeBookingStatus(
      this.env.DB,
      input,
    );
  }


  async changeOperationStatus(
    input: Parameters<
      typeof changeOperationStatus
    >[1],
  ) {
    return await changeOperationStatus(
      this.env.DB,
      input,
    );
  }


  async reportDriverIssue(
    input: Parameters<
      typeof reportDriverIssue
    >[1],
  ) {
    return await reportDriverIssue(
      this.env.DB,
      input,
    );
  }


  async reassignOperation(
    input: Parameters<
      typeof reassignOperation
    >[1],
  ) {
    return await reassignOperation(
      this.env.DB,
      input,
    );
  }


  /*
   * =====================================================
   * GENERIC TENANT RESOURCES
   * =====================================================
   */

  async resourceCatalog(
    input: Parameters<
      typeof resourceCatalog
    >[1],
  ) {
    return await resourceCatalog(
      this.env.DB,
      input,
    );
  }


  async resourceList(
    input: Parameters<
      typeof resourceList
    >[1],
  ) {
    return await resourceList(
      this.env.DB,
      input,
    );
  }


  async resourceGet(
    input: Parameters<
      typeof resourceGet
    >[1],
  ) {
    return await resourceGet(
      this.env.DB,
      input,
    );
  }


  async resourceCreate(
    input: Parameters<
      typeof resourceCreate
    >[1],
  ) {
    return await resourceCreate(
      this.env.DB,
      input,
    );
  }


  async resourceUpdate(
    input: Parameters<
      typeof resourceUpdate
    >[1],
  ) {
    return await resourceUpdate(
      this.env.DB,
      input,
    );
  }


  async resourceDelete(
    input: Parameters<
      typeof resourceDelete
    >[1],
  ) {
    return await resourceDelete(
      this.env.DB,
      input,
    );
  }


  /*
   * =====================================================
   * COMPANY
   * =====================================================
   */

  async getCompany(
    input: Parameters<
      typeof getCompany
    >[1],
  ) {
    return await getCompany(
      this.env.DB,
      input,
    );
  }


  async updateCompany(
    input: Parameters<
      typeof updateCompany
    >[1],
  ) {
    return await updateCompany(
      this.env.DB,
      input,
    );
  }


  /*
   * =====================================================
   * DASHBOARD / DISPATCH
   * =====================================================
   */

  async dashboardSummary(
    input: Parameters<
      typeof dashboardSummary
    >[1],
  ) {
    return await dashboardSummary(
      this.env.DB,
      input,
    );
  }


  async dispatchList(
    input: Parameters<
      typeof dispatchList
    >[1],
  ) {
    return await dispatchList(
      this.env.DB,
      input,
    );
  }
}
