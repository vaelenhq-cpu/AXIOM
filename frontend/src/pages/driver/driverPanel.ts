import {
  acceptDriverOperation,
  completeDriverOperation,
  driverLogout,
  getDriverOperations,
  reportDriverIssue,
  startDriverOperation,
  type DriverOperation,
} from "../../api/driver";

import {
  getDriverIdentity,
  getDriverToken,
} from "../../driver/driverAuthStore";

import "./driver.css";


export function DriverPanelPage():
HTMLElement {
  if (!getDriverToken()) {
    history.replaceState(
      {},
      "",
      "/driver/login"
    );

    return DriverLoginRedirect();
  }

  const identity =
    getDriverIdentity();

  const page =
    document.createElement(
      "main"
    );

  page.className =
    "driver-panel-page";

  page.innerHTML = `
    <header class="driver-header">

      <div>
        <span class="driver-overline">
          AXIOM DRIVER
        </span>

        <h1>
          ${escapeHtml(
            [
              identity?.first_name,
              identity?.last_name,
            ]
              .filter(Boolean)
              .join(" ")
            || "Şoför"
          )}
        </h1>

        <p class="driver-header-sub">
          Atanmış operasyonlarınız
        </p>
      </div>

      <button
        type="button"
        id="driver-logout"
      >
        Çıkış
      </button>

    </header>

    <section class="driver-task-section">

      <div
        id="driver-focus"
        class="driver-focus"
      ></div>

      <div class="driver-tabs">
        <button
          type="button"
          class="driver-tab active"
          data-driver-tab="today"
        >
          Bugün
        </button>

        <button
          type="button"
          class="driver-tab"
          data-driver-tab="upcoming"
        >
          Yaklaşan
        </button>

        <button
          type="button"
          class="driver-tab"
          data-driver-tab="completed"
        >
          Tamamlanan
        </button>
      </div>

      <div
        id="driver-operation-list"
        class="driver-operation-list"
      >
        Görevler yükleniyor...
      </div>

    </section>

    <div
      class="driver-issue-backdrop"
      id="driver-issue-backdrop"
      hidden
    >
      <section
        class="driver-issue-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="driver-issue-title"
      >
        <div class="driver-issue-sheet-head">
          <div>
            <span>OPERASYON BİLDİRİMİ</span>

            <h2 id="driver-issue-title">
              Durum Bildir
            </h2>
          </div>

          <button
            type="button"
            id="driver-issue-close"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div class="driver-issue-types">

          <button
            type="button"
            data-issue-choice="delay"
          >
            Gecikme
          </button>

          <button
            type="button"
            data-issue-choice="passenger_missing"
          >
            Yolcu Bulunamadı
          </button>

          <button
            type="button"
            data-issue-choice="problem"
          >
            Araç / Operasyon Sorunu
          </button>

        </div>

        <label class="driver-issue-field">
          <span>Açıklama</span>

          <textarea
            id="driver-issue-description"
            maxlength="1000"
            rows="5"
            placeholder="Durumu operasyon merkezine açıklayın..."
          ></textarea>
        </label>

        <div
          class="driver-issue-error"
          id="driver-issue-error"
          hidden
        ></div>

        <div class="driver-issue-sheet-actions">

          <button
            type="button"
            class="driver-issue-cancel"
            id="driver-issue-cancel"
          >
            Vazgeç
          </button>

          <button
            type="button"
            class="driver-issue-submit"
            id="driver-issue-submit"
          >
            Bildirimi Gönder
          </button>

        </div>

      </section>
    </div>
  `;

  const list =
    page.querySelector<
      HTMLDivElement
    >("#driver-operation-list");

  const issueBackdrop =
    page.querySelector<HTMLElement>(
      "#driver-issue-backdrop"
    );

  const issueDescription =
    page.querySelector<HTMLTextAreaElement>(
      "#driver-issue-description"
    );

  const issueError =
    page.querySelector<HTMLElement>(
      "#driver-issue-error"
    );

  let issueOperationId:
    string | null = null;

  let issueType:
    "delay" |
    "passenger_missing" |
    "problem" |
    null = null;

  let activeTab:
    "today" |
    "upcoming" |
    "completed" =
      "today";

  let cachedOperations:
    DriverOperation[] = [];


  async function load():
  Promise<void> {
    if (!list) {
      return;
    }

    try {
      const operations =
        await getDriverOperations();

      cachedOperations =
        operations;

      renderDriverFocus(
        page,
        operations,
      );

      updateDriverTabCounts(
        page,
        operations,
      );

      const filtered =
        filterOperations(
          operations,
          activeTab,
        );

      if (!filtered.length) {
        list.innerHTML = `
          <div class="driver-empty">
            Atanmış görev bulunmuyor.
          </div>
        `;

        return;
      }

      list.innerHTML = "";

      filtered.forEach(
        operation => {
          const card =
            document.createElement(
              "article"
            );

          if (
            operation.status === "completed"
          ) {
            card.className =
              "driver-operation-card driver-operation-compact";

            card.innerHTML =
              completedOperationCard(
                operation
              );

            list.appendChild(
              card
            );

            return;
          }

          card.className =
            operation.status === "in_progress"
              ? "driver-operation-card active-operation"
              : operation.status === "ready"
                ? "driver-operation-card ready-operation"
                : "driver-operation-card";

          const customerName =
            [
              operation.customer_first_name,
              operation.customer_last_name,
            ]
              .filter(Boolean)
              .join(" ")
            || "Müşteri";

          card.innerHTML = `
            <div class="driver-task-top">

              <div>
                <span class="driver-operation-status">
                  ${escapeHtml(
                    statusLabel(
                      operation.status
                    )
                  )}
                </span>

                <span class="driver-booking-code">
                  ${escapeHtml(
                    operation.booking_code
                    ?? operation.id
                  )}
                </span>
              </div>

              <strong class="driver-task-time">
                ${formatTime(
                  operation.pickup_datetime
                  ?? operation.scheduled_start_at
                )}
              </strong>

            </div>

            <div class="driver-route">

              <div class="driver-route-point">

                <span class="route-dot"></span>

                <div>
                  <small>
                    ALIŞ
                  </small>

                  <strong>
                    ${escapeHtml(
                      operation.pickup_location
                      ?? "-"
                    )}
                  </strong>
                </div>

              </div>

              <div class="driver-route-line"></div>

              <div class="driver-route-point">

                <span class="route-dot destination"></span>

                <div>
                  <small>
                    BIRAKIŞ
                  </small>

                  <strong>
                    ${escapeHtml(
                      operation.dropoff_location
                      ?? "-"
                    )}
                  </strong>
                </div>

              </div>

            </div>

            <div class="driver-info-grid">

              ${infoCard(
                "Tarih",
                formatDate(
                  operation.pickup_datetime
                  ?? operation.scheduled_start_at
                )
              )}

              ${infoCard(
                "Müşteri",
                customerName
              )}

              ${infoCard(
                "Telefon",
                operation.customer_phone
                ?? "-"
              )}

              ${infoCard(
                "Uçuş",
                operation.flight_number
                  ? [
                      operation.flight_number,
                      operation.flight_datetime
                        ? formatTime(
                            operation.flight_datetime
                          )
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")
                  : "-"
              )}

              ${infoCard(
                "Yolcu",
                formatPax(operation)
              )}

              ${infoCard(
                "Bagaj",
                String(
                  operation.luggage_count
                  ?? 0
                )
              )}

            </div>

            <div class="driver-vehicle-card">

              <span>
                ATANAN ARAÇ
              </span>

              <strong>
                ${escapeHtml(
                  [
                    operation.vehicle_brand,
                    operation.vehicle_model,
                  ]
                    .filter(Boolean)
                    .join(" ")
                  || "Araç bilgisi yok"
                )}
              </strong>

              <p>
                ${escapeHtml(
                  operation.vehicle_plate
                  ?? "-"
                )}
                ${
                  operation.vehicle_class
                    ? ` • ${escapeHtml(
                        operation.vehicle_class
                      )}`
                    : ""
                }
              </p>

            </div>

            ${
              operation.pickup_sign
                ? `
                  <div class="driver-note-card">
                    <span>
                      KARŞILAMA TABELASI
                    </span>

                    <strong>
                      ${escapeHtml(
                        operation.pickup_sign
                      )}
                    </strong>
                  </div>
                `
                : ""
            }

            ${
              operation.special_request
              || operation.customer_note
              || operation.operation_note
                ? `
                  <div class="driver-note-card">

                    <span>
                      OPERASYON NOTU
                    </span>

                    <p>
                      ${escapeHtml(
                        [
                          operation.special_request,
                          operation.customer_note,
                          operation.operation_note,
                        ]
                          .filter(Boolean)
                          .join(" • ")
                      )}
                    </p>

                  </div>
                `
                : ""
            }

            <div class="driver-task-actions">

              ${
                operation.customer_phone
                  ? `
                    <a
                      href="tel:${escapeAttribute(
                        normalizePhone(
                          operation.customer_phone
                        )
                      )}"
                      class="driver-secondary-action"
                    >
                      Müşteriyi Ara
                    </a>

                    <a
                      href="${whatsappUrl(
                        operation.customer_phone
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="driver-secondary-action"
                    >
                      WhatsApp
                    </a>
                  `
                  : ""
              }

              ${
                operation.pickup_location
                  ? `
                    <a
                      href="${mapsUrl(
                        operation.pickup_location
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="driver-secondary-action"
                    >
                      Alış Konumuna Git
                    </a>
                  `
                  : ""
              }

              ${
                operation.dropoff_location
                  ? `
                    <a
                      href="${mapsUrl(
                        operation.dropoff_location
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="driver-secondary-action"
                    >
                      Bırakış Konumunu Aç
                    </a>
                  `
                  : ""
              }

            </div>

            ${
              operation.status === "assigned"
              || operation.status === "ready"
              || operation.status === "in_progress"
                ? `
                  <div class="driver-issue-actions">

                    <button
                      type="button"
                      data-driver-issue="delay"
                    >
                      Gecikme Bildir
                    </button>

                    <button
                      type="button"
                      data-driver-issue="passenger_missing"
                    >
                      Yolcu Bulunamadı
                    </button>

                    <button
                      type="button"
                      data-driver-issue="problem"
                    >
                      Sorun Bildir
                    </button>

                  </div>
                `
                : ""
            }

            ${actionButton(
              operation
            )}
          `;

          card
            .querySelectorAll<HTMLButtonElement>(
              "[data-driver-issue]"
            )
            .forEach(
              issueButton => {
                issueButton.addEventListener(
                  "click",
                  () => {
                    const value =
                      issueButton.dataset.driverIssue;

                    if (
                      value !== "delay" &&
                      value !== "passenger_missing" &&
                      value !== "problem"
                    ) {
                      return;
                    }

                    issueOperationId =
                      operation.id;

                    issueType =
                      value;

                    openIssueSheet(
                      value
                    );
                  },
                );
              },
            );

          const button =
            card.querySelector<
              HTMLButtonElement
            >("[data-driver-action]");

          button?.addEventListener(
            "click",
            async () => {
              const action =
                button.dataset.driverAction;

              button.disabled = true;

              try {
                if (
                  action === "accept"
                ) {
                  await acceptDriverOperation(
                    operation.id
                  );
                }

                if (
                  action === "start"
                ) {
                  await startDriverOperation(
                    operation.id
                  );
                }

                if (
                  action === "complete"
                ) {
                  await completeDriverOperation(
                    operation.id
                  );
                }

                await load();

              } catch (
                exception
              ) {
                alert(
                  exception instanceof Error
                    ? exception.message
                    : "İşlem başarısız."
                );

                button.disabled = false;
              }
            },
          );

          list.appendChild(
            card
          );
        },
      );

      list
        .querySelectorAll<HTMLButtonElement>(
          "[data-history-toggle]"
        )
        .forEach(
          button => {
            button.addEventListener(
              "click",
              () => {
                const detail =
                  button.nextElementSibling;

                if (
                  !(detail instanceof HTMLElement)
                ) {
                  return;
                }

                const willOpen =
                  detail.hidden;

                detail.hidden =
                  !willOpen;

                button.textContent =
                  willOpen
                    ? "Görev Detayını Gizle"
                    : "Görev Detayını Göster";
              },
            );
          },
        );

    } catch (exception) {
      list.textContent =
        exception instanceof Error
          ? exception.message
          : "Görevler yüklenemedi.";
    }
  }


  page
    .querySelectorAll<HTMLButtonElement>(
      "[data-driver-tab]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const value =
              button.dataset.driverTab;

            if (
              value !== "today" &&
              value !== "upcoming" &&
              value !== "completed"
            ) {
              return;
            }

            activeTab = value;

            page
              .querySelectorAll(
                ".driver-tab"
              )
              .forEach(
                tab =>
                  tab.classList.remove(
                    "active"
                  )
              );

            button.classList.add(
              "active"
            );

            if (!list) {
              return;
            }

            renderFiltered(
              list,
              cachedOperations,
              activeTab,
              load,
            );
          },
        );
      },
    );


  page
    .querySelector(
      "#driver-logout"
    )
    ?.addEventListener(
      "click",
      () => {
        driverLogout();

        history.pushState(
          {},
          "",
          "/driver/login"
        );

        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );
      },
    );


  function openIssueSheet(
    type:
      "delay" |
      "passenger_missing" |
      "problem",
  ): void {
    issueType = type;

    if (issueDescription) {
      issueDescription.value = "";
    }

    if (issueError) {
      issueError.hidden = true;
      issueError.textContent = "";
    }

    page
      .querySelectorAll<HTMLButtonElement>(
        "[data-issue-choice]"
      )
      .forEach(
        button => {
          button.classList.toggle(
            "active",
            button.dataset.issueChoice
              === type,
          );
        },
      );

    if (issueBackdrop) {
      issueBackdrop.hidden = false;
    }

    document.body.classList.add(
      "driver-modal-open"
    );
  }


  function closeIssueSheet(): void {
    if (issueBackdrop) {
      issueBackdrop.hidden = true;
    }

    issueOperationId = null;
    issueType = null;

    document.body.classList.remove(
      "driver-modal-open"
    );
  }


  page
    .querySelectorAll<HTMLButtonElement>(
      "[data-issue-choice]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const value =
              button.dataset.issueChoice;

            if (
              value !== "delay" &&
              value !== "passenger_missing" &&
              value !== "problem"
            ) {
              return;
            }

            issueType = value;

            page
              .querySelectorAll(
                "[data-issue-choice]"
              )
              .forEach(
                item =>
                  item.classList.remove(
                    "active"
                  )
              );

            button.classList.add(
              "active"
            );
          },
        );
      },
    );


  page
    .querySelector(
      "#driver-issue-close"
    )
    ?.addEventListener(
      "click",
      closeIssueSheet,
    );


  page
    .querySelector(
      "#driver-issue-cancel"
    )
    ?.addEventListener(
      "click",
      closeIssueSheet,
    );


  issueBackdrop
    ?.addEventListener(
      "click",
      event => {
        if (
          event.target ===
          issueBackdrop
        ) {
          closeIssueSheet();
        }
      },
    );


  page
    .querySelector<HTMLButtonElement>(
      "#driver-issue-submit"
    )
    ?.addEventListener(
      "click",
      async event => {
        const button =
          event.currentTarget;

        if (
          !(button instanceof HTMLButtonElement)
        ) {
          return;
        }

        if (
          !issueOperationId ||
          !issueType
        ) {
          return;
        }

        const description =
          issueDescription?.value.trim()
          ?? "";

        if (!description) {
          if (issueError) {
            issueError.hidden = false;
            issueError.textContent =
              "Açıklama alanı zorunludur.";
          }

          return;
        }

        button.disabled = true;

        try {
          await reportDriverIssue(
            issueOperationId,
            issueType,
            description,
          );

          closeIssueSheet();

          await load();

        } catch (exception) {
          if (issueError) {
            issueError.hidden = false;
            issueError.textContent =
              exception instanceof Error
                ? exception.message
                : "Bildirim gönderilemedi.";
          }
        } finally {
          button.disabled = false;
        }
      },
    );


  void load();

  return page;
}


