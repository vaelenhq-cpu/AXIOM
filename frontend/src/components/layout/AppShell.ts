import {
  logout,
} from "../../api/auth";

import {
  getAuthState,
} from "../../auth/authStore";

import {
  navigate,
} from "../../core/router";

import "./appShell.css";


interface NavItem {
  path: string;
  label: string;
  icon: string;
}


const PRIMARY_NAV: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: "⌂",
  },
  {
    path: "/bookings",
    label: "Rezervasyonlar",
    icon: "◫",
  },
  {
    path: "/operations",
    label: "Operasyon",
    icon: "◇",
  },
  {
    path: "/tours",
    label: "Turlar",
    icon: "○",
  },
];


const RESOURCE_NAV: NavItem[] = [
  {
    path: "/drivers",
    label: "Şoförler",
    icon: "◉",
  },
  {
    path: "/vehicles",
    label: "Araçlar",
    icon: "▱",
  },
  {
    path: "/customers",
    label: "Müşteriler",
    icon: "◎",
  },
];


const BUSINESS_NAV: NavItem[] = [
  {
    path: "/routes",
    label: "Rotalar",
    icon: "⌁",
  },
  {
    path: "/pricing",
    label: "Fiyatlandırma",
    icon: "◈",
  },
  {
    path: "/finance",
    label: "Finans",
    icon: "◒",
  },
];


const SYSTEM_NAV: NavItem[] = [
  {
    path: "/integrations",
    label: "Entegrasyonlar",
    icon: "⌘",
  },
  {
    path: "/settings",
    label: "Ayarlar",
    icon: "⚙",
  },
];


export function AppShell(
  content: HTMLElement,
): HTMLElement {
  const auth =
    getAuthState();

  const path =
    window.location.pathname;

  const shell =
    document.createElement(
      "div",
    );

  shell.className =
    "app-shell";

  shell.innerHTML = `
    <div
      class="sidebar-backdrop"
      id="sidebar-backdrop"
      hidden
    ></div>

    <aside
      class="app-sidebar"
      id="app-sidebar"
      aria-hidden="true"
    >

      <div class="sidebar-head">

        <button
          type="button"
          class="sidebar-brand"
          id="sidebar-home"
          aria-label="Axiom Dashboard"
        >
          <span class="sidebar-brand-mark">
            <span>A</span>
          </span>

          <span class="sidebar-brand-copy">
            <strong>AXIOM</strong>
            <small>
              OPERATIONS
            </small>
          </span>
        </button>

        <button
          type="button"
          class="sidebar-close"
          id="sidebar-close"
          aria-label="Menüyü kapat"
        >
          ×
        </button>

      </div>

      <div class="sidebar-environment">

        <span class="environment-dot"></span>

        <div>
          <strong>
            Sistem Aktif
          </strong>

          <span>
            Operasyon Merkezi
          </span>
        </div>

      </div>

      <div class="sidebar-navigation">

        ${navGroup(
          "OPERASYON",
          PRIMARY_NAV,
          path,
        )}

        ${navGroup(
          "KAYNAKLAR",
          RESOURCE_NAV,
          path,
        )}

        ${navGroup(
          "İŞLETME",
          BUSINESS_NAV,
          path,
        )}

        ${navGroup(
          "SİSTEM",
          SYSTEM_NAV,
          path,
        )}

      </div>

      <div class="sidebar-account">

        <div class="sidebar-avatar">
          ${initials(
            auth.user?.first_name,
            auth.user?.last_name,
            auth.user?.email,
          )}
        </div>

        <div class="sidebar-account-copy">

          <strong>
            ${escapeHtml(
              [
                auth.user?.first_name,
                auth.user?.last_name,
              ]
                .filter(Boolean)
                .join(" ")
              ||
              auth.user?.email
              ||
              "Axiom User"
            )}
          </strong>

          <span>
            ${roleLabel(
              auth.user?.role
            )}
          </span>

        </div>

        <button
          type="button"
          id="logout-button"
          class="sidebar-logout"
          title="Çıkış Yap"
          aria-label="Çıkış Yap"
        >
          ↗
        </button>

      </div>

    </aside>

    <section class="app-workspace">

      <header class="workspace-topbar">

        <div class="workspace-left">

          <button
            type="button"
            class="mobile-menu-button"
            id="mobile-menu-button"
            aria-label="Menüyü aç"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div class="workspace-context">
            <span>
              AXIOM
            </span>

            <strong>
              ${escapeHtml(
                currentPageLabel(
                  path
                )
              )}
            </strong>
          </div>

        </div>

        <div class="workspace-actions">

          <div class="workspace-live">
            <span></span>
            CANLI
          </div>

          <div class="workspace-date">
            ${todayLabel()}
          </div>

        </div>

      </header>

      <main
        class="app-content"
        id="app-content"
      ></main>

    </section>
  `;


  const sidebar =
    shell.querySelector<HTMLElement>(
      "#app-sidebar",
    );

  const backdrop =
    shell.querySelector<HTMLDivElement>(
      "#sidebar-backdrop",
    );


  function openSidebar(): void {
    sidebar?.classList.add(
      "app-sidebar-open",
    );

    sidebar?.setAttribute(
      "aria-hidden",
      "false",
    );

    if (backdrop) {
      backdrop.hidden = false;
    }

    document.body.classList.add(
      "sidebar-open",
    );
  }


  function closeSidebar(): void {
    sidebar?.classList.remove(
      "app-sidebar-open",
    );

    sidebar?.setAttribute(
      "aria-hidden",
      "true",
    );

    if (backdrop) {
      backdrop.hidden = true;
    }

    document.body.classList.remove(
      "sidebar-open",
    );
  }


  shell
    .querySelector(
      "#mobile-menu-button",
    )
    ?.addEventListener(
      "click",
      openSidebar,
    );


  shell
    .querySelector(
      "#sidebar-close",
    )
    ?.addEventListener(
      "click",
      closeSidebar,
    );


  backdrop?.addEventListener(
    "click",
    closeSidebar,
  );


  shell
    .querySelector(
      "#sidebar-home",
    )
    ?.addEventListener(
      "click",
      () => {
        closeSidebar();
        navigate("/");
      },
    );


  shell
    .querySelectorAll<
      HTMLAnchorElement
    >("[data-route]")
    .forEach(
      anchor => {
        anchor.addEventListener(
          "click",
          event => {
            event.preventDefault();

            closeSidebar();

            navigate(
              anchor.dataset.route
              ?? "/",
            );
          },
        );
      },
    );


  shell
    .querySelector(
      "#logout-button",
    )
    ?.addEventListener(
      "click",
      async () => {
        closeSidebar();

        await logout();

        navigate(
          "/login",
        );
      },
    );


  shell
    .querySelector(
      "#app-content",
    )
    ?.append(
      content,
    );


  return shell;
}


