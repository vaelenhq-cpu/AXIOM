import {
  driverLogin,
} from "../../api/driver";

import "./driver.css";


export function DriverLoginPage():
HTMLElement {
  const page =
    document.createElement(
      "main",
    );

  page.className =
    "driver-login-page";

  page.innerHTML = `
    <section class="driver-login-card">

      <span class="driver-overline">
        AXIOM DRIVER
      </span>

      <h1>
        Şoför Girişi
      </h1>

      <p>
        Atanmış operasyonlarınızı
        görüntülemek için giriş yapın.
      </p>

      <form
        id="driver-login-form"
        class="driver-login-form"
      >

        <label>
          <span>Şirket Kodu</span>

          <input
            name="company_slug"
            value="aselviptur"
            required
          />
        </label>

        <label>
          <span>Kullanıcı Adı</span>

          <input
            name="login_identifier"
            required
          />
        </label>

        <label>
          <span>Şifre</span>

          <input
            name="password"
            type="password"
            required
            minlength="8"
          />
        </label>

        <div
          id="driver-login-error"
          class="driver-error"
          hidden
        ></div>

        <button
          type="submit"
        >
          Giriş Yap
        </button>

      </form>

    </section>
  `;

  const form =
    page.querySelector<
      HTMLFormElement
    >("#driver-login-form");

  const error =
    page.querySelector<
      HTMLDivElement
    >("#driver-login-error");

  form?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const data =
        new FormData(form);

      try {
        await driverLogin({
          company_slug:
            String(
              data.get(
                "company_slug"
              )
            ),

          login_identifier:
            String(
              data.get(
                "login_identifier"
              )
            ),

          password:
            String(
              data.get(
                "password"
              )
            ),
        });

        history.pushState(
          {},
          "",
          "/driver"
        );

        window.dispatchEvent(
          new PopStateEvent(
            "popstate"
          )
        );

      } catch (exception) {
        if (error) {
          error.hidden = false;
          error.textContent =
            exception instanceof Error
              ? exception.message
              : "Giriş başarısız.";
        }
      }
    },
  );

  return page;
}
