import {
  getDashboard,
  type DashboardOverview,
} from "../../api/dashboard";

import {
  navigate,
} from "../../core/router";

import "./dashboard.css";


export function DashboardPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "dashboard-page ax-page";

  page.innerHTML = `
    <header class="page-header dashboard-header">

      <div>
        <span class="page-overline">
          OPERASYON MERKEZİ
        </span>

        <h1>
          Dashboard
        </h1>

        <p>
          Rezervasyonları, operasyonları,
          şoförleri ve araçları tek merkezden yönetin.
        </p>
      </div>

      <div class="dashboard-header-actions">

        <button
          type="button"
          class="ax-button ax-button-secondary"
          data-dashboard-route="/operations"
        >
          Operasyon Merkezi
        </button>

        <button
          type="button"
          class="ax-button ax-button-primary"
          data-dashboard-route="/bookings"
        >
          Rezervasyonlar
        </button>

      </div>

    </header>

    <div
      class="dashboard-loading"
      id="dashboard-loading"
    >
      Operasyon verileri yükleniyor...
    </div>

    <div
      class="dashboard-root"
      id="dashboard-root"
      hidden
    ></div>
  `;


  page
    .querySelectorAll<HTMLButtonElement>(
      "[data-dashboard-route]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            navigate(
              button.dataset.dashboardRoute
              ?? "/"
            );
          },
        );
      },
    );


  void loadDashboard(
    page
  );

  return page;
}


async function loadDashboard(
  page: HTMLElement,
): Promise<void> {
  const loading =
    page.querySelector<HTMLElement>(
      "#dashboard-loading"
    );

  const root =
    page.querySelector<HTMLElement>(
      "#dashboard-root"
    );

  if (!root) {
    return;
  }

  try {
    const data =
      await getDashboard();

    root.innerHTML =
      renderDashboard(
        data
      );

    root.hidden = false;

    if (loading) {
      loading.hidden = true;
    }

    bindDashboardNavigation(
      root
    );

  } catch (exception) {
    if (loading) {
      loading.textContent =
        exception instanceof Error
          ? exception.message
          : "Dashboard yüklenemedi.";
    }
  }
}


