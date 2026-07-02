const searchInput = document.querySelector("[data-search-input]");
const records = [...document.querySelectorAll("[data-record]")];
const navToggle = document.querySelector("[data-nav-toggle]");
const navOverlay = document.querySelector("[data-nav-overlay]");
const sidebar = document.querySelector("[data-sidebar]");

if (searchInput && records.length) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    for (const record of records) {
      const haystack = record.dataset.search ?? "";
      record.hidden = query.length > 0 && !haystack.includes(query);
    }
  });
}

function setNavigation(open) {
  document.body.classList.toggle("nav-open", open);
  navToggle?.setAttribute("aria-expanded", String(open));
}

navToggle?.addEventListener("click", () => {
  setNavigation(!document.body.classList.contains("nav-open"));
});

navOverlay?.addEventListener("click", () => setNavigation(false));

sidebar?.addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (link) setNavigation(false);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNavigation(false);
});
