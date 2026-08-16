import {
  getBooking,
  getBookings,
  updateBookingStatus,
  type BookingDetail,
  type BookingListItem,
} from "../../api/bookings";

import {
  navigate,
} from "../../core/router";

import "./bookings.css";


const STATUS_LABELS:
Record<string, string> = {
  draft: "Taslak",
  pending: "Bekliyor",
  confirmed: "Onaylandı",
  cancelled: "İptal",
  completed: "Tamamlandı",
};


export function BookingsPage():
HTMLElement {
  const page =
    document.createElement(
      "section",
    );

  page.className =
    "bookings-page";

  page.innerHTML = `
    <header class="page-header bookings-header">
      <div>
        <span class="page-overline">
          REZERVASYON YÖNETİMİ
        </span>

        <h1>
          Rezervasyonlar
        </h1>

        <p>
          Gelen rezervasyonları,
          hizmetleri ve operasyon
          durumlarını yönetin.
        </p>
      </div>

      <div class="booking-header-actions">
        <button
          class="secondary-button"
          id="refresh-bookings"
          type="button"
        >
          Yenile
        </button>
      </div>
    </header>

    <section
      class="booking-toolbar"
    >

      <div class="booking-search">
        <input
          id="booking-search"
          type="search"
          placeholder="Kod, müşteri veya kaynak ara..."
        />
      </div>

      <select
        id="booking-source-filter"
        class="booking-filter"
      >
        <option value="">
          Tüm kaynaklar
        </option>

        <option value="website">
          Web Sitesi
        </option>

        <option value="booking_widget">
          Booking Widget
        </option>

        <option value="integration">
          Entegrasyon
        </option>

        <option value="phone">
          Telefon
        </option>

        <option value="whatsapp">
          WhatsApp
        </option>

        <option value="manual">
          Manuel
        </option>
      </select>

      <select
        id="booking-status-filter"
        class="booking-filter"
      >
        <option value="">
          Tüm durumlar
        </option>

        <option value="draft">
          Taslak
        </option>

        <option value="pending">
          Bekliyor
        </option>

        <option value="confirmed">
          Onaylandı
        </option>

        <option value="completed">
          Tamamlandı
        </option>

        <option value="cancelled">
          İptal
        </option>
      </select>

    </section>

    <section
      class="booking-list-panel"
    >

      <div
        id="booking-list-loading"
        class="booking-state"
      >
        Rezervasyonlar yükleniyor...
      </div>

      <div
        id="booking-list-empty"
        class="booking-state"
        hidden
      >
        Rezervasyon bulunamadı.
      </div>

      <div
        id="booking-list"
        class="booking-list"
        hidden
      ></div>

    </section>

    <div
      class="booking-drawer-overlay"
      id="booking-drawer-overlay"
      hidden
    ></div>

    <aside
      class="booking-drawer"
      id="booking-drawer"
      aria-hidden="true"
    ></aside>
  `;

  const state = {
    bookings:
      [] as BookingListItem[],

    query: "",
    status: "",
    source: "",
  };

  const list =
    page.querySelector<
      HTMLDivElement
    >("#booking-list");

  const loading =
    page.querySelector<
      HTMLDivElement
    >("#booking-list-loading");

  const empty =
    page.querySelector<
      HTMLDivElement
    >("#booking-list-empty");

  const search =
    page.querySelector<
      HTMLInputElement
    >("#booking-search");

  const sourceFilter =
    page.querySelector<
      HTMLSelectElement
    >("#booking-source-filter");

  const statusFilter =
    page.querySelector<
      HTMLSelectElement
    >("#booking-status-filter");

  const refresh =
    page.querySelector<
      HTMLButtonElement
    >("#refresh-bookings");

  const drawer =
    page.querySelector<
      HTMLElement
    >("#booking-drawer");

  const overlay =
    page.querySelector<
      HTMLDivElement
    >("#booking-drawer-overlay");


  function filteredBookings():
  BookingListItem[] {
    const query =
      state.query
        .trim()
        .toLowerCase();

    return state.bookings.filter(
      (booking) => {
        if (
          state.status &&
          booking.status !==
            state.status
        ) {
          return false;
        }

        if (
          state.source &&
          booking.source !==
            state.source
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          booking.booking_code,
          booking.source,
          booking.customer_first_name,
          booking.customer_last_name,
          booking.customer_phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          query,
        );
      },
    );
  }


  function renderList(): void {
    if (!list || !empty) {
      return;
    }

    const records =
      filteredBookings();

    list.innerHTML = "";

    if (!records.length) {
      list.hidden = true;
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.hidden = false;

    records.forEach(
      (booking) => {
        const row =
          document.createElement(
            "button",
          );

        row.type = "button";

        row.className =
          "booking-row";

        const customer =
          [
            booking
              .customer_first_name,
            booking
              .customer_last_name,
          ]
            .filter(Boolean)
            .join(" ")
          ||
          "Müşteri bilgisi yok";

        row.innerHTML = `
          <div class="booking-main">
            <div class="booking-code-line">
              <span class="booking-code">
                ${escapeHtml(
                  booking.booking_code,
                )}
              </span>

              <span
                class="booking-status booking-status-${escapeHtml(
                  booking.status,
                )}"
              >
                ${escapeHtml(
                  statusLabel(
                    booking.status,
                  ),
                )}
              </span>
            </div>

            <strong>
              ${escapeHtml(
                customer,
              )}
            </strong>

            <span class="booking-meta">
              ${escapeHtml(
                sourceLabel(
                  booking.source,
                  booking.source_provider,
                ),
              )}
              ${
                booking
                  .customer_phone
                  ? ` • ${escapeHtml(
                      booking
                        .customer_phone,
                    )}`
                  : ""
              }
            </span>
          </div>

          <div class="booking-row-right">
            <strong>
              ${money(
                booking.total_amount,
                booking.currency,
              )}
            </strong>

            <span>
              ${formatDate(
                booking.created_at,
              )}
            </span>
          </div>
        `;

        row.addEventListener(
          "click",
          () => {
            void openBooking(
              booking.id,
            );
          },
        );

        list.appendChild(
          row,
        );
      },
    );
  }


  async function loadBookings():
  Promise<void> {
    if (
      !loading ||
      !list ||
      !empty
    ) {
      return;
    }

    loading.hidden = false;
    loading.textContent =
      "Rezervasyonlar yükleniyor...";

    list.hidden = true;
    empty.hidden = true;

    try {
      state.bookings =
        await getBookings();

      loading.hidden = true;

      renderList();

    } catch (error) {
      loading.hidden = false;

      loading.textContent =
        error instanceof Error
          ? error.message
          : "Rezervasyonlar yüklenemedi.";
    }
  }


  async function openBooking(
    bookingId: string,
  ): Promise<void> {
    if (!drawer || !overlay) {
      return;
    }

    overlay.hidden = false;

    drawer.classList.add(
      "booking-drawer-open",
    );

    drawer.setAttribute(
      "aria-hidden",
      "false",
    );

    drawer.innerHTML = `
      <div class="drawer-loading">
        Rezervasyon detayı
        yükleniyor...
      </div>
    `;

    try {
      const booking =
        await getBooking(
          bookingId,
        );

      renderDrawer(
        drawer,
        booking,
        async (
          newStatus,
        ) => {
          const updated =
            await updateBookingStatus(
              booking.id,
              newStatus,
            );

          const index =
            state.bookings.findIndex(
              (item) =>
                item.id === booking.id,
            );

          if (index >= 0) {
            state.bookings[
              index
            ].status =
              updated.status;
          }

          renderList();

          await openBooking(
            booking.id,
          );
        },
        closeDrawer,
      );

    } catch (error) {
      drawer.innerHTML = `
        <div class="drawer-error">
          ${
            error instanceof Error
              ? escapeHtml(
                  error.message,
                )
              : "Detay yüklenemedi."
          }
        </div>
      `;
    }
  }


  function closeDrawer(): void {
    if (!drawer || !overlay) {
      return;
    }

    drawer.classList.remove(
      "booking-drawer-open",
    );

    drawer.setAttribute(
      "aria-hidden",
      "true",
    );

    overlay.hidden = true;
  }


  search?.addEventListener(
    "input",
    () => {
      state.query =
        search.value;

      renderList();
    },
  );

  sourceFilter?.addEventListener(
    "change",
    () => {
      state.source =
        sourceFilter.value;

      renderList();
    },
  );

  statusFilter?.addEventListener(
    "change",
    () => {
      state.status =
        statusFilter.value;

      renderList();
    },
  );

  refresh?.addEventListener(
    "click",
    () => {
      void loadBookings();
    },
  );

  overlay?.addEventListener(
    "click",
    closeDrawer,
  );


  void loadBookings();

  return page;
}


function renderDrawer(
  drawer: HTMLElement,
  booking: BookingDetail,
  onStatusChange:
    (status: string) =>
      Promise<void>,
  onClose: () => void,
): void {
  drawer.innerHTML = `
    <header class="booking-drawer-header">

      <div>
        <span class="drawer-overline">
          REZERVASYON
        </span>

        <h2>
          ${escapeHtml(
            booking.booking_code,
          )}
        </h2>

        <span
          class="booking-status booking-status-${escapeHtml(
            booking.status,
          )}"
        >
          ${escapeHtml(
            statusLabel(
              booking.status,
            ),
          )}
        </span>
      </div>

      <button
        type="button"
        class="drawer-close"
        id="drawer-close"
        aria-label="Kapat"
      >
        ×
      </button>

    </header>

    <div class="drawer-section">

      <span class="drawer-section-title">
        Rezervasyon
      </span>

      <div class="drawer-info-grid">

        ${info(
          "Kaynak",
          booking.source,
        )}

        ${info(
          "Toplam",
          money(
            booking.total_amount,
            booking.currency,
          ),
        )}

        ${info(
          "Oluşturulma",
          formatDate(
            booking.created_at,
          ),
        )}

        ${info(
          "Durum",
          statusLabel(
            booking.status,
          ),
        )}

      </div>

    </div>

    <div class="drawer-section">

      <span class="drawer-section-title">
        Müşteri
      </span>

      <div class="drawer-info-grid">

        ${info(
          "Ad Soyad",
          [
            booking.customer?.first_name,
            booking.customer?.last_name,
          ]
            .filter(Boolean)
            .join(" ")
          || "-",
        )}

        ${info(
          "Telefon",
          booking.customer?.phone
          ?? "-",
        )}

        ${info(
          "E-posta",
          booking.customer?.email
          ?? "-",
        )}

        ${info(
          "Uyruk",
          booking.customer?.nationality
          ?? "-",
        )}

      </div>

    </div>

    <div class="drawer-section">

      <span class="drawer-section-title">
        Hizmetler
      </span>

      <div class="drawer-services">

        ${
          booking.services.length
            ? booking.services
                .map(
                  serviceCard,
                )
                .join("")
            : `
              <div class="drawer-empty">
                Hizmet bulunamadı.
              </div>
            `
        }

      </div>

    </div>

    ${
      booking.customer_note
        ? `
          <div class="drawer-section">

            <span class="drawer-section-title">
              Müşteri Notu
            </span>

            <p class="drawer-note">
              ${escapeHtml(
                booking.customer_note,
              )}
            </p>

          </div>
        `
        : ""
    }

    ${
      booking.internal_note
        ? `
          <div class="drawer-section">

            <span class="drawer-section-title">
              İç Not
            </span>

            <p class="drawer-note">
              ${escapeHtml(
                booking.internal_note,
              )}
            </p>

          </div>
        `
        : ""
    }

    <div class="drawer-section">

      <span class="drawer-section-title">
        Durum Değiştir
      </span>

      <div
        class="status-actions"
        id="status-actions"
      >
        ${statusButtons(
          booking.status,
        )}
      </div>

      <div
        class="drawer-action-error"
        id="drawer-action-error"
        hidden
      ></div>

    </div>
  `;

  drawer
    .querySelector(
      "#drawer-close",
    )
    ?.addEventListener(
      "click",
      onClose,
    );

  drawer
    .querySelectorAll<HTMLButtonElement>(
      "[data-open-operations]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            onClose();

            navigate(
              "/operations"
            );
          },
        );
      },
    );


  const error =
    drawer.querySelector<
      HTMLDivElement
    >("#drawer-action-error");

  drawer
    .querySelectorAll<
      HTMLButtonElement
    >("[data-booking-status]")
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          async () => {
            const status =
              button.dataset
                .bookingStatus;

            if (!status) {
              return;
            }

            drawer
              .querySelectorAll<
                HTMLButtonElement
              >(
                "[data-booking-status]",
              )
              .forEach(
                (item) => {
                  item.disabled =
                    true;
                },
              );

            if (error) {
              error.hidden = true;
            }

            try {
              await onStatusChange(
                status,
              );

            } catch (
              exception
            ) {
              if (error) {
                error.hidden = false;

                error.textContent =
                  exception
                    instanceof Error
                    ? exception
                        .message
                    : "Durum güncellenemedi.";
              }

              drawer
                .querySelectorAll<
                  HTMLButtonElement
                >(
                  "[data-booking-status]",
                )
                .forEach(
                  (item) => {
                    item.disabled =
                      false;
                  },
                );
            }
          },
        );
      },
    );
}


