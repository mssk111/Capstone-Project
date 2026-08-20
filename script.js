const ITEMS_KEY = "nuSecondhandItems";
const USERS_KEY = "nuSecondhandUsers";
const CHATS_KEY = "nuSecondhandChats";
const SESSION_KEY = "currentUser";
const FALLBACK_IMAGE_URL =
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=80";
const DEFAULT_LOCATIONS = ["Evanston Main Campus (North/South)"];
const DEFAULT_CATEGORY_BASELINES = [
  { category: "Clothing", price: 25 },
  { category: "Textbooks", price: 60 },
  { category: "Electronics", price: 35 },
  { category: "Bikes", price: 120 },
  { category: "Dorm", price: 15 },
  { category: "Furniture", price: 45 },
];
const CONDITION_PRICE_MULTIPLIERS = {
  New: 1.2,
  "Like New": 1.1,
  Good: 1,
  Used: 0.85,
  Fair: 0.7,
};

// Supabase configuration for real-time chat and user authentication.
const SUPABASE_URL = "https://bjhmrdlunzzipbxmojyv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XTJlnLIvuuS6-ME9yvpMIg_nk_I7U-4";
const supabaseClient = window.supabaseClient ||
  (typeof window.supabase?.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    : window.supabase || null);

// Keep the initialized client available to all application code and DevTools.
if (supabaseClient) {
  window.supabase = supabaseClient;
  window.supabaseClient = supabaseClient;
}

const state = {
  view: "market",
  query: "",
  category: "all",
  location: "all",
  conditions: [],
  maxPrice: 250,
  sort: "newest",
  activeListingId: null,
  activeChatId: null,
  editingItemId: null,
  selectedImageFile: null,
  selectedImageFiles: [],
  previewObjectUrl: "",
  originalImageUrl: "",
  listingImagesBucketReady: false,
  aiListingDrafts: [],
  activeAiDraftId: null,
  chatSubscription: null,
  chatSyncTimer: null,
  adminTab: "moderation",
  adminRole: false,
  analytics: null,
  categories: [],
};

const listingGrid = document.querySelector("#listingGrid");
const resultCount = document.querySelector("#resultCount");
const resultLabel = document.querySelector("#resultLabel");
const emptyState = document.querySelector("#emptyState");
const savedList = document.querySelector("#savedList");
const categoryFilter = document.querySelector("#categoryFilter");
const locationFilter = document.querySelector("#locationFilter");
const conditionFilters = Array.from(document.querySelectorAll('input[name="condition"][type="checkbox"]'));
const maxPrice = document.querySelector("#maxPrice");
const priceValue = document.querySelector("#priceValue");
const sortSelect = document.querySelector("#sortSelect");
const searchInput = document.querySelector("#searchInput");
const listingDialog = document.querySelector("#listingDialog");
const dialogSaveButton = document.querySelector("#dialogSaveButton");
const dialogContactButton = document.querySelector("#dialogContactButton");
const sellDialog = document.querySelector("#sellDialog");
const sellForm = document.querySelector("#sellForm");
const sellModalEyebrow = document.querySelector("#sellModalEyebrow");
const sellModalTitle = document.querySelector("#sellModalTitle");
const sellSubmitButton = document.querySelector("#sellSubmitButton");
const sellImageFile = document.querySelector("#sell-image-file");
const editImagePreview = document.querySelector("#editImagePreview");
const aiStatus = document.querySelector("#aiStatus");
const aiDraftReview = document.querySelector("#aiDraftReview");
const aiListingDrafts = document.querySelector("#aiListingDrafts");
const authDialog = document.querySelector("#authDialog");
const loginForm = document.querySelector("#loginForm");
const signupForm = document.querySelector("#signupForm");
const openAuthButton = document.querySelector("#openAuthButton");
const logoutButton = document.querySelector("#logoutButton");
const welcomeText = document.querySelector("#welcomeText");
const loginMessage = document.querySelector("#loginMessage");
const signupMessage = document.querySelector("#signupMessage");
const chatDialog = document.querySelector("#chatDialog");
const chatForm = document.querySelector("#chatForm");
const chatMessageInput = document.querySelector("#chatMessageInput");
const chatTitle = document.querySelector("#chatTitle");
const chatMeta = document.querySelector("#chatMeta");
const messageList = document.querySelector("#messageList");
const mobileNav = document.querySelector("#mobileNav");
const reportDialog = document.querySelector("#reportDialog");
const reportForm = document.querySelector("#reportForm");
const adminPanel = document.querySelector("#admin");
const adminContent = document.querySelector("#adminContent");

function normalizeItem(item) {
  const rawLocations = item.locations ?? item.pickup_location ?? item.pickup ?? item.location;
  const locations = Array.isArray(rawLocations)
    ? rawLocations
    : typeof rawLocations === "string"
      ? rawLocations.split(",")
      : [];

  return {
    id: item.id,
    title: item.title,
    price: Number(item.price) || 0,
    category: item.category || "Dorm",
    condition: item.condition || "Good",
    image: item.image || item.image_url || FALLBACK_IMAGE_URL,
    image_url: item.image_url || item.image_path || item.image || "",
    image_path: item.image_path || "",
    description: item.description || "",
    suggested_price: item.suggested_price ?? item.price,
    seller: item.seller || item.owner || "northwestern_market",
    locations: locations.map((location) => String(location).trim()).filter(Boolean).length > 0
      ? locations.map((location) => String(location).trim()).filter(Boolean)
      : DEFAULT_LOCATIONS,
    active: item.active !== false,
    saved: Boolean(item.saved),
    status: ["active", "flagged", "removed"].includes(item.status) ? item.status : "active",
  };
}

function normalizeChat(chat) {
  return {
    id: chat.id || `${chat.buyer}_${chat.seller}_${chat.itemId}`,
    supabaseId: chat.supabaseId || null,
    itemId: Number(chat.itemId),
    itemTitle: chat.itemTitle || "Marketplace item",
    buyer: chat.buyer || "",
    seller: chat.seller || "",
    messages: Array.isArray(chat.messages)
      ? chat.messages.map((message) => ({
          id: message.id || null,
          sender: message.sender || "",
          text: message.text || "",
          timestamp: Number(message.timestamp) || Date.now(),
        }))
      : [],
  };
}

function normalizeUser(user) {
  return {
    username: user.username || "",
    savedItems: Array.isArray(user.savedItems) ? user.savedItems.map(Number) : [],
    status: ["active", "warned", "banned"].includes(user.status) ? user.status : "active",
  };
}

function isAdmin() {
  return state.adminRole;
}

function redirectToMarket() {
  state.view = "market";
  if (window.location.hash !== "#market") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#market`);
  }
}

function applyHashRoute() {
  const requestedView = window.location.hash.slice(1);
  if (requestedView !== "admin") return;

  if (!isAdmin()) {
    redirectToMarket();
    render();
    return;
  }

  state.view = "admin";
  render();
}

async function refreshAdminAccess(currentUser = undefined) {
  state.adminRole = false;
  let user = currentUser;
  if (supabaseClient && user === undefined) {
    const { data, error } = await supabaseClient.auth.getUser();
    user = error ? null : data?.user || null;
  }
  state.adminRole = user?.app_metadata?.role === "admin";
  if (state.adminRole) {
    fetchAnalytics()
      .then((analytics) => { state.analytics = analytics; })
      .catch((error) => console.warn("Supabase analytics refresh failed:", error.message || error));
  } else {
    state.analytics = null;
  }
  updateAuthUI();
  if (state.view === "admin" && !state.adminRole) redirectToMarket();
  applyHashRoute();
  render();
}

async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getSession();
    if (data.session?.access_token) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) throw new Error((await response.text()) || "Request failed");
  return response.status === 204 ? null : response.json();
}

async function loadCategories() {
  try {
    const categories = await apiFetch("/api/categories");
    if (Array.isArray(categories) && categories.length) state.categories = categories;
  } catch (_) {
    state.categories = DEFAULT_CATEGORY_BASELINES.map((item, index) => ({
      id: item.category.toLowerCase(), name: item.category, slug: item.category.toLowerCase(), icon: "tag", is_active: true, display_order: index,
    }));
  }
  renderCategoryControls();
}