function DriverLoginRedirect():
HTMLElement {
  const node =
    document.createElement(
      "div"
    );

  queueMicrotask(() => {
    window.dispatchEvent(
      new PopStateEvent(
        "popstate"
      )
    );
  });

  return node;
}


function updateDriverTabCounts(
  page: HTMLElement,
  operations: DriverOperation[],
): void {
  const tabs = {
    today:
      filterOperations(
        operations,
        "today"
      ).length,

    upcoming:
      filterOperations(
        operations,
        "upcoming"
      ).length,

    completed:
      filterOperations(
        operations,
        "completed"
      ).length,
  };

  const labels = {
    today: "Bugün",
    upcoming: "Yaklaşan",
    completed: "Tamamlanan",
  };

  Object.entries(tabs)
    .forEach(
      ([key, count]) => {
        const button =
          page.querySelector<HTMLButtonElement>(
            `[data-driver-tab="${key}"]`
          );

        if (!button) {
          return;
        }

        button.innerHTML = `
          <span>
            ${
              labels[
                key as keyof typeof labels
              ]
            }
          </span>

          <strong>
            ${count}
          </strong>
        `;
      },
    );
}


function renderDriverFocus(
  page: HTMLElement,
  operations: DriverOperation[],
): void {
  const host =
    page.querySelector<HTMLElement>(
      "#driver-focus"
    );

  if (!host) {
    return;
  }

  const active =
    operations.find(
      operation =>
        operation.status === "in_progress"
    );

  const ready =
    operations.find(
      operation =>
        operation.status === "ready"
    );

  const assigned =
    operations.find(
      operation =>
        operation.status === "assigned"
    );

  const focus =
    active
    ?? ready
    ?? assigned;

  if (!focus) {
    host.innerHTML = `
      <div class="driver-focus-empty">
        <span>AKTİF GÖREV</span>
        <strong>Bekleyen aktif görev yok</strong>
      </div>
    `;
    return;
  }

  const title =
    [
      focus.pickup_location,
      focus.dropoff_location,
    ]
      .filter(Boolean)
      .join(" → ")
    || "Operasyon";

  host.innerHTML = `
    <article class="driver-focus-card">

      <div class="driver-focus-head">
        <div>
          <span>
            ${
              focus.status === "in_progress"
                ? "AKTİF GÖREV"
                : focus.status === "ready"
                  ? "HAZIR GÖREV"
                  : "SIRADAKİ GÖREV"
            }
          </span>

          <strong>
            ${escapeHtml(title)}
          </strong>
        </div>

        <b>
          ${formatTime(
            focus.pickup_datetime
            ?? focus.scheduled_start_at
          )}
        </b>
      </div>

      <div class="driver-focus-meta">
        <span>
          ${
            focus.booking_code
              ? escapeHtml(
                  focus.booking_code
                )
              : "—"
          }
        </span>

        <span>
          ${escapeHtml(
            statusLabel(
              focus.status
            )
          )}
        </span>
      </div>

    </article>
  `;
}


