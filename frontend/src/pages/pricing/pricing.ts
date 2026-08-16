import {
  calculateRoutePrice,
  createRoutePricingRule,
  getPricingRules,
  type PricingRule,
} from "../../api/pricing";

import {
  getRoutes,
  type RouteItem,
} from "../../api/routes";

import "./pricing.css";


export function PricingPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "pricing-page";

  page.innerHTML = `
    <header class="page-header pricing-header">

      <div>
        <span class="page-overline">
          FİYATLANDIRMA
        </span>

        <h1>
          Fiyatlandırma
        </h1>

        <p>
          Rota ve araç sınıfına göre
          fiyat kurallarını yönetin.
        </p>
      </div>

      <button
        type="button"
        class="pricing-create-button"
        id="pricing-create-button"
      >
        + Yeni Fiyat Kuralı
      </button>

    </header>


    <section class="pricing-grid">

      <article class="pricing-panel">

        <header class="pricing-panel-head">
          <div>
            <span>AKTİF KURALLAR</span>

            <h2>
              Fiyat Kuralları
            </h2>
          </div>

          <strong
            id="pricing-count"
          >
            0
          </strong>
        </header>

        <div
          class="pricing-state"
          id="pricing-loading"
        >
          Kurallar yükleniyor...
        </div>

        <div
          class="pricing-list"
          id="pricing-list"
          hidden
        ></div>

      </article>


      <article class="pricing-panel">

        <header class="pricing-panel-head">
          <div>
            <span>HIZLI TEST</span>

            <h2>
              Fiyat Hesapla
            </h2>
          </div>
        </header>

        <form
          class="price-test-form"
          id="price-test-form"
        >

          <label>
            <span>Rota</span>

            <select
              name="route_id"
              id="price-test-route"
              required
            >
              <option value="">
                Rota seç
              </option>
            </select>
          </label>


          <label>
            <span>Araç Sınıfı</span>

            <input
              name="vehicle_class"
              placeholder="Örn. Vip Minivan"
            >
          </label>


          <button
            type="submit"
            class="price-test-button"
          >
            Fiyatı Hesapla
          </button>


          <div
            class="price-test-result"
            id="price-test-result"
          >
            Henüz hesaplama yapılmadı.
          </div>

        </form>

      </article>

    </section>


    <div
      class="pricing-overlay"
      id="pricing-overlay"
      hidden
    ></div>

    <aside
      class="pricing-drawer"
      id="pricing-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const list =
    page.querySelector<HTMLElement>(
      "#pricing-list"
    );

  const loading =
    page.querySelector<HTMLElement>(
      "#pricing-loading"
    );

  const count =
    page.querySelector<HTMLElement>(
      "#pricing-count"
    );

  const testRoute =
    page.querySelector<HTMLSelectElement>(
      "#price-test-route"
    );

  const testForm =
    page.querySelector<HTMLFormElement>(
      "#price-test-form"
    );

  const testResult =
    page.querySelector<HTMLElement>(
      "#price-test-result"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#pricing-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#pricing-overlay"
    );

  let routes:
    RouteItem[] = [];

  let rules:
    PricingRule[] = [];


  function routeName(
    routeId?: string | null,
  ): string {
    if (!routeId) {
      return "Rota yok";
    }

    const route =
      routes.find(
        item =>
          item.id === routeId
      );

    return route?.name
      ?? routeId;
  }


  function renderRules():
  void {
    if (
      !list ||
      !count
    ) {
      return;
    }

    count.textContent =
      String(
        rules.length
      );

    list.innerHTML = "";

    if (!rules.length) {
      list.hidden = false;

      list.innerHTML = `
        <div class="pricing-empty">
          Henüz fiyat kuralı bulunmuyor.
        </div>
      `;

      return;
    }

    list.hidden = false;

    rules.forEach(
      rule => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "pricing-rule-card";

        card.innerHTML = `
          <div class="pricing-rule-head">

            <div>
              <span>
                ${escapeHtml(
                  rule.rule_type
                    .toUpperCase()
                )}
              </span>

              <strong>
                ${escapeHtml(
                  rule.name
                )}
              </strong>
            </div>

            <strong class="pricing-rule-price">
              ${money(
                rule.base_price,
                rule.currency
              )}
            </strong>

          </div>


          <div class="pricing-rule-route">
            ${escapeHtml(
              routeName(
                rule.route_id
              )
            )}
          </div>


          <div class="pricing-rule-meta">

            <span>
              Araç:
              ${escapeHtml(
                rule.vehicle_class
                ?? "Tüm sınıflar"
              )}
            </span>

            <span>
              Öncelik:
              ${rule.priority}
            </span>

            ${
              rule.valid_from
                ? `
                  <span>
                    Başlangıç:
                    ${escapeHtml(
                      rule.valid_from
                    )}
                  </span>
                `
                : ""
            }

            ${
              rule.valid_until
                ? `
                  <span>
                    Bitiş:
                    ${escapeHtml(
                      rule.valid_until
                    )}
                  </span>
                `
                : ""
            }

          </div>
        `;

        list.appendChild(
          card
        );
      },
    );
  }


  function renderRouteOptions():
  void {
    if (!testRoute) {
      return;
    }

    testRoute.innerHTML = `
      <option value="">
        Rota seç
      </option>

      ${routes
        .map(
          route => `
            <option
              value="${escapeHtml(
                route.id
              )}"
            >
              ${escapeHtml(
                route.name
              )}
            </option>
          `
        )
        .join("")}
    `;
  }


  async function load():
  Promise<void> {
    if (!loading) {
      return;
    }

    loading.hidden = false;

    try {
      [
        routes,
        rules,
      ] = await Promise.all([
        getRoutes(),
        getPricingRules(),
      ]);

      loading.hidden = true;

      renderRouteOptions();

      renderRules();

    } catch (exception) {
      loading.textContent =
        exception instanceof Error
          ? exception.message
          : "Fiyatlandırma verileri yüklenemedi.";
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
      "pricing-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML = `
      <header class="pricing-drawer-head">

        <div>
          <span>
            YENİ FİYAT KURALI
          </span>

          <h2>
            Rota Fiyatı Oluştur
          </h2>
        </div>

        <button
          type="button"
          id="pricing-close"
        >
          ×
        </button>

      </header>


      <form
        class="pricing-form"
        id="pricing-form"
      >

        <label>
          <span>Kural Adı</span>

          <input
            name="name"
            placeholder="Örn. AYT → Belek VIP"
            required
          >
        </label>


        <label>
          <span>Rota</span>

          <select
            name="route_id"
            required
          >
            <option value="">
              Rota seç
            </option>

            ${routes
              .map(
                route => `
                  <option
                    value="${escapeHtml(
                      route.id
                    )}"
                  >
                    ${escapeHtml(
                      route.name
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>


        <div class="pricing-form-grid">

          <label>
            <span>Taban Fiyat</span>

            <input
              type="number"
              name="base_price"
              min="0"
              step="0.01"
              required
            >
          </label>


          <label>
            <span>Para Birimi</span>

            <select name="currency">
              <option value="TRY">
                TRY
              </option>

              <option value="EUR">
                EUR
              </option>

              <option value="USD">
                USD
              </option>

              <option value="GBP">
                GBP
              </option>
            </select>
          </label>


          <label>
            <span>Araç Sınıfı</span>

            <input
              name="vehicle_class"
              placeholder="Vip Minivan"
            >
          </label>


          <label>
            <span>Öncelik</span>

            <input
              type="number"
              name="priority"
              min="0"
              value="100"
            >
          </label>


          <label>
            <span>Geçerli Başlangıç</span>

            <input
              type="datetime-local"
              name="valid_from"
            >
          </label>


          <label>
            <span>Geçerli Bitiş</span>

            <input
              type="datetime-local"
              name="valid_until"
            >
          </label>

        </div>


        <div
          class="pricing-form-error"
          id="pricing-form-error"
        ></div>


        <button
          type="submit"
          class="pricing-save-button"
        >
          Fiyat Kuralını Oluştur
        </button>

      </form>
    `;


    drawer
      .querySelector(
        "#pricing-close"
      )
      ?.addEventListener(
        "click",
        closeDrawer
      );


    const form =
      drawer.querySelector<HTMLFormElement>(
        "#pricing-form"
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
            "#pricing-form-error"
          );

        const name =
          textValue(
            data,
            "name"
          );

        const routeId =
          textValue(
            data,
            "route_id"
          );

        const basePrice =
          numberValue(
            data,
            "base_price"
          );

        if (
          !name ||
          !routeId ||
          basePrice == null
        ) {
          if (error) {
            error.textContent =
              "Kural adı, rota ve fiyat zorunludur.";
          }

          return;
        }

        const submit =
          form.querySelector<HTMLButtonElement>(
            ".pricing-save-button"
          );

        if (submit) {
          submit.disabled =
            true;
        }

        try {
          await createRoutePricingRule({
            name,

            route_id:
              routeId,

            base_price:
              basePrice,

            vehicle_class:
              optionalText(
                data,
                "vehicle_class"
              ),

            currency:
              textValue(
                data,
                "currency"
              )
              || "TRY",

            priority:
              integerValue(
                data,
                "priority"
              )
              ?? 100,

            valid_from:
              optionalText(
                data,
                "valid_from"
              ),

            valid_until:
              optionalText(
                data,
                "valid_until"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Fiyat kuralı oluşturulamadı.";
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
      "pricing-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );

    overlay.hidden =
      true;
  }


  testForm?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      if (!testResult) {
        return;
      }

      const data =
        new FormData(
          testForm
        );

      const routeId =
        textValue(
          data,
          "route_id"
        );

      const vehicleClass =
        optionalText(
          data,
          "vehicle_class"
        );

      if (!routeId) {
        testResult.textContent =
          "Önce rota seçmelisiniz.";

        return;
      }

      testResult.textContent =
        "Fiyat hesaplanıyor...";

      try {
        const result =
          await calculateRoutePrice(
            routeId,
            vehicleClass
          );

        testResult.innerHTML = `
          <span>
            HESAPLANAN FİYAT
          </span>

          <strong>
            ${money(
              result.amount,
              result.currency
            )}
          </strong>

          <small>
            Kural:
            ${escapeHtml(
              result.pricing_rule_id
            )}
          </small>
        `;

      } catch (exception) {
        testResult.textContent =
          exception instanceof Error
            ? exception.message
            : "Fiyat bulunamadı.";
      }
    },
  );


  page
    .querySelector(
      "#pricing-create-button"
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


function numberValue(
  data: FormData,
  key: string,
): number | null {
  const raw =
    textValue(
      data,
      key
    );

  if (!raw) {
    return null;
  }

  const parsed =
    Number(raw);

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function integerValue(
  data: FormData,
  key: string,
): number | null {
  const value =
    numberValue(
      data,
      key
    );

  return value == null
    ? null
    : Math.round(
        value
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
      Number(
        value || 0
      )
    );

  } catch {
    return `${value} ${currency}`;
  }
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
