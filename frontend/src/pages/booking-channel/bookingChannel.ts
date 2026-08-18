import { createBookingKey, getBookingKeys, type BookingKey } from "../../api/bookingChannel";
import { apiRequest } from "../../api/client";
import "./bookingChannel.css";

export function BookingChannelPage(): HTMLElement {
  const page = document.createElement("section");
  page.className = "ax-page booking-channel-page";
  page.innerHTML = `
    <header class="page-header"><div><span class="page-overline">SATIŞ KANALI</span><h1>Müşteri Rezervasyonu</h1><p>V1 müşteri rezervasyon sayfanız için public booking anahtarını ve paylaşılabilir bağlantıyı yönetin.</p></div></header>
    <div class="booking-channel-grid">
      <article class="ax-card booking-channel-card"><span class="booking-channel-label">AKTİF KANAL</span><div id="booking-channel-state">Yükleniyor...</div></article>
      <article class="ax-card booking-channel-card"><span class="booking-channel-label">YENİ KANAL</span><form id="booking-channel-form"><label><span>Kanal Adı</span><input class="ax-input" name="name" value="Web Rezervasyon"></label><label><span>İzin Verilen Domain</span><input class="ax-input" name="allowed_domain" placeholder="aselviptur.com"></label><button class="ax-button ax-button-primary">Kanal Oluştur</button></form><div id="booking-channel-error" class="booking-channel-error" hidden></div></article>
    </div>
  `;

  const state = page.querySelector<HTMLElement>("#booking-channel-state");
  const form = page.querySelector<HTMLFormElement>("#booking-channel-form");
  const error = page.querySelector<HTMLElement>("#booking-channel-error");
  let companySlug = "";

  async function load(): Promise<void> {
    try {
      const company = await apiRequest<{slug: string}>("/api/company");
      companySlug = company.slug;
      const keys = await getBookingKeys();
      renderKeys(state, keys, companySlug);
    } catch (exception) {
      if (state) state.textContent = exception instanceof Error ? exception.message : "Kanal bilgisi alınamadı.";
    }
  }

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (error) error.hidden = true;
    const data = new FormData(form);
    try {
      await createBookingKey({
        name: String(data.get("name") ?? "").trim() || null,
        allowed_domain: String(data.get("allowed_domain") ?? "").trim() || null,
      });
      await load();
    } catch (exception) {
      if (error) {
        error.hidden = false;
        error.textContent = exception instanceof Error ? exception.message : "Kanal oluşturulamadı.";
      }
    }
  });

  void load();
  return page;
}

function renderKeys(host: HTMLElement | null, keys: BookingKey[], companySlug: string): void {
  if (!host) return;
  const active = keys.find(key => Boolean(key.active));
  if (!active) {
    host.innerHTML = `<div class="booking-channel-empty">Aktif public booking kanalı yok. Sağdaki formdan V1 kanalını oluşturun.</div>`;
    return;
  }
  const url = `${window.location.origin}/book?company=${encodeURIComponent(companySlug)}`;
  host.innerHTML = `<div class="booking-channel-live"><div><small>PUBLIC KEY</small><code>${escapeHtml(active.public_key)}</code></div><div><small>MÜŞTERİ LİNKİ</small><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></div><div><small>DOMAIN</small><strong>${escapeHtml(active.allowed_domain ?? "Kısıt yok")}</strong></div></div>`;
}

function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
