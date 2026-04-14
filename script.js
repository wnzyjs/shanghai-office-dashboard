const STORAGE_KEY = "applied-value-shanghai-inventory";
const defaultInventory = [
  { id: "item-1", item: "Sparkling Water", category: "Beverages", stock: 96, dailyUse: 18, vendor: "AquaPure", monthlySpend: 180, threshold: 40 },
  { id: "item-2", item: "Cold Brew Cans", category: "Beverages", stock: 22, dailyUse: 10, vendor: "Roast Lab", monthlySpend: 240, threshold: 30 },
  { id: "item-3", item: "Green Tea Bags", category: "Beverages", stock: 64, dailyUse: 6, vendor: "Zen Leaf", monthlySpend: 72, threshold: 20 },
  { id: "item-4", item: "Protein Bars", category: "Snacks", stock: 18, dailyUse: 7, vendor: "Fuel Foods", monthlySpend: 210, threshold: 24 },
  { id: "item-5", item: "Trail Mix Packs", category: "Snacks", stock: 44, dailyUse: 5, vendor: "SnackBase", monthlySpend: 130, threshold: 20 },
  { id: "item-6", item: "Fruit Basket", category: "Fresh", stock: 15, dailyUse: 8, vendor: "Fresh Route", monthlySpend: 160, threshold: 18 },
  { id: "item-7", item: "Greek Yogurt Cups", category: "Fresh", stock: 12, dailyUse: 6, vendor: "Dairy Direct", monthlySpend: 145, threshold: 14 },
  { id: "item-8", item: "Paper Cups", category: "Supplies", stock: 210, dailyUse: 24, vendor: "OfficeHub", monthlySpend: 68, threshold: 80 },
  { id: "item-9", item: "Oat Milk", category: "Beverages", stock: 14, dailyUse: 4, vendor: "Barista Box", monthlySpend: 96, threshold: 16 }
];

let inventory = loadInventory();

const inventoryBody = document.getElementById("inventory-body");
const restockList = document.getElementById("restock-list");
const categoryBreakdown = document.getElementById("category-breakdown");
const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const addItemBtn = document.getElementById("add-item-btn");
const editorModal = document.getElementById("editor-modal");
const modalBackdrop = document.getElementById("modal-backdrop");
const closeModalBtn = document.getElementById("close-modal-btn");
const inventoryForm = document.getElementById("inventory-form");
const editorTitle = document.getElementById("editor-title");
const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
const editIdInput = document.getElementById("edit-id");
const itemNameInput = document.getElementById("item-name");
const itemCategoryInput = document.getElementById("item-category");
const itemStockInput = document.getElementById("item-stock");
const itemDailyUseInput = document.getElementById("item-daily-use");
const itemVendorInput = document.getElementById("item-vendor");
const itemMonthlySpendInput = document.getElementById("item-monthly-spend");
const itemThresholdInput = document.getElementById("item-threshold");

const totalItemsEl = document.getElementById("total-items");
const goodStockEl = document.getElementById("good-stock");
const lowStockEl = document.getElementById("low-stock");
const monthlySpendEl = document.getElementById("monthly-spend");

function loadInventory() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) return [...defaultInventory];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length ? parsed : [...defaultInventory];
  } catch (error) {
    return [...defaultInventory];
  }
}

function persistInventory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

function getStatus(item) {
  if (item.stock <= item.threshold) return "Low";
  if (item.stock <= item.threshold * 1.5) return "Watch";
  return "Good";
}

function getStatusClass(status) {
  if (status === "Low") return "status-low";
  if (status === "Watch") return "status-medium";
  return "status-good";
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function filteredInventory() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;

  return inventory.filter((item) => {
    const matchesQuery =
      item.item.toLowerCase().includes(query) ||
      item.vendor.toLowerCase().includes(query);
    const matchesCategory = category === "all" || item.category === category;
    return matchesQuery && matchesCategory;
  });
}

