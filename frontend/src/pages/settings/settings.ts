import {
  createCompanyDomain,
  getCompany,
  getCompanyDomains,
  getCompanySettings,
  updateCompany,
  updateCompanySettings,
  verifyCompanyDomain,
  type CompanyDomain,
  type CompanyProfile,
  type CompanySettings,
} from "../../api/settings";

import "./settings.css";


let company: CompanyProfile | null = null;
let settings: CompanySettings | null = null;
let domains: CompanyDomain[] = [];


function escapeHtml(
  value: unknown,
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function checked(
  value: boolean | number,
): string {
  return Boolean(value)
    ? "checked"
    : "";
}


function domainStatusLabel(
  status: CompanyDomain["status"],
): string {
  const labels: Record<
    CompanyDomain["status"],
    string
  > = {
    pending: "Bekliyor",
    verifying: "Doğrulanıyor",
    verified: "Doğrulandı",
    failed: "Başarısız",
    disabled: "Devre dışı",
  };

  return labels[status];
}


function renderDomains(): string {
  if (domains.length === 0) {
    return `
      <div class="settings-empty">
        Henüz bağlı domain bulunmuyor.
      </div>
    `;
  }

  return domains
    .map(
      (domain) => {
        const verificationPath =
          `https://${domain.domain}` +
          "/.well-known/" +
          "axiom-domain-verification.txt";

        const isVerified =
          domain.status === "verified";

        return `
          <article class="domain-row">

            <div class="domain-main">
              <div class="domain-heading">
                <strong>
                  ${escapeHtml(domain.domain)}
                </strong>

                <span>
                  ${escapeHtml(
                    domain.domain_type,
                  )}
                </span>
              </div>

              ${
                !isVerified &&
                domain.verification_token
                  ? `
                    <div
                      class="domain-verification"
                    >
                      <p>
                        Aşağıdaki dosyayı sitenizde
                        oluşturun:
                      </p>

                      <code>
                        ${escapeHtml(
                          verificationPath,
                        )}
                      </code>

                      <p>
                        Dosyanın içeriği yalnızca
                        şu doğrulama anahtarı
                        olmalıdır:
                      </p>

                      <code>
                        ${escapeHtml(
                          domain
                            .verification_token,
                        )}
                      </code>
                    </div>
                  `
                  : ""
              }
            </div>

            <div class="domain-actions">

              <span
                class="
                  domain-status
                  domain-status--${escapeHtml(
                    domain.status,
                  )}
                "
              >
                ${domainStatusLabel(
                  domain.status,
                )}
              </span>

              ${
                !isVerified
                  ? `
                    <button
                      type="button"
                      class="domain-verify-button"
                      data-domain-verify="${escapeHtml(
                        domain.id,
                      )}"
                    >
                      Domaini Doğrula
                    </button>
                  `
                  : `
                    <span
                      class="domain-verified-label"
                    >
                      Bağlantı doğrulandı
                    </span>
                  `
              }

            </div>

          </article>
        `;
      },
    )
    .join("");
}

