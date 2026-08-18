import {
  createPublicBooking,
  getPublicBookingConfig,
  type PublicBookingConfig,
} from "../../api/publicBooking";

import "./customerBooking.css";

export function CustomerBookingPage(): HTMLElement {
  const query = new URLSearchParams(window.location.search);
  const initialCompany = query.get("company") ?? "";
  const page = document.createElement("main");

  page.className = "customer-booking-page";
  page.innerHTML = `
    <header class="customer-booking-header">
      <a class="customer-brand" href="/book"><span>A</span><strong>AXIOM</strong></a>
      <div class="customer-secure"><i></i>Güvenli Rezervasyon</div>
    </header>

    <section class="customer-hero">
      <span class="customer-overline">TRANSFER REZERVASYONU</span>
      <h1>Yolculuğunuzu <em>planlayın.</em></h1>
      <p>Transfer bilgilerinizi girin. Rezervasyonunuz doğrudan acentenizin operasyon sistemine düşsün.</p>
    </section>

    <section class="customer-booking-shell">
      <form id="public-booking-form" class="customer-form">
        <div class="customer-section">
          <div class="customer-section-head"><span>01</span><div><strong>Acente ve Rota</strong><small>Rezervasyon kanalınızı ve güzergâhı belirleyin.</small></div></div>
          <div class="customer-grid customer-grid-3">
            <label><span>Acente Kodu</span><input name="company_slug" value="${escapeAttribute(initialCompany)}" required placeholder="ör. aselviptur"></label>
            <label><span>Alış Noktası</span><input name="pickup_location" required placeholder="Antalya Havalimanı"></label>
            <label><span>Bırakış Noktası</span><input name="dropoff_location" required placeholder="Belek / Otel"></label>
          </div>
        </div>

        <div class="customer-section">
          <div class="customer-section-head"><span>02</span><div><strong>Zaman ve Yolcu</strong><small>Operasyon planlaması için temel detaylar.</small></div></div>
          <div class="customer-grid customer-grid-4">
            <label><span>Tarih</span><input name="date" type="date" required></label>
            <label><span>Saat</span><input name="time" type="time" required></label>
            <label><span>Yolcu</span><input name="pax" type="number" min="1" max="50" value="1" required></label>
            <label><span>Bagaj</span><input name="luggage" type="number" min="0" max="100" value="0" required></label>
            <label><span>Uçuş Numarası</span><input name="flight_number" placeholder="TK2410"></label>
            <label><span>Araç Sınıfı</span><select name="vehicle_class"><option value="">Standart</option><option value="vip">VIP</option><option value="minivan">Minivan</option><option value="minibus">Minibüs</option></select></label>
          </div>
        </div>

        <div class="customer-section">
          <div class="customer-section-head"><span>03</span><div><strong>İletişim Bilgileri</strong><small>Rezervasyon sahibi ve operasyon iletişimi.</small></div></div>
          <div class="customer-grid customer-grid-2">
            <label><span>Ad</span><input name="first_name" required autocomplete="given-name"></label>
            <label><span>Soyad</span><input name="last_name" autocomplete="family-name"></label>
            <label><span>Telefon</span><input name="phone" required autocomplete="tel"></label>
            <label><span>E-posta</span><input name="email" type="email" autocomplete="email"></label>
            <label class="customer-grid-full"><span>Özel İstek / Not</span><textarea name="note" rows="4" placeholder="Çocuk koltuğu, karşılama notu vb."></textarea></label>
          </div>
        </div>

        <div id="booking-error" class="customer-error" hidden></div>
        <button id="booking-submit" type="submit" class="customer-submit"><span>Rezervasyonu Oluştur</span><b>→</b></button>
      </form>

      <aside class="customer-summary">
        <span class="summary-label">AXIOM V1</span>
        <h2>Transfer Özeti</h2>
        <div class="summary-row"><span>Durum</span><strong>Yeni Rezervasyon</strong></div>
        <div class="summary-row"><span>Kaynak</span><strong>Web Sitesi</strong></div>
        <div class="summary-note">Rezervasyon gönderildiğinde acentenizin operasyon merkezinde otomatik olarak rezervasyon, transfer ve operasyon kaydı oluşur.</div>
      </aside>
    </section>
  `;

  const form = page.querySelector<HTMLFormElement>("#public-booking-form");
  const error = page.querySelector<HTMLElement>("#booking-error");
  const submit = page.querySelector<HTMLButtonElement>("#booking-submit");

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (error) error.hidden = true;
    if (submit) submit.disabled = true;

    const data = new FormData(form);

    try {
      const companySlug = stringValue(data, "company_slug");
      const bookingConfig = await getPublicBookingConfig(companySlug);
      const date = stringValue(data, "date");
      const time = stringValue(data, "time");
      const pickupDatetime = new Date(`${date}T${time}:00`).toISOString();
      const pax = integerValue(data, "pax", 1);
      const luggage = integerValue(data, "luggage", 0);
      const bookingCode = generateBookingCode(bookingConfig);
      const requestId = `web_${crypto.randomUUID()}`;

      const result = await createPublicBooking(
        bookingConfig.public_key,
        {
          request_id: requestId,
          booking: {
            bookingCode,
            customer: {
              firstName: stringValue(data, "first_name"),
              lastName: optionalValue(data, "last_name"),
              email: optionalValue(data, "email"),
              phone: optionalValue(data, "phone"),
              language: "tr",
              notes: optionalValue(data, "note"),
            },
            services: [{
              serviceType: "transfer",
              title: "Web Transfer",
              serviceDate: date,
              startTime: time,
              paxAdult: pax,
              paxChild: 0,
              paxInfant: 0,
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              transfer: {
                pickupLocation: stringValue(data, "pickup_location"),
                dropoffLocation: stringValue(data, "dropoff_location"),
                pickupDatetime,
                flightNumber: optionalValue(data, "flight_number"),
                pax,
                luggageCount: luggage,
                requestedVehicleClass: optionalValue(data, "vehicle_class"),
                specialRequest: optionalValue(data, "note"),
              },
            }],
            source: "website",
            currency: bookingConfig.company.default_currency || "TRY",
            customerNote: optionalValue(data, "note"),
          },
        },
      );

      renderSuccess(page, result, bookingConfig.company.name);
    } catch (exception) {
      if (error) {
        error.hidden = false;
        error.textContent = exception instanceof Error ? exception.message : "Rezervasyon oluşturulamadı.";
      }
      if (submit) submit.disabled = false;
    }
  });

  return page;
}

