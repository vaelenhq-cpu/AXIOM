import {
  assignOperation,
  getAvailableDrivers,
  getAvailableVehicles,
  getOperations,
  reassignOperation,
  type AvailableDriver,
  type AvailableVehicle,
  type DispatchOperation,
} from "../../api/operations";

import "./operations.css";


export function OperationsPage(): HTMLElement {
  const page = document.createElement("section");

  page.innerHTML = `
    <header class="page-header">
      <div>
        <span class="page-overline">
          DISPATCH
        </span>

        <h1>
          Operasyon Merkezi
        </h1>

        <p>
          Onaylanmış operasyonları,
          şoför ve araç atamalarını yönetin.
        </p>
      </div>
    </header>

    <div
      id="dispatch-summary"
      class="dispatch-summary"
    ></div>

    <div
      id="dispatch-list"
      class="dispatch-list"
    >
      Operasyonlar yükleniyor...
    </div>
  `;

  const list =
    page.querySelector<HTMLDivElement>(
      "#dispatch-list"
    );

  const summary =
    page.querySelector<HTMLDivElement>(
      "#dispatch-summary"
    );

  let drivers: AvailableDriver[] = [];
  let vehicles: AvailableVehicle[] = [];

  async function load(): Promise<void> {
    if (!list || !summary) return;

    try {
      const [
        operations,
        availableDrivers,
        availableVehicles,
      ] = await Promise.all([
        getOperations(),
        getAvailableDrivers(),
        getAvailableVehicles(),
      ]);

      drivers = availableDrivers;
      vehicles = availableVehicles;

      renderSummary(
        summary,
        operations,
      );

      renderOperations(
        list,
        operations,
        drivers,
        vehicles,
        load,
      );

    } catch (exception) {
      list.textContent =
        exception instanceof Error
          ? exception.message
          : "Operasyonlar yüklenemedi.";
    }
  }

  void load();

  return page;
}


function renderSummary(
  host: HTMLElement,
  operations: DispatchOperation[],
): void {
  const count = (status: string) =>
    operations.filter(
      item => item.status === status
    ).length;

  host.innerHTML = `
    ${summaryCard(
      "Atama Bekliyor",
      count("waiting_assignment"),
    )}

    ${summaryCard(
      "Atandı",
      count("assigned"),
    )}

    ${summaryCard(
      "Operasyonda",
      count("in_progress"),
    )}

    ${summaryCard(
      "Sorunlu",
      count("problem"),
    )}
  `;
}