function statusButtons(
  current: string,
): string {
  const transitions:
  Record<
    string,
    string[]
  > = {
    draft: [
      "pending",
      "confirmed",
      "cancelled",
    ],

    pending: [
      "confirmed",
      "cancelled",
    ],

    confirmed: [
      "cancelled",
    ],
  };

  const allowed =
    transitions[current] ?? [];

  if (!allowed.length) {
    return `
      <span class="drawer-empty">
        Bu rezervasyon için
        başka durum geçişi yok.
      </span>
    `;
  }

  return allowed
    .map(
      (status) => `
        <button
          type="button"
          class="status-action-button"
          data-booking-status="${escapeHtml(
            status,
          )}"
        >
          ${escapeHtml(
            statusLabel(
              status,
            ),
          )}
        </button>
      `,
    )
    .join("");
}


function serviceCard(
  service:
    BookingDetail[
      "services"
    ][number],
): string {
  const pax =
    service.pax_adult
    + service.pax_child
    + service.pax_infant;

  let detail = "";

  if (
    service.service_type === "transfer"
    && service.transfer
  ) {
    const t =
      service.transfer;

    const operation =
      service.operation;

    const driver =
      operation
        ? [
            operation.driver_first_name,
            operation.driver_last_name,
          ]
            .filter(Boolean)
            .join(" ")
        : "";

    const vehicle =
      operation
        ? [
            operation.vehicle_plate,
            operation.vehicle_brand,
            operation.vehicle_model,
          ]
            .filter(Boolean)
            .join(" • ")
        : "";

    detail = `
      <div class="service-route">

        <div>
          <span>ALIŞ</span>

          <strong>
            ${escapeHtml(
              t.pickup_location
            )}
          </strong>
        </div>

        <i>→</i>

        <div>
          <span>BIRAKIŞ</span>

          <strong>
            ${escapeHtml(
              t.dropoff_location
            )}
          </strong>
        </div>

      </div>

      <div class="service-detail-grid">

        ${info(
          "Transfer Zamanı",
          t.pickup_datetime
            ? formatDate(
                t.pickup_datetime
              )
            : "-"
        )}

        ${info(
          "Uçuş",
          t.flight_number
          ?? "-"
        )}

        ${info(
          "Uçuş Zamanı",
          t.flight_datetime
            ? formatDate(
                t.flight_datetime
              )
            : "-"
        )}

        ${info(
          "Yolcu",
          `${t.pax ?? pax} kişi`
        )}

        ${info(
          "Bagaj",
          `${t.luggage_count ?? 0}`
        )}

        ${info(
          "Araç Sınıfı",
          t.requested_vehicle_class
          ?? "-"
        )}

        ${info(
          "Karşılama Tabelası",
          t.pickup_sign
          ?? "-"
        )}

      </div>

      ${
        t.special_request
          ? `
            <div class="service-special-request">
              <span>
                ÖZEL TALEP
              </span>

              <p>
                ${escapeHtml(
                  t.special_request
                )}
              </p>
            </div>
          `
          : ""
      }

      ${
        operation
          ? `
            <div class="
              booking-operation-card
              booking-operation-${escapeHtml(
                operation.status
              )}
            ">

              <div class="booking-operation-head">

                <div>
                  <span>
                    OPERASYON
                  </span>

                  <strong>
                    ${escapeHtml(
                      operationStatusLabel(
                        operation.status
                      )
                    )}
                  </strong>
                </div>

                <span class="
                  booking-operation-status
                  booking-operation-status-${escapeHtml(
                    operation.status
                  )}
                ">
                  ${escapeHtml(
                    operationStatusLabel(
                      operation.status
                    )
                  )}
                </span>

              </div>

              <div class="booking-operation-resources">

                <div>
                  <span>Şoför</span>

                  <strong>
                    ${escapeHtml(
                      driver
                      || "Atanmadı"
                    )}
                  </strong>
                </div>

                <div>
                  <span>Araç</span>

                  <strong>
                    ${escapeHtml(
                      vehicle
                      || "Atanmadı"
                    )}
                  </strong>
                </div>

              </div>

              ${
                operation.scheduled_start_at
                  ? `
                    <div class="booking-operation-time">
                      <span>
                        Planlanan başlangıç
                      </span>

                      <strong>
                        ${escapeHtml(
                          formatDate(
                            operation
                              .scheduled_start_at
                          )
                        )}
                      </strong>
                    </div>
                  `
                  : ""
              }

              <button
                type="button"
                class="booking-open-operation"
                data-open-operations
              >
                Operasyon Merkezinde Aç
              </button>

            </div>
          `
          : `
            <div class="booking-operation-missing">
              Bu hizmet için henüz operasyon oluşturulmamış.
            </div>
          `
      }
    `;
  }

  if (
    service.service_type === "tour"
    && service.tour
  ) {
    const tour =
      service.tour;

    detail = `
      <div class="service-detail-grid">

        ${info(
          "Tur",
          tour.tour_name
          ?? service.title
        )}

        ${info(
          "Kalkış Tarihi",
          tour.departure_date
          ?? "-"
        )}

        ${info(
          "Kalkış Saati",
          tour.departure_time
          ?? "-"
        )}

        ${info(
          "Buluşma",
          tour.meeting_point
          ?? "-"
        )}

        ${info(
          "Pickup",
          tour.pickup_required
            ? (
                tour.pickup_location
                ?? "Gerekli"
              )
            : "Yok"
        )}

      </div>
    `;
  }

  return `
    <article
      class="drawer-service"
    >

      <div class="drawer-service-head">

        <span
          class="service-type service-${escapeHtml(
            service.service_type
          )}"
        >
          ${escapeHtml(
            serviceTypeLabel(
              service.service_type
            )
          )}
        </span>

        <span>
          ${escapeHtml(
            serviceStatusLabel(
              service.status
            )
          )}
        </span>

      </div>

      <strong>
        ${escapeHtml(
          service.title
        )}
      </strong>

      <div class="drawer-service-meta">

        ${
          service.service_date
            ? `
              <span>
                ${escapeHtml(
                  service.service_date
                )}
              </span>
            `
            : ""
        }

        ${
          service.start_time
            ? `
              <span>
                ${escapeHtml(
                  service.start_time
                )}
              </span>
            `
            : ""
        }

        <span>
          ${pax} kişi
        </span>

        <span>
          ${money(
            service.total_price,
            "TRY"
          )}
        </span>

      </div>

      ${detail}

    </article>
  `;
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

    problem:
      "Sorun",

    completed:
      "Tamamlandı",

    cancelled:
      "İptal",
  };

  return labels[status]
    ?? status;
}


