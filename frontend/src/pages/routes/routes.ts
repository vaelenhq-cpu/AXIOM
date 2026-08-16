import {
  createRoute,
  getRoutes,
  type RouteItem,
} from "../../api/routes";

import "./routes.css";


export function RoutesPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "routes-page";

  page.innerHTML = `
    <header class="page-header routes-header">

      <div>
        <span class="page-overline">
          ROTA YÖNETİMİ
        </span>

        <h1>
          Rotalar
        </h1>

        <p>
          Transfer güzergâhlarını,
          mesafe ve süre bilgileriyle yönetin.
        </p>
      </div>

      <button
        type="button"
        class="route-create-button"
        id="route-create-button"
      >
        + Yeni Rota
      </button>

    </header>


    <section class="route-toolbar">

      <input
        id="route-search"
        type="search"
        placeholder="Rota, başlangıç veya varış ara..."
      >

      <div
        class="route-count"
        id="route-count"
      >
        0 rota
      </div>

    </section>


    <section class="route-list-panel">

      <div
        class="route-state"
        id="route-loading"
      >
        Rotalar yükleniyor...
      </div>

      <div
        class="route-state"
        id="route-empty"
        hidden
      >
        Henüz rota bulunmuyor.
      </div>

      <div
        class="route-list"
        id="route-list"
        hidden
      ></div>

    </section>


    <div
      class="route-overlay"
      id="route-overlay"
      hidden
    ></div>

    <aside
      class="route-drawer"
      id="route-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const list =
    page.querySelector<HTMLElement>(
      "#route-list"
    );

  const loading =
    page.querySelector<HTMLElement>(
      "#route-loading"
    );

  const empty =
    page.querySelector<HTMLElement>(
      "#route-empty"
    );

  const count =
    page.querySelector<HTMLElement>(
      "#route-count"
    );

  const search =
    page.querySelector<HTMLInputElement>(
      "#route-search"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#route-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#route-overlay"
    );

  let routes:
    RouteItem[] = [];

  let query = "";


  function filtered():
  RouteItem[] {
    const value =
      query
        .trim()
        .toLocaleLowerCase(
          "tr-TR"
        );

    if (!value) {
      return routes;
    }

    return routes.filter(
      route => {
        const haystack =
          [
            route.name,
            route.code,
            route.origin_name,
            route.origin_code,
            route.destination_name,
            route.destination_code,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase(
              "tr-TR"
            );

        return haystack.includes(
          value
        );
      },
    );
  }


  function render():
  void {
    if (
      !list ||
      !empty ||
      !count
    ) {
      return;
    }

    const records =
      filtered();

    count.textContent =
      `${records.length} rota`;

    list.innerHTML = "";

    if (!records.length) {
      list.hidden = true;
      empty.hidden = false;

      return;
    }

    empty.hidden = true;
    list.hidden = false;

    records.forEach(
      route => {
        const card =
          document.createElement(
            "article"
          );

        card.className =
          "route-card";

        card.innerHTML = `
          <div class="route-card-head">

            <div>
              ${
                route.code
                  ? `
                    <span class="route-code">
                      ${escapeHtml(
                        route.code
                      )}
                    </span>
                  `
                  : ""
              }

              <h3>
                ${escapeHtml(
                  route.name
                )}
              </h3>
            </div>

            <span class="route-active">
              Aktif
            </span>

          </div>


          <div class="route-line">

            <div>
              <span>BAŞLANGIÇ</span>

              <strong>
                ${escapeHtml(
                  route.origin_name
                )}
              </strong>

              ${
                route.origin_code
                  ? `
                    <small>
                      ${escapeHtml(
                        route.origin_code
                      )}
                    </small>
                  `
                  : ""
              }
            </div>

            <i>→</i>

            <div>
              <span>VARIŞ</span>

              <strong>
                ${escapeHtml(
                  route.destination_name
                )}
              </strong>

              ${
                route.destination_code
                  ? `
                    <small>
                      ${escapeHtml(
                        route.destination_code
                      )}
                    </small>
                  `
                  : ""
              }
            </div>

          </div>


          <div class="route-metrics">

            <div>
              <span>Mesafe</span>

              <strong>
                ${
                  route.distance_km != null
                    ? `${route.distance_km} km`
                    : "—"
                }
              </strong>
            </div>

            <div>
              <span>Tahmini Süre</span>

              <strong>
                ${durationLabel(
                  route
                    .estimated_duration_minutes
                )}
              </strong>
            </div>

          </div>
        `;

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

    loading.hidden = false;

    try {
      routes =
        await getRoutes();

      loading.hidden = true;

      render();

    } catch (exception) {
      loading.textContent =
        exception instanceof Error
          ? exception.message
          : "Rotalar yüklenemedi.";
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
      "route-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML = `
      <header class="route-drawer-head">

        <div>
          <span>
            YENİ ROTA
          </span>

          <h2>
            Rota Oluştur
          </h2>
        </div>

        <button
          type="button"
          id="route-close"
        >
          ×
        </button>

      </header>


      <form
        class="route-form"
        id="route-form"
      >

        ${field(
          "Rota Adı",
          "name",
          "Örn. Antalya Havalimanı → Belek",
          true
        )}

        <div class="route-form-grid">

          ${field(
            "Rota Kodu",
            "code",
            "Örn. AYT-BELEK"
          )}

          ${field(
            "Mesafe (km)",
            "distance_km",
            "Örn. 35",
            false,
            "number"
          )}

          ${field(
            "Başlangıç",
            "origin_name",
            "Antalya Havalimanı",
            true
          )}

          ${field(
            "Başlangıç Kodu",
            "origin_code",
            "AYT"
          )}

          ${field(
            "Varış",
            "destination_name",
            "Belek",
            true
          )}

          ${field(
            "Varış Kodu",
            "destination_code",
            "BELEK"
          )}

          ${field(
            "Tahmini Süre (dk)",
            "estimated_duration_minutes",
            "Örn. 40",
            false,
            "number"
          )}

        </div>


        <div
          class="route-form-error"
          id="route-form-error"
        ></div>


        <button
          type="submit"
          class="route-save-button"
        >
          Rotayı Oluştur
        </button>

      </form>
    `;


    drawer
      .querySelector(
        "#route-close"
      )
      ?.addEventListener(
        "click",
        closeDrawer
      );


    const form =
      drawer.querySelector<HTMLFormElement>(
        "#route-form"
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
            "#route-form-error"
          );

        const name =
          value(
            data,
            "name"
          );

        const origin =
          value(
            data,
            "origin_name"
          );

        const destination =
          value(
            data,
            "destination_name"
          );

        if (
          !name ||
          !origin ||
          !destination
        ) {
          if (error) {
            error.textContent =
              "Rota adı, başlangıç ve varış zorunludur.";
          }

          return;
        }

        const button =
          form.querySelector<HTMLButtonElement>(
            ".route-save-button"
          );

        if (button) {
          button.disabled =
            true;
        }

        try {
          await createRoute({
            name,

            code:
              value(
                data,
                "code"
              )
              || null,

            origin_name:
              origin,

            origin_code:
              value(
                data,
                "origin_code"
              )
              || null,

            destination_name:
              destination,

            destination_code:
              value(
                data,
                "destination_code"
              )
              || null,

            distance_km:
              numberValue(
                data,
                "distance_km"
              ),

            estimated_duration_minutes:
              integerValue(
                data,
                "estimated_duration_minutes"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Rota oluşturulamadı.";
          }

          if (button) {
            button.disabled =
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
      "route-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "true"
    );

    overlay.hidden =
      true;
  }


  search?.addEventListener(
    "input",
    () => {
      query =
        search.value;

      render();
    },
  );


  page
    .querySelector(
      "#route-create-button"
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
            ? 'min="0" step="any"'
            : ""
        }
      >
    </label>
  `;
}


function value(
  data: FormData,
  key: string,
): string {
  return String(
    data.get(key)
    ?? ""
  ).trim();
}


function numberValue(
  data: FormData,
  key: string,
): number | null {
  const raw =
    value(
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
  const number =
    numberValue(
      data,
      key
    );

  return number == null
    ? null
    : Math.round(number);
}


function durationLabel(
  minutes?:
    number | null,
): string {
  if (
    minutes == null
  ) {
    return "—";
  }

  if (
    minutes < 60
  ) {
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