function renderDashboard(
  data: DashboardOverview,
): string {
  const bookings =
    data.summary.bookings;

  const operations =
    data.summary.operations;

  const drivers =
    data.summary.drivers;

  const vehicles =
    data.summary.vehicles;

  const transfers =
    data.summary.transfers;

  const tours =
    data.summary.tours;


  return `
    <section class="dashboard-kpis">

      ${kpiCard(
        "Toplam Rezervasyon",
        numeric(
          bookings.total
        ),
        `${numeric(
          bookings.confirmed
        )} onaylı`,
        "blue"
      )}

      ${kpiCard(
        "İşlem Gerekiyor",
        data.action_required.length,
        `${numeric(
          operations.problem
        )} sorunlu operasyon`,
        data.action_required.length > 0
          ? "amber"
          : "green"
      )}

      ${kpiCard(
        "Aktif Operasyon",
        numeric(
          operations.in_progress
        ),
        `${numeric(
          operations.ready
        )} hazır`,
        "green"
      )}

      ${kpiCard(
        "Atama Bekliyor",
        numeric(
          operations.waiting_assignment
        ),
        `${numeric(
          operations.assigned
        )} atanmış`,
        numeric(
          operations.waiting_assignment
        ) > 0
          ? "amber"
          : "blue"
      )}

    </section>


    <section class="dashboard-main-grid">

      <article class="dashboard-card dashboard-action-card">

        ${sectionHeader(
          "İşlem Gerekiyor",
          "Operasyon merkezinin müdahale etmesi gereken kayıtlar",
          "/operations"
        )}

        <div class="dashboard-list">

          ${
            data.action_required.length
              ? data.action_required
                  .slice(0, 6)
                  .map(
                    item =>
                      actionRequiredItem(
                        item
                      )
                  )
                  .join("")
              : emptyState(
                  "Bekleyen işlem yok",
                  "Şu anda müdahale gerektiren kayıt bulunmuyor."
                )
          }

        </div>

      </article>


      <article class="dashboard-card">

        ${sectionHeader(
          "Yaklaşan Operasyonlar",
          "Aktif operasyon planı",
          "/operations"
        )}

        <div class="dashboard-list">

          ${
            data.upcoming_operations.length
              ? data.upcoming_operations
                  .slice(0, 6)
                  .map(
                    operation =>
                      upcomingOperationItem(
                        operation
                      )
                  )
                  .join("")
              : emptyState(
                  "Operasyon yok",
                  "Yaklaşan operasyon bulunmuyor."
                )
          }

        </div>

      </article>

    </section>


    <section class="dashboard-secondary-grid">

      <article class="dashboard-card">

        ${sectionHeader(
          "Son Rezervasyonlar",
          "Sisteme son gelen rezervasyonlar",
          "/bookings"
        )}

        <div class="dashboard-list">

          ${
            data.recent_bookings.length
              ? data.recent_bookings
                  .slice(0, 7)
                  .map(
                    booking =>
                      recentBookingItem(
                        booking
                      )
                  )
                  .join("")
              : emptyState(
                  "Rezervasyon yok",
                  "Henüz rezervasyon kaydı bulunmuyor."
                )
          }

        </div>

      </article>


      <article class="dashboard-card dashboard-resource-card">

        ${sectionHeader(
          "Kaynak Durumu",
          "Şoför ve araç kullanılabilirliği"
        )}

        ${resourceBlock(
          "Şoförler",
          numeric(
            drivers.available
          ),
          numeric(
            drivers.total
          ),
          numeric(
            drivers.busy
          ),
          "/drivers"
        )}

        ${resourceBlock(
          "Araçlar",
          numeric(
            vehicles.available
          ),
          numeric(
            vehicles.total
          ),
          numeric(
            vehicles.busy
          ),
          "/vehicles"
        )}

        <div class="dashboard-resource-note">
          <span>
            Bakımda Araç
          </span>

          <strong>
            ${numeric(
              vehicles.maintenance
            )}
          </strong>
        </div>

      </article>

    </section>


    <section class="dashboard-business-grid">

      ${summaryTile(
        "Transferler",
        numeric(
          transfers.total
        ),
        `${numeric(
          transfers.waiting_assignment
        )} atama bekliyor`,
        "/operations"
      )}

      ${summaryTile(
        "Turlar",
        numeric(
          tours.total_departures
        ),
        `${numeric(
          tours.scheduled
        )} planlandı`,
        "/tours"
      )}

      ${summaryTile(
        "Şoförler",
        numeric(
          drivers.total
        ),
        `${numeric(
          drivers.available
        )} müsait`,
        "/drivers"
      )}

      ${summaryTile(
        "Araçlar",
        numeric(
          vehicles.total
        ),
        `${numeric(
          vehicles.available
        )} müsait`,
        "/vehicles"
      )}

    </section>
  `;
}


function kpiCard(
  label: string,
  value: number,
  description: string,
  tone:
    "blue" |
    "green" |
    "amber",
): string {
  return `
    <article
      class="dashboard-kpi dashboard-kpi-${tone}"
    >
      <div class="dashboard-kpi-top">
        <span>
          ${escapeHtml(label)}
        </span>

        <i></i>
      </div>

      <strong>
        ${value}
      </strong>

      <p>
        ${escapeHtml(description)}
      </p>
    </article>
  `;
}


function sectionHeader(
  title: string,
  description: string,
  route?: string,
): string {
  return `
    <header class="dashboard-card-head">

      <div>
        <h2>
          ${escapeHtml(title)}
        </h2>

        <p>
          ${escapeHtml(description)}
        </p>
      </div>

      ${
        route
          ? `
            <button
              type="button"
              data-dashboard-route="${route}"
            >
              Tümünü Gör
            </button>
          `
          : ""
      }

    </header>
  `;
}


