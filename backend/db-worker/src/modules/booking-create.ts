import {
  atomic,
  first,
} from "../core/db";

import {
  generateId,
} from "../core/ids";

import {
  nowIso,
} from "../core/time";

import {
  NotFoundError,
  ValidationError,
} from "../core/errors";

import {
  requireTenant,
  TenantContext,
} from "../core/tenant";


type CustomerInput = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  nationality?: string | null;
  language?: string | null;
  notes?: string | null;
};


type TransferInput = {
  pickupLocation: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  pickupPlaceId?: string | null;

  dropoffLocation: string;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  dropoffPlaceId?: string | null;

  pickupDatetime?: string | null;

  flightNumber?: string | null;
  flightDatetime?: string | null;

  pickupSign?: string | null;

  pax?: number;
  luggageCount?: number;

  requestedVehicleClass?: string | null;

  specialRequest?: string | null;
};


type TourInput = {
  tourDepartureId: string;

  pickupRequired?: boolean;

  pickupLocation?: string | null;

  notes?: string | null;
};


type BookingServiceInput = {
  serviceType:
    | "transfer"
    | "tour"
    | "other";

  title: string;

  description?: string | null;

  serviceDate?: string | null;
  startTime?: string | null;

  paxAdult?: number;
  paxChild?: number;
  paxInfant?: number;

  quantity?: number;

  unitPrice?: number;
  totalPrice?: number;

  transfer?: TransferInput;

  tour?: TourInput;
};


type CreateBookingInput = {
  tenant: TenantContext;

  bookingCode: string;

  customer: CustomerInput;

  services: BookingServiceInput[];

  source?: string;

  currency?: string;

  customerNote?: string | null;
  internalNote?: string | null;
};


const allowedSources = new Set([
  "manual",
  "website",
  "booking_widget",
  "api",
  "integration",
  "b2b",
  "phone",
  "whatsapp",
  "hotel",
  "other",
]);


