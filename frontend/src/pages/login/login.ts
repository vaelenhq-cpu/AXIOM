import {
  login,
} from "../../api/auth";

import {
  navigate,
} from "../../core/router";

import "./login.css";

export function LoginPage(): HTMLElement {
  const page =
    document.createElement("main");

  page.className =
    "login-page";

  page.innerHTML = `
    <section class="login-panel">

      <div class="login-brand">
        <span class="login-brand-mark">
          A
        </span>

        <div>
          <strong>AXIOM</strong>
          <span>
            Operasyon Platformu
          </span>
        </div>
      </div>

      <div class="login-heading">
        <span class="login-overline">
          GÜVENLİ ERİŞİM
        </span>

        <h1>
          Operasyon merkezine giriş
        </h1>

        <p>
          Acente hesabınız ile
          Axiom yönetim paneline giriş yapın.
        </p>
      </div>

      <form
        class="login-form"
        id="login-form"
      >

        <label>
          <span>Şirket kodu</span>

          <input
            type="text"
            name="company_slug"
            autocomplete="organization"
            required
            placeholder="ornek-acente"
          />
        </label>

        <label>
          <span>E-posta</span>

          <input
            type="email"
            name="email"
            autocomplete="username"
            required
            placeholder="isim@acente.com"
          />
        </label>

        <label>
          <span>Şifre</span>

          <input
            type="password"
            name="password"
            autocomplete="current-password"
            required
            minlength="8"
          />
        </label>

        <div
          class="login-error"
          id="login-error"
          hidden
        ></div>

        <button
          type="submit"
          class="login-submit"
        >
          <span>
            Giriş Yap
          </span>
        </button>

      </form>

      <button
        type="button"
        class="login-register-link"
        id="go-register"
      >
        Hesabınız yok mu?
        Axiom hesabı oluşturun
      </button>

    </section>
  `;

  const form =
    page.querySelector<HTMLFormElement>(
      "#login-form",
    );

  const error =
    page.querySelector<HTMLDivElement>(
      "#login-error",
    );

  page
    .querySelector(
      "#go-register",
    )
    ?.addEventListener(
      "click",
      () => {
        navigate(
          "/register",
        );
      },
    );

  form?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!form) {
        return;
      }

      const data =
        new FormData(form);

      const button =
        form.querySelector<HTMLButtonElement>(
          "button[type='submit']",
        );

      if (button) {
        button.disabled = true;
        button.textContent =
          "Giriş yapılıyor...";
      }

      if (error) {
        error.hidden = true;
      }

      try {
        await login({
          company_slug:
            String(
              data.get(
                "company_slug",
              ),
            ),

          email:
            String(
              data.get("email"),
            ),

          password:
            String(
              data.get(
                "password",
              ),
            ),
        });

        navigate("/");

      } catch (exception) {
        if (error) {
          error.hidden = false;

          error.textContent =
            exception instanceof Error
              ? exception.message
              : "Giriş başarısız.";
        }

      } finally {
        if (button) {
          button.disabled = false;
          button.textContent =
            "Giriş Yap";
        }
      }
    },
  );

  return page;
}