function renderContent(): string {
  if (!company || !settings) {
    return `
      <section class="settings-state">
        Axiom ayarları yükleniyor...
      </section>
    `;
  }

  return `
    <section class="settings-page">

      <header class="settings-header">
        <div>
          <span class="settings-kicker">
            AXIOM CONTROL
          </span>

          <h1>
            Ayarlar
          </h1>

          <p>
            Şirket, operasyon ve bağlantı
            yapılandırmasını tek merkezden yönetin.
          </p>
        </div>

        <div class="settings-company-state">
          <span></span>
          ${escapeHtml(company.status)}
        </div>
      </header>


      <div class="settings-grid">

        <article class="settings-card">
          <header>
            <div>
              <span class="card-index">
                01
              </span>

              <h2>
                Şirket Profili
              </h2>
            </div>

            <p>
              Axiom hesabının bağlı olduğu
              şirket bilgileri.
            </p>
          </header>

          <form id="company-settings-form">

            <label>
              Şirket adı
              <input
                name="name"
                value="${escapeHtml(
                  company.name,
                )}"
                required
              >
            </label>

            <label>
              Ticari unvan
              <input
                name="legal_name"
                value="${escapeHtml(
                  company.legal_name,
                )}"
              >
            </label>

            <label>
              Vergi numarası
              <input
                name="tax_number"
                value="${escapeHtml(
                  company.tax_number,
                )}"
              >
            </label>

            <div class="settings-form-row">
              <label>
                Ülke
                <input
                  name="country_code"
                  value="${escapeHtml(
                    company.country_code,
                  )}"
                >
              </label>

              <label>
                Para birimi
                <input
                  name="default_currency"
                  value="${escapeHtml(
                    company.default_currency,
                  )}"
                >
              </label>
            </div>

            <label>
              Saat dilimi
              <input
                name="timezone"
                value="${escapeHtml(
                  company.timezone,
                )}"
              >
            </label>

            <button type="submit">
              Şirket bilgilerini kaydet
            </button>

          </form>
        </article>


        <article class="settings-card">
          <header>
            <div>
              <span class="card-index">
                02
              </span>

              <h2>
                Operasyon
              </h2>
            </div>

            <p>
              Rezervasyon ve operasyon
              otomasyon kuralları.
            </p>
          </header>

          <form id="operation-settings-form">

            <label>
              Rezervasyon kodu
              <input
                name="booking_prefix"
                value="${escapeHtml(
                  settings.booking_prefix,
                )}"
              >
            </label>

            <label>
              Varsayılan dil
              <input
                name="default_language"
                value="${escapeHtml(
                  settings.default_language,
                )}"
              >
            </label>

            <label>
              Varsayılan saat dilimi
              <input
                name="default_timezone"
                value="${escapeHtml(
                  settings.default_timezone,
                )}"
              >
            </label>

            <label>
              Varsayılan para birimi
              <input
                name="default_currency"
                value="${escapeHtml(
                  settings.default_currency,
                )}"
              >
            </label>


            <div class="settings-switches">

              <label class="settings-switch">
                <div>
                  <strong>
                    Otomatik rezervasyon onayı
                  </strong>

                  <span>
                    Yeni rezervasyonları
                    otomatik onaylar.
                  </span>
                </div>

                <input
                  type="checkbox"
                  name="auto_confirm_bookings"
                  ${checked(
                    settings
                      .auto_confirm_bookings,
                  )}
                >
              </label>


              <label class="settings-switch">
                <div>
                  <strong>
                    Otomatik operasyon oluştur
                  </strong>

                  <span>
                    Uygun rezervasyonlardan
                    operasyon üretir.
                  </span>
                </div>

                <input
                  type="checkbox"
                  name="auto_create_operations"
                  ${checked(
                    settings
                      .auto_create_operations,
                  )}
                >
              </label>


              <label class="settings-switch">
                <div>
                  <strong>
                    Şoför kabulü gerekli
                  </strong>

                  <span>
                    Atanan görevin şoför
                    tarafından kabulünü ister.
                  </span>
                </div>

                <input
                  type="checkbox"
                  name="require_driver_acceptance"
                  ${checked(
                    settings
                      .require_driver_acceptance,
                  )}
                >
              </label>

            </div>

            <button type="submit">
              Operasyon ayarlarını kaydet
            </button>

          </form>
        </article>


        <article
          class="
            settings-card
            settings-card--wide
          "
        >
          <header>
            <div>
              <span class="card-index">
                03
              </span>

              <h2>
                Domain Bağlantıları
              </h2>
            </div>

            <p>
              Şirket sitesi ve Axiom servisleri
              arasındaki bağlantıları yönetin.
            </p>
          </header>


          <form
            id="domain-create-form"
            class="domain-create-form"
          >

            <input
              name="domain"
              placeholder="ornekacente.com"
              required
            >

            <select name="domain_type">
              <option value="website">
                Web sitesi
              </option>

              <option value="booking">
                Rezervasyon
              </option>

              <option value="api">
                API
              </option>

              <option value="custom">
                Özel
              </option>
            </select>

            <button type="submit">
              Domain ekle
            </button>

          </form>


          <div class="domain-list">
            ${renderDomains()}
          </div>

        </article>

      </div>

      <div
        id="settings-message"
        class="settings-message"
      ></div>

    </section>
  `;
}


async function loadSettings(): Promise<void> {
  const root = document.querySelector(
    "#settings-root",
  );

  if (!root) {
    return;
  }

  try {
    [
      company,
      settings,
      domains,
    ] = await Promise.all([
      getCompany(),
      getCompanySettings(),
      getCompanyDomains(),
    ]);

    root.innerHTML =
      renderContent();

    bindSettingsEvents();

  } catch (error) {
    console.error(error);

    root.innerHTML = `
      <section class="settings-state settings-state--error">
        Ayarlar yüklenemedi.
        API bağlantısını ve oturumu kontrol edin.
      </section>
    `;
  }
}