function renderTable(items) {
  inventoryBody.innerHTML = items.map((item) => {
    const status = getStatus(item);

    return `
      <tr>
        <td class="item-name">${item.item}</td>
        <td>${item.category}</td>
        <td>${item.stock} units</td>
        <td>${item.dailyUse}/day</td>
        <td>${item.vendor}</td>
        <td><span class="status-pill ${getStatusClass(status)}">${status}</span></td>
        <td>
          <div class="table-actions">
            <button class="table-btn edit-btn" type="button" data-id="${item.id}">Edit</button>
            <button class="table-btn delete-btn" type="button" data-id="${item.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function renderSummary(items) {
  const good = items.filter((item) => getStatus(item) === "Good").length;
  const low = items.filter((item) => getStatus(item) === "Low").length;
  const spend = items.reduce((sum, item) => sum + item.monthlySpend, 0);

  totalItemsEl.textContent = items.length;
  goodStockEl.textContent = good;
  lowStockEl.textContent = low;
  monthlySpendEl.textContent = formatCurrency(spend);
}

function renderRestock(items) {
  const priorities = [...items]
    .filter((item) => getStatus(item) !== "Good")
    .sort((a, b) => (a.stock / a.threshold) - (b.stock / b.threshold))
    .slice(0, 5);

  restockList.innerHTML = priorities.map((item) => {
    const daysLeft = Math.max(1, Math.floor(item.stock / item.dailyUse));
    const fill = Math.min(100, Math.round((item.stock / item.threshold) * 100));

    return `
      <article class="restock-item">
        <div class="restock-top">
          <strong>${item.item}</strong>
          <span>${daysLeft} day${daysLeft > 1 ? "s" : ""} left</span>
        </div>
        <p class="restock-meta">${item.stock} units on hand - reorder at ${item.threshold} - ${item.vendor}</p>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${fill}%"></div>
        </div>
      </article>
    `;
  }).join("") || "<p class='restock-item'>Everything looks comfortably stocked.</p>";
}

function renderBreakdown(items) {
  const totals = items.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.monthlySpend;
    return acc;
  }, {});

  const maxValue = Math.max(...Object.values(totals), 1);

  categoryBreakdown.innerHTML = Object.entries(totals).map(([category, spend]) => {
    const width = Math.round((spend / maxValue) * 100);

    return `
      <article class="breakdown-item">
        <div class="breakdown-top">
          <strong>${category}</strong>
          <span>${formatCurrency(spend)}</span>
        </div>
        <p class="breakdown-meta">Estimated monthly demand</p>
        <div class="progress-track">
          <div class="progress-bar" style="width: ${width}%"></div>
        </div>
      </article>
    `;
  }).join("");
}

function renderDashboard() {
  const items = filteredInventory();
  renderTable(items);
  renderSummary(items);
  renderRestock(items);
  renderBreakdown(items);
}

function openModal(item) {
  const editing = Boolean(item);
  editorTitle.textContent = editing ? "Edit pantry item" : "Add pantry item";
  editIdInput.value = item?.id || "";
  itemNameInput.value = item?.item || "";
  itemCategoryInput.value = item?.category || "Beverages";
  itemStockInput.value = item?.stock ?? "";
  itemDailyUseInput.value = item?.dailyUse ?? "";
  itemVendorInput.value = item?.vendor || "";
  itemMonthlySpendInput.value = item?.monthlySpend ?? "";
  itemThresholdInput.value = item?.threshold ?? "";
  editorModal.classList.remove("hidden");
  editorModal.setAttribute("aria-hidden", "false");
  itemNameInput.focus();
}

function closeModal() {
  editorModal.classList.add("hidden");
  editorModal.setAttribute("aria-hidden", "true");
  inventoryForm.reset();
  editIdInput.value = "";
}

function upsertItem(event) {
  event.preventDefault();

  const itemData = {
    id: editIdInput.value || `item-${Date.now()}`,
    item: itemNameInput.value.trim(),
    category: itemCategoryInput.value,
    stock: Number(itemStockInput.value),
    dailyUse: Number(itemDailyUseInput.value),
    vendor: itemVendorInput.value.trim(),
    monthlySpend: Number(itemMonthlySpendInput.value),
    threshold: Number(itemThresholdInput.value)
  };

  const existingIndex = inventory.findIndex((entry) => entry.id === itemData.id);

  if (existingIndex >= 0) {
    inventory[existingIndex] = itemData;
  } else {
    inventory.unshift(itemData);
  }

  persistInventory();
  renderDashboard();
  closeModal();
}

function removeItem(id) {
  inventory = inventory.filter((item) => item.id !== id);
  persistInventory();
  renderDashboard();
}

function resetInventory() {
  inventory = [...defaultInventory];
  persistInventory();
  renderDashboard();
  closeModal();
}

searchInput.addEventListener("input", renderDashboard);
categoryFilter.addEventListener("change", renderDashboard);
addItemBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
inventoryForm.addEventListener("submit", upsertItem);
resetDefaultsBtn.addEventListener("click", resetInventory);

inventoryBody.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) return;

  const { id } = button.dataset;
  if (!id) return;

  if (button.classList.contains("edit-btn")) {
    const item = inventory.find((entry) => entry.id === id);
    openModal(item);
  }

  if (button.classList.contains("delete-btn")) {
    removeItem(id);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !editorModal.classList.contains("hidden")) {
    closeModal();
  }
});

renderDashboard();