function filterOperations(
  operations: DriverOperation[],
  tab:
    "today" |
    "upcoming" |
    "completed",
): DriverOperation[] {
  const now = new Date();

  const startOfToday =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

  const startOfTomorrow =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );

  return operations.filter(
    operation => {
      const raw =
        operation.pickup_datetime
        ?? operation.scheduled_start_at;

      const date =
        raw
          ? new Date(raw)
          : null;

      if (
        tab === "completed"
      ) {
        return (
          operation.status === "completed"
        );
      }

      if (
        operation.status === "completed"
      ) {
        return false;
      }

      if (
        !date ||
        Number.isNaN(
          date.getTime()
        )
      ) {
        return tab === "today";
      }

      if (
        tab === "today"
      ) {
        return (
          date >= startOfToday &&
          date < startOfTomorrow
        );
      }

      return (
        tab === "upcoming" &&
        date >= startOfTomorrow
      );
    },
  );
}


function renderFiltered(
  host: HTMLElement,
  operations: DriverOperation[],
  tab:
    "today" |
    "upcoming" |
    "completed",
  reload: () => Promise<void>,
): void {
  const filtered =
    filterOperations(
      operations,
      tab,
    );

  if (!filtered.length) {
    host.innerHTML = `
      <div class="driver-empty">
        Bu bölümde görev bulunmuyor.
      </div>
    `;

    return;
  }

  void reload();
}


