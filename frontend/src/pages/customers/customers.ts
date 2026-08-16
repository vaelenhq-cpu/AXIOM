import {
  createCustomer,
  getCustomers,
  searchCustomers,
  updateCustomer,
  type Customer,
} from "../../api/customers";

import "./customers.css";


export function CustomersPage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "customers-page";

  page.innerHTML = `
    <header class="page-header customers-header">

      <div>
        <span class="page-overline">
          MÜŞTERİ YÖNETİMİ
        </span>

        <h1>
          Müşteriler
        </h1>

        <p>
          Yolcu ve müşteri kayıtlarını
          tek merkezden yönetin.
        </p>
      </div>

      <button
        type="button"
        class="customer-create-button"
        id="customer-create-button"
      >
        + Yeni Müşteri
      </button>

    </header>


    <section class="customer-toolbar">

      <input
        id="customer-search"
        type="search"
        placeholder="Ad, telefon veya e-posta ara..."
      >

      <div
        class="customer-count"
        id="customer-count"
      >
        0 müşteri
      </div>

    </section>


    <section
      class="customer-list-panel"
    >
      <div
        id="customer-loading"
        class="customer-state"
      >
        Müşteriler yükleniyor...
      </div>

      <div
        id="customer-empty"
        class="customer-state"
        hidden
      >
        Müşteri bulunamadı.
      </div>

      <div
        id="customer-list"
        class="customer-list"
        hidden
      ></div>
    </section>


    <div
      class="customer-overlay"
      id="customer-overlay"
      hidden
    ></div>

    <aside
      class="customer-drawer"
      id="customer-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const list =
    page.querySelector<HTMLElement>(
      "#customer-list"
    );

  const loading =
    page.querySelector<HTMLElement>(
      "#customer-loading"
    );

  const empty =
    page.querySelector<HTMLElement>(
      "#customer-empty"
    );

  const count =
    page.querySelector<HTMLElement>(
      "#customer-count"
    );

  const search =
    page.querySelector<HTMLInputElement>(
      "#customer-search"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#customer-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#customer-overlay"
    );

  let customers:
    Customer[] = [];

  let searchTimer:
    number | undefined;


  function render():
  void {
    if (
      !list ||
      !empty ||
      !count
    ) {
      return;
    }

    count.textContent =
      `${customers.length} müşteri`;

    list.innerHTML = "";

    if (!customers.length) {
      list.hidden = true;
      empty.hidden = false;

      return;
    }

    empty.hidden = true;
    list.hidden = false;

    customers.forEach(
      customer => {
        const card =
          document.createElement(
            "button"
          );

        card.type =
          "button";

        card.className =
          "customer-row";

        const name =
          [
            customer.first_name,
            customer.last_name,
          ]
            .filter(Boolean)
            .join(" ");

        const initials =
          [
            customer.first_name,
            customer.last_name,
          ]
            .filter(Boolean)
            .map(
              value =>
                String(value)
                  .trim()
                  .charAt(0)
                  .toUpperCase()
            )
            .join("")
            .slice(0, 2);

        card.innerHTML = `
          <div class="customer-avatar">
            ${escapeHtml(
              initials || "M"
            )}
          </div>

          <div class="customer-primary">
            <strong>
              ${escapeHtml(name)}
            </strong>

            <span>
              ${
                customer.phone
                  ? escapeHtml(
                      customer.phone
                    )
                  : "Telefon yok"
              }
            </span>
          </div>

          <div class="customer-contact">
            <span>
              ${
                customer.email
                  ? escapeHtml(
                      customer.email
                    )
                  : "E-posta yok"
              }
            </span>

            <small>
              ${
                [
                  customer.nationality,
                  customer.language,
                ]
                  .filter(Boolean)
                  .map(
                    value =>
                      String(value)
                        .toUpperCase()
                  )
                  .join(" • ")
                || "—"
              }
            </small>
          </div>

          <span class="customer-row-arrow">
            ›
          </span>
        `;

        card.addEventListener(
          "click",
          () => {
            openCustomer(
              customer
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

    loading.hidden = false;

    try {
      customers =
        await getCustomers();

      loading.hidden = true;

      render();

    } catch (exception) {
      loading.textContent =
        exception instanceof Error
          ? exception.message
          : "Müşteriler yüklenemedi.";
    }
  }


  async function runSearch(
    value: string,
  ):
  Promise<void> {
    const query =
      value.trim();

    try {
      customers =
        query
          ? await searchCustomers(
              query
            )
          : await getCustomers();

      render();

    } catch (exception) {
      if (loading) {
        loading.hidden = false;

        loading.textContent =
          exception instanceof Error
            ? exception.message
            : "Arama başarısız.";
      }
    }
  }


  function openCustomer(
    customer?: Customer,
  ):
  void {
    if (
      !drawer ||
      !overlay
    ) {
      return;
    }

    const editing =
      Boolean(customer);

    overlay.hidden =
      false;

    drawer.classList.add(
      "customer-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML = `
      <header class="customer-drawer-head">

        <div>
          <span>
            ${
              editing
                ? "MÜŞTERİ KAYDI"
                : "YENİ MÜŞTERİ"
            }
          </span>

          <h2>
            ${
              editing
                ? escapeHtml(
                    [
                      customer?.first_name,
                      customer?.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  )
                : "Müşteri Oluştur"
            }
          </h2>
        </div>

        <button
          type="button"
          id="customer-close"
        >
          ×
        </button>

      </header>


      <form
        class="customer-form"
        id="customer-form"
      >

        <div class="customer-form-grid">

          ${field(
            "Ad",
            "first_name",
            customer?.first_name
            ?? "",
            true
          )}

          ${field(
            "Soyad",
            "last_name",
            customer?.last_name
            ?? ""
          )}

          ${field(
            "Telefon",
            "phone",
            customer?.phone
            ?? ""
          )}

          ${field(
            "E-posta",
            "email",
            customer?.email
            ?? "",
            false,
            "email"
          )}

          ${field(
            "Uyruk",
            "nationality",
            customer?.nationality
            ?? ""
          )}

          ${field(
            "Dil",
            "language",
            customer?.language
            ?? ""
          )}

        </div>


        <label class="customer-notes">
          <span>
            Notlar
          </span>

          <textarea
            name="notes"
            rows="5"
            placeholder="Müşteri hakkında operasyonel not..."
          >${escapeHtml(
            customer?.notes
            ?? ""
          )}</textarea>
        </label>


        <div
          class="customer-form-error"
          id="customer-form-error"
        ></div>


        <button
          type="submit"
          class="customer-save-button"
        >
          ${
            editing
              ? "Değişiklikleri Kaydet"
              : "Müşteri Oluştur"
          }
        </button>

      </form>
    `;


    drawer
      .querySelector(
        "#customer-close"
      )
      ?.addEventListener(
        "click",
        closeDrawer
      );


    const form =
      drawer.querySelector<HTMLFormElement>(
        "#customer-form"
      );

    form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const error =
          drawer.querySelector<HTMLElement>(
            "#customer-form-error"
          );

        const formData =
          new FormData(form);

        const firstName =
          String(
            formData.get(
              "first_name"
            )
            ?? ""
          ).trim();

        if (!firstName) {
          if (error) {
            error.textContent =
              "Ad alanı zorunludur.";
          }

          return;
        }

        const payload = {
          first_name:
            firstName,

          last_name:
            optionalValue(
              formData,
              "last_name"
            ),

          phone:
            optionalValue(
              formData,
              "phone"
            ),

          email:
            optionalValue(
              formData,
              "email"
            ),

          nationality:
            optionalValue(
              formData,
              "nationality"
            ),

          language:
            optionalValue(
              formData,
              "language"
            ),

          notes:
            optionalValue(
              formData,
              "notes"
            ),
        };


        const submit =
          form.querySelector<HTMLButtonElement>(
            ".customer-save-button"
          );

        if (submit) {
          submit.disabled =
            true;
        }

        try {
          if (
            editing &&
            customer
          ) {
            await updateCustomer(
              customer.id,
              payload
            );

          } else {
            await createCustomer(
              payload
            );
          }

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Müşteri kaydedilemedi.";
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
      "customer-drawer-open"
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
      window.clearTimeout(
        searchTimer
      );

      searchTimer =
        window.setTimeout(
          () => {
            void runSearch(
              search.value
            );
          },
          250,
        );
    },
  );


  page
    .querySelector(
      "#customer-create-button"
    )
    ?.addEventListener(
      "click",
      () => {
        openCustomer();
      },
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
  value: string,
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
        value="${escapeHtml(value)}"
        ${required ? "required" : ""}
      >
    </label>
  `;
}


function optionalValue(
  data: FormData,
  key: string,
):
string | null {
  const value =
    String(
      data.get(key)
      ?? ""
    ).trim();

  return value || null;
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
