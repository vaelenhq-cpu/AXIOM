import {
  register,
} from "../../api/register";

import {
  navigate,
} from "../../core/router";

import "./register.css";


export function RegisterPage():
HTMLElement {
  const page =
    document.createElement(
      "main",
    );

  page.className =
    "register-page";

  page.innerHTML = `
    <section class="register-panel">

      <div class="register-brand">
        <span class="register-brand-mark">
          A
        </span>

        <div>
          <strong>AXIOM</strong>
          <span>Operasyon Platformu</span>
        </div>
      </div>

      <div class="register-heading">

        <span class="register-overline">
          YENİ HESAP
        </span>

        <h1>
          Axiom hesabınızı oluşturun
        </h1>

        <p>
          Şirket hesabınızı oluşturun ve
          operasyon merkezini kullanmaya başlayın.
        </p>

      </div>

      <form
        class="register-form"
        id="register-form"
      >

        <label>
          <span>Şirket adı</span>

          <input
            name="company_name"
            required
            minlength="2"
            placeholder="Örn. Antalya Premium Travel"
          />
        </label>

        <div class="register-grid">

          <label>
            <span>Ad</span>

            <input
              name="first_name"
              required
            />
          </label>

          <label>
            <span>Soyad</span>

            <input
              name="last_name"
              required
            />
          </label>

        </div>

        <label>
          <span>E-posta</span>

          <input
            name="email"
            type="email"
            required
            autocomplete="email"
          />
        </label>

        <label>
          <span>Telefon</span>

          <input
            name="phone"
            type="tel"
            autocomplete="tel"
          />
        </label>

        <div class="register-grid">

          <label>
            <span>Şifre</span>

            <input
              name="password"
              type="password"
              required
              minlength="8"
            />
          </label>

          <label>
            <span>Şifre tekrar</span>

            <input
              name="password_confirm"
              type="password"
              required
              minlength="8"
            />
          </label>

        </div>

        <div
          class="register-error"
          id="register-error"
          hidden
        ></div>

        <button
          type="submit"
          class="register-submit"
        >
          Hesap Oluştur
        </button>

      </form>

      <button
        type="button"
        id="go-login"
        class="register-login-link"
      >
        Zaten hesabınız var mı?
        Giriş yapın
      </button>

    </section>
  `;

  const form =
    page.querySelector<
      HTMLFormElement
    >("#register-form");

  const error =
    page.querySelector<
      HTMLDivElement
    >("#register-error");

  const loginButton =
    page.querySelector<
      HTMLButtonElement
    >("#go-login");

  loginButton?.addEventListener(
    "click",
    () => navigate("/login"),
  );

  form?.addEventListener(
    "submit",
    async (
      event,
    ) => {
      event.preventDefault();

      if (!form) {
        return;
      }

      const data =
        new FormData(form);

      const button =
        form.querySelector<
          HTMLButtonElement
        >(
          "button[type='submit']",
        );

      if (button) {
        button.disabled = true;
        button.textContent =
          "Hesap oluşturuluyor...";
      }

      if (error) {
        error.hidden = true;
      }

      try {
        await register({
          company_name:
            String(
              data.get(
                "company_name",
              ),
            ),

          first_name:
            String(
              data.get(
                "first_name",
              ),
            ),

          last_name:
            String(
              data.get(
                "last_name",
              ),
            ),

          email:
            String(
              data.get("email"),
            ),

          phone:
            String(
              data.get("phone") ?? "",
            ) || undefined,

          password:
            String(
              data.get(
                "password",
              ),
            ),

          password_confirm:
            String(
              data.get(
                "password_confirm",
              ),
            ),
        });

        navigate(
          "/",
        );

      } catch (
        exception
      ) {
        if (error) {
          error.hidden = false;

          error.textContent =
            exception instanceof Error
              ? exception.message
              : "Kayıt başarısız.";
        }

      } finally {
        if (button) {
          button.disabled = false;
          button.textContent =
            "Hesap Oluştur";
        }
      }
    },
  );

  return page;
}