function renderCategoryControls() {
  const categories = state.categories.filter((category) => category.is_active !== false);
  categoryFilter.innerHTML = `<option value="all">All categories</option>${categories.map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`).join("")}`;
  document.querySelector(".category-tabs").innerHTML = `<button class="tab active" type="button" data-category="all">All</button>${categories.slice(0, 5).map((category) => `<button class="tab" type="button" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)}</button>`).join("")}`;
  document.querySelector("#category-select").innerHTML = `<option value="">Choose a category</option>${categories.map((category) => `<option>${escapeHtml(category.name)}</option>`).join("")}`;
  categoryFilter.value = state.category;
}

function initializeStorage() {
  // Marketplace listings are always loaded from Supabase, never seeded locally.
  localStorage.setItem(ITEMS_KEY, JSON.stringify([]));

  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify([]));
  } else {
    saveUsers(getUsers());
  }

  if (!localStorage.getItem(CHATS_KEY)) {
    localStorage.setItem(CHATS_KEY, JSON.stringify([]));
  } else {
    saveChats(getChats());
  }
}

function getItems() {
  try {
    return (JSON.parse(localStorage.getItem(ITEMS_KEY)) || []).map(normalizeItem);
  } catch (error) {
    localStorage.setItem(ITEMS_KEY, JSON.stringify([]));
    return [];
  }
}

function saveItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items.map(normalizeItem)));
}

function normalizeSupabaseListing(listing) {
  return normalizeItem({
    id: listing.local_item_id || listing.id,
    title: listing.title,
    price: listing.price,
    category: listing.category,
    condition: listing.condition,
    image: listing.image_url,
    image_url: listing.image_url,
    image_path: listing.image_path,
    description: listing.description,
    suggested_price: listing.suggested_price ?? listing.price,
    seller: listing.seller_username,
    locations: listing.pickup_location ?? listing.pickup ?? listing.location ?? listing.locations,
    active: listing.active !== false,
    status: listing.status || "active",
  });
}

async function loadListingsFromSupabase() {
  if (!supabaseClient) {
    saveItems([]);
    render();
    return;
  }

  const { data, error } = await supabaseClient
    .from("item_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Supabase listing load failed:", error.message);
    saveItems([]);
  } else {
    saveItems((data || []).map(normalizeSupabaseListing));
  }
  render();
}

function getUsers() {
  try {
    return (JSON.parse(localStorage.getItem(USERS_KEY)) || []).map(normalizeUser);
  } catch (error) {
    localStorage.setItem(USERS_KEY, JSON.stringify([]));
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users.map(normalizeUser)));
}

function getChats() {
  try {
    return (JSON.parse(localStorage.getItem(CHATS_KEY)) || []).map(normalizeChat);
  } catch (error) {
    localStorage.setItem(CHATS_KEY, JSON.stringify([]));
    return [];
  }
}

function saveChats(chats) {
  localStorage.setItem(CHATS_KEY, JSON.stringify(chats.map(normalizeChat)));
}

function setSessionCookie(name, value) {
  document.cookie = name + "=" + encodeURIComponent(value) + "; path=/";
}

function getSessionCookie(name) {
  const matches = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)")
  );
  return matches ? decodeURIComponent(matches[1]) : null;
}

function deleteSessionCookie(name) {
  document.cookie = name + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

function getCurrentUsername() {
  return getSessionCookie(SESSION_KEY);
}

function getCurrentUser() {
  const username = getCurrentUsername();
  if (!username) return null;
  return getUsers().find((user) => user.username === username) || null;
}

async function setCurrentUser(username) {
  setSessionCookie(SESSION_KEY, username);
  updateAuthUI();
  render();
  startChatSync(username);
  // getUser() retrieves the current authenticated user so fresh app_metadata claims apply now.
  await refreshAdminAccess();
}

function updateCurrentUser(updater) {
  const username = getCurrentUsername();
  if (!username) return null;

  const users = getUsers();
  const user = users.find((currentUser) => currentUser.username === username);
  if (!user) return null;

  updater(user);
  saveUsers(users);
  return user;
}

function requireLogin(message) {
  if (getCurrentUser()) return true;

  alert(message);
  openAuthDialog("login");
  return false;
}

function escapeHtml(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return String(value).replace(/[&<>"']/g, (character) => replacements[character]);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function isItemSaved(itemId) {
  const user = getCurrentUser();
  return Boolean(user && user.savedItems.includes(Number(itemId)));
}

function getImageSource(item) {
  return item.image || item.image_url || FALLBACK_IMAGE_URL;
}

function renderLocationChips(locations) {
  return `
    <div class="location-chips">
      ${locations
        .map((location) => `<span class="location-chip">📍 ${escapeHtml(location)}</span>`)
        .join("")}
    </div>
  `;
}

function getSelectedLocations() {
  const selectedLocations = Array.from(document.querySelectorAll('input[name="transactionLocation"]:checked')).map(
    (checkbox) => checkbox.value
  );
  const customLocation = document.querySelector("#custom-location-input").value.trim();
  return customLocation ? [...selectedLocations, customLocation] : selectedLocations;
}

function setSelectedLocations(locations) {
  const selected = new Set(locations);
  const locationCheckboxes = document.querySelectorAll('input[name="transactionLocation"]');
  locationCheckboxes.forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
  const standardLocations = new Set(Array.from(locationCheckboxes, (checkbox) => checkbox.value));
  document.querySelector("#custom-location-input").value = locations
    .filter((location) => !standardLocations.has(location))
    .join(", ");
}

function getCurrentUserChats() {
  const username = getCurrentUsername();
  if (!username) return [];

  return getChats()
    .filter((chat) => chat.buyer === username || chat.seller === username)
    .sort((a, b) => getLastMessageTime(b) - getLastMessageTime(a));
}

function getLastMessageTime(chat) {
  const lastMessage = chat.messages[chat.messages.length - 1];
  return lastMessage ? lastMessage.timestamp : 0;
}

function normalizeFilterValue(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

// Apply all marketplace controls before rendering.
function getVisibleItems() {
  const normalizedQuery = normalizeFilterValue(state.query);
  const selectedLocation = normalizeFilterValue(state.location);
  const selectedConditions = new Set(state.conditions.map(normalizeFilterValue));

  return getItems()
    .filter((item) => {
      if (state.view === "saved") {
        return isItemSaved(item.id);
      }

      if (!item.active) {
        return false;
      }

      const matchesSearch =
        !normalizedQuery ||
        `${item.title} ${item.category}`.toLowerCase().includes(normalizedQuery);
      const matchesCategory = state.category === "all" || item.category === state.category;
      const matchesPrice = Number(item.price) <= state.maxPrice;
      const matchesLocation =
        !selectedLocation ||
        selectedLocation === "all" ||
        item.locations.some((location) => normalizeFilterValue(location) === selectedLocation);
      // No selected conditions means that condition filtering is inactive.
      const matchesCondition =
        selectedConditions.size === 0 || selectedConditions.has(normalizeFilterValue(item.condition));

      return matchesSearch && matchesCategory && matchesPrice && matchesLocation && matchesCondition;
    })
    .sort((a, b) => {
      if (state.sort === "priceLow") return Number(a.price) - Number(b.price);
      if (state.sort === "priceHigh") return Number(b.price) - Number(a.price);
      return Number(b.id) - Number(a.id);
    });
}

function renderListings() {
  if (state.view === "inbox") {
    renderInbox();
    return;
  }

  if (state.view === "profile") {
    renderProfileDashboard();
    return;
  }

  const visibleItems = getVisibleItems();
  resultCount.textContent = visibleItems.length;
  resultLabel.textContent = state.view === "saved" ? "saved listings" : "campus listings";
  emptyState.hidden = visibleItems.length > 0;
  emptyState.textContent =
    state.view === "saved" ? "No saved listings yet." : "No matching listings right now.";

  listingGrid.innerHTML = visibleItems
    .map((item) => {
      const title = escapeHtml(item.title);
      const category = escapeHtml(item.category);
      const imageSource = escapeHtml(getImageSource(item));
      const saved = isItemSaved(item.id);
      const currentUsername = getCurrentUsername();
      const seller = escapeHtml(item.seller);
      const canContactSeller = !currentUsername || currentUsername !== item.seller;

      return `
        <article class="listing-card">
          <img src="${imageSource}" alt="${title}" />
          <div class="listing-content">
            <div class="listing-meta">
              <span class="badge">${category}</span>
              <span>${saved ? "Saved" : "Available"}</span>
            </div>
            <div>
              <h3>${title}</h3>
              <p>Northwestern student pickup</p>
              <span class="seller-line">Seller: ${seller}</span>
            </div>
            ${renderLocationChips(item.locations)}
            <div class="listing-footer">
              <span class="price">$${Number(item.price)}</span>
              <div class="card-actions">
                ${
                  canContactSeller
                    ? `<button class="secondary-button small-button contact-card-button" type="button"
                        data-action="contact-seller" data-id="${item.id}">
                        <i data-lucide="message-circle"></i>
                        Contact Seller
                      </button>`
                    : ""
                }
                <button class="icon-button ${saved ? "saved" : ""}" type="button"
                  data-action="toggle-save" data-id="${item.id}"
                  aria-label="${saved ? "Unsave" : "Save"} ${title}"
                  title="${saved ? "Unsave" : "Save"}">
                  <i data-lucide="heart"></i>
                </button>
                <button class="icon-button" type="button" data-action="view"
                  data-id="${item.id}" aria-label="View ${title}" title="View">
                  <i data-lucide="eye"></i>
                </button>
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  refreshIcons();
}

function renderProfileDashboard() {
  const username = getCurrentUsername();
  const myItems = getItems()
    .filter((item) => item.seller === username)
    .sort((a, b) => Number(b.id) - Number(a.id));
  const activeCount = myItems.filter((item) => item.active).length;

  resultCount.textContent = myItems.length;
  resultLabel.textContent = myItems.length === 1 ? "listed item" : "listed items";
  emptyState.hidden = myItems.length > 0;
  emptyState.textContent = "You have not listed anything yet.";
  listingGrid.classList.remove("inbox-grid");

  listingGrid.innerHTML = `
    <section class="dashboard-summary">
      <div>
        <p class="eyebrow">My Dashboard</p>
        <h3>${escapeHtml(username)}</h3>
        <p>${activeCount} active listings - ${myItems.length - activeCount} inactive listings</p>
      </div>
      <button class="primary-button" type="button" data-action="new-listing">
        <i data-lucide="plus"></i>
        New listing
      </button>
    </section>
    ${myItems.map(renderDashboardItemCard).join("")}
  `;

  refreshIcons();
}

