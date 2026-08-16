import {
  createIntegration,
  getIntegrations,
  updateIntegrationStatus,
  type Integration,
  type IntegrationStatus,
} from "../../api/integrations";

import "./integrations.css";


export function IntegrationsPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "integrations-page";

  page.innerHTML = `
    <header class="page-header integrations-header">

      <div>
        <span class="page-overline">
          BAĞLANTILAR
        </span>

        <h1>
          Entegrasyonlar
        </h1>

        <p>
          Web sitesi, API, tur operatörü,
          ödeme ve mesajlaşma bağlantılarını yönetin.
        </p>
      </div>

      <button
        type="button"
        class="integration-create-button"
        id="integration-create-button"
      >
        + Yeni Entegrasyon
      </button>

    </header>


    <section
      class="integration-summary"
      id="integration-summary"
    ></section>


    <section class="integration-list-panel">

      <div
        class="integration-state"
        id="integration-loading"
      >
        Entegrasyonlar yükleniyor...
      </div>

      <div
        class="integration-list"
        id="integration-list"
        hidden
      ></div>

    </section>


    <div
      class="integration-overlay"
      id="integration-overlay"
      hidden
    ></div>

    <aside
      class="integration-drawer"
      id="integration-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const list =
    page.querySelector<HTMLElement>(
      "#integration-list"
    );

  const loading =
    page.querySelector<HTMLElement>(
      "#integration-loading"
    );

  const summary =
    page.querySelector<HTMLElement>(
      "#integration-summary"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#integration-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#integration-overlay"
    );

  let integrations:
    Integration[] = [];


  function count(
    status: IntegrationStatus,
  ): number {
    return integrations.filter(
      item =>
        item.status === status
    ).length;
  }


  function renderSummary():
  void {
    if (!summary) {
      return;
    }

    summary.innerHTML = `
      ${summaryCard(
        "Toplam",
        integrations.length
      )}

      ${summaryCard(
        "Aktif",
        count("active")
      )}

      ${summaryCard(
        "Pasif",
        count("inactive")
      )}

      ${summaryCard(
        "Hata",
        count("error")
      )}

      ${summaryCard(
        "Devre Dışı",
        count("disabled")
      )}
    `;
  }


  function render():
  void {
    if (!list) {
      return;
    }

    list.innerHTML = "";

    if (!integrations.length) {
      list.hidden = false;

      list.innerHTML = `
        <div class="integration-empty">
          Henüz entegrasyon bulunmuyor.
        </div>
      `;

      return;
    }

    list.hidden = false;

    integrations.forEach(
      integration => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "integration-card";

        card.innerHTML = `
          <div class="integration-card-head">

            <div class="integration-identity">

              <span
                class="integration-type integration-type-${escapeHtml(
                  integration.integration_type
                )}"
              >
                ${escapeHtml(
                  typeLabel(
                    integration.integration_type
                  )
                )}
              </span>

              <div>
                <strong>
                  ${escapeHtml(
                    integration.name
                  )}
                </strong>

                <span>
                  ${escapeHtml(
                    integration.provider
                  )}
                </span>
              </div>

            </div>

            <span
              class="integration-status integration-status-${escapeHtml(
                integration.status
              )}"
            >
              ${escapeHtml(
                statusLabel(
                  integration.status
                )
              )}
            </span>

          </div>


          <div class="integration-details">

            <div>
              <span>Sync Modu</span>

              <strong>
                ${escapeHtml(
                  syncLabel(
                    integration.sync_mode
                  )
                )}
              </strong>
            </div>

            <div>
              <span>Harici Hesap</span>

              <strong>
                ${escapeHtml(
                  integration.external_account_id
                  ?? "—"
                )}
              </strong>
            </div>

            <div>
              <span>Son Sync</span>

              <strong>
                ${formatDate(
                  integration.last_sync_at
                )}
              </strong>
            </div>

            <div>
              <span>Son Başarı</span>

              <strong>
                ${formatDate(
                  integration.last_success_at
                )}
              </strong>
            </div>

          </div>


          ${
            integration.base_url
              ? `
                <div class="integration-url">
                  ${escapeHtml(
                    integration.base_url
                  )}
                </div>
              `
              : ""
          }


          <div class="integration-state-box">
            ${frameworkMessage(
              integration
            )}
          </div>


          <div class="integration-actions">

            ${statusButton(
              integration,
              "active",
              "Aktifleştir"
            )}

            ${statusButton(
              integration,
              "inactive",
              "Pasife Al"
            )}

            ${statusButton(
              integration,
              "disabled",
              "Devre Dışı"
            )}

          </div>


          <div
            class="integration-card-error"
          ></div>
        `;


        card
          .querySelectorAll<HTMLButtonElement>(
            "[data-integration-status]"
          )
          .forEach(
            button => {
              button.addEventListener(
                "click",
                async () => {
                  const status =
                    (
                      button.dataset.integrationStatus
                    ) as IntegrationStatus;

                  button.disabled =
                    true;

                  const error =
                    card.querySelector<HTMLElement>(
                      ".integration-card-error"
                    );

                  if (error) {
                    error.textContent =
                      "";
                  }

                  try {
                    await updateIntegrationStatus(
                      integration.id,
                      status
                    );

                    await load();

                  } catch (exception) {
                    if (error) {
                      error.textContent =
                        exception instanceof Error
                          ? exception.message
                          : "Durum değiştirilemedi.";
                    }

                    button.disabled =
                      false;
                  }
                },
              );
            },
          );


        list.appendChild(
          card
        );
      },
    );
  }


  async function load():
  Promise<void> {
    if (!loading) {
      return;
    }

    loading.hidden =
      false;

    try {
      integrations =
        await getIntegrations();

      loading.hidden =
        true;

      renderSummary();
      render();

    } catch (exception) {
      loading.textContent =
        exception instanceof Error
          ? exception.message
          : "Entegrasyonlar yüklenemedi.";
    }
  }


  function openCreateDrawer():
  void {
    if (
      !drawer ||
      !overlay
    ) {
      return;
    }

    overlay.hidden =
      false;

    drawer.classList.add(
      "integration-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML = `
      <header class="integration-drawer-head">

        <div>
          <span>
            YENİ ENTEGRASYON
          </span>

          <h2>
            Bağlantı Oluştur
          </h2>
        </div>

        <button
          type="button"
          id="integration-close"
        >
          ×
        </button>

      </header>


      <form
        class="integration-form"
        id="integration-form"
      >

        <label>
          <span>
            Entegrasyon Adı
          </span>

          <input
            name="name"
            placeholder="Örn. Asel Web Booking"
            required
          >
        </label>


        <div class="integration-form-grid">

          <label>
            <span>
              Sağlayıcı
            </span>

            <input
              name="provider"
              placeholder="Örn. Pegas"
              required
            >
          </label>


          <label>
            <span>
              Tür
            </span>

            <select
              name="integration_type"
              required
            >
              <option value="website">
                Web Sitesi
              </option>

              <option value="api">
                API
              </option>

              <option value="b2b">
                B2B
              </option>

              <option value="tour_operator">
                Tur Operatörü
              </option>

              <option value="payment">
                Ödeme
              </option>

              <option value="messaging">
                Mesajlaşma
              </option>

              <option value="other">
                Diğer
              </option>
            </select>
          </label>


          <label>
            <span>
              Sync Modu
            </span>

            <select
              name="sync_mode"
            >
              <option value="manual">
                Manuel
              </option>

              <option value="scheduled">
                Zamanlanmış
              </option>

              <option value="webhook">
                Webhook
              </option>

              <option value="realtime">
                Gerçek Zamanlı
              </option>
            </select>
          </label>


          <label>
            <span>
              Harici Hesap ID
            </span>

            <input
              name="external_account_id"
            >
          </label>

        </div>


        <label>
          <span>
            Base URL
          </span>

          <input
            name="base_url"
            placeholder="https://..."
          >
        </label>


        <label>
          <span>
            Secret Referansı
          </span>

          <input
            name="secret_ref"
            placeholder="secret/provider/account"
          >
        </label>


        <label>
          <span>
            Settings JSON
          </span>

          <textarea
            name="settings"
            rows="6"
            placeholder='{"hotel_id":"123"}'
          ></textarea>
        </label>


        <div
          class="integration-form-error"
          id="integration-form-error"
        ></div>


        <button
          type="submit"
          class="integration-save-button"
        >
          Entegrasyonu Oluştur
        </button>

      </form>
    `;


    drawer
      .querySelector(
        "#integration-close"
      )
      ?.addEventListener(
        "click",
        closeDrawer
      );


    const form =
      drawer.querySelector<HTMLFormElement>(
        "#integration-form"
      );

    form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const data =
          new FormData(
            form
          );

        const error =
          drawer.querySelector<HTMLElement>(
            "#integration-form-error"
          );

        const name =
          textValue(
            data,
            "name"
          );

        const provider =
          textValue(
            data,
            "provider"
          );

        if (
          !name ||
          !provider
        ) {
          if (error) {
            error.textContent =
              "Entegrasyon adı ve sağlayıcı zorunludur.";
          }

          return;
        }

        let settings:
          Record<string, unknown>
          | null = null;

        const settingsRaw =
          textValue(
            data,
            "settings"
          );

        if (settingsRaw) {
          try {
            const parsed =
              JSON.parse(
                settingsRaw
              );

            if (
              typeof parsed !== "object"
              || parsed === null
              || Array.isArray(
                parsed
              )
            ) {
              throw new Error();
            }

            settings =
              parsed;

          } catch {
            if (error) {
              error.textContent =
                "Settings alanı geçerli bir JSON nesnesi olmalıdır.";
            }

            return;
          }
        }


        const submit =
          form.querySelector<HTMLButtonElement>(
            ".integration-save-button"
          );

        if (submit) {
          submit.disabled =
            true;
        }


        try {
          await createIntegration({
            name,

            provider,

            integration_type:
              textValue(
                data,
                "integration_type"
              ) as
                | "website"
                | "api"
                | "b2b"
                | "tour_operator"
                | "payment"
                | "messaging"
                | "other",

            sync_mode:
              textValue(
                data,
                "sync_mode"
              ) as
                | "manual"
                | "scheduled"
                | "webhook"
                | "realtime",

            base_url:
              optionalText(
                data,
                "base_url"
              ),

            external_account_id:
              optionalText(
                data,
                "external_account_id"
              ),

            secret_ref:
              optionalText(
                data,
                "secret_ref"
              ),

            settings,
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Entegrasyon oluşturulamadı.";
          }

          if (submit) {
            submit.disabled =
              false;
          }
        }
      },
    );
  }


  function closeDrawer():
  void {
    if (
      !drawer ||
      !overlay
    ) {
      return;
    }

    drawer.classList.remove(
      "integration-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );

    overlay.hidden =
      true;
  }


  page
    .querySelector(
      "#integration-create-button"
    )
    ?.addEventListener(
      "click",
      openCreateDrawer
    );


  overlay?.addEventListener(
    "click",
    closeDrawer
  );


  void load();

  return page;
}


function frameworkMessage(
  integration: Integration,
): string {
  if (
    integration.status === "error"
  ) {
    return `
      <strong>
        Bağlantı hatası
      </strong>

      <span>
        Sağlayıcı bağlantısı kontrol edilmeli.
      </span>
    `;
  }

  if (
    integration.status === "active"
  ) {
    return `
      <strong>
        Entegrasyon aktif
      </strong>

      <span>
        AXIOM kayıtları bu bağlantı üzerinden işleyebilir.
      </span>
    `;
  }

  return `
    <strong>
      Framework hazır
    </strong>

    <span>
      Gerçek sağlayıcı bağlantısı aktifleştirilmeden veri senkronizasyonu başlamaz.
    </span>
  `;
}


function statusButton(
  integration: Integration,
  status: IntegrationStatus,
  label: string,
): string {
  if (
    integration.status === status
  ) {
    return "";
  }

  return `
    <button
      type="button"
      data-integration-status="${status}"
    >
      ${escapeHtml(label)}
    </button>
  `;
}


function summaryCard(
  label: string,
  value: number,
): string {
  return `
    <article>
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${value}
      </strong>
    </article>
  `;
}


function typeLabel(
  value: string,
): string {
  const labels:
  Record<string, string> = {
    website:
      "WEB",

    api:
      "API",

    b2b:
      "B2B",

    tour_operator:
      "TUR OPERATÖRÜ",

    payment:
      "ÖDEME",

    messaging:
      "MESAJLAŞMA",

    other:
      "DİĞER",
  };

  return labels[value]
    ?? value;
}


function statusLabel(
  value: string,
): string {
  const labels:
  Record<string, string> = {
    inactive:
      "Pasif",

    active:
      "Aktif",

    error:
      "Hata",

    disabled:
      "Devre Dışı",
  };

  return labels[value]
    ?? value;
}


function syncLabel(
  value: string,
): string {
  const labels:
  Record<string, string> = {
    manual:
      "Manuel",

    scheduled:
      "Zamanlanmış",

    webhook:
      "Webhook",

    realtime:
      "Gerçek Zamanlı",
  };

  return labels[value]
    ?? value;
}


function textValue(
  data: FormData,
  key: string,
): string {
  return String(
    data.get(key)
    ?? ""
  ).trim();
}


function optionalText(
  data: FormData,
  key: string,
): string | null {
  const value =
    textValue(
      data,
      key
    );

  return value || null;
}


function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "—";
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
      dateStyle: "short",
      timeStyle: "short",
    },
  ).format(
    date
  );
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
