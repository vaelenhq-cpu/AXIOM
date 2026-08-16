import {
  createTourDeparture,
  createTourProduct,
  getTourDepartures,
  getTourProducts,
  type TourDeparture,
  type TourProduct,
} from "../../api/tours";

import "./tours.css";


export function ToursPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "tours-page";

  page.innerHTML = `
    <header class="page-header tours-header">

      <div>
        <span class="page-overline">
          TUR YÖNETİMİ
        </span>

        <h1>
          Turlar
        </h1>

        <p>
          Tur ürünlerini ve planlanan
          kalkışları tek merkezden yönetin.
        </p>
      </div>

      <div class="tour-header-actions">

        <button
          type="button"
          class="tour-secondary-button"
          id="tour-departure-create"
        >
          + Yeni Kalkış
        </button>

        <button
          type="button"
          class="tour-primary-button"
          id="tour-product-create"
        >
          + Yeni Tur
        </button>

      </div>

    </header>


    <section class="tour-summary">

      <article>
        <span>
          Tur Ürünü
        </span>

        <strong
          id="tour-product-count"
        >
          0
        </strong>
      </article>

      <article>
        <span>
          Planlanan Kalkış
        </span>

        <strong
          id="tour-departure-count"
        >
          0
        </strong>
      </article>

      <article>
        <span>
          Hazır
        </span>

        <strong
          id="tour-ready-count"
        >
          0
        </strong>
      </article>

      <article>
        <span>
          Operasyonda
        </span>

        <strong
          id="tour-progress-count"
        >
          0
        </strong>
      </article>

    </section>


    <section class="tour-layout">

      <article class="tour-panel">

        <header class="tour-panel-head">
          <div>
            <span>
              ÜRÜNLER
            </span>

            <h2>
              Tur Ürünleri
            </h2>
          </div>
        </header>

        <div
          class="tour-state"
          id="tour-product-loading"
        >
          Tur ürünleri yükleniyor...
        </div>

        <div
          class="tour-product-list"
          id="tour-product-list"
          hidden
        ></div>

      </article>


      <article class="tour-panel">

        <header class="tour-panel-head">
          <div>
            <span>
              TAKVİM
            </span>

            <h2>
              Kalkışlar
            </h2>
          </div>
        </header>

        <div
          class="tour-state"
          id="tour-departure-loading"
        >
          Kalkışlar yükleniyor...
        </div>

        <div
          class="tour-departure-list"
          id="tour-departure-list"
          hidden
        ></div>

      </article>

    </section>


    <div
      class="tour-overlay"
      id="tour-overlay"
      hidden
    ></div>

    <aside
      class="tour-drawer"
      id="tour-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const productList =
    page.querySelector<HTMLElement>(
      "#tour-product-list"
    );

  const departureList =
    page.querySelector<HTMLElement>(
      "#tour-departure-list"
    );

  const productLoading =
    page.querySelector<HTMLElement>(
      "#tour-product-loading"
    );

  const departureLoading =
    page.querySelector<HTMLElement>(
      "#tour-departure-loading"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#tour-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#tour-overlay"
    );

  let products:
    TourProduct[] = [];

  let departures:
    TourDeparture[] = [];


  function productName(
    productId: string,
  ): string {
    const product =
      products.find(
        item =>
          item.id === productId
      );

    return product?.name
      ?? "Tur";
  }


  function renderSummary():
  void {
    setText(
      page,
      "#tour-product-count",
      products.length
    );

    setText(
      page,
      "#tour-departure-count",
      departures.filter(
        item =>
          item.status === "scheduled"
      ).length
    );

    setText(
      page,
      "#tour-ready-count",
      departures.filter(
        item =>
          item.status === "ready"
      ).length
    );

    setText(
      page,
      "#tour-progress-count",
      departures.filter(
        item =>
          item.status === "in_progress"
      ).length
    );
  }


  function renderProducts():
  void {
    if (!productList) {
      return;
    }

    productList.innerHTML = "";

    if (!products.length) {
      productList.hidden = false;

      productList.innerHTML = `
        <div class="tour-empty">
          Henüz tur ürünü bulunmuyor.
        </div>
      `;

      return;
    }

    productList.hidden = false;

    products.forEach(
      product => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "tour-product-card";

        card.innerHTML = `
          <div class="tour-product-head">

            <div>
              ${
                product.code
                  ? `
                    <span class="tour-code">
                      ${escapeHtml(
                        product.code
                      )}
                    </span>
                  `
                  : ""
              }

              <h3>
                ${escapeHtml(
                  product.name
                )}
              </h3>
            </div>

            <span class="tour-active">
              Aktif
            </span>

          </div>


          ${
            product.description
              ? `
                <p>
                  ${escapeHtml(
                    product.description
                  )}
                </p>
              `
              : ""
          }


          <div class="tour-product-meta">

            <div>
              <span>
                Süre
              </span>

              <strong>
                ${durationLabel(
                  product.duration_minutes
                )}
              </strong>
            </div>

            <div>
              <span>
                Varsayılan Kapasite
              </span>

              <strong>
                ${
                  product.default_capacity
                  ?? "—"
                }
              </strong>
            </div>

          </div>
        `;

        productList.appendChild(
          card
        );
      },
    );
  }


  function renderDepartures():
  void {
    if (!departureList) {
      return;
    }

    departureList.innerHTML = "";

    if (!departures.length) {
      departureList.hidden = false;

      departureList.innerHTML = `
        <div class="tour-empty">
          Henüz kalkış planlanmamış.
        </div>
      `;

      return;
    }

    departureList.hidden = false;

    departures
      .slice()
      .sort(
        (a, b) =>
          `${a.departure_date} ${a.departure_time ?? ""}`
            .localeCompare(
              `${b.departure_date} ${b.departure_time ?? ""}`
            )
      )
      .forEach(
        departure => {
          const card =
            document.createElement(
              "article"
            );

          card.className =
            "tour-departure-card";

          card.innerHTML = `
            <div class="tour-departure-date">

              <strong>
                ${escapeHtml(
                  formatDate(
                    departure.departure_date
                  )
                )}
              </strong>

              <span>
                ${escapeHtml(
                  departure.departure_time
                  ?? "--:--"
                )}
              </span>

            </div>


            <div class="tour-departure-main">

              <strong>
                ${escapeHtml(
                  departure.tour_name
                  ?? productName(
                    departure.tour_product_id
                  )
                )}
              </strong>

              <span>
                ${
                  departure.meeting_point
                    ? escapeHtml(
                        departure.meeting_point
                      )
                    : "Buluşma noktası yok"
                }
              </span>

            </div>


            <div class="tour-departure-right">

              <span class="
                tour-status
                tour-status-${escapeHtml(
                  departure.status
                )}
              ">
                ${escapeHtml(
                  statusLabel(
                    departure.status
                  )
                )}
              </span>

              <small>
                Kapasite:
                ${
                  departure.capacity
                  ?? "—"
                }
              </small>

            </div>
          `;

          departureList.appendChild(
            card
          );
        },
      );
  }


  async function load():
  Promise<void> {
    try {
      [
        products,
        departures,
      ] = await Promise.all([
        getTourProducts(),
        getTourDepartures(),
      ]);

      if (productLoading) {
        productLoading.hidden =
          true;
      }

      if (departureLoading) {
        departureLoading.hidden =
          true;
      }

      renderSummary();
      renderProducts();
      renderDepartures();

    } catch (exception) {
      const message =
        exception instanceof Error
          ? exception.message
          : "Tur verileri yüklenemedi.";

      if (productLoading) {
        productLoading.textContent =
          message;
      }

      if (departureLoading) {
        departureLoading.textContent =
          message;
      }
    }
  }


  function openProductDrawer():
  void {
    openDrawer(`
      <header class="tour-drawer-head">

        <div>
          <span>
            YENİ TUR
          </span>

          <h2>
            Tur Ürünü Oluştur
          </h2>
        </div>

        <button
          type="button"
          id="tour-close"
        >
          ×
        </button>

      </header>


      <form
        class="tour-form"
        id="tour-product-form"
      >

        ${field(
          "Tur Adı",
          "name",
          "Örn. Pamukkale Günlük Tur",
          true
        )}

        <div class="tour-form-grid">

          ${field(
            "Tur Kodu",
            "code",
            "PAM-01"
          )}

          ${field(
            "Süre (dk)",
            "duration_minutes",
            "720",
            false,
            "number"
          )}

          ${field(
            "Varsayılan Kapasite",
            "default_capacity",
            "20",
            false,
            "number"
          )}

        </div>


        <label>
          <span>
            Açıklama
          </span>

          <textarea
            name="description"
            rows="5"
            placeholder="Tur programı ve açıklaması..."
          ></textarea>
        </label>


        <div
          class="tour-form-error"
          id="tour-product-error"
        ></div>


        <button
          type="submit"
          class="tour-save-button"
        >
          Tur Ürününü Oluştur
        </button>

      </form>
    `);


    const form =
      drawer?.querySelector<HTMLFormElement>(
        "#tour-product-form"
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
          drawer?.querySelector<HTMLElement>(
            "#tour-product-error"
          );

        const name =
          textValue(
            data,
            "name"
          );

        if (!name) {
          if (error) {
            error.textContent =
              "Tur adı zorunludur.";
          }

          return;
        }

        try {
          await createTourProduct({
            name,

            code:
              optionalText(
                data,
                "code"
              ),

            description:
              optionalText(
                data,
                "description"
              ),

            duration_minutes:
              integerValue(
                data,
                "duration_minutes"
              ),

            default_capacity:
              integerValue(
                data,
                "default_capacity"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Tur oluşturulamadı.";
          }
        }
      },
    );
  }


  function openDepartureDrawer():
  void {
    if (!products.length) {
      alert(
        "Önce bir tur ürünü oluşturmalısınız."
      );

      return;
    }

    openDrawer(`
      <header class="tour-drawer-head">

        <div>
          <span>
            YENİ KALKIŞ
          </span>

          <h2>
            Tur Kalkışı Planla
          </h2>
        </div>

        <button
          type="button"
          id="tour-close"
        >
          ×
        </button>

      </header>


      <form
        class="tour-form"
        id="tour-departure-form"
      >

        <label>
          <span>
            Tur
          </span>

          <select
            name="tour_product_id"
            required
          >
            <option value="">
              Tur seç
            </option>

            ${products
              .map(
                product => `
                  <option
                    value="${escapeHtml(
                      product.id
                    )}"
                  >
                    ${escapeHtml(
                      product.name
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>


        <div class="tour-form-grid">

          <label>
            <span>
              Kalkış Tarihi
            </span>

            <input
              type="date"
              name="departure_date"
              required
            >
          </label>


          <label>
            <span>
              Kalkış Saati
            </span>

            <input
              type="time"
              name="departure_time"
            >
          </label>


          ${field(
            "Kapasite",
            "capacity",
            "20",
            false,
            "number"
          )}

        </div>


        ${field(
          "Buluşma Noktası",
          "meeting_point",
          "Örn. Otel önü / Ofis"
        )}


        <div
          class="tour-form-error"
          id="tour-departure-error"
        ></div>


        <button
          type="submit"
          class="tour-save-button"
        >
          Kalkışı Oluştur
        </button>

      </form>
    `);


    const form =
      drawer?.querySelector<HTMLFormElement>(
        "#tour-departure-form"
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
          drawer?.querySelector<HTMLElement>(
            "#tour-departure-error"
          );

        const productId =
          textValue(
            data,
            "tour_product_id"
          );

        const date =
          textValue(
            data,
            "departure_date"
          );

        if (
          !productId ||
          !date
        ) {
          if (error) {
            error.textContent =
              "Tur ve kalkış tarihi zorunludur.";
          }

          return;
        }

        try {
          await createTourDeparture({
            tour_product_id:
              productId,

            departure_date:
              date,

            departure_time:
              optionalText(
                data,
                "departure_time"
              ),

            capacity:
              integerValue(
                data,
                "capacity"
              ),

            meeting_point:
              optionalText(
                data,
                "meeting_point"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Kalkış oluşturulamadı.";
          }
        }
      },
    );
  }


  function openDrawer(
    html: string,
  ):
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
      "tour-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML =
      html;

    drawer
      .querySelector(
        "#tour-close"
      )
      ?.addEventListener(
        "click",
        closeDrawer
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
      "tour-drawer-open"
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
      "#tour-product-create"
    )
    ?.addEventListener(
      "click",
      openProductDrawer
    );


  page
    .querySelector(
      "#tour-departure-create"
    )
    ?.addEventListener(
      "click",
      openDepartureDrawer
    );


  overlay?.addEventListener(
    "click",
    closeDrawer
  );


  void load();

  return page;
}


