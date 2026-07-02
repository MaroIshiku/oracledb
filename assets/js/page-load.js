const viewer = document.querySelector(".viewer.loading-dossier");
const dossier = document.querySelector("[data-dossier]");
const loader = document.querySelector("[data-route-loader]");

if (viewer && dossier && loader) {
  const delay = 520 + Math.floor(Math.random() * 360);
  window.setTimeout(() => {
    viewer.classList.remove("loading-dossier");
    loader.setAttribute("aria-hidden", "true");
  }, delay);
}
