import {
  isAuthenticated,
} from "../auth/authStore";

export type PageRenderer =
  () => HTMLElement;

const routes =
  new Map<string, PageRenderer>();

export function registerRoute(
  path: string,
  renderer: PageRenderer,
): void {
  routes.set(path, renderer);
}

export function navigate(
  path: string,
): void {
  history.pushState(
    {},
    "",
    path,
  );

  renderRoute();
}

export function renderRoute(): void {
  const root =
    document.querySelector<HTMLDivElement>(
      "#app",
    );

  if (!root) {
    return;
  }

  let path =
    window.location.pathname;

  const isDriverRoute =
    path === "/driver" ||
    path === "/driver/login";

  const isPublicAdminRoute =
    path === "/login" ||
    path === "/register";

  const isPublicCustomerRoute =
    path === "/book";

  /*
   * Driver alanı admin auth sisteminden
   * tamamen bağımsızdır.
   */
  if (
    !isDriverRoute &&
    !isPublicAdminRoute &&
    !isPublicCustomerRoute &&
    !isAuthenticated()
  ) {
    history.replaceState(
      {},
      "",
      "/login",
    );

    path = "/login";
  }

  /*
   * Admin zaten giriş yaptıysa yalnızca
   * admin login/register sayfalarından
   * dashboard'a gönder.
   *
   * /driver/login bu kurala dahil DEĞİL.
   */
  if (
    isPublicAdminRoute &&
    isAuthenticated()
  ) {
    history.replaceState(
      {},
      "",
      "/",
    );

    path = "/";
  }

  const renderer =
    routes.get(path) ??
    routes.get("/");

  if (!renderer) {
    root.innerHTML =
      "<h1>Route not found</h1>";
    return;
  }

  root.replaceChildren(
    renderer(),
  );
}

window.addEventListener(
  "popstate",
  renderRoute,
);