function renderOperations(
  host: HTMLElement,
  operations: DispatchOperation[],
  drivers: AvailableDriver[],
  vehicles: AvailableVehicle[],
  reload: () => Promise<void>,
): void {
  if (!operations.length) {
    host.innerHTML = `
      <div class="dispatch-empty">
        Aktif operasyon bulunmuyor.
      </div>
    `;
    return;
  }

  host.innerHTML = "";

  operations.forEach(
    operation => {
      const card =
        document.createElement(
          "article"
        );

      card.className =
        "dispatch-card";

      const customer =
        [
          operation.customer_first_name,
          operation.customer_last_name,
        ]
          .filter(Boolean)
          .join(" ")
        || "Müşteri";

      card.innerHTML = `
        <div class="dispatch-card-head">

          <div>
            <span class="dispatch-code">
              ${escapeHtml(
                operation.booking_code
                ?? operation.id
              )}
            </span>

            <h3>
              ${escapeHtml(
                operation.pickup_location
                ?? operation.service_title
                ?? "Operasyon"
              )}
              ${
                operation.dropoff_location
                  ? ` → ${escapeHtml(
                      operation.dropoff_location
                    )}`
                  : ""
              }
            </h3>
          </div>

          <span
            class="dispatch-status"
          >
            ${statusLabel(
              operation.status
            )}
          </span>

        </div>

        <div class="dispatch-meta">

          <span>
            ${formatDateTime(
              operation.pickup_datetime
              ?? operation.scheduled_start_at
            )}
          </span>

          <span>
            ${escapeHtml(customer)}
          </span>

          ${
            operation.pax
              ? `<span>${operation.pax} kişi</span>`
              : ""
          }

          ${
            operation.flight_number
              ? `<span>Uçuş ${escapeHtml(
                  operation.flight_number
                )}</span>`
              : ""
          }

        </div>

        <div class="dispatch-info">

          <div>
            <span>Araç Sınıfı</span>
            <strong>
              ${escapeHtml(
                operation.requested_vehicle_class
                ?? "-"
              )}
            </strong>
          </div>

          <div>
            <span>Bagaj</span>
            <strong>
              ${operation.luggage_count ?? 0}
            </strong>
          </div>

        </div>

        ${
          operation.status === "waiting_assignment"
            ? assignmentForm(
                operation,
                drivers,
                vehicles,
              )

            : operation.status === "problem"
              ? reassignForm(
                  operation,
                  drivers,
                  vehicles,
                )

              : assignmentSummary(
                  operation
                )
        }
      `;

      const assignButton =
        card.querySelector<HTMLButtonElement>(
          "[data-assign-operation]"
        );

      assignButton?.addEventListener(
        "click",
        async () => {
          const driverSelect =
            card.querySelector<HTMLSelectElement>(
              "[data-driver]"
            );

          const vehicleSelect =
            card.querySelector<HTMLSelectElement>(
              "[data-vehicle]"
            );

          if (
            !driverSelect?.value ||
            !vehicleSelect?.value
          ) {
            const error =
              card.querySelector<HTMLElement>(
                ".dispatch-error"
              );

            if (error) {
              error.textContent =
                "Şoför ve araç seçmelisiniz.";
            }

            return;
          }

          assignButton.disabled = true;

          try {
            await assignOperation(
              operation.id,
              driverSelect.value,
              vehicleSelect.value,
            );

            await reload();

          } catch (exception) {
            const error =
              card.querySelector<HTMLElement>(
                ".dispatch-error"
              );

            if (error) {
              error.textContent =
                exception instanceof Error
                  ? exception.message
                  : "Atama yapılamadı.";
            }

            assignButton.disabled = false;
          }
        },
      );

      const reassignButton =
        card.querySelector<HTMLButtonElement>(
          "[data-reassign-operation]"
        );

      reassignButton?.addEventListener(
        "click",
        async () => {
          const driverSelect =
            card.querySelector<HTMLSelectElement>(
              "[data-reassign-driver]"
            );

          const vehicleSelect =
            card.querySelector<HTMLSelectElement>(
              "[data-reassign-vehicle]"
            );

          const reasonInput =
            card.querySelector<HTMLTextAreaElement>(
              "[data-reassign-reason]"
            );

          const maintenanceInput =
            card.querySelector<HTMLInputElement>(
              "[data-mark-maintenance]"
            );

          const error =
            card.querySelector<HTMLElement>(
              ".dispatch-reassign-error"
            );

          const driverId =
            driverSelect?.value
            || null;

          const vehicleId =
            vehicleSelect?.value
            || null;

          const reason =
            reasonInput?.value.trim()
            ?? "";

          if (
            !driverId &&
            !vehicleId
          ) {
            if (error) {
              error.textContent =
                "Yeni şoför veya yeni araç seçmelisiniz.";
            }

            return;
          }

          if (!reason) {
            if (error) {
              error.textContent =
                "Yeniden atama nedeni zorunludur.";
            }

            return;
          }

          reassignButton.disabled = true;

          if (error) {
            error.textContent = "";
          }

          try {
            await reassignOperation(
              operation.id,
              {
                driver_id:
                  driverId,

                vehicle_id:
                  vehicleId,

                reason,

                mark_previous_vehicle_maintenance:
                  maintenanceInput?.checked
                  ?? false,
              },
            );

            await reload();

          } catch (exception) {
            if (error) {
              error.textContent =
                exception instanceof Error
                  ? exception.message
                  : "Operasyon yeniden atanamadı.";
            }

            reassignButton.disabled = false;
          }
        },
      );


      host.appendChild(card);
    },
  );
}


