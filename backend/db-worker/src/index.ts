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


export interface Env {
  DB: D1Database;
}


type BatchStatement = {
  sql: string;
  params?: unknown[];
};


export default class AxiomDbWorker
  extends WorkerEntrypoint<Env> {

  /*
   * =====================================================
   * HTTP HEALTH
   * =====================================================
   */

  async fetch(): Promise<Response> {
    return Response.json({
      service: "AXIOM Core DB Worker",
      status: "ok",
      database: "Cloudflare D1",
      architecture: "RPC Command Gateway",
      version: "0.2.0",
    });
  }


  /*
   * =====================================================
   * DATABASE HEALTH
   * =====================================================
   */

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
   * GENERIC DATABASE RPC
   *
   * Python API compatibility layer.
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
    statements: BatchStatement[],
  ) {
    if (
      !Array.isArray(statements)
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

    return await this.env.DB.batch(
      prepared,
    );
  }


  /*
   * =====================================================
   * AXIOM COMMAND RPC
   * =====================================================
   */


  /*
   * BOOKING CREATE
   *
   * Customer
   * Booking
   * Booking services
   * Transfer
   * Operation
   * Tour booking
   * Booking event
   *
   * tek D1 atomic batch.
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


  /*
   * BOOKING STATE MACHINE
   */

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


  /*
   * OPERATION STATE MACHINE
   */

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


  /*
   * DRIVER ISSUE
   */

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


  /*
   * DRIVER / VEHICLE REASSIGNMENT
   */

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
}
