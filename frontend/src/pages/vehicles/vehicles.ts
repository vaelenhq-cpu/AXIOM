import {
  createVehicle,
  getVehicles,
  type Vehicle,
} from "../../api/vehicles";

import "../drivers/drivers.css";


export function VehiclesPage(): HTMLElement {
  const page = document.createElement("section");

  page.innerHTML = `
    <header class="page-header resource-header">
      <div>
        <span class="page-overline">
          FİLO YÖNETİMİ
        </span>

        <h1>Araçlar</h1>

        <p>
          Operasyonlarda kullanılacak
          filoyu yönetin.
        </p>
      </div>

      <button
        type="button"
        class="resource-primary"
        id="new-vehicle"
      >
        + Araç Ekle
      </button>
    </header>

    <div
      id="vehicle-list"
      class="resource-grid"
    >
      Yükleniyor...
    </div>

    <dialog
      id="vehicle-dialog"
      class="resource-dialog"
    >
      <form id="vehicle-form">
        <header>
          <div>
            <span class="page-overline">
              YENİ ARAÇ
            </span>

            <h2>Araç ekle</h2>
          </div>

          <button
            type="button"
            id="close-vehicle"
            class="dialog-close"
          >
            ×
          </button>
        </header>

        <label>
          <span>Plaka *</span>
          <input
            name="plate"
            required
            placeholder="07 ABC 123"
          />
        </label>

        <div class="resource-form-grid">
          <label>
            <span>Marka</span>
            <input name="brand" />
          </label>

          <label>
            <span>Model</span>
            <input name="model" />
          </label>
        </div>

        <div class="resource-form-grid">
          <label>
            <span>Araç Sınıfı</span>
            <input
              name="vehicle_class"
              placeholder="VIP Minivan"
            />
          </label>

          <label>
            <span>Kapasite *</span>
            <input
              name="capacity"
              type="number"
              min="1"
              value="7"
              required
            />
          </label>
        </div>

        <label>
          <span>Model Yılı</span>
          <input
            name="model_year"
            type="number"
            min="1980"
            max="2100"
          />
        </label>

        <div
          id="vehicle-error"
          class="resource-error"
          hidden
        ></div>

        <button
          type="submit"
          class="resource-primary full"
        >
          Aracı Kaydet
        </button>
      </form>
    </dialog>
  `;

  const list =
    page.querySelector<HTMLDivElement>("#vehicle-list");

  const dialog =
    page.querySelector<HTMLDialogElement>("#vehicle-dialog");

  const form =
    page.querySelector<HTMLFormElement>("#vehicle-form");

  const error =
    page.querySelector<HTMLDivElement>("#vehicle-error");

  async function load(): Promise<void> {
    if (!list) return;

    try {
      const vehicles = await getVehicles();

      if (!vehicles.length) {
        list.innerHTML = `
          <div class="resource-empty">
            Henüz araç eklenmemiş.
          </div>
        `;
        return;
      }

      list.innerHTML = vehicles
        .map(vehicleCard)
        .join("");

    } catch (exception) {
      list.textContent =
        exception instanceof Error
          ? exception.message
          : "Araçlar yüklenemedi.";
    }
  }

  page
    .querySelector("#new-vehicle")
    ?.addEventListener(
      "click",
      () => dialog?.showModal(),
    );

  page
    .querySelector("#close-vehicle")
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
        const modelYear =
          String(data.get("model_year") || "");

        await createVehicle({
          plate:
            String(data.get("plate")),
          brand:
            String(data.get("brand") || "") || undefined,
          model:
            String(data.get("model") || "") || undefined,
          model_year:
            modelYear
              ? Number(modelYear)
              : undefined,
          vehicle_class:
            String(data.get("vehicle_class") || "") || undefined,
          capacity:
            Number(data.get("capacity") || 1),
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
              : "Araç eklenemedi.";
        }
      }
    },
  );

  void load();

  return page;
}


function vehicleCard(
  vehicle: Vehicle,
): string {
  return `
    <article class="resource-card">
      <div class="resource-card-head">
        <div>
          <span class="resource-type">
            ARAÇ
          </span>

          <h3>
            ${escapeHtml(vehicle.plate)}
          </h3>
        </div>

        <span class="resource-status">
          ${statusLabel(vehicle.status)}
        </span>
      </div>

      <div class="resource-details">
        <span>
          ${escapeHtml(
            [
              vehicle.brand,
              vehicle.model,
            ]
              .filter(Boolean)
              .join(" ")
            || "Araç bilgisi yok"
          )}
        </span>

        <span>
          ${escapeHtml(
            vehicle.vehicle_class
            ?? "Sınıf belirtilmedi"
          )}
          • ${vehicle.capacity} kişi
        </span>
      </div>
    </article>
  `;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    available: "Müsait",
    busy: "Görevde",
    maintenance: "Bakımda",
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