function renderSuccess(
  page: HTMLElement,
  result: { request_id: string; booking: Record<string, unknown> },
  companyName: string,
): void {
  const bookingCode = String(result.booking.booking_code ?? result.booking.bookingCode ?? "-");
  page.innerHTML = `
    <section class="customer-success">
      <div class="customer-success-mark">✓</div>
      <span>REZERVASYON ALINDI</span>
      <h1>Transferiniz <em>planlandı.</em></h1>
      <p>${escapeHtml(companyName)} operasyon ekibi rezervasyonunuzu aldı.</p>
      <div class="customer-success-code"><small>REZERVASYON KODU</small><strong>${escapeHtml(bookingCode)}</strong></div>
      <a href="/book" class="customer-success-link">Yeni Rezervasyon</a>
    </section>
  `;
}

function generateBookingCode(config: PublicBookingConfig): string {
  const prefix = config.company.slug.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase() || "AX";
  const stamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${stamp}`;
}

function stringValue(data: FormData, key: string): string { return String(data.get(key) ?? "").trim(); }
function optionalValue(data: FormData, key: string): string | null { const value = stringValue(data, key); return value || null; }
function integerValue(data: FormData, key: string, fallback: number): number { const value = Number(stringValue(data, key)); return Number.isFinite(value) ? Math.round(value) : fallback; }
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value: string): string { return escapeHtml(value); }