function showMessage(
  message: string,
  error = false,
): void {
  const element = document.querySelector(
    "#settings-message",
  );

  if (!element) {
    return;
  }

  element.textContent = message;

  element.classList.toggle(
    "settings-message--error",
    error,
  );
}


function bindDomainVerifyEvents(): void {
  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-domain-verify]",
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const domainId =
            button.dataset.domainVerify;

          if (!domainId) {
            return;
          }

          button.disabled = true;
          button.textContent =
            "Doğrulanıyor...";

          try {
            await verifyCompanyDomain(
              domainId
            );

            domains =
              await getCompanyDomains();

            const list =
              document.querySelector(
                ".domain-list",
              );

            if (list) {
              list.innerHTML =
                renderDomains();

              bindDomainVerifyEvents();
            }

            showMessage(
              "Domain başarıyla doğrulandı.",
            );

          } catch (error) {
            console.error(error);

            domains =
              await getCompanyDomains();

            const list =
              document.querySelector(
                ".domain-list",
              );

            if (list) {
              list.innerHTML =
                renderDomains();

              bindDomainVerifyEvents();
            }

            showMessage(
              "Domain doğrulanamadı. " +
              "Doğrulama dosyasını kontrol edin.",
              true,
            );
          }
        },
      );
    });
}


function bindSettingsEvents(): void {

  bindDomainVerifyEvents();

  const companyForm =
    document.querySelector<HTMLFormElement>(
      "#company-settings-form",
    );

  companyForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const data =
        new FormData(companyForm);

      try {
        company = await updateCompany({
          name: String(
            data.get("name") ?? "",
          ),
          legal_name: String(
            data.get("legal_name") ?? "",
          ) || null,
          tax_number: String(
            data.get("tax_number") ?? "",
          ) || null,
          country_code: String(
            data.get("country_code") ?? "",
          ),
          timezone: String(
            data.get("timezone") ?? "",
          ),
          default_currency: String(
            data.get(
              "default_currency",
            ) ?? "",
          ),
        });

        showMessage(
          "Şirket bilgileri kaydedildi.",
        );

      } catch (error) {
        console.error(error);

        showMessage(
          "Şirket bilgileri kaydedilemedi.",
          true,
        );
      }
    },
  );


  const operationForm =
    document.querySelector<HTMLFormElement>(
      "#operation-settings-form",
    );

  operationForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const data =
        new FormData(operationForm);

      try {
        settings =
          await updateCompanySettings({
            booking_prefix: String(
              data.get(
                "booking_prefix",
              ) ?? "",
            ),

            default_language: String(
              data.get(
                "default_language",
              ) ?? "",
            ),

            default_timezone: String(
              data.get(
                "default_timezone",
              ) ?? "",
            ),

            default_currency: String(
              data.get(
                "default_currency",
              ) ?? "",
            ),

            auto_confirm_bookings:
              data.has(
                "auto_confirm_bookings",
              ),

            auto_create_operations:
              data.has(
                "auto_create_operations",
              ),

            require_driver_acceptance:
              data.has(
                "require_driver_acceptance",
              ),
          });

        showMessage(
          "Operasyon ayarları kaydedildi.",
        );

      } catch (error) {
        console.error(error);

        showMessage(
          "Operasyon ayarları kaydedilemedi.",
          true,
        );
      }
    },
  );


  const domainForm =
    document.querySelector<HTMLFormElement>(
      "#domain-create-form",
    );

  domainForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const data =
        new FormData(domainForm);

      try {
        await createCompanyDomain({
          domain: String(
            data.get("domain") ?? "",
          ),

          domain_type:
            String(
              data.get(
                "domain_type",
              ) ?? "website",
            ) as
              | "website"
              | "booking"
              | "api"
              | "custom",
        });

        domains =
          await getCompanyDomains();

        const list =
          document.querySelector(
            ".domain-list",
          );

        if (list) {
          list.innerHTML =
            renderDomains();
        }

        domainForm.reset();

        showMessage(
          "Domain Axiom'a eklendi.",
        );

      } catch (error) {
        console.error(error);

        showMessage(
          "Domain eklenemedi.",
          true,
        );
      }
    },
  );
}


export function SettingsPage(): HTMLElement {
  const root =
    document.createElement("div");

  root.id = "settings-root";
  root.innerHTML = renderContent();

  queueMicrotask(
    () => {
      void loadSettings();
    },
  );

  return root;
}