function navGroup(
  title: string,
  items: NavItem[],
  currentPath: string,
): string {
  return `
    <div class="sidebar-group">

      <span class="sidebar-group-label">
        ${title}
      </span>

      <nav class="sidebar-nav">

        ${items
          .map(
            item => {
              const active =
                item.path === "/"
                  ? currentPath === "/"
                  : currentPath
                      .startsWith(
                        item.path
                      );

              return `
                <a
                  href="${item.path}"
                  data-route="${item.path}"
                  class="${
                    active
                      ? "sidebar-link active"
                      : "sidebar-link"
                  }"
                >
                  <span class="sidebar-link-icon">
                    ${item.icon}
                  </span>

                  <span>
                    ${item.label}
                  </span>

                  ${
                    active
                      ? `
                        <i
                          class="sidebar-active-marker"
                        ></i>
                      `
                      : ""
                  }
                </a>
              `;
            },
          )
          .join("")}

      </nav>

    </div>
  `;
}


function currentPageLabel(
  path: string,
): string {
  const items = [
    ...PRIMARY_NAV,
    ...RESOURCE_NAV,
    ...BUSINESS_NAV,
    ...SYSTEM_NAV,
  ];

  if (path === "/") {
    return "Dashboard";
  }

  return (
    items.find(
      item =>
        path.startsWith(
          item.path
        )
    )?.label
    ??
    "Workspace"
  );
}


function todayLabel(): string {
  return new Intl.DateTimeFormat(
    "tr-TR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(),
  );
}


function roleLabel(
  role?: string | null,
): string {
  const roles:
  Record<string, string> = {
    owner: "Şirket Sahibi",
    admin: "Yönetici",
    dispatcher:
      "Operasyon Yetkilisi",
  };

  return (
    roles[role ?? ""]
    ??
    role
    ??
    "Kullanıcı"
  );
}


function initials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const value =
    [
      firstName?.[0],
      lastName?.[0],
    ]
      .filter(Boolean)
      .join("")
    ||
    email?.slice(0, 2)
    ||
    "AX";

  return escapeHtml(
    value.toUpperCase()
  );
}


function escapeHtml(
  value: string,
): string {
  return value
    .replaceAll(
      "&",
      "&amp;",
    )
    .replaceAll(
      "<",
      "&lt;",
    )
    .replaceAll(
      ">",
      "&gt;",
    )
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}