export async function createBooking(
  db: D1Database,
  input: CreateBookingInput,
) {
  const tenant = requireTenant(
    input.tenant,
  );

  /*
   * -------------------------------------------------
   * Validate booking
   * -------------------------------------------------
   */

  const bookingCode =
    input.bookingCode.trim();

  if (!bookingCode) {
    throw new ValidationError(
      "bookingCode is required",
    );
  }

  if (
    !Array.isArray(input.services)
    ||
    input.services.length === 0
  ) {
    throw new ValidationError(
      "Booking must contain at least one service",
    );
  }

  const source =
    input.source ?? "manual";

  if (!allowedSources.has(source)) {
    throw new ValidationError(
      "Invalid booking source",
    );
  }

  const currency =
    input.currency ?? "TRY";


  /*
   * -------------------------------------------------
   * Validate customer
   * -------------------------------------------------
   */

  const customerFirstName =
    input.customer.firstName.trim();

  if (!customerFirstName) {
    throw new ValidationError(
      "Customer first name is required",
    );
  }


  /*
   * -------------------------------------------------
   * Booking code uniqueness
   * -------------------------------------------------
   */

  const existingBooking =
    await first<any>(
      db,
      `
      SELECT id
      FROM bookings
      WHERE company_id = ?
        AND booking_code = ?
      LIMIT 1
      `,
      [
        tenant.companyId,
        bookingCode,
      ],
    );

  if (existingBooking) {
    throw new ValidationError(
      "Booking code already exists",
    );
  }


  /*
   * -------------------------------------------------
   * Prevalidate services
   * -------------------------------------------------
   */

  for (
    const service
    of input.services
  ) {
    if (
      ![
        "transfer",
        "tour",
        "other",
      ].includes(
        service.serviceType,
      )
    ) {
      throw new ValidationError(
        `Unsupported service type: ${service.serviceType}`,
      );
    }

    if (!service.title?.trim()) {
      throw new ValidationError(
        "Service title is required",
      );
    }

    if (
      service.serviceType ===
      "transfer"
    ) {
      if (!service.transfer) {
        throw new ValidationError(
          "Transfer service requires transfer data",
        );
      }

      if (
        !service.transfer
          .pickupLocation
          ?.trim()
      ) {
        throw new ValidationError(
          "pickupLocation is required",
        );
      }

      if (
        !service.transfer
          .dropoffLocation
          ?.trim()
      ) {
        throw new ValidationError(
          "dropoffLocation is required",
        );
      }

      const pax =
        service.transfer.pax
        ?? 1;

      if (pax <= 0) {
        throw new ValidationError(
          "Transfer pax must be greater than 0",
        );
      }

      const luggageCount =
        service.transfer
          .luggageCount
        ?? 0;

      if (luggageCount < 0) {
        throw new ValidationError(
          "luggageCount cannot be negative",
        );
      }
    }


    if (
      service.serviceType ===
      "tour"
    ) {
      if (!service.tour) {
        throw new ValidationError(
          "Tour service requires tour data",
        );
      }

      if (
        !service.tour
          .tourDepartureId
      ) {
        throw new ValidationError(
          "tourDepartureId is required",
        );
      }

      const adult =
        service.paxAdult ?? 0;

      const child =
        service.paxChild ?? 0;

      const infant =
        service.paxInfant ?? 0;

      if (
        adult + child + infant
        <= 0
      ) {
        throw new ValidationError(
          "Tour booking must contain at least one passenger",
        );
      }

      const departure =
        await first<any>(
          db,
          `
          SELECT id
          FROM tour_departures
          WHERE id = ?
            AND company_id = ?
          LIMIT 1
          `,
          [
            service.tour
              .tourDepartureId,
            tenant.companyId,
          ],
        );

      if (!departure) {
        throw new NotFoundError(
          "Tour departure not found",
        );
      }
    }
  }


  /*
   * -------------------------------------------------
   * IDs
   * -------------------------------------------------
   */

  const customerId =
    generateId(
      "customer",
    );

  const bookingId =
    generateId(
      "booking",
    );

  const bookingEventId =
    generateId(
      "booking_event",
    );

  const now =
    nowIso();


  /*
   * -------------------------------------------------
   * Prices
   * -------------------------------------------------
   */

  const subtotal =
    input.services.reduce(
      (
        total,
        service,
      ) =>
        total
        + Number(
          service.totalPrice
          ?? 0,
        ),
      0,
    );


  const statements: {
    sql: string;
    params?: unknown[];
  }[] = [];


  /*
   * -------------------------------------------------
   * Customer
   * -------------------------------------------------
   */

  statements.push({
    sql: `
      INSERT INTO customers (
        id,
        company_id,
        first_name,
        last_name,
        email,
        phone,
        nationality,
        language,
        notes
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
    params: [
      customerId,
      tenant.companyId,

      customerFirstName,

      input.customer
        .lastName
        ?? null,

      input.customer
        .email
        ?? null,

      input.customer
        .phone
        ?? null,

      input.customer
        .nationality
        ?? null,

      input.customer
        .language
        ?? null,

      input.customer
        .notes
        ?? null,
    ],
  });


  /*
   * -------------------------------------------------
   * Booking
   * -------------------------------------------------
   */

  statements.push({
    sql: `
      INSERT INTO bookings (
        id,
        company_id,
        customer_id,
        booking_code,
        status,
        source,
        currency,
        subtotal_amount,
        discount_amount,
        tax_amount,
        total_amount,
        customer_note,
        internal_note,
        booked_at,
        confirmed_at,
        created_by
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, 0, 0, ?,
        ?, ?, ?, ?, ?
      )
    `,
    params: [
      bookingId,
      tenant.companyId,
      customerId,

      bookingCode,

      "confirmed",
      source,
      currency,

      subtotal,
      subtotal,

      input.customerNote
        ?? null,

      input.internalNote
        ?? null,

      now,
      now,

      tenant.userId
        ?? null,
    ],
  });


  /*
   * -------------------------------------------------
   * Services
   * -------------------------------------------------
   */

  const createdServices: {
    serviceId: string;
    transferId?: string;
    operationId?: string;
    tourBookingId?: string;
  }[] = [];


  for (
    const service
    of input.services
  ) {
    const serviceId =
      generateId(
        "service",
      );


    const paxAdult =
      service.paxAdult ?? 0;

    const paxChild =
      service.paxChild ?? 0;

    const paxInfant =
      service.paxInfant ?? 0;

    const quantity =
      service.quantity ?? 1;

    const unitPrice =
      Number(
        service.unitPrice
        ?? 0,
      );

    const totalPrice =
      Number(
        service.totalPrice
        ?? 0,
      );


    statements.push({
      sql: `
        INSERT INTO booking_services (
          id,
          company_id,
          booking_id,
          service_type,
          status,
          title,
          description,
          service_date,
          start_time,
          pax_adult,
          pax_child,
          pax_infant,
          quantity,
          unit_price,
          total_price
        )
        VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?
        )
      `,
      params: [
        serviceId,
        tenant.companyId,
        bookingId,

        service.serviceType,

        "confirmed",

        service.title.trim(),

        service.description
          ?? null,

        service.serviceDate
          ?? null,

        service.startTime
          ?? null,

        paxAdult,
        paxChild,
        paxInfant,

        quantity,
        unitPrice,
        totalPrice,
      ],
    });


    const createdEntry: {
      serviceId: string;
      transferId?: string;
      operationId?: string;
      tourBookingId?: string;
    } = {
      serviceId,
    };


    /*
     * -----------------------------------------------
     * Transfer
     * -----------------------------------------------
     */

    if (
      service.serviceType ===
      "transfer"
      &&
      service.transfer
    ) {
      const transfer =
        service.transfer;

      const transferId =
        generateId(
          "transfer",
        );

      const operationId =
        generateId(
          "operation",
        );


      statements.push({
        sql: `
          INSERT INTO transfers (
            id,
            company_id,
            booking_service_id,

            pickup_location,
            pickup_latitude,
            pickup_longitude,
            pickup_place_id,

            dropoff_location,
            dropoff_latitude,
            dropoff_longitude,
            dropoff_place_id,

            pickup_datetime,
            flight_number,
            flight_datetime,
            pickup_sign,
            pax,
            luggage_count,
            requested_vehicle_class,
            special_request
          )
          VALUES (
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
        params: [
          transferId,
          tenant.companyId,
          serviceId,

          transfer.pickupLocation
            .trim(),

          transfer.pickupLatitude
            ?? null,

          transfer.pickupLongitude
            ?? null,

          transfer.pickupPlaceId
            ?? null,

          transfer.dropoffLocation
            .trim(),

          transfer.dropoffLatitude
            ?? null,

          transfer.dropoffLongitude
            ?? null,

          transfer.dropoffPlaceId
            ?? null,

          transfer.pickupDatetime
            ?? null,

          transfer.flightNumber
            ?? null,

          transfer.flightDatetime
            ?? null,

          transfer.pickupSign
            ?? null,

          transfer.pax ?? 1,

          transfer.luggageCount
            ?? 0,

          transfer
            .requestedVehicleClass
            ?? null,

          transfer.specialRequest
            ?? null,
        ],
      });


      /*
       * Existing BookingService creates transfer
       * operations directly in waiting_assignment.
       */

      statements.push({
        sql: `
          INSERT INTO operations (
            id,
            company_id,
            source_type,
            source_id,
            status,
            scheduled_start_at,
            priority
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?
          )
        `,
        params: [
          operationId,
          tenant.companyId,

          "transfer",
          transferId,

          "waiting_assignment",

          transfer.pickupDatetime
            ?? null,

          100,
        ],
      });


      createdEntry.transferId =
        transferId;

      createdEntry.operationId =
        operationId;
    }


    /*
     * -----------------------------------------------
     * Tour
     * -----------------------------------------------
     */

    if (
      service.serviceType ===
      "tour"
      &&
      service.tour
    ) {
      const tourBookingId =
        generateId(
          "tour_booking",
        );


      statements.push({
        sql: `
          INSERT INTO tour_bookings (
            id,
            company_id,
            booking_service_id,
            tour_departure_id,
            adult_count,
            child_count,
            infant_count,
            pickup_required,
            pickup_location,
            notes
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `,
        params: [
          tourBookingId,
          tenant.companyId,
          serviceId,

          service.tour
            .tourDepartureId,

          paxAdult,
          paxChild,
          paxInfant,

          service.tour
            .pickupRequired
            ? 1
            : 0,

          service.tour
            .pickupLocation
            ?? null,

          service.tour
            .notes
            ?? null,
        ],
      });


      createdEntry.tourBookingId =
        tourBookingId;
    }


    createdServices.push(
      createdEntry,
    );
  }


  /*
   * -------------------------------------------------
   * Booking event
   * -------------------------------------------------
   */

  statements.push({
    sql: `
      INSERT INTO booking_events (
        id,
        company_id,
        booking_id,
        event_type,
        new_value,
        description,
        actor_user_id
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?
      )
    `,
    params: [
      bookingEventId,
      tenant.companyId,
      bookingId,

      "booking_created",

      "confirmed",

      "Booking created",

      tenant.userId
        ?? null,
    ],
  });


  /*
   * -------------------------------------------------
   * ONE ATOMIC D1 TRANSACTION
   * -------------------------------------------------
   */

  await atomic(
    db,
    statements,
  );


  /*
   * -------------------------------------------------
   * Reload result
   * -------------------------------------------------
   */

  const booking =
    await first<any>(
      db,
      `
      SELECT *
      FROM bookings
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [
        bookingId,
        tenant.companyId,
      ],
    );


  const customer =
    await first<any>(
      db,
      `
      SELECT *
      FROM customers
      WHERE id = ?
        AND company_id = ?
      LIMIT 1
      `,
      [
        customerId,
        tenant.companyId,
      ],
    );


  return {
    booking,
    customer,
    services:
      createdServices,
  };
}