function field(
  label: string,
  name: string,
  placeholder: string,
  required = false,
  type = "text",
): string {
  return `
    <label>
      <span>
        ${escapeHtml(label)}
      </span>

      <input
        type="${type}"
        name="${name}"
        placeholder="${escapeHtml(
          placeholder
        )}"
        ${required ? "required" : ""}
        ${
          type === "number"
            ? 'min="1" step="1"'
            : ""
        }
      >
    </label>
  `;
}


function setText(
  root: HTMLElement,
  selector: string,
  value: unknown,
): void {
  const node =
    root.querySelector<HTMLElement>(
      selector
    );

  if (node) {
    node.textContent =
      String(value ?? 0);
  }
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


function integerValue(
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

  const number =
    Number(raw);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return Math.round(
    number
  );
}


function durationLabel(
  minutes?:
    number | null,
): string {
  if (!minutes) {
    return "—";
  }

  if (minutes < 60) {
    return `${minutes} dk`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const rest =
    minutes % 60;

  return rest
    ? `${hours} sa ${rest} dk`
    : `${hours} sa`;
}


function statusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    scheduled: "Planlandı",
    ready: "Hazır",
    in_progress: "Operasyonda",
    completed: "Tamamlandı",
    cancelled: "İptal",
  };

  return labels[status]
    ?? status;
}


function formatDate(
  value: string,
): string {
  const date =
    new Date(
      `${value}T00:00:00`
    );

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
