const STORAGE_KEY = "applied-value-shanghai-inventory";
const WISHLIST_STORAGE_KEY = "applied-value-shanghai-wishlist";
const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE_URL = (APP_CONFIG.apiBaseUrl || "").trim();
const REFRESH_INTERVAL_MS = Number(APP_CONFIG.refreshIntervalMs) || 15000;
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
let wishlist = loadWishlist();

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
const wishlistForm = document.getElementById("wishlist-form");
const wishlistItems = document.getElementById("wishlist-items");
const wishItemInput = document.getElementById("wish-item");
const wishCategoryInput = document.getElementById("wish-category");
const wishRequesterInput = document.getElementById("wish-requester");
const wishNotesInput = document.getElementById("wish-notes");

const totalItemsEl = document.getElementById("total-items");
const goodStockEl = document.getElementById("good-stock");
const lowStockEl = document.getElementById("low-stock");
const monthlySpendEl = document.getElementById("monthly-spend");
const syncIndicator = document.getElementById("sync-indicator");

let refreshHandle = null;
let syncInFlight = false;
let wishlistSyncInFlight = false;

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

function loadWishlist() {
  const saved = localStorage.getItem(WISHLIST_STORAGE_KEY);

  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function persistWishlist() {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
}

async function fetchSharedWishlist() {
  if (!isSharedMode() || wishlistSyncInFlight) return;

  wishlistSyncInFlight = true;

  try {
    const response = await fetch(`${API_BASE_URL}?action=listWishlist`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load shared wishlist: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    wishlist = items.map((item, index) => ({
      id: String(item.id || `wish-${index + 1}`),
      item: String(item.item || "").trim(),
      category: String(item.category || "Snacks").trim(),
      requester: String(item.requester || "").trim(),
      notes: String(item.notes || "").trim()
    }));
    renderWishlist();
  } finally {
    wishlistSyncInFlight = false;
  }
}

async function saveSharedWishlist() {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "saveWishlist",
      items: wishlist
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to save shared wishlist: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error("Shared wishlist save was rejected");
  }
}

function isSharedMode() {
  return Boolean(API_BASE_URL);
}

function setSyncStatus(text, state) {
  if (!syncIndicator) return;
  syncIndicator.textContent = text;
  syncIndicator.dataset.state = state || "idle";
}

function sanitizeItem(item, fallbackId) {
  return {
    id: String(item.id || fallbackId),
    item: String(item.item || "").trim(),
    category: String(item.category || "Beverages").trim(),
    stock: Number(item.stock) || 0,
    dailyUse: Number(item.dailyUse) || 0,
    vendor: String(item.vendor || "").trim(),
    monthlySpend: Number(item.monthlySpend) || 0,
    threshold: Math.max(1, Number(item.threshold) || 1)
  };
}

async function fetchSharedInventory() {
  if (syncInFlight) return;

  syncInFlight = true;

  try {
    const response = await fetch(`${API_BASE_URL}?action=list`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load shared inventory: ${response.status}`);
    }

    const data = await response.json();
    const items = Array.isArray(data.items) ? data.items : [];
    inventory = items.map((item, index) => sanitizeItem(item, `shared-${index + 1}`));
    renderDashboard();
    setSyncStatus(APP_CONFIG.sharedModeLabel || "Shared mode", "connected");
  } finally {
    syncInFlight = false;
  }
}

async function saveSharedInventory() {
  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action: "save",
      items: inventory
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to save shared inventory: ${response.status}`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error("Shared inventory save was rejected");
  }

  setSyncStatus(`${APP_CONFIG.sharedModeLabel || "Shared mode"} synced`, "connected");
}

async function saveInventory() {
  if (isSharedMode()) {
    setSyncStatus("Syncing shared inventory...", "syncing");
    await saveSharedInventory();
    await fetchSharedInventory();
    return;
  }

  persistInventory();
  setSyncStatus("Local mode", "local");
}

async function initializeInventory() {
  if (!isSharedMode()) {
    inventory = loadInventory();
    wishlist = loadWishlist();
    setSyncStatus("Local mode", "local");
    renderDashboard();
    return;
  }

  setSyncStatus("Connecting to shared inventory...", "syncing");

  try {
    await fetchSharedInventory();
    await fetchSharedWishlist();
  } catch (error) {
    inventory = loadInventory();
    wishlist = loadWishlist();
    renderDashboard();
    setSyncStatus("Shared sync failed - using local mode", "error");
  }
}

function startSharedRefresh() {
  if (!isSharedMode()) return;

  refreshHandle = window.setInterval(async () => {
    try {
      await fetchSharedInventory();
    } catch (error) {
      setSyncStatus("Shared refresh failed", "error");
    }
  }, REFRESH_INTERVAL_MS);
}

async function refreshSharedInventory() {
  if (!isSharedMode()) return;

  try {
    await fetchSharedInventory();
    await fetchSharedWishlist();
  } catch (error) {
    setSyncStatus("Shared refresh failed", "error");
  }
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
  renderWishlist();
}

function renderWishlist() {
  if (!wishlist.length) {
    wishlistItems.innerHTML = "<div class='wish-empty'>No requests yet. Add a suggested item for the pantry team to review.</div>";
    return;
  }

  wishlistItems.innerHTML = wishlist.map((wish) => `
    <article class="wish-item">
      <div class="wish-top">
        <strong>${wish.item}</strong>
        <button class="table-btn delete-wish-btn" type="button" data-id="${wish.id}">Remove</button>
      </div>
      <p class="wish-meta">${wish.category} requested by ${wish.requester}</p>
      <p class="wish-notes">${wish.notes || "No extra notes provided."}</p>
    </article>
  `).join("");
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

async function upsertItem(event) {
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

  renderDashboard();
  await saveInventory();
  closeModal();
}

async function removeItem(id) {
  inventory = inventory.filter((item) => item.id !== id);
  renderDashboard();
  await saveInventory();
}

async function resetInventory() {
  inventory = [...defaultInventory];
  renderDashboard();
  await saveInventory();
  closeModal();
}

function addWish(event) {
async function addWish(event) {
  event.preventDefault();

  wishlist.unshift({
    id: `wish-${Date.now()}`,
    item: wishItemInput.value.trim(),
    category: wishCategoryInput.value,
    requester: wishRequesterInput.value.trim(),
    notes: wishNotesInput.value.trim()
  });

  renderWishlist();
  wishlistForm.reset();

  if (isSharedMode()) {
    await saveSharedWishlist();
    await fetchSharedWishlist();
    return;
  }

  persistWishlist();
}

async function removeWish(id) {
  wishlist = wishlist.filter((wish) => wish.id !== id);
  renderWishlist();

  if (isSharedMode()) {
    await saveSharedWishlist();
    await fetchSharedWishlist();
    return;
  }

  persistWishlist();
}

searchInput.addEventListener("input", renderDashboard);
categoryFilter.addEventListener("change", renderDashboard);
addItemBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", closeModal);
inventoryForm.addEventListener("submit", upsertItem);
resetDefaultsBtn.addEventListener("click", resetInventory);
wishlistForm.addEventListener("submit", addWish);

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

wishlistItems.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button || !button.classList.contains("delete-wish-btn")) return;

  removeWish(button.dataset.id);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !editorModal.classList.contains("hidden")) {
    closeModal();
  }
});

window.addEventListener("focus", refreshSharedInventory);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshSharedInventory();
  }
});

initializeInventory();
startSharedRefresh();