function actionRequiredItem(
  item:
    Record<string, unknown>,
): string {
  const type =
    String(
      item.type
      ?? ""
    );

  if (
    type === "booking"
  ) {
    return `
      <button
        type="button"
        class="dashboard-list-item"
        data-dashboard-route="/bookings"
      >
        <div class="dashboard-item-icon amber">
          !
        </div>

        <div class="dashboard-item-copy">
          <strong>
            ${escapeHtml(
              String(
                item.booking_code
                ?? "Rezervasyon"
              )
            )}
          </strong>

          <span>
            Yeni rezervasyon onay bekliyor
          </span>
        </div>

        <span class="ax-status ax-status-amber">
          Bekliyor
        </span>
      </button>
    `;
  }

  const status =
    String(
      item.status
      ?? ""
    );

  const eventType =
    String(
      item.latest_event_type
      ?? ""
    );

  const description =
    String(
      item.latest_event_description
      ?? ""
    );

  const route =
    [
      item.pickup_location,
      item.dropoff_location,
    ]
      .filter(Boolean)
      .join(" → ");

  const driver =
    [
      item.driver_first_name,
      item.driver_last_name,
    ]
      .filter(Boolean)
      .join(" ");

  const vehicle =
    String(
      item.vehicle_plate
      ?? ""
    );

  const context =
    [
      driver || null,
      vehicle || null,
    ]
      .filter(Boolean)
      .join(" • ");

  let title =
    "Operasyon";

  let tone:
    "amber" |
    "red" =
      "amber";

  let statusText =
    operationStatusLabel(
      status
    );

  if (
    eventType === "driver_delay"
  ) {
    title =
      "Gecikme Bildirildi";

    tone =
      "amber";

    statusText =
      "Gecikme";
  }

  if (
    eventType === "passenger_missing"
  ) {
    title =
      "Yolcu Bulunamadı";

    tone =
      "red";

    statusText =
      "Acil";
  }

  if (
    eventType === "driver_problem"
  ) {
    title =
      "Şoför Sorun Bildirdi";

    tone =
      "red";

    statusText =
      "Sorun";
  }

  if (
    !eventType
    && status === "waiting_assignment"
  ) {
    title =
      "Atama Bekleyen Operasyon";
  }

  return `
    <button
      type="button"
      class="dashboard-alert-item dashboard-alert-${tone}"
      data-dashboard-route="/operations"
    >

      <div class="dashboard-alert-top">

        <div class="dashboard-alert-title">

          <span class="dashboard-item-icon ${tone}">
            !
          </span>

          <div>
            <strong>
              ${escapeHtml(title)}
            </strong>

            ${
              route
                ? `
                  <span>
                    ${escapeHtml(route)}
                  </span>
                `
                : ""
            }
          </div>

        </div>

        <span class="
          ax-status
          ${
            tone === "red"
              ? "ax-status-red"
              : "ax-status-amber"
          }
        ">
          ${escapeHtml(statusText)}
        </span>

      </div>

      ${
        description
          ? `
            <p class="dashboard-alert-description">
              ${escapeHtml(description)}
            </p>
          `
          : ""
      }

      ${
        context
          ? `
            <div class="dashboard-alert-context">
              ${escapeHtml(context)}
            </div>
          `
          : ""
      }

      ${
        item.booking_code
          ? `
            <small class="dashboard-alert-code">
              ${escapeHtml(
                String(
                  item.booking_code
                )
              )}
            </small>
          `
          : ""
      }

    </button>
  `;
}


function upcomingOperationItem(
  operation:
    Record<string, unknown>,
): string {
  const status =
    String(
      operation.status
      ?? ""
    );

  const route =
    [
      operation.pickup_location,
      operation.dropoff_location,
    ]
      .filter(Boolean)
      .join(" → ")
    || operationSourceLabel(
      String(
        operation.source_type
        ?? ""
      )
    );

  const customer =
    [
      operation.customer_first_name,
      operation.customer_last_name,
    ]
      .filter(Boolean)
      .join(" ");

  const driver =
    [
      operation.driver_first_name,
      operation.driver_last_name,
    ]
      .filter(Boolean)
      .join(" ");

  const vehicle =
    String(
      operation.vehicle_plate
      ?? ""
    );

  const resourceLine =
    [
      driver || null,
      vehicle || null,
    ]
      .filter(Boolean)
      .join(" • ")
    || (
      status === "waiting_assignment"
        ? "Şoför / araç ataması bekliyor"
        : "Kaynak bilgisi yok"
    );

  return `
    <button
      type="button"
      class="dashboard-list-item dashboard-operation-item"
      data-dashboard-route="/operations"
    >
      <div class="dashboard-time">
        ${formatOperationTime(
          operation.pickup_datetime
          ?? operation.scheduled_start_at
        )}
      </div>

      <div class="dashboard-item-copy">

        <strong>
          ${escapeHtml(route)}
        </strong>

        <span>
          ${
            customer
              ? `${escapeHtml(customer)} • `
              : ""
          }
          ${escapeHtml(resourceLine)}
        </span>

      </div>

      <span class="
        ax-status
        ${statusTone(status)}
      ">
        ${operationStatusLabel(
          status
        )}
      </span>
    </button>
  `;
}


