(() => {
  const cards = Array.from(document.querySelectorAll("[data-report-card]"));
  if (!cards.length) return;

  const typeFilter = document.querySelector("#type-filter");
  const departmentFilter = document.querySelector("#department-filter");
  const statusFilter = document.querySelector("#status-filter");
  const emptyState = document.querySelector("#filtered-empty");

  const applyFilters = () => {
    const type = typeFilter?.value || "all";
    const department = departmentFilter?.value || "all";
    const status = statusFilter?.value || "all";
    let visible = 0;

    cards.forEach((card) => {
      const matches =
        (type === "all" || card.dataset.type === type) &&
        (department === "all" || card.dataset.department === department) &&
        (status === "all" || card.dataset.status === status);

      card.hidden = !matches;
      if (matches) visible += 1;
    });

    if (emptyState) emptyState.hidden = visible !== 0;
  };

  [typeFilter, departmentFilter, statusFilter].forEach((filter) => {
    filter?.addEventListener("change", applyFilters);
  });

  applyFilters();
})();