function completedOperationCard(
  operation: DriverOperation,
): string {
  const route =
    [
      operation.pickup_location,
      operation.dropoff_location,
    ]
      .filter(Boolean)
      .join(" → ")
    || "Operasyon";

  const customer =
    [
      operation.customer_first_name,
      operation.customer_last_name,
    ]
      .filter(Boolean)
      .join(" ")
    || "Müşteri";

  return `
    <div class="driver-compact-head">

      <div>
        <span class="driver-operation-status">
          TAMAMLANDI
        </span>

        <small>
          ${escapeHtml(
            operation.booking_code
            ?? operation.id
          )}
        </small>
      </div>

      <strong>
        ${formatTime(
          operation.pickup_datetime
          ?? operation.scheduled_start_at
        )}
      </strong>

    </div>

    <h3 class="driver-compact-route">
      ${escapeHtml(route)}
    </h3>

    <div class="driver-compact-meta">

      <span>
        ${formatDate(
          operation.pickup_datetime
          ?? operation.scheduled_start_at
        )}
      </span>

      <span>
        ${escapeHtml(customer)}
      </span>

      ${
        operation.vehicle_plate
          ? `
            <span>
              ${escapeHtml(
                operation.vehicle_plate
              )}
            </span>
          `
          : ""
      }

    </div>

    <button
      type="button"
      class="driver-history-toggle"
      data-history-toggle
    >
      Görev Detayını Göster
    </button>

    <div
      class="driver-history-detail"
      hidden
    >
      ${
        operation.flight_number
          ? `
            <div>
              <span>Uçuş</span>
              <strong>
                ${escapeHtml(
                  operation.flight_number
                )}
              </strong>
            </div>
          `
          : ""
      }

      <div>
        <span>Yolcu</span>
        <strong>
          ${escapeHtml(
            formatPax(operation)
          )}
        </strong>
      </div>

      <div>
        <span>Bagaj</span>
        <strong>
          ${
            operation.luggage_count
            ?? 0
          }
        </strong>
      </div>

      <div>
        <span>Araç</span>
        <strong>
          ${escapeHtml(
            operation.vehicle_plate
            ?? "-"
          )}
        </strong>
      </div>

    </div>
  `;
}


