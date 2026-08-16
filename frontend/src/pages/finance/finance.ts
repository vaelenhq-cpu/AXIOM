import {
  createFinanceTransaction,
  createPayment,
  getFinanceTransactions,
  getPayments,
  type FinanceTransaction,
  type Payment,
} from "../../api/finance";

import {
  getBookings,
  type BookingListItem,
} from "../../api/bookings";

import "./finance.css";


type CurrencyTotals =
  Record<
    string,
    number
  >;


export function FinancePage():
HTMLElement {
  const page =
    document.createElement(
      "section"
    );

  page.className =
    "finance-page";

  page.innerHTML = `
    <header class="page-header finance-header">

      <div>
        <span class="page-overline">
          FİNANS MERKEZİ
        </span>

        <h1>
          Finans
        </h1>

        <p>
          Tahsilatları, gelir-gider
          hareketlerini ve finans
          akışını yönetin.
        </p>
      </div>

      <div class="finance-header-actions">

        <button
          type="button"
          class="finance-secondary-button"
          id="finance-transaction-create"
        >
          + Finans Hareketi
        </button>

        <button
          type="button"
          class="finance-primary-button"
          id="finance-payment-create"
        >
          + Ödeme Kaydet
        </button>

      </div>

    </header>


    <section
      class="finance-summary"
      id="finance-summary"
    ></section>


    <section class="finance-layout">

      <article class="finance-panel">

        <header class="finance-panel-head">
          <div>
            <span>
              TAHSİLATLAR
            </span>

            <h2>
              Ödemeler
            </h2>
          </div>

          <strong
            id="finance-payment-count"
          >
            0
          </strong>
        </header>

        <div
          class="finance-state"
          id="finance-payment-loading"
        >
          Ödemeler yükleniyor...
        </div>

        <div
          class="finance-list"
          id="finance-payment-list"
          hidden
        ></div>

      </article>


      <article class="finance-panel">

        <header class="finance-panel-head">
          <div>
            <span>
              MUHASEBE
            </span>

            <h2>
              Finans Hareketleri
            </h2>
          </div>

          <strong
            id="finance-transaction-count"
          >
            0
          </strong>
        </header>

        <div
          class="finance-state"
          id="finance-transaction-loading"
        >
          Hareketler yükleniyor...
        </div>

        <div
          class="finance-list"
          id="finance-transaction-list"
          hidden
        ></div>

      </article>

    </section>


    <div
      class="finance-overlay"
      id="finance-overlay"
      hidden
    ></div>

    <aside
      class="finance-drawer"
      id="finance-drawer"
      aria-hidden="true"
    ></aside>
  `;


  const summary =
    page.querySelector<HTMLElement>(
      "#finance-summary"
    );

  const paymentList =
    page.querySelector<HTMLElement>(
      "#finance-payment-list"
    );

  const transactionList =
    page.querySelector<HTMLElement>(
      "#finance-transaction-list"
    );

  const paymentLoading =
    page.querySelector<HTMLElement>(
      "#finance-payment-loading"
    );

  const transactionLoading =
    page.querySelector<HTMLElement>(
      "#finance-transaction-loading"
    );

  const drawer =
    page.querySelector<HTMLElement>(
      "#finance-drawer"
    );

  const overlay =
    page.querySelector<HTMLElement>(
      "#finance-overlay"
    );

  let payments:
    Payment[] = [];

  let transactions:
    FinanceTransaction[] = [];

  let bookings:
    BookingListItem[] = [];


  function bookingCode(
    bookingId?: string | null,
  ): string {
    if (!bookingId) {
      return "Bağımsız";
    }

    const booking =
      bookings.find(
        item =>
          item.id === bookingId
      );

    return booking?.booking_code
      ?? bookingId;
  }


  function addTotal(
    totals: CurrencyTotals,
    currency: string,
    amount: number,
  ): void {
    const key =
      currency || "TRY";

    totals[key] =
      (
        totals[key]
        ?? 0
      )
      + Number(
          amount || 0
        );
  }


  function totalsByType(
    type: string,
  ): CurrencyTotals {
    const totals:
      CurrencyTotals = {};

    transactions
      .filter(
        item =>
          item.transaction_type
          === type
      )
      .forEach(
        item => {
          addTotal(
            totals,
            item.currency,
            item.amount
          );
        },
      );

    return totals;
  }


  function paidTotals():
  CurrencyTotals {
    const totals:
      CurrencyTotals = {};

    payments
      .filter(
        item =>
          [
            "paid",
            "authorized",
            "partially_refunded",
          ].includes(
            item.status
          )
      )
      .forEach(
        item => {
          addTotal(
            totals,
            item.currency,
            item.amount
          );
        },
      );

    return totals;
  }


  function renderTotals(
    totals: CurrencyTotals,
  ): string {
    const entries =
      Object.entries(
        totals
      );

    if (!entries.length) {
      return `
        <strong>0</strong>
        <small>Kayıt yok</small>
      `;
    }

    return entries
      .map(
        ([currency, amount]) => `
          <strong>
            ${money(
              amount,
              currency
            )}
          </strong>
        `
      )
      .join("");
  }


  function renderSummary():
  void {
    if (!summary) {
      return;
    }

    summary.innerHTML = `
      ${summaryCard(
        "Tahsil Edilen",
        renderTotals(
          paidTotals()
        )
      )}

      ${summaryCard(
        "Gelir",
        renderTotals(
          totalsByType(
            "income"
          )
        )
      )}

      ${summaryCard(
        "Gider",
        renderTotals(
          totalsByType(
            "expense"
          )
        )
      )}

      ${summaryCard(
        "Komisyon",
        renderTotals(
          totalsByType(
            "commission"
          )
        )
      )}

      ${summaryCard(
        "İade",
        renderTotals(
          totalsByType(
            "refund"
          )
        )
      )}
    `;
  }


  function renderPayments():
  void {
    if (!paymentList) {
      return;
    }

    setText(
      page,
      "#finance-payment-count",
      payments.length
    );

    paymentList.innerHTML = "";

    if (!payments.length) {
      paymentList.hidden = false;

      paymentList.innerHTML = `
        <div class="finance-empty">
          Henüz ödeme kaydı bulunmuyor.
        </div>
      `;

      return;
    }

    paymentList.hidden = false;

    payments.forEach(
      payment => {
        const row =
          document.createElement(
            "article"
          );

        row.className =
          "finance-row";

        row.innerHTML = `
          <div class="finance-row-main">

            <strong>
              ${escapeHtml(
                bookingCode(
                  payment.booking_id
                )
              )}
            </strong>

            <span>
              ${escapeHtml(
                paymentMethodLabel(
                  payment.payment_method
                )
              )}
            </span>

          </div>


          <div class="finance-row-meta">

            <span class="
              finance-status
              finance-status-${escapeHtml(
                payment.status
              )}
            ">
              ${escapeHtml(
                paymentStatusLabel(
                  payment.status
                )
              )}
            </span>

            <small>
              ${formatDate(
                payment.created_at
              )}
            </small>

          </div>


          <strong class="finance-amount">
            ${money(
              payment.amount,
              payment.currency
            )}
          </strong>
        `;

        paymentList.appendChild(
          row
        );
      },
    );
  }


  function renderTransactions():
  void {
    if (!transactionList) {
      return;
    }

    setText(
      page,
      "#finance-transaction-count",
      transactions.length
    );

    transactionList.innerHTML = "";

    if (!transactions.length) {
      transactionList.hidden =
        false;

      transactionList.innerHTML = `
        <div class="finance-empty">
          Henüz finans hareketi bulunmuyor.
        </div>
      `;

      return;
    }

    transactionList.hidden =
      false;

    transactions.forEach(
      transaction => {
        const row =
          document.createElement(
            "article"
          );

        row.className =
          "finance-row";

        row.innerHTML = `
          <div class="finance-row-main">

            <strong>
              ${escapeHtml(
                transactionTypeLabel(
                  transaction
                    .transaction_type
                )
              )}
            </strong>

            <span>
              ${
                transaction.description
                  ? escapeHtml(
                      transaction
                        .description
                    )
                  : escapeHtml(
                      bookingCode(
                        transaction
                          .booking_id
                      )
                    )
              }
            </span>

          </div>


          <div class="finance-row-meta">

            ${
              transaction.category
                ? `
                  <span class="finance-category">
                    ${escapeHtml(
                      transaction.category
                    )}
                  </span>
                `
                : ""
            }

            <small>
              ${formatDate(
                transaction
                  .transaction_date
              )}
            </small>

          </div>


          <strong class="
            finance-amount
            finance-amount-${escapeHtml(
              transaction
                .transaction_type
            )}
          ">
            ${
              transaction.transaction_type
              === "expense"
              || transaction.transaction_type
              === "commission"
              || transaction.transaction_type
              === "refund"
                ? "−"
                : "+"
            }

            ${money(
              transaction.amount,
              transaction.currency
            )}
          </strong>
        `;

        transactionList.appendChild(
          row
        );
      },
    );
  }


  async function load():
  Promise<void> {
    try {
      [
        payments,
        transactions,
        bookings,
      ] = await Promise.all([
        getPayments(),
        getFinanceTransactions(),
        getBookings(),
      ]);

      if (paymentLoading) {
        paymentLoading.hidden =
          true;
      }

      if (transactionLoading) {
        transactionLoading.hidden =
          true;
      }

      renderSummary();
      renderPayments();
      renderTransactions();

    } catch (exception) {
      const message =
        exception instanceof Error
          ? exception.message
          : "Finans verileri yüklenemedi.";

      if (paymentLoading) {
        paymentLoading.textContent =
          message;
      }

      if (transactionLoading) {
        transactionLoading.textContent =
          message;
      }
    }
  }


  function openPaymentDrawer():
  void {
    if (!bookings.length) {
      alert(
        "Ödeme kaydı için önce bir rezervasyon bulunmalıdır."
      );

      return;
    }

    openDrawer(`
      <header class="finance-drawer-head">

        <div>
          <span>
            YENİ ÖDEME
          </span>

          <h2>
            Ödeme Kaydet
          </h2>
        </div>

        <button
          type="button"
          id="finance-close"
        >
          ×
        </button>

      </header>


      <form
        class="finance-form"
        id="finance-payment-form"
      >

        <label>
          <span>
            Rezervasyon
          </span>

          <select
            name="booking_id"
            required
          >
            <option value="">
              Rezervasyon seç
            </option>

            ${bookings
              .map(
                booking => `
                  <option
                    value="${escapeHtml(
                      booking.id
                    )}"
                  >
                    ${escapeHtml(
                      booking.booking_code
                    )}
                    •
                    ${money(
                      booking.total_amount,
                      booking.currency
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>


        <div class="finance-form-grid">

          <label>
            <span>
              Tutar
            </span>

            <input
              type="number"
              name="amount"
              min="0.01"
              step="0.01"
              required
            >
          </label>


          <label>
            <span>
              Para Birimi
            </span>

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
            <span>
              Ödeme Yöntemi
            </span>

            <select name="payment_method">
              <option value="">
                Seçiniz
              </option>

              <option value="cash">
                Nakit
              </option>

              <option value="card">
                Kart
              </option>

              <option value="bank_transfer">
                Havale
              </option>

              <option value="online">
                Online
              </option>

              <option value="virtual_pos">
                Sanal POS
              </option>

              <option value="other">
                Diğer
              </option>
            </select>
          </label>


          <label>
            <span>
              Sağlayıcı
            </span>

            <input
              name="provider"
              placeholder="Örn. iyzico"
            >
          </label>

        </div>


        <label>
          <span>
            Harici Ödeme ID
          </span>

          <input
            name="external_payment_id"
          >
        </label>


        <label>
          <span>
            Not
          </span>

          <textarea
            name="notes"
            rows="4"
          ></textarea>
        </label>


        <div
          class="finance-form-error"
          id="finance-payment-error"
        ></div>


        <button
          type="submit"
          class="finance-save-button"
        >
          Ödeme Kaydını Oluştur
        </button>

      </form>
    `);


    const form =
      drawer?.querySelector<HTMLFormElement>(
        "#finance-payment-form"
      );

    form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const data =
          new FormData(
            form
          );

        const bookingId =
          textValue(
            data,
            "booking_id"
          );

        const amount =
          numberValue(
            data,
            "amount"
          );

        const error =
          drawer?.querySelector<HTMLElement>(
            "#finance-payment-error"
          );

        if (
          !bookingId ||
          amount == null ||
          amount <= 0
        ) {
          if (error) {
            error.textContent =
              "Rezervasyon ve geçerli tutar zorunludur.";
          }

          return;
        }

        try {
          await createPayment({
            booking_id:
              bookingId,

            amount,

            currency:
              textValue(
                data,
                "currency"
              )
              || "TRY",

            payment_method:
              optionalText(
                data,
                "payment_method"
              ) as
                | "cash"
                | "card"
                | "bank_transfer"
                | "online"
                | "virtual_pos"
                | "other"
                | null,

            provider:
              optionalText(
                data,
                "provider"
              ),

            external_payment_id:
              optionalText(
                data,
                "external_payment_id"
              ),

            notes:
              optionalText(
                data,
                "notes"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Ödeme oluşturulamadı.";
          }
        }
      },
    );
  }


  function openTransactionDrawer():
  void {
    openDrawer(`
      <header class="finance-drawer-head">

        <div>
          <span>
            FİNANS HAREKETİ
          </span>

          <h2>
            Yeni Hareket
          </h2>
        </div>

        <button
          type="button"
          id="finance-close"
        >
          ×
        </button>

      </header>


      <form
        class="finance-form"
        id="finance-transaction-form"
      >

        <div class="finance-form-grid">

          <label>
            <span>
              Hareket Tipi
            </span>

            <select
              name="transaction_type"
              required
            >
              <option value="income">
                Gelir
              </option>

              <option value="expense">
                Gider
              </option>

              <option value="commission">
                Komisyon
              </option>

              <option value="refund">
                İade
              </option>

              <option value="adjustment">
                Düzeltme
              </option>
            </select>
          </label>


          <label>
            <span>
              Tutar
            </span>

            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              required
            >
          </label>


          <label>
            <span>
              Para Birimi
            </span>

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
            <span>
              Kategori
            </span>

            <input
              name="category"
              placeholder="Örn. Yakıt"
            >
          </label>

        </div>


        <label>
          <span>
            Rezervasyon
          </span>

          <select name="booking_id">
            <option value="">
              Bağımsız hareket
            </option>

            ${bookings
              .map(
                booking => `
                  <option
                    value="${escapeHtml(
                      booking.id
                    )}"
                  >
                    ${escapeHtml(
                      booking.booking_code
                    )}
                  </option>
                `
              )
              .join("")}
          </select>
        </label>


        <label>
          <span>
            Açıklama
          </span>

          <textarea
            name="description"
            rows="4"
          ></textarea>
        </label>


        <div
          class="finance-form-error"
          id="finance-transaction-error"
        ></div>


        <button
          type="submit"
          class="finance-save-button"
        >
          Finans Hareketini Kaydet
        </button>

      </form>
    `);


    const form =
      drawer?.querySelector<HTMLFormElement>(
        "#finance-transaction-form"
      );

    form?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        const data =
          new FormData(
            form
          );

        const amount =
          numberValue(
            data,
            "amount"
          );

        const error =
          drawer?.querySelector<HTMLElement>(
            "#finance-transaction-error"
          );

        if (
          amount == null
          || amount < 0
        ) {
          if (error) {
            error.textContent =
              "Geçerli bir tutar girilmelidir.";
          }

          return;
        }

        try {
          await createFinanceTransaction({
            transaction_type:
              textValue(
                data,
                "transaction_type"
              ) as
                | "income"
                | "expense"
                | "commission"
                | "refund"
                | "adjustment",

            amount,

            currency:
              textValue(
                data,
                "currency"
              )
              || "TRY",

            booking_id:
              optionalText(
                data,
                "booking_id"
              ),

            category:
              optionalText(
                data,
                "category"
              ),

            description:
              optionalText(
                data,
                "description"
              ),
          });

          closeDrawer();

          await load();

        } catch (exception) {
          if (error) {
            error.textContent =
              exception instanceof Error
                ? exception.message
                : "Finans hareketi oluşturulamadı.";
          }
        }
      },
    );
  }


  function openDrawer(
    html: string,
  ): void {
    if (
      !drawer ||
      !overlay
    ) {
      return;
    }

    overlay.hidden =
      false;

    drawer.classList.add(
      "finance-drawer-open"
    );

    drawer.setAttribute(
      "aria-hidden",
      "false"
    );

    drawer.innerHTML =
      html;

    drawer
      .querySelector(
        "#finance-close"
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
      "finance-drawer-open"
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
      "#finance-payment-create"
    )
    ?.addEventListener(
      "click",
      openPaymentDrawer
    );


  page
    .querySelector(
      "#finance-transaction-create"
    )
    ?.addEventListener(
      "click",
      openTransactionDrawer
    );


  overlay?.addEventListener(
    "click",
    closeDrawer
  );


  void load();

  return page;
}


function summaryCard(
  label: string,
  value: string,
): string {
  return `
    <article class="finance-summary-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <div>
        ${value}
      </div>

    </article>
  `;
}


function transactionTypeLabel(
  type: string,
): string {
  const labels:
  Record<string, string> = {
    income:
      "Gelir",

    expense:
      "Gider",

    commission:
      "Komisyon",

    refund:
      "İade",

    adjustment:
      "Düzeltme",
  };

  return labels[type]
    ?? type;
}


function paymentStatusLabel(
  status: string,
): string {
  const labels:
  Record<string, string> = {
    pending:
      "Bekliyor",

    authorized:
      "Yetkilendirildi",

    paid:
      "Ödendi",

    partially_refunded:
      "Kısmi İade",

    refunded:
      "İade Edildi",

    failed:
      "Başarısız",

    cancelled:
      "İptal",
  };

  return labels[status]
    ?? status;
}


function paymentMethodLabel(
  method?: string | null,
): string {
  const labels:
  Record<string, string> = {
    cash:
      "Nakit",

    card:
      "Kart",

    bank_transfer:
      "Havale",

    online:
      "Online",

    virtual_pos:
      "Sanal POS",

    other:
      "Diğer",
  };

  if (!method) {
    return "Yöntem belirtilmedi";
  }

  return labels[method]
    ?? method;
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

  const value =
    Number(raw);

  return Number.isFinite(
    value
  )
    ? value
    : null;
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
      Number(value || 0)
    );

  } catch {
    return `${value} ${currency}`;
  }
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
