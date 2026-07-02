const searchInput = document.querySelector("[data-search-input]");
const records = [...document.querySelectorAll("[data-record]")];

if (searchInput && records.length) {
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    for (const record of records) {
      const haystack = record.dataset.search ?? "";
      record.hidden = query.length > 0 && !haystack.includes(query);
    }
  });
}