function infoCard(
  label: string,
  value: string,
): string {
  return `
    <div class="driver-info-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>

    </div>
  `;
}


function actionButton(
  operation: DriverOperation,
): string {
  if (
    operation.status === "assigned"
  ) {
    return `
      <button
        class="driver-primary-action"
        data-driver-action="accept"
      >
        Görevi Kabul Et
      </button>
    `;
  }

  if (
    operation.status === "ready"
  ) {
    return `
      <button
        class="driver-primary-action"
        data-driver-action="start"
      >
        Operasyonu Başlat
      </button>
    `;
  }

  if (
    operation.status === "in_progress"
  ) {
    return `
      <button
        class="driver-primary-action danger"
        data-driver-action="complete"
      >
        Operasyonu Tamamla
      </button>
    `;
  }

  if (
    operation.status === "completed"
  ) {
    return `
      <div class="driver-complete-state">
        Operasyon Tamamlandı
      </div>
    `;
  }

  return "";
}


function statusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    assigned: "Atandı",
    ready: "Hazır",
    in_progress: "Operasyonda",
    completed: "Tamamlandı",
    problem: "Sorun",
    cancelled: "İptal",
  };

  return labels[status] ?? status;
}


function formatPax(
  operation: DriverOperation,
): string {
  const parts: string[] = [];

  if (
    operation.pax_adult
  ) {
    parts.push(
      `${operation.pax_adult} yetişkin`
    );
  }

  if (
    operation.pax_child
  ) {
    parts.push(
      `${operation.pax_child} çocuk`
    );
  }

  if (
    operation.pax_infant
  ) {
    parts.push(
      `${operation.pax_infant} bebek`
    );
  }

  if (parts.length) {
    return parts.join(" • ");
  }

  if (operation.pax) {
    return `${operation.pax} kişi`;
  }

  return "-";
}


function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

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
    },
  ).format(date);
}


function formatTime(
  value?: string | null,
): string {
  if (!value) {
    return "--:--";
  }

  const date =
    new Date(value);

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
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(date);
}


function mapsUrl(
  location: string,
): string {
  return (
    "https://www.google.com/maps/search/?api=1&query="
    + encodeURIComponent(location)
  );
}


function whatsappUrl(
  phone: string,
): string {
  const normalized =
    normalizePhone(phone)
      .replace(/^\+/, "");

  return (
    "https://wa.me/"
    + encodeURIComponent(
        normalized
      )
  );
}



function normalizePhone(
  value: string,
): string {
  return value.replace(
    /[^+\d]/g,
    ""
  );
}


function escapeAttribute(
  value: string,
): string {
  return escapeHtml(value);
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}