function assignmentForm(
  operation: DispatchOperation,
  drivers: AvailableDriver[],
  vehicles: AvailableVehicle[],
): string {
  return `
    <div class="dispatch-assignment">

      <label>
        <span>Şoför</span>

        <select data-driver>
          <option value="">
            Şoför seç
          </option>

          ${drivers
            .map(
              driver => `
                <option value="${escapeHtml(driver.id)}">
                  ${escapeHtml(
                    [
                      driver.first_name,
                      driver.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  )}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label>
        <span>Araç</span>

        <select data-vehicle>
          <option value="">
            Araç seç
          </option>

          ${vehicles
            .slice()
            .sort((a, b) => {
              const requested =
                normalizeVehicleClass(
                  operation.requested_vehicle_class
                );

              const aClass =
                normalizeVehicleClass(
                  a.vehicle_class
                );

              const bClass =
                normalizeVehicleClass(
                  b.vehicle_class
                );

              const aMatch =
                requested &&
                aClass === requested
                  ? 1
                  : 0;

              const bMatch =
                requested &&
                bClass === requested
                  ? 1
                  : 0;

              return bMatch - aMatch;
            })
            .map(
              vehicle => {
                const requested =
                  normalizeVehicleClass(
                    operation.requested_vehicle_class
                  );

                const vehicleClass =
                  normalizeVehicleClass(
                    vehicle.vehicle_class
                  );

                const match =
                  requested &&
                  vehicleClass === requested;

                return `
                  <option value="${escapeHtml(vehicle.id)}">
                    ${match ? "✓ " : ""}
                    ${escapeHtml(vehicle.plate)}
                    ${
                      vehicle.vehicle_class
                        ? ` • ${escapeHtml(
                            vehicle.vehicle_class
                          )}`
                        : ""
                    }
                  </option>
                `;
              }
            )
            .join("")}
        </select>
      </label>

      <div class="dispatch-error"></div>

      <button
        type="button"
        class="dispatch-assign-button"
        data-assign-operation
      >
        Operasyonu Ata
      </button>

    </div>
  `;
}


function reassignForm(
  operation: DispatchOperation,
  drivers: AvailableDriver[],
  vehicles: AvailableVehicle[],
): string {
  const currentDriverId =
    operation.driver_id ?? "";

  const currentVehicleId =
    operation.vehicle_id ?? "";

  const replacementDrivers =
    drivers.filter(
      driver =>
        driver.id !== currentDriverId
    );

  const replacementVehicles =
    vehicles.filter(
      vehicle =>
        vehicle.id !== currentVehicleId
    );

  return `
    <div class="dispatch-reassign">

      <div class="dispatch-reassign-head">
        <div>
          <span>OPERASYON MÜDAHALESİ</span>
          <strong>
            Yeni Atama
          </strong>
        </div>

        <span class="dispatch-reassign-badge">
          Sorunlu
        </span>
      </div>

      <div class="dispatch-reassign-current">

        <div>
          <span>Mevcut Şoför</span>
          <strong>
            ${escapeHtml(
              [
                operation.driver_first_name,
                operation.driver_last_name,
              ]
                .filter(Boolean)
                .join(" ")
              || "Atanmamış"
            )}
          </strong>
        </div>

        <div>
          <span>Mevcut Araç</span>
          <strong>
            ${escapeHtml(
              operation.vehicle_plate
              ?? "Atanmamış"
            )}
          </strong>
        </div>

      </div>

      <label>
        <span>Yeni Şoför</span>

        <select data-reassign-driver>
          <option value="">
            Şoförü değiştirme
          </option>

          ${replacementDrivers
            .map(
              driver => `
                <option
                  value="${escapeHtml(driver.id)}"
                >
                  ${escapeHtml(
                    [
                      driver.first_name,
                      driver.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  )}
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label>
        <span>Yeni Araç</span>

        <select data-reassign-vehicle>
          <option value="">
            Aracı değiştirme
          </option>

          ${replacementVehicles
            .map(
              vehicle => `
                <option
                  value="${escapeHtml(vehicle.id)}"
                >
                  ${escapeHtml(vehicle.plate)}
                  ${
                    vehicle.vehicle_class
                      ? ` • ${escapeHtml(
                          vehicle.vehicle_class
                        )}`
                      : ""
                  }
                </option>
              `
            )
            .join("")}
        </select>
      </label>

      <label>
        <span>Yeniden Atama Nedeni</span>

        <textarea
          data-reassign-reason
          rows="3"
          placeholder="Örn: Araç lastiği patladı"
        ></textarea>
      </label>

      ${
        currentVehicleId
          ? `
            <label class="dispatch-maintenance-option">
              <input
                type="checkbox"
                data-mark-maintenance
              >

              <span>
                Mevcut aracı bakım durumuna al
              </span>
            </label>
          `
          : ""
      }

      <div
        class="dispatch-reassign-error"
      ></div>

      <button
        type="button"
        class="dispatch-reassign-button"
        data-reassign-operation
      >
        Operasyonu Yeniden Ata
      </button>

    </div>
  `;
}


function assignmentSummary(
  operation: DispatchOperation,
): string {
  return `
    <div class="assignment-summary">

      <div>
        <span>Şoför</span>
        <strong>
          ${escapeHtml(
            [
              operation.driver_first_name,
              operation.driver_last_name,
            ]
              .filter(Boolean)
              .join(" ")
            || "Atanmadı"
          )}
        </strong>
      </div>

      <div>
        <span>Araç</span>
        <strong>
          ${escapeHtml(
            operation.vehicle_plate
            ?? "Atanmadı"
          )}
        </strong>
      </div>

    </div>
  `;
}


function normalizeVehicleClass(
  value?: string | null,
): string {
  return (
    value
      ?.trim()
      .toLocaleLowerCase("tr-TR")
      .replaceAll(/\s+/g, " ")
    ?? ""
  );
}


function summaryCard(
  label: string,
  value: number,
): string {
  return `
    <article>
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}


function statusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
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

  return labels[status] ?? status;
}


function formatDateTime(
  value?: string | null,
): string {
  if (!value) return "-";

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(date);
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