function serviceTypeLabel(
  type: string,
): string {
  const labels:
  Record<string, string> = {
    transfer:
      "TRANSFER",

    tour:
      "TUR",

    other:
      "DİĞER",
  };

  return labels[type]
    ?? type.toUpperCase();
}


function serviceStatusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    pending:
      "Bekliyor",

    confirmed:
      "Onaylandı",

    cancelled:
      "İptal",

    completed:
      "Tamamlandı",
  };

  return labels[status]
    ?? status;
}


function info(
  label: string,
  value: unknown,
): string {
  return `
    <div class="drawer-info">
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          String(
            value ?? "-",
          ),
        )}
      </strong>
    </div>
  `;
}


function statusLabel(
  status: string,
): string {
  return (
    STATUS_LABELS[status]
    ?? status
  );
}


function money(
  value: number,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      },
    ).format(
      Number(value || 0),
    );

  } catch {
    return `${value} ${currency}`;
  }
}


function formatDate(
  value: string,
): string {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(date);
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}


function sourceLabel(
  source: string,
  provider?: string | null,
): string {
  const labels:
  Record<string, string> = {
    website:
      "Web Sitesi",

    booking_widget:
      "Booking Widget",

    integration:
      provider
        ? `Entegrasyon • ${provider}`
        : "Entegrasyon",

    phone:
      "Telefon",

    whatsapp:
      "WhatsApp",

    manual:
      "Manuel",

    api:
      "API",

    b2b:
      "B2B",

    hotel:
      "Otel",

    other:
      "Diğer",
  };

  return (
    labels[source]
    ?? source
  );
}
