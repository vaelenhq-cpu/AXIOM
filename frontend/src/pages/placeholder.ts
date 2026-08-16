export function PlaceholderPage(
  title: string,
): HTMLElement {
  const page =
    document.createElement(
      "section",
    );

  page.innerHTML = `
    <header class="page-header">

      <div>
        <span class="page-overline">
          AXIOM
        </span>

        <h1>
          ${title}
        </h1>

        <p>
          Bu modül gerçek API ile
          bağlanacak.
        </p>
      </div>

    </header>
  `;

  return page;
}