function renderDashboardItemCard(item) {
  const title = escapeHtml(item.title);
  const category = escapeHtml(item.category);
  const status = item.active ? "Active" : "Inactive";

  return `
    <article class="listing-card dashboard-card">
      <img src="${escapeHtml(getImageSource(item))}" alt="${title}" />
      <div class="listing-content">
        <div class="listing-meta">
          <span class="badge">${category}</span>
          <span class="status-badge ${item.active ? "active" : "inactive"}">${status}</span>
        </div>
        <div>
          <h3>${title}</h3>
          <p>Your listing - $${Number(item.price)}</p>
        </div>
        ${renderLocationChips(item.locations)}
        <div class="card-actions">
          <button class="secondary-button small-button" type="button" data-action="edit-listing" data-id="${item.id}">
            <i data-lucide="pencil"></i>
            Edit
          </button>
          <button class="secondary-button small-button" type="button" data-action="toggle-active" data-id="${item.id}">
            <i data-lucide="${item.active ? "pause-circle" : "play-circle"}"></i>
            Mark ${item.active ? "Inactive" : "Active"}
          </button>
          <button class="secondary-button small-button delete-button ${item.active ? "" : "ready"}"
            type="button" data-action="delete-listing" data-id="${item.id}">
            <i data-lucide="trash-2"></i>
            Delete
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderInbox() {
  const chats = getCurrentUserChats();
  resultCount.textContent = chats.length;
  resultLabel.textContent = chats.length === 1 ? "conversation" : "conversations";
  emptyState.hidden = chats.length > 0;
  emptyState.textContent = "No active conversations yet.";
  listingGrid.classList.add("inbox-grid");

  listingGrid.innerHTML = chats
    .map((chat) => {
      const currentUsername = getCurrentUsername();
      const otherUser = chat.buyer === currentUsername ? chat.seller : chat.buyer;
      const lastMessage = chat.messages[chat.messages.length - 1];
      const preview = lastMessage ? lastMessage.text : "No messages yet.";
      const lastTime = lastMessage ? formatTimestamp(lastMessage.timestamp) : "";

      return `
        <article class="listing-card inbox-card">
          <div>
            <h3>${escapeHtml(chat.itemTitle)}</h3>
            <p>Conversation with ${escapeHtml(otherUser)}</p>
          </div>
          <p>${escapeHtml(preview)}</p>
          ${lastTime ? `<time>${lastTime}</time>` : ""}
          <button class="primary-button" type="button" data-action="open-chat" data-chat-id="${escapeHtml(chat.id)}">
            <i data-lucide="message-circle"></i>
            Open chat
          </button>
        </article>
      `;
    })
    .join("");

  refreshIcons();
}

function renderSavedSummary() {
  const user = getCurrentUser();
  const savedIds = user ? user.savedItems : [];
  const savedItems = getItems().filter((item) => savedIds.includes(Number(item.id)));

  savedList.innerHTML =
    savedItems.length === 0
      ? "<span>No saved listings yet.</span>"
      : savedItems
          .map((item) => `<span class="saved-chip">${escapeHtml(item.title)} - $${item.price}</span>`)
          .join("");
}

function render() {
  updateNavLinks();
  adminPanel.hidden = state.view !== "admin" || !isAdmin();
  listingGrid.classList.toggle("inbox-grid", state.view === "inbox");
  listingGrid.classList.toggle("dashboard-grid", state.view === "profile");
  renderListings();
  renderSavedSummary();
  updateDialogSaveButton();
  if (state.view === "admin" && isAdmin()) renderAdminPanel();
}

function updateNavLinks() {
  document.querySelectorAll("[data-nav-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.navView === state.view);
  });
}

function syncAdminNavigation() {
  document.querySelectorAll("[data-admin-nav-slot]").forEach((slot) => {
    slot.replaceChildren();
    if (!isAdmin()) return;

    const link = document.createElement("a");
    link.href = "#admin";
    link.dataset.navView = "admin";
    link.textContent = "Admin Dashboard";
    link.classList.toggle("active", state.view === "admin");
    link.addEventListener("click", handleNavigationClick);
    slot.append(link);
  });
}

function updateAuthUI() {
  const user = getCurrentUser();
  const username = user ? user.username : "";
  const loggedIn = Boolean(user);

  if (getCurrentUsername() && !user) {
    deleteSessionCookie(SESSION_KEY);
  }

  openAuthButton.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  welcomeText.hidden = !loggedIn;
  welcomeText.textContent = loggedIn ? `Welcome, ${username}` : "";

  document.querySelectorAll("[data-open-auth]").forEach((button) => {
    button.hidden = loggedIn;
  });
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.hidden = !loggedIn;
  });
  document.querySelectorAll("[data-auth-only]").forEach((element) => {
    element.hidden = !loggedIn;
  });
  syncAdminNavigation();

  refreshIcons();
}

function setView(view) {
  if (view === "saved" && !requireLogin("Please log in to view your saved items.")) return;
  if (view === "inbox" && !requireLogin("Please log in to view your inbox.")) return;
  if (view === "profile" && !requireLogin("Please log in to view your profile.")) return;
  if (view === "admin" && !isAdmin()) {
    redirectToMarket();
    render();
    return false;
  }

  state.view = view;

  if (view === "inbox") {
    refreshChatsFromSupabase().catch((error) => {
      console.warn("Supabase chat refresh failed:", error.message || error);
    });
  }

  if (view === "market" || view === "saved" || view === "profile") {
    state.category = "all";
    categoryFilter.value = "all";
    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.category === "all");
    });
  }

  render();
  return true;
}

function priorityLabel(reason) {
  return reason === "scam" ? "High" : reason === "harassment" ? "Medium" : "Standard";
}

function adminActionButton(label, action, id, extra = "") {
  return `<button class="secondary-button small-button ${extra}" type="button" data-admin-action="${action}" data-id="${escapeHtml(id)}">${label}</button>`;
}

async function renderAdminPanel() {
  const status = document.querySelector("#adminStatus");
  try {
    if (state.adminTab === "moderation") {
      const usersNeedingAttention = await fetchUsersNeedingAttention();
      adminContent.innerHTML = `<section><h3>Users needing attention</h3><p class="queue-note">Users appear here after receiving more than five reports across their listings.</p>${renderUsersNeedingAttention(usersNeedingAttention)}</section>`;
    } else if (state.adminTab === "reports") {
      if (!supabaseClient) throw new Error("Supabase is unavailable");
      const { data: reports, error } = await supabaseClient
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      adminContent.innerHTML = `<section><h3>Submitted reports</h3><div class="queue-note">Newest reports appear first. Use the row actions to complete review.</div>${renderReportTable(reports || [])}</section>`;
    } else {
      const analytics = await fetchAnalytics();
      state.analytics = analytics;
      adminContent.innerHTML = renderAnalytics(analytics);
    }
    status.textContent = "";
  } catch (error) {
    adminContent.innerHTML = `<p class="empty-state admin-empty">Could not load this dashboard section. Start the API service and sign in with an admin account.</p>`;
    status.textContent = "Live service unavailable";
  }
  refreshIcons();
}

async function fetchUsersNeedingAttention() {
  if (!supabaseClient) throw new Error("Supabase is unavailable");

  const [{ data: reports, error: reportsError }, { data: listings, error: listingsError }] = await Promise.all([
    supabaseClient.from("reports").select("reported_user_id, listing_id"),
    supabaseClient.from("item_listings").select("local_item_id, seller_auth_user_id, seller_username"),
  ]);
  if (reportsError) throw reportsError;
  if (listingsError) throw listingsError;

  const listingOwners = new Map((listings || []).map((listing) => [
    String(listing.local_item_id),
    { id: listing.seller_auth_user_id || listing.seller_username, username: listing.seller_username },
  ]));
  const reportCounts = new Map();
  (reports || []).forEach((report) => {
    const listingOwner = listingOwners.get(String(report.listing_id));
    const userId = report.reported_user_id || listingOwner?.id;
    if (!userId) return;
    const current = reportCounts.get(userId) || {
      id: userId,
      username: listingOwner?.username || userId,
      chatUsername: listingOwner?.username || userId,
      reportCount: 0,
    };
    current.reportCount += 1;
    reportCounts.set(userId, current);
  });

  const userIds = [...reportCounts.keys()];
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await supabaseClient
      .from("student_profiles")
      .select("auth_user_id, username")
      .in("auth_user_id", userIds);
    if (!profilesError) {
      const usernames = new Map((profiles || []).map((profile) => [profile.auth_user_id, profile.username]));
      reportCounts.forEach((user) => { user.username = usernames.get(user.id) || user.username; });
    }
  }

  return [...reportCounts.values()]
    .filter((user) => user.reportCount > 5)
    .sort((a, b) => b.reportCount - a.reportCount || String(a.username).localeCompare(String(b.username)));
}

function renderUsersNeedingAttention(users) {
  if (!users.length) return `<p class="admin-empty">Nothing requires action.</p>`;
  return `<div class="table-scroll"><table><thead><tr><th>User</th><th>Total reports</th><th>Actions</th></tr></thead><tbody>${users.map((user) => `<tr><td>${escapeHtml(user.username || user.id)}</td><td><span class="status-badge flagged">${user.reportCount}</span></td><td>${adminActionButton("Warn User", "warn-user", user.chatUsername || user.username || user.id)}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderReportTable(reports) {
  if (!reports.length) return `<p class="admin-empty">The report queue is clear.</p>`;
  return `<div class="table-scroll"><table><thead><tr><th>Priority</th><th>Reason</th><th>Details</th><th>Submitted</th><th>Actions</th></tr></thead><tbody>${reports.map((report) => `<tr><td>${priorityLabel(report.reason)}</td><td>${escapeHtml(report.reason)}</td><td>${escapeHtml(report.details || "—")}</td><td>${new Date(report.created_at).toLocaleDateString()}</td><td>${adminActionButton("Resolve", "resolve-report", report.id)}</td></tr>`).join("")}</tbody></table></div>`;
}

async function fetchAnalytics() {
  if (!supabaseClient) throw new Error("Supabase is unavailable");

  const [{ count: activeUsers, error: usersError }, { count: productsInStock, error: listingsError }] = await Promise.all([
    supabaseClient.from("student_profiles").select("*", { count: "exact", head: true }),
    supabaseClient.from("item_listings").select("*", { count: "exact", head: true }),
  ]);
  if (usersError) throw usersError;
  if (listingsError) throw listingsError;

  return { activeUsers: activeUsers || 0, productsInStock: productsInStock || 0 };
}

function renderAnalytics(data) {
  const cards = [
    ["Active Users", data.activeUsers],
    ["Products in Stock", data.productsInStock],
  ];
  return `<section><h3>Platform analytics</h3><div class="metric-grid">${cards.map(([label, value]) => `<article class="metric-card"><span>${label}</span><strong>${Number(value || 0).toLocaleString()}</strong></article>`).join("")}</div></section>`;
}

function setCategory(category) {
  state.view = "market";
  state.category = category;
  categoryFilter.value = category;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.category === category);
  });

  render();
}

function toggleSaved(id) {
  if (!requireLogin("Please log in before saving items.")) return;

  const itemId = Number(id);
  updateCurrentUser((user) => {
    user.savedItems = Array.isArray(user.savedItems) ? user.savedItems : [];

    if (user.savedItems.includes(itemId)) {
      user.savedItems = user.savedItems.filter((savedId) => savedId !== itemId);
    } else {
      user.savedItems.push(itemId);
    }
  });

  // Keep each item object's boolean saved field in sync for this local session view.
  const items = getItems().map((item) => ({
    ...item,
    saved: Number(item.id) === itemId ? isItemSaved(itemId) : item.saved,
  }));
  saveItems(items);
  render();
}

function openListing(id) {
  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(id));
  if (!item) return;
  const currentUsername = getCurrentUsername();

  state.activeListingId = Number(id);
  document.querySelector("#dialogImage").src = getImageSource(item);
  document.querySelector("#dialogImage").alt = item.title;
  document.querySelector("#dialogMeta").textContent = `${item.category} - Northwestern pickup`;
  document.querySelector("#dialogTitle").textContent = `${item.title} - $${Number(item.price)}`;
  document.querySelector("#dialogDescription").textContent =
    "Message the seller to coordinate pickup on or near campus.";
  dialogContactButton.hidden = Boolean(currentUsername && currentUsername === item.seller);
  dialogContactButton.dataset.id = item.id;
  document.querySelector("#dialogReportButton").dataset.id = item.id;

  updateDialogSaveButton();
  listingDialog.showModal();
  refreshIcons();
}

function openReportDialog() {
  if (!requireLogin("Please log in before submitting a report.")) return;
  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(state.activeListingId));
  if (!item) return;
  reportForm.reset();
  document.querySelector("#reportMessage").textContent = "";
  document.querySelector("#reportTarget").textContent = `You are reporting “${item.title}” posted by ${item.seller}.`;
  reportDialog.showModal();
  refreshIcons();
}

function updateDialogSaveButton() {
  if (!state.activeListingId || !dialogSaveButton) return;

  const saved = isItemSaved(state.activeListingId);
  dialogSaveButton.classList.toggle("saved", saved);
  dialogSaveButton.innerHTML = `<i data-lucide="heart"></i>${saved ? "Unsave" : "Save"}`;
  refreshIcons();
}

function openSellDialog() {
  if (!requireLogin("Please log in before selling an item.")) return;

  openCreateModal();
}

function openCreateModal() {
  prepareSellFormForCreate();
  sellDialog.showModal();
  refreshIcons();
}

function clearImageUploadState() {
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.previewObjectUrl = "";
  state.originalImageUrl = "";
  state.selectedImageFile = null;
  state.selectedImageFiles = [];
  sellImageFile.value = "";
}

function previewSelectedImage(file) {
  if (state.previewObjectUrl) URL.revokeObjectURL(state.previewObjectUrl);
  state.previewObjectUrl = URL.createObjectURL(file);
  editImagePreview.src = state.previewObjectUrl;
  editImagePreview.hidden = false;
}

function prepareSellFormForCreate() {
  state.editingItemId = null;
  clearImageUploadState();
  state.aiListingDrafts = [];
  sellForm.reset();
  renderAiListingDrafts();
  editImagePreview.hidden = true;
  editImagePreview.removeAttribute("src");
  setSelectedLocations([]);
  sellForm.classList.remove("ai-analyzing");
  aiStatus.textContent = "✨ Upload photos to detect one or more items for review.";
  sellModalEyebrow.textContent = "Create listing";
  sellModalTitle.textContent = "Sell an item";
  sellSubmitButton.innerHTML = '<i data-lucide="plus"></i>Add listing';
}

function openEditListing(id) {
  if (!requireLogin("Please log in before editing a listing.")) return;

  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(id));
  if (!item || item.seller !== getCurrentUsername()) return;

  openEditModal(item);
}

function openEditModal(item) {
  const titleInput = document.querySelector("#title-input");
  const priceInput = document.querySelector("#price-input");
  const categorySelect = document.querySelector("#category-select");
  const conditionSelect = document.querySelector("#condition-select");
  const imageUrlInput = document.querySelector("#itemImageUrl");
  const existingImageUrl = item.image_url || item.image_path || item.image || "";

  state.editingItemId = Number(item.id);
  clearImageUploadState();
  state.originalImageUrl = existingImageUrl;
  state.aiListingDrafts = [];
  sellForm.reset();
  renderAiListingDrafts();
  sellForm.classList.remove("ai-analyzing");
  aiStatus.textContent = "Upload a new image to let AI refresh these details.";
  sellModalEyebrow.textContent = "Edit listing";
  sellModalTitle.textContent = "Update item";
  sellSubmitButton.innerHTML = '<i data-lucide="save"></i>Save changes';
  titleInput.value = item.title || "";
  priceInput.value = item.suggested_price || item.price || "";
  categorySelect.value = item.category || "Dorm";
  conditionSelect.value = item.condition || "Good";
  imageUrlInput.value = existingImageUrl.startsWith("data:") ? "" : existingImageUrl;
  editImagePreview.src = existingImageUrl || FALLBACK_IMAGE_URL;
  editImagePreview.hidden = false;
  setSelectedLocations(item.locations);
  sellDialog.showModal();
  refreshIcons();
}

async function toggleListingActive(id) {
  const username = getCurrentUsername();
  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(id));
  if (!item || item.seller !== username || !supabaseClient) return;

  const { error } = await supabaseClient
    .from("item_listings")
    .update({ active: !item.active })
    .eq("local_item_id", String(id))
    .eq("seller_username", username);
  if (error) {
    console.warn("Supabase listing status update failed:", error.message);
    return;
  }
  await loadListingsFromSupabase();
}

async function deleteItem(itemId) {
  const confirmed = confirm("Are you sure you want to permanently delete this listing?");
  if (!confirmed) return;

  try {
    await deleteListingFromSupabase(itemId);
    await loadListingsFromSupabase();
    state.view = "profile";
    render();
  } catch (error) {
    console.error("Listing delete failed:", error);
    alert("Unable to delete listing. Please try again.");
  }
}

function buildChatId(buyer, seller, itemId) {
  return `${buyer}_${seller}_${itemId}`;
}

function getOrCreateChat(item) {
  const buyer = getCurrentUsername();
  const seller = item.seller;
  const chatId = buildChatId(buyer, seller, item.id);
  const chats = getChats();
  let chat = chats.find((currentChat) => currentChat.id === chatId);

  if (!chat) {
    chat = {
      id: chatId,
      itemId: Number(item.id),
      itemTitle: item.title,
      buyer,
      seller,
      messages: [],
    };
    chats.push(chat);
    saveChats(chats);
  }

  return chat;
}

function openChatForItem(id) {
  if (!requireLogin("Please log in before contacting a seller.")) return;

  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(id));
  if (!item) return;

  if (item.seller === getCurrentUsername()) {
    alert("You cannot message yourself about your own listing.");
    return;
  }

  const chat = getOrCreateChat(item);
  openChat(chat.id);
}

function openChat(chatId) {
  const chat = getChats().find((currentChat) => currentChat.id === chatId);
  const username = getCurrentUsername();
  if (!chat || !username || (chat.buyer !== username && chat.seller !== username)) return;

  state.activeChatId = chat.id;
  renderChatModal();
  chatDialog.showModal();
  refreshIcons();
}

function renderChatModal() {
  const chat = getChats().find((currentChat) => currentChat.id === state.activeChatId);
  if (!chat) return;

  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(chat.itemId));
  const otherUser = chat.buyer === getCurrentUsername() ? chat.seller : chat.buyer;
  chatTitle.textContent = `${chat.itemTitle} - $${item ? Number(item.price) : "N/A"}`;
  chatMeta.textContent = `Chat with ${otherUser}`;

  messageList.innerHTML =
    chat.messages.length === 0
      ? '<p class="empty-state">No messages yet.</p>'
      : chat.messages
          .map((message) => {
            const mine = message.sender === getCurrentUsername();
            return `
              <div class="message-row ${mine ? "mine" : ""}">
                <div class="message-bubble">
                  <strong>${escapeHtml(message.sender)}</strong>
                  <span>${escapeHtml(message.text)}</span>
                  <time>${formatTimestamp(message.timestamp)}</time>
                </div>
              </div>
            `;
          })
          .join("");

  messageList.scrollTop = messageList.scrollHeight;
}

async function sendChatMessage(text) {
  const username = getCurrentUsername();
  if (!state.activeChatId || !username) return;

  const chat = getChats().find((currentChat) => currentChat.id === state.activeChatId);
  if (!chat) return;

  // Persist remotely before updating the local cache and UI.
  const supabaseChatId = await syncChatToSupabase(chat.itemId, chat.buyer, chat.seller);
  let syncedMessage = null;
  if (supabaseChatId) {
    syncedMessage = await syncMessageToSupabase(supabaseChatId, username, text);
  }

  // Re-read after the network request in case a realtime refresh ran while sending.
  const chats = getChats();
  const latestChat = chats.find((currentChat) => currentChat.id === state.activeChatId);
  if (!latestChat) return;

  latestChat.supabaseId = supabaseChatId || latestChat.supabaseId;
  if (!syncedMessage?.id || !latestChat.messages.some((message) => message.id === syncedMessage.id)) {
    latestChat.messages.push({
      id: syncedMessage?.id || null,
      sender: username,
      text,
      timestamp: syncedMessage?.created_at
        ? new Date(syncedMessage.created_at).getTime()
        : Date.now(),
    });
  }
  saveChats(chats);
  renderChatModal();
  render();
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function openAuthDialog(mode = "login") {
  showAuthMode(mode);
  authDialog.showModal();
  refreshIcons();
}

function showAuthMode(mode) {
  const signupMode = mode === "signup";
  loginForm.hidden = signupMode;
  signupForm.hidden = !signupMode;
  loginMessage.textContent = "";
  signupMessage.textContent = "";
}

function closeMobileNav() {
  mobileNav.hidden = true;
  document.querySelector(".mobile-menu-button").setAttribute("aria-expanded", "false");
}

async function logout() {
  stopChatSync();
  state.adminRole = false;
  deleteSessionCookie(SESSION_KEY);
  redirectToMarket();
  updateAuthUI();
  render();

  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) console.warn("Supabase sign-out failed:", error.message);
  }
  await refreshAdminAccess();
}

function readUploadedImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function compressListingImageForDatabase(file, maxDimension = 960, quality = 0.68) {
  if (!file) return "";

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression is unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    return canvas.toDataURL("image/webp", quality);
  } catch (error) {
    console.warn("Image compression failed; using the original image data:", error);
    return readUploadedImage(file);
  }
}

async function uploadListingImageToStorage(file) {
  if (!file) return "";
  if (!state.listingImagesBucketReady) await initializeListingImagesBucket();
  if (!state.listingImagesBucketReady) {
    throw new Error("Image storage is not configured. Ask an administrator to create the listing-images bucket.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabaseClient.storage
    .from("listing-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from("listing-images").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("The uploaded image does not have a public URL.");
  return data.publicUrl;
}

async function initializeListingImagesBucket() {
  // Bucket creation and inspection require elevated privileges. The browser only
  // attempts an upload; administrators create `listing-images` once in Supabase.
  state.listingImagesBucketReady = Boolean(supabaseClient?.storage);
  return state.listingImagesBucketReady;
}

function buildSupabaseEmail(username) {
  return username.includes("@") ? username : `${username}@northwestern.local`;
}

async function syncSignupToSupabase({ username, password }) {
  if (!supabaseClient) return;

  const campusEmail = buildSupabaseEmail(username);
  const { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: campusEmail,
    password,
    options: {
      data: {
        username,
      },
    },
  });

  if (authError) {
    throw authError;
  }

  const { error: profileError } = await supabaseClient.from("student_profiles").upsert(
    {
      auth_user_id: authData.user?.id || null,
      username,
      full_name: username,
      campus_email: campusEmail,
      contact_info: "",
    },
    { onConflict: "username" }
  );

  if (profileError) {
    throw profileError;
  }

  return authData.user;
}

async function syncChatToSupabase(itemId, buyer, seller) {
  if (!supabaseClient) return null;

  const { data: existingChat, error: selectError } = await supabaseClient
    .from("chats")
    .select("id")
    .eq("item_id", Number(itemId))
    .eq("buyer_username", buyer)
    .eq("seller_username", seller)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existingChat) return existingChat.id;

  const { data: newChat, error: insertError } = await supabaseClient
    .from("chats")
    .insert({
      item_id: Number(itemId),
      buyer_username: buyer,
      seller_username: seller,
    })
    .select("id")
    .single();

  // Another browser may have created the same room after our initial check.
  if (insertError?.code === "23505") {
    const { data: concurrentChat, error: retryError } = await supabaseClient
      .from("chats")
      .select("id")
      .eq("item_id", Number(itemId))
      .eq("buyer_username", buyer)
      .eq("seller_username", seller)
      .single();

    if (retryError) throw retryError;
    return concurrentChat.id;
  }

  if (insertError) throw insertError;
  return newChat.id;
}

async function syncMessageToSupabase(chatId, sender, messageText) {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from("chat_messages")
    .insert({
      chat_id: chatId,
      sender_username: sender,
      message_text: messageText,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return data;
}

async function sendModerationWarning(targetUsername) {
  if (!supabaseClient) throw new Error("Supabase chat is unavailable.");

  const systemUsername = "system_admin";
  const warningText = "Official Moderation Warning: Your listings have received multiple reports. Please review our platform guidelines.";
  let { data: chat, error: chatError } = await supabaseClient
    .from("chats")
    .select("id")
    .eq("buyer_username", systemUsername)
    .eq("seller_username", targetUsername)
    .maybeSingle();
  if (chatError) throw chatError;

  if (!chat) {
    const { data: listing, error: listingError } = await supabaseClient
      .from("item_listings")
      .select("local_item_id")
      .eq("seller_username", targetUsername)
      .limit(1)
      .maybeSingle();
    if (listingError) throw listingError;
    if (!listing?.local_item_id) throw new Error("No listing was found for this user’s warning chat.");

    const { data: newChat, error: createError } = await supabaseClient
      .from("chats")
      .insert({
        item_id: Number(listing.local_item_id),
        buyer_username: systemUsername,
        seller_username: targetUsername,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    chat = newChat;
  }

  const { error: messageError } = await supabaseClient
    .from("chat_messages")
    .insert({
      chat_id: chat.id,
      sender_username: systemUsername,
      message_text: warningText,
    });
  if (messageError) throw messageError;
}

async function refreshChatsFromSupabase() {
  const username = getCurrentUsername();
  if (!supabaseClient || !username) return;

  const { data: cloudChats, error } = await supabaseClient
    .from("chats")
    .select(`
      id,
      item_id,
      buyer_username,
      seller_username,
      chat_messages (
        id,
        sender_username,
        message_text,
        created_at
      )
    `)
    .or(`buyer_username.eq.${username},seller_username.eq.${username}`);

  if (error) throw error;
  if (username !== getCurrentUsername()) return;

  const localChats = getChats();
  const items = getItems();

  (cloudChats || []).forEach((cloudChat) => {
    const localId = buildChatId(
      cloudChat.buyer_username,
      cloudChat.seller_username,
      cloudChat.item_id
    );
    const existingChat = localChats.find(
      (chat) => chat.supabaseId === cloudChat.id || chat.id === localId
    );
    const item = items.find((currentItem) => Number(currentItem.id) === Number(cloudChat.item_id));
    const messages = (cloudChat.chat_messages || [])
      .map((message) => ({
        id: message.id,
        sender: message.sender_username,
        text: message.message_text,
        timestamp: new Date(message.created_at).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const syncedChat = {
      id: localId,
      supabaseId: cloudChat.id,
      itemId: Number(cloudChat.item_id),
      itemTitle: existingChat?.itemTitle || item?.title || "Marketplace item",
      buyer: cloudChat.buyer_username,
      seller: cloudChat.seller_username,
      messages,
    };

    if (existingChat) {
      Object.assign(existingChat, syncedChat);
    } else {
      localChats.push(syncedChat);
    }
  });

  saveChats(localChats);

  if (state.view === "inbox") render();
  if (chatDialog.open && state.activeChatId) renderChatModal();
}

function stopChatSync() {
  if (state.chatSyncTimer) {
    window.clearInterval(state.chatSyncTimer);
    state.chatSyncTimer = null;
  }

  if (state.chatSubscription && supabaseClient) {
    supabaseClient.removeChannel(state.chatSubscription);
    state.chatSubscription = null;
  }
}

function startChatSync(username = getCurrentUsername()) {
  stopChatSync();
  if (!supabaseClient || !username) return;

  refreshChatsFromSupabase().catch((error) => {
    console.warn("Supabase initial chat sync failed:", error.message || error);
  });

  state.chatSubscription = supabaseClient
    .channel(`marketplace-chat-${username}-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages" },
      (payload) => {
        if (payload.new.sender_username === getCurrentUsername()) return;
        refreshChatsFromSupabase().catch((error) => {
          console.warn("Supabase realtime chat refresh failed:", error.message || error);
        });
      }
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chats" },
      () => {
        refreshChatsFromSupabase().catch((error) => {
          console.warn("Supabase realtime room refresh failed:", error.message || error);
        });
      }
    )
    .subscribe();

  state.chatSyncTimer = window.setInterval(() => {
    refreshChatsFromSupabase().catch((error) => {
      console.warn("Supabase periodic chat refresh failed:", error.message || error);
    });
  }, 5000);
}

async function insertListingIntoSupabase(item) {
  return insertListingsIntoSupabase([item]);
}

async function insertListingsIntoSupabase(items) {
  if (!supabaseClient) throw new Error("Supabase is unavailable.");

  const { data: sessionData, error: sessionError } = await supabaseClient.auth.getUser();
  if (sessionError || !sessionData?.user) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const { data, error } = await supabaseClient.from("item_listings").insert(items.map((item) => ({
    seller_auth_user_id: sessionData.user.id,
    seller_username: item.seller,
    local_item_id: String(item.id),
    title: item.title,
    description: item.description || item.title,
    category: item.category,
    price: Number(item.price),
    condition: item.condition,
    pickup_location: item.locations.join(", "),
    image_url: item.image,
    active: item.active,
  }))).select("local_item_id");

  if (error) {
    throw error;
  }
  if (!data || data.length !== items.length) {
    throw new Error("The listing was not saved. Check database permissions.");
  }

  return data;
}

async function updateListingInSupabase(item) {
  if (!supabaseClient) throw new Error("Supabase is unavailable.");

  const username = getCurrentUsername();
  const { data, error } = await supabaseClient
    .from("item_listings")
    .update({
      title: item.title,
      description: item.description || item.title,
      category: item.category,
      price: Number(item.price),
      condition: item.condition,
      pickup_location: item.locations.join(", "),
      image_url: item.image_url || item.image_path || item.image,
    })
    .eq("local_item_id", String(item.id))
    .eq("seller_username", username)
    .select("local_item_id");

  if (error) {
    throw error;
  }
  if (!data?.length) {
    throw new Error("The listing was not updated. Check ownership and row-level security policies.");
  }
}

async function deleteListingFromSupabase(itemId) {
  if (!supabaseClient) throw new Error("Supabase is unavailable.");

  const username = getCurrentUsername();
  const { data, error } = await supabaseClient
    .from("item_listings")
    .delete()
    .eq("local_item_id", String(itemId))
    .eq("seller_username", username)
    .select("local_item_id");

  if (error) {
    throw error;
  }
  if (!data?.length) {
    throw new Error("The listing was not deleted. Check ownership and row-level security policies.");
  }
}

function getDefaultPriceForCategory(category) {
  return DEFAULT_CATEGORY_BASELINES.find((entry) => entry.category === category)?.price || 20;
}

function getMedianPrice(prices) {
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const middle = Math.floor(sortedPrices.length / 2);

  return sortedPrices.length % 2
    ? sortedPrices[middle]
    : (sortedPrices[middle - 1] + sortedPrices[middle]) / 2;
}

function estimateItemPrice(category, condition, items = getItems()) {
  if (!category || !condition) return null;

  const historicalPrices = items
    .filter((item) => item.category === category && Number(item.price) >= 0)
    .map((item) => Number(item.price));
  const baseline = historicalPrices.length
    ? getMedianPrice(historicalPrices)
    : getDefaultPriceForCategory(category);

  return Math.round(baseline * (CONDITION_PRICE_MULTIPLIERS[condition] || 1));
}

function updateEstimatedPrice() {
  const category = document.querySelector("#category-select").value;
  const condition = document.querySelector("#condition-select").value;
  const estimatedPrice = estimateItemPrice(category, condition);

  if (estimatedPrice !== null) {
    document.querySelector("#price-input").value = estimatedPrice;
  }
}

function getFallbackTitle(file) {
  return file?.name?.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Uploaded item";
}

function normalizeAiListingDraft(item, imageDataUrls = [], files = []) {
  const sourceFile = files[Number(item.image_index) || 0];
  const fallbackTitle = getFallbackTitle(sourceFile);
  const requestedCategory = item.category || "Dorm";
  const category = state.categories.some((entry) => entry.name === requestedCategory)
    ? requestedCategory
    : "Dorm";
  const randomPrice = Math.floor(Math.random() * 21) + 30;
  return {
    id: crypto.randomUUID(),
    title: String(item.title || fallbackTitle).trim(),
    category,
    suggested_price: Math.max(0, Number(item.suggested_price || randomPrice)),
    condition: ["New", "Like New", "Good", "Used", "Fair"].includes(item.condition) ? item.condition : "Good",
    description: String(item.description || "Item listing uploaded via marketplace.").trim(),
    image: imageDataUrls[Number(item.image_index) || 0] || "",
    sourceImageIndex: Number(item.image_index) || 0,
  };
}

function generateFallbackListing(file) {
  const title = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim() || "Uploaded item";

  return {
    title,
    suggested_price: Math.floor(Math.random() * 21) + 30,
    description: "Item listing uploaded via marketplace.",
    category: "Dorm",
    condition: "Good",
  };
}

function renderAiListingDrafts() {
  const drafts = state.aiListingDrafts;
  if (drafts.length && !drafts.some((draft) => draft.id === state.activeAiDraftId)) {
    state.activeAiDraftId = drafts[0].id;
  }
  aiDraftReview.hidden = drafts.length === 0;
  aiListingDrafts.innerHTML = drafts.map((draft, index) => `
    <article class="ai-draft-card ${draft.id === state.activeAiDraftId ? "active" : ""}" data-draft-id="${draft.id}">
      <div class="ai-draft-card-header"><strong>Item ${index + 1}</strong><span><button class="text-button" type="button" data-apply-ai-draft="${draft.id}">Apply to Listing</button><button class="text-button" type="button" data-remove-ai-draft="${draft.id}">Remove</button></span></div>
      <label>Title<input data-ai-draft-field="title" value="${escapeHtml(draft.title)}" required></label>
      <label>Category<select data-ai-draft-field="category">${state.categories.map((category) => `<option ${category.name === draft.category ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></label>
      <label>Suggested price<input data-ai-draft-field="suggested_price" type="number" min="0" step="1" value="${draft.suggested_price}" required></label>
      <label>Condition<select data-ai-draft-field="condition">${["New", "Like New", "Good", "Used", "Fair"].map((condition) => `<option ${condition === draft.condition ? "selected" : ""}>${condition}</option>`).join("")}</select></label>
    </article>`).join("");
  const activeDraft = drafts.find((draft) => draft.id === state.activeAiDraftId);
  if (activeDraft) applyDraftToListing(activeDraft);
  sellSubmitButton.innerHTML = drafts.length ? `<i data-lucide="upload"></i>Publish ${drafts.length} listing${drafts.length === 1 ? "" : "s"}` : '<i data-lucide="plus"></i>Add listing';
  ["#title-input", "#price-input", "#category-select", "#condition-select", "#itemImageUrl"].forEach((selector) => {
    const field = document.querySelector(selector);
    field.disabled = drafts.length > 0;
    if (["#title-input", "#price-input", "#category-select", "#condition-select"].includes(selector)) field.required = drafts.length === 0;
  });
  refreshIcons();
}

function applyDraftToListing(draft) {
  document.querySelector("#title-input").value = draft.title;
  document.querySelector("#price-input").value = draft.suggested_price;
  document.querySelector("#category-select").value = draft.category;
  document.querySelector("#condition-select").value = draft.condition;
  state.activeAiDraftId = draft.id;
}

async function analyzeListingImages(files) {
  const analysisResults = await Promise.all(files.map(async (file, index) => {
    let dataUrl = "";
    try {
      dataUrl = await readUploadedImage(file);
      const imageBase64 = dataUrl.replace(/^data:image\/[^;]+;base64,/, "");
      if (imageBase64 === dataUrl) throw new Error(`Could not encode ${file.name} for image analysis.`);
      if (!supabaseClient?.functions) throw new Error("Image analysis is unavailable because the Supabase Vision function is not configured.");

      const { data, error } = await supabaseClient.functions.invoke("analyze-listing-images", {
        body: {
          imageBase64,
          mimeType: file.type || "image/jpeg",
        },
      });
      if (error) throw error;
      if (!Array.isArray(data?.items)) throw new Error("The image analysis service returned an invalid response.");

      return { dataUrl, items: data.items.map((item) => ({ ...item, image_index: index })) };
    } catch (error) {
      console.warn("Image analysis failed; using fallback listing:", error);
      return { dataUrl, items: [{ ...generateFallbackListing(file), image_index: index }] };
    }
  }));

  const imageDataUrls = analysisResults.map((result) => result.dataUrl);
  const detectedItems = analysisResults.flatMap((result) => result.items);
  return detectedItems.map((item) => normalizeAiListingDraft(item, imageDataUrls, files));
}

async function runVisionAutoFill(files) {
  if (!files.length) return;
  aiStatus.textContent = "AI is analyzing your photo set…";
  sellForm.classList.add("ai-analyzing");
  sellForm.setAttribute("aria-busy", "true");
  try {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    state.aiListingDrafts = await analyzeListingImages(files);
    renderAiListingDrafts();
    aiStatus.textContent = `${state.aiListingDrafts.length} item${state.aiListingDrafts.length === 1 ? "" : "s"} detected. Review each draft before publishing.`;
  } catch (error) {
    console.error("Image analysis error:", error);
    state.aiListingDrafts = [];
    renderAiListingDrafts();
    aiStatus.textContent = error.message || "Image analysis could not be completed. You can still enter one listing manually.";
  } finally {
    sellForm.classList.remove("ai-analyzing");
    sellForm.removeAttribute("aria-busy");
  }
}

function handleNavigationClick(event) {
  event.preventDefault();
  const view = event.currentTarget.dataset.navView;
  if (!setView(view)) return;

  window.location.hash = view;
  closeMobileNav();
  document.querySelector(view === "admin" ? "#admin" : "#market").scrollIntoView({ behavior: "smooth" });
}

document.addEventListener("DOMContentLoaded", () => {
document.querySelector(".mobile-menu-button").addEventListener("click", () => {
  const isHidden = mobileNav.hidden;
  mobileNav.hidden = !isHidden;
  document.querySelector(".mobile-menu-button").setAttribute("aria-expanded", String(isHidden));
});

document.querySelectorAll("[data-nav-view]").forEach((link) => {
  link.addEventListener("click", handleNavigationClick);
});

window.addEventListener("hashchange", applyHashRoute);

document.querySelectorAll("[data-open-sell]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeMobileNav();
    openSellDialog();
  });
});

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => {
    closeMobileNav();
    openAuthDialog("login");
  });
});

document.querySelectorAll("[data-logout]").forEach((button) => {
  button.addEventListener("click", () => {
    closeMobileNav();
    logout();
  });
});

openAuthButton.addEventListener("click", () => openAuthDialog("login"));
logoutButton.addEventListener("click", logout);

document.querySelectorAll(".auth-toggle").forEach((button) => {
  button.addEventListener("click", () => showAuthMode(button.dataset.authMode));
});

document.querySelector(".close-auth-dialog").addEventListener("click", () => authDialog.close());

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.querySelector("#loginUsername").value.trim();
  const password = document.querySelector("#loginPassword").value;

  if (!username || !password) {
    loginMessage.textContent = "Enter both username and password.";
    return;
  }

  try {
    if (!supabaseClient) throw new Error("Supabase authentication is unavailable.");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: buildSupabaseEmail(username),
      password,
    });
    if (error) throw error;
    const authenticatedUser = data?.user;
    if (!authenticatedUser) throw new Error("Login succeeded but no authenticated user was returned.");

    const signedInUsername = authenticatedUser.user_metadata?.username || username;
    const users = getUsers();
    if (!users.some((user) => user.username === signedInUsername)) {
      users.push({ username: signedInUsername, savedItems: [] });
      saveUsers(users);
    }

    loginForm.reset();
    authDialog.close();
    await setCurrentUser(signedInUsername);
  } catch (error) {
    console.error("Login Error:", error);
    loginMessage.textContent = error.message || "Unable to log in. Please try again.";
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.querySelector("#signupUsername").value.trim();
  const password = document.querySelector("#signupPassword").value;
  const confirmPassword = document.querySelector("#confirmPassword").value;
  const users = getUsers();

  if (!username || !password || !confirmPassword) {
    signupMessage.textContent = "Complete all sign up fields.";
    return;
  }

  if (password.length < 6) {
    signupMessage.textContent = "Password must be at least 6 characters long.";
    return;
  }

  if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    signupMessage.textContent = "That username is already taken.";
    return;
  }

  if (password !== confirmPassword) {
    signupMessage.textContent = "Passwords do not match.";
    return;
  }

  try {
    await syncSignupToSupabase({ username, password });
    users.push({ username, savedItems: [] });
    saveUsers(users);
    signupForm.reset();
    authDialog.close();
    await setCurrentUser(username);
  } catch (error) {
    console.error("Signup Error:", error);
    signupMessage.textContent = error.message || "Unable to create the account. Please try again.";
  }
});

document.querySelector("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  state.query = searchInput.value;
  render();
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value;
  render();
});

categoryFilter.addEventListener("change", (event) => setCategory(event.target.value));

locationFilter.addEventListener("change", (event) => {
  state.location = event.target.value;
  render();
});

conditionFilters.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    state.conditions = conditionFilters
      .filter((conditionFilter) => conditionFilter.checked)
      .map((conditionFilter) => conditionFilter.value);
    render();
  });
});

maxPrice.addEventListener("input", (event) => {
  state.maxPrice = Number(event.target.value);
  priceValue.textContent = `$${state.maxPrice}`;
  render();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelector(".category-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) setCategory(tab.dataset.category);
});

listingGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);
  if (button.dataset.action === "toggle-save") toggleSaved(id);
  if (button.dataset.action === "view") openListing(id);
  if (button.dataset.action === "contact-seller") openChatForItem(id);
  if (button.dataset.action === "open-chat") openChat(button.dataset.chatId);
  if (button.dataset.action === "new-listing") openSellDialog();
  if (button.dataset.action === "edit-listing") openEditListing(id);
  if (button.dataset.action === "toggle-active") toggleListingActive(id);
  if (button.dataset.action === "delete-listing") deleteItem(id);
});

document.querySelector("#clearFilters").addEventListener("click", () => {
  state.query = "";
  state.category = "all";
  state.location = "all";
  state.conditions = [];
  state.maxPrice = 250;
  state.view = "market";

  searchInput.value = "";
  categoryFilter.value = "all";
  locationFilter.value = "all";
  maxPrice.value = "250";
  priceValue.textContent = "$250";
  conditionFilters.forEach((checkbox) => {
    checkbox.checked = false;
  });
  setCategory("all");
});

document.querySelector(".close-dialog").addEventListener("click", () => listingDialog.close());

dialogSaveButton.addEventListener("click", () => {
  if (state.activeListingId) toggleSaved(state.activeListingId);
});

dialogContactButton.addEventListener("click", () => {
  if (state.activeListingId) {
    listingDialog.close();
    openChatForItem(state.activeListingId);
  }
});

document.querySelector("#dialogReportButton").addEventListener("click", openReportDialog);
document.querySelector(".close-report-dialog").addEventListener("click", () => reportDialog.close());

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(state.activeListingId));
  const reporter = getCurrentUser();
  if (!item || !reporter) return;
  const message = document.querySelector("#reportMessage");
  const submitButton = reportForm.querySelector('button[type="submit"]');
  // Supports both the database values and any human-friendly option labels.
  const reasonMap = {
    spam: "spam",
    scam: "scam",
    "Scam or suspected fraud": "scam",
    harassment: "harassment",
  };
  const selectedReason = document.querySelector("#reportReason").value;

  if (!supabaseClient) {
    message.style.color = "";
    message.textContent = "Reporting is temporarily unavailable. Please try again later.";
    return;
  }

  submitButton.disabled = true;
  try {
    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Please sign in to submit a report.");

    const reportedUserId = item.seller_id || item.reported_user_id;
    const isUuid = (value) =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const payload = {
      // Supabase Auth's UUID is the database-safe reporter identifier.
      reporter_id: authData.user.id,
      // Report references support local Date.now() IDs without UUID coercion.
      listing_id: String(item.id),
      reason: reasonMap[selectedReason] || "spam",
      details: document.querySelector("#reportDetails").value.trim(),
      status: "pending",
    };
    // The seller in localStorage is often a username, not a UUID. Omit it
    // unless it can satisfy the reports.reported_user_id UUID column.
    if (isUuid(reportedUserId)) payload.reported_user_id = reportedUserId;
    const { error } = await supabaseClient
      .from("reports")
      .insert([payload]);
    if (error) throw error;

    message.style.color = "#25614e";
    message.textContent = "Thank you. Your report has been sent for review.";
    window.setTimeout(() => reportDialog.close(), 800);
  } catch (error) {
    message.style.color = "";
    message.textContent = error.message || "We could not submit that report. Please try again.";
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelectorAll(".admin-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.adminTab = tab.dataset.adminTab;
  document.querySelectorAll(".admin-tab").forEach((button) => button.classList.toggle("active", button === tab));
  renderAdminPanel();
}));

adminContent.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-admin-action]");
  if (!button) return;
  e.preventDefault();
  const { adminAction: action, id } = button.dataset;

  if (action === "resolve-report") {
    const reportId = button.dataset.id;
    let usedSoftDeleteFallback = false;
    let { data, error } = await supabaseClient
      .from("reports")
      .delete()
      .eq("id", reportId)
      .select();

    if (error) {
      console.error("Supabase Delete Error:", error.message, error.details);
      usedSoftDeleteFallback = true;
      const fallback = await supabaseClient
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", reportId)
        .select();
      data = fallback.data;
      error = fallback.error;
      if (error) {
        console.error("Supabase Resolve Fallback Error:", error.message, error.details);
        alert("Failed to delete report: " + error.message);
        return;
      }
    }

    if ((!data || data.length === 0) && !usedSoftDeleteFallback) {
      console.warn("Delete call executed, but 0 rows were affected. Check RLS policies on the 'reports' table.");
      const fallback = await supabaseClient
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", reportId)
        .select();
      if (fallback.error) {
        console.error("Supabase Resolve Fallback Error:", fallback.error.message, fallback.error.details);
        alert("Failed to delete report: " + fallback.error.message);
        return;
      }
      data = fallback.data;
    }

    if (!data || data.length === 0) {
      console.warn("Delete call executed, but 0 rows were affected. Check RLS policies on the 'reports' table.");
      return;
    }
    const reportRow = button.closest("tr");
    reportRow?.remove();
    if (!adminContent.querySelector("tbody tr")) {
      adminContent.innerHTML = '<section><h3>Submitted reports</h3><p class="admin-empty">The report queue is clear.</p></section>';
    }
    return;
  }

  if (action === "warn-user") {
    try {
      await sendModerationWarning(button.dataset.id);
      alert("Warning message sent to chat.");
    } catch (error) {
      console.error("Warning message failed:", error.message || error);
      alert("Warning message could not be sent. Please try again.");
    }
    return;
  }

  try {
    if (action === "remove-listing") await apiFetch(`/api/admin/listings/${id}`, { method: "DELETE" });
    await renderAdminPanel();
  } catch (_) {
    document.querySelector("#adminStatus").textContent = "Action could not be completed.";
  }
});

document.querySelector(".close-sell-dialog").addEventListener("click", () => sellDialog.close());

document.querySelector(".close-chat-dialog").addEventListener("click", () => chatDialog.close());

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = chatMessageInput.value.trim();
  if (!text) return;

  const sendButton = chatForm.querySelector('button[type="submit"]');
  sendButton.disabled = true;

  try {
    await sendChatMessage(text);
    chatForm.reset();
  } catch (error) {
    console.warn("Supabase chat sync failed:", error.message || error);
    alert("Your message could not be saved. Please try again.");
  } finally {
    sendButton.disabled = false;
    chatMessageInput.focus();
  }
});

sellImageFile.addEventListener("change", (event) => {
  const files = Array.from(event.target.files).filter((file) => file.type.startsWith("image/"));
  state.selectedImageFiles = files;
  state.selectedImageFile = files[0] || null;
  if (files[0]) previewSelectedImage(files[0]);
  if (state.editingItemId) return;
  runVisionAutoFill(files);
});

aiListingDrafts.addEventListener("input", (event) => {
  const field = event.target.dataset.aiDraftField;
  const card = event.target.closest("[data-draft-id]");
  if (!field || !card) return;
  const draft = state.aiListingDrafts.find((item) => item.id === card.dataset.draftId);
  if (!draft) return;
  draft[field] = field === "suggested_price" ? Number(event.target.value) : event.target.value;
  if (draft.id === state.activeAiDraftId) applyDraftToListing(draft);
});

aiListingDrafts.addEventListener("click", (event) => {
  const applyButton = event.target.closest("[data-apply-ai-draft]");
  if (applyButton) {
    const draft = state.aiListingDrafts.find((item) => item.id === applyButton.dataset.applyAiDraft);
    if (draft) {
      applyDraftToListing(draft);
      renderAiListingDrafts();
    }
    return;
  }
  const button = event.target.closest("[data-remove-ai-draft]");
  if (!button) return;
  state.aiListingDrafts = state.aiListingDrafts.filter((draft) => draft.id !== button.dataset.removeAiDraft);
  renderAiListingDrafts();
});

document.querySelector("#category-select").addEventListener("change", updateEstimatedPrice);
document.querySelector("#condition-select").addEventListener("change", updateEstimatedPrice);

sellForm.addEventListener("dragover", (event) => {
  event.preventDefault();
  sellForm.classList.add("drag-ready");
});

sellForm.addEventListener("dragleave", () => {
  sellForm.classList.remove("drag-ready");
});

sellForm.addEventListener("drop", (event) => {
  event.preventDefault();
  sellForm.classList.remove("drag-ready");

  const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
  if (!files.length) return;

  state.selectedImageFiles = files;
  state.selectedImageFile = files[0];
  previewSelectedImage(files[0]);
  if (state.editingItemId) return;
  runVisionAutoFill(files);
});

sellForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin("Please log in before selling an item.")) return;

  const locations = getSelectedLocations();
  if (locations.length === 0) {
    alert("Please select at least one preferred transaction location.");
    return;
  }

  if (state.aiListingDrafts.length && !state.editingItemId) {
    const manualImageUrl = document.querySelector("#itemImageUrl").value.trim();
    const listings = state.aiListingDrafts.map((draft, index) => ({
      id: `${Date.now()}${index}`,
      title: draft.title.trim(),
      price: Number(draft.suggested_price),
      category: draft.category,
      condition: draft.condition,
      description: draft.description,
      image: manualImageUrl || FALLBACK_IMAGE_URL,
      seller: getCurrentUsername(),
      locations,
      active: true,
      saved: false,
    }));
    if (listings.some((item) => !item.title || Number.isNaN(item.price))) {
      aiStatus.textContent = "Each detected item needs a title and valid suggested price before publishing.";
      return;
    }

    let publishSucceeded = false;
    sellSubmitButton.disabled = true;
    sellSubmitButton.textContent = `Publishing ${listings.length}...`;
    try {
      let uploadedImageUrls = [];
      let embeddedImageUrls = [];
      try {
        uploadedImageUrls = await Promise.all(
          state.selectedImageFiles.map((file) => uploadListingImageToStorage(file))
        );
      } catch (error) {
        console.warn("Listing photo upload failed; saving compressed images with the listing:", error);
        embeddedImageUrls = await Promise.all(
          state.selectedImageFiles.map((file) => compressListingImageForDatabase(file))
        );
      }
      listings.forEach((listing, index) => {
        const imageIndex = state.aiListingDrafts[index].sourceImageIndex;
        listing.image = uploadedImageUrls[imageIndex] || embeddedImageUrls[imageIndex] || listing.image;
      });
      await insertListingsIntoSupabase(listings);
      await loadListingsFromSupabase();
      publishSucceeded = true;
    } catch (error) {
      console.error("Bulk listing submission failed:", error);
      const message = "Unable to publish listing. Please try again.";
      aiStatus.textContent = `${message} ${error.message || ""}`.trim();
      alert(message);
    } finally {
      sellSubmitButton.disabled = false;
      if (!publishSucceeded) renderAiListingDrafts();
    }

    if (!publishSucceeded) return;

    sellDialog.close();
    state.aiListingDrafts = [];
    clearImageUploadState();
    sellForm.reset();
    renderAiListingDrafts();
    render();
    document.querySelector("#market").scrollIntoView({ behavior: "smooth" });
    return;
  }

  const title = document.querySelector("#title-input").value.trim();
  const price = Number(document.querySelector("#price-input").value);
  const category = document.querySelector("#category-select").value;
  const condition = document.querySelector("#condition-select").value;
  const imageUrl = document.querySelector("#itemImageUrl").value.trim();
  const imageFile = state.selectedImageFile || sellImageFile.files[0];
  if (!title || Number.isNaN(price) || !category || !condition) {
    aiStatus.textContent = "Complete the title, price, category, and condition before publishing.";
    return;
  }

  const wasEditing = Boolean(state.editingItemId);
  sellSubmitButton.disabled = true;
  sellSubmitButton.textContent = wasEditing ? "Saving..." : "Publishing...";

  try {
    let uploadedImage = "";
    let embeddedImage = "";
    try {
      uploadedImage = await uploadListingImageToStorage(imageFile);
    } catch (error) {
      console.warn("Listing photo upload failed; saving a compressed image with the listing:", error);
      embeddedImage = await compressListingImageForDatabase(imageFile);
    }

    const image = uploadedImage || embeddedImage || imageUrl || FALLBACK_IMAGE_URL;
    const items = getItems();
    const editingItem = items.find((item) => Number(item.id) === Number(state.editingItemId));

    if (editingItem && editingItem.seller === getCurrentUsername()) {
      editingItem.title = title;
      editingItem.price = price;
      editingItem.category = category;
      editingItem.condition = condition;
      editingItem.image = uploadedImage || embeddedImage || imageUrl || state.originalImageUrl || editingItem.image;
      editingItem.image_url = uploadedImage || embeddedImage || imageUrl || state.originalImageUrl || editingItem.image_url || editingItem.image_path || editingItem.image;
      editingItem.locations = locations;
      await updateListingInSupabase(editingItem);
      saveChats(
        getChats().map((chat) =>
          Number(chat.itemId) === Number(editingItem.id) ? { ...chat, itemTitle: title } : chat
        )
      );
    } else {
      const newItem = {
        id: Date.now(),
        title,
        price,
        category,
        condition,
        image,
        seller: getCurrentUsername(),
        locations,
        active: true,
        saved: false,
      };
      await insertListingIntoSupabase(newItem);
    }

    await loadListingsFromSupabase();
    sellDialog.close();
    state.view = state.editingItemId ? "profile" : "market";
    state.query = "";
    state.category = "all";
    state.maxPrice = Math.max(250, price);
    searchInput.value = "";
    categoryFilter.value = "all";
    maxPrice.max = String(state.maxPrice);
    maxPrice.value = String(state.maxPrice);
    priceValue.textContent = `$${state.maxPrice}`;
    state.editingItemId = null;
    clearImageUploadState();
    state.aiListingDrafts = [];
    sellForm.reset();
    renderAiListingDrafts();
    render();
    document.querySelector("#market").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error(wasEditing ? "Listing update failed:" : "Listing submission failed:", error);
    const message = wasEditing
      ? "Unable to update listing. Please try again."
      : "Unable to publish listing. Please try again.";
    aiStatus.textContent = `${message} ${error.message || ""}`.trim();
    alert(message);
  } finally {
    sellSubmitButton.disabled = false;
    sellSubmitButton.innerHTML = wasEditing
      ? '<i data-lucide="save"></i>Save changes'
      : '<i data-lucide="plus"></i>Add listing';
    refreshIcons();
  }
});

async function initializeApp() {
  initializeStorage();
  await initializeListingImagesBucket();
  updateAuthUI();
  setView("market");
  await loadCategories();
  await loadListingsFromSupabase();

  let user = null;
  if (supabaseClient) {
    const { data, error } = await supabaseClient.auth.getUser();
    user = error ? null : data?.user || null;
  }
  await refreshAdminAccess(user);

  if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange(async () => {
      const { data, error } = await supabaseClient.auth.getUser();
      const user = error ? null : data?.user || null;
      console.log("Current user app_metadata:", user?.app_metadata);
      await refreshAdminAccess(user);
    });
  }

  startChatSync();
  refreshIcons();
}

initializeApp();
});