function recentBookingItem(
  booking:
    Record<string, unknown>,
): string {
  const name =
    [
      booking.first_name,
      booking.last_name,
    ]
      .filter(Boolean)
      .join(" ")
    || "Müşteri";

  const amount =
    Number(
      booking.total_amount
      ?? 0
    );

  const currency =
    String(
      booking.currency
      ?? "TRY"
    );

  const status =
    String(
      booking.status
      ?? ""
    );

  return `
    <button
      type="button"
      class="dashboard-list-item"
      data-dashboard-route="/bookings"
    >
      <div class="dashboard-booking-source">
        ${sourceLabel(
          String(
            booking.source
            ?? ""
          )
        )}
      </div>

      <div class="dashboard-item-copy">
        <strong>
          ${escapeHtml(
            String(
              booking.booking_code
              ?? "Rezervasyon"
            )
          )}
        </strong>

        <span>
          ${escapeHtml(
            name
          )}
        </span>
      </div>

      <div class="dashboard-booking-total">
        <strong>
          ${formatMoney(
            amount,
            currency
          )}
        </strong>

        <span>
          ${bookingStatusLabel(
            status
          )}
        </span>
      </div>
    </button>
  `;
}


function resourceBlock(
  title: string,
  available: number,
  total: number,
  busy: number,
  route: string,
): string {
  const percentage =
    total > 0
      ? Math.round(
          (
            available
            / total
          )
          * 100
        )
      : 0;

  return `
    <button
      type="button"
      class="dashboard-resource"
      data-dashboard-route="${route}"
    >
      <div class="dashboard-resource-top">

        <div>
          <span>
            ${escapeHtml(title)}
          </span>

          <strong>
            ${available}
            <small>
              / ${total}
            </small>
          </strong>
        </div>

        <span>
          ${busy} meşgul
        </span>

      </div>

      <div class="dashboard-progress">
        <span
          style="width:${percentage}%"
        ></span>
      </div>

      <small>
        %${percentage} müsait
      </small>
    </button>
  `;
}


function summaryTile(
  title: string,
  value: number,
  description: string,
  route: string,
): string {
  return `
    <button
      type="button"
      class="dashboard-summary-tile"
      data-dashboard-route="${route}"
    >
      <span>
        ${escapeHtml(title)}
      </span>

      <strong>
        ${value}
      </strong>

      <small>
        ${escapeHtml(description)}
      </small>
    </button>
  `;
}


function emptyState(
  title: string,
  description: string,
): string {
  return `
    <div class="dashboard-empty">
      <strong>
        ${escapeHtml(title)}
      </strong>

      <span>
        ${escapeHtml(description)}
      </span>
    </div>
  `;
}


function bindDashboardNavigation(
  root: HTMLElement,
): void {
  root
    .querySelectorAll<HTMLElement>(
      "[data-dashboard-route]"
    )
    .forEach(
      item => {
        item.addEventListener(
          "click",
          () => {
            navigate(
              item.dataset.dashboardRoute
              ?? "/"
            );
          },
        );
      },
    );
}


function numeric(
  value:
    unknown,
): number {
  const number =
    Number(
      value
      ?? 0
    );

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}


function operationStatusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    not_planned:
      "Planlanmadı",

    waiting_assignment:
      "Atama Bekliyor",

    assigned:
      "Atandı",

    ready:
      "Hazır",

    in_progress:
      "Operasyonda",

    completed:
      "Tamamlandı",

    problem:
      "Sorun",

    cancelled:
      "İptal",
  };

  return (
    labels[status]
    ?? status
  );
}


function bookingStatusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    draft: "Taslak",
    pending: "Bekliyor",
    confirmed: "Onaylandı",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  return (
    labels[status]
    ?? status
  );
}


function statusTone(
  status: string,
): string {
  if (
    status === "problem"
    || status === "cancelled"
  ) {
    return "ax-status-red";
  }

  if (
    status === "in_progress"
    || status === "completed"
  ) {
    return "ax-status-green";
  }

  if (
    status === "waiting_assignment"
  ) {
    return "ax-status-amber";
  }

  return "ax-status-blue";
}


function operationSourceLabel(
  source: string,
): string {
  const labels:
  Record<string, string> = {
    transfer: "Transfer",
    tour_departure: "Tur",
    other: "Operasyon",
  };

  return (
    labels[source]
    ?? "Operasyon"
  );
}


function sourceLabel(
  source: string,
): string {
  const labels:
  Record<string, string> = {
    website: "Website",
    booking_widget: "Widget",
    api: "API",
    integration: "Entegrasyon",
    manual: "Manuel",
    phone: "Telefon",
    whatsapp: "WhatsApp",
    hotel: "Otel",
    b2b: "B2B",
  };

  return (
    labels[source]
    ?? source
    ?? "-"
  );
}


function formatMoney(
  amount: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      },
    ).format(
      amount
    );

  } catch {
    return (
      `${amount} ${currency}`
    );
  }
}


function formatOperationTime(
  value: unknown,
): string {
  if (!value) {
    return "--:--";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    date
  );
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
