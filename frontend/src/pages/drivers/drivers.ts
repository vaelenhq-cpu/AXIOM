import {
  createDriver,
  getDrivers,
  type Driver,
} from "../../api/drivers";

import {
  createDriverAccount,
} from "../../api/driverAccounts";

import "./drivers.css";


export function DriversPage(): HTMLElement {
  const page = document.createElement("section");

  page.innerHTML = `
    <header class="page-header resource-header">
      <div>
        <span class="page-overline">
          OPERASYON KAYNAKLARI
        </span>

        <h1>Şoförler</h1>

        <p>
          Operasyonlarda görevlendirilecek
          şoförleri yönetin.
        </p>
      </div>

      <button
        type="button"
        class="resource-primary"
        id="new-driver"
      >
        + Şoför Ekle
      </button>
    </header>

    <div
      id="driver-list"
      class="resource-grid"
    >
      Yükleniyor...
    </div>

    <dialog
      id="driver-dialog"
      class="resource-dialog"
    >
      <form id="driver-form">
        <header>
          <div>
            <span class="page-overline">
              YENİ ŞOFÖR
            </span>
            <h2>Şoför ekle</h2>
          </div>

          <button
            type="button"
            id="close-driver"
            class="dialog-close"
          >
            ×
          </button>
        </header>

        <label>
          <span>Ad *</span>
          <input name="first_name" required />
        </label>

        <label>
          <span>Soyad</span>
          <input name="last_name" />
        </label>

        <label>
          <span>Telefon</span>
          <input name="phone" type="tel" />
        </label>

        <label>
          <span>E-posta</span>
          <input name="email" type="email" />
        </label>

        <div class="resource-form-grid">
          <label>
            <span>Ehliyet No</span>
            <input name="license_number" />
          </label>

          <label>
            <span>Ehliyet Sınıfı</span>
            <input name="license_class" />
          </label>
        </div>

        <div
          id="driver-error"
          class="resource-error"
          hidden
        ></div>

        <button
          type="submit"
          class="resource-primary full"
        >
          Şoförü Kaydet
        </button>
      </form>
    </dialog>
  `;

  const list =
    page.querySelector<HTMLDivElement>("#driver-list");

  const dialog =
    page.querySelector<HTMLDialogElement>("#driver-dialog");

  const form =
    page.querySelector<HTMLFormElement>("#driver-form");

  const error =
    page.querySelector<HTMLDivElement>("#driver-error");

  async function load(): Promise<void> {
    if (!list) return;

    try {
      const drivers = await getDrivers();

      if (!drivers.length) {
        list.innerHTML = `
          <div class="resource-empty">
            Henüz şoför eklenmemiş.
          </div>
        `;
        return;
      }

      list.innerHTML = drivers
        .map(driverCard)
        .join("");

    } catch (exception) {
      list.textContent =
        exception instanceof Error
          ? exception.message
          : "Şoförler yüklenemedi.";
    }
  }

  page
    .querySelector("#new-driver")
    ?.addEventListener(
      "click",
      () => dialog?.showModal(),
    );

  page
    .querySelector("#close-driver")
    ?.addEventListener(
      "click",
      () => dialog?.close(),
    );

  form?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const data = new FormData(form);

      try {
        await createDriver({
          first_name:
            String(data.get("first_name")),
          last_name:
            String(data.get("last_name") || "") || undefined,
          phone:
            String(data.get("phone") || "") || undefined,
          email:
            String(data.get("email") || "") || undefined,
          license_number:
            String(data.get("license_number") || "") || undefined,
          license_class:
            String(data.get("license_class") || "") || undefined,
        });

        form.reset();
        dialog?.close();
        await load();

      } catch (exception) {
        if (error) {
          error.hidden = false;
          error.textContent =
            exception instanceof Error
              ? exception.message
              : "Şoför eklenemedi.";
        }
      }
    },
  );


  page.addEventListener(
    "click",
    async (event) => {
      const target =
        event.target as HTMLElement;

      const button =
        target.closest<HTMLButtonElement>(
          "[data-driver-account]"
        );

      if (!button) {
        return;
      }

      const driverId =
        button.dataset.driverAccount;

      const driverName =
        button.dataset.driverName
        ?? "Şoför";

      if (!driverId) {
        return;
      }

      const loginIdentifier =
        prompt(
          `${driverName} için giriş kullanıcı adı:`,
          driverName
            .toLocaleLowerCase("tr-TR")
            .replaceAll(" ", ".")
        );

      if (!loginIdentifier) {
        return;
      }

      const password =
        prompt(
          "Şoför için en az 8 karakterli şifre:"
        );

      if (!password) {
        return;
      }

      try {
        await createDriverAccount({
          driver_id: driverId,
          login_identifier:
            loginIdentifier.trim(),
          password,
        });

        alert(
          "Şoför giriş hesabı oluşturuldu."
        );

      } catch (exception) {
        alert(
          exception instanceof Error
            ? exception.message
            : "Driver hesabı oluşturulamadı."
        );
      }
    },
  );

  void load();

  return page;
}


function driverCard(
  driver: Driver,
): string {
  const name =
    [
      driver.first_name,
      driver.last_name,
    ]
      .filter(Boolean)
      .join(" ");

  return `
    <article class="resource-card">
      <div class="resource-card-head">
        <div>
          <span class="resource-type">
            ŞOFÖR
          </span>

          <h3>${escapeHtml(name)}</h3>
        </div>

        <span class="resource-status">
          ${statusLabel(driver.status)}
        </span>
      </div>

      <div class="resource-details">
        <span>
          ${escapeHtml(driver.phone ?? "Telefon yok")}
        </span>

        <span>
          ${
            driver.license_class
              ? `Ehliyet ${escapeHtml(driver.license_class)}`
              : "Ehliyet bilgisi yok"
          }
        </span>
      </div>

      <button
        type="button"
        class="resource-account-button"
        data-driver-account="${escapeHtml(driver.id)}"
        data-driver-name="${escapeHtml(name)}"
      >
        Giriş Hesabı Oluştur
      </button>
    </article>
  `;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    available: "Müsait",
    busy: "Görevde",
    off_duty: "Mesai Dışı",
    inactive: "Pasif",
  };

  return labels[value] ?? value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
