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
const supabaseClient = window.supabase?.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// Seed data follows the localStorage item shape used by the prototype.
const mockMarketplaceItems = [
  {
    id: 1,
    title: "Walnut desk with cable tray",
    price: 85,
    category: "Furniture",
    image:
      "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Evanston Main Campus (North/South)", "Norris University Center (Evanston)"],
    saved: false,
  },
  {
    id: 2,
    title: "Econ 201 textbook bundle",
    price: 42,
    category: "Textbooks",
    image:
      "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Evanston Main Campus (North/South)"],
    saved: false,
  },
  {
    id: 3,
    title: "Retina monitor, 24 inch",
    price: 140,
    category: "Electronics",
    image:
      "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Chicago Downtown Campus (Streeterville)", "Northwestern Memorial Hospital Hub"],
    saved: false,
  },
  {
    id: 4,
    title: "Single-speed campus bike",
    price: 120,
    category: "Bikes",
    image:
      "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Evanston Main Campus (North/South)"],
    saved: false,
  },
  {
    id: 5,
    title: "Mini fridge with freezer shelf",
    price: 65,
    category: "Dorm",
    image:
      "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Norris University Center (Evanston)"],
    saved: false,
  },
  {
    id: 6,
    title: "Purple quarter-zip sweatshirt",
    price: 24,
    category: "Clothing",
    image:
      "https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=900&q=80",
    seller: "northwestern_market",
    locations: ["Evanston Main Campus (North/South)", "Norris University Center (Evanston)"],
    saved: false,
  },
];

const state = {
  view: "market",
  query: "",
  category: "all",
  location: "all",
  maxPrice: 250,
  sort: "newest",
  activeListingId: null,
  activeChatId: null,
  editingItemId: null,
  selectedImageFile: null,
  chatSubscription: null,
  chatSyncTimer: null,
};

const listingGrid = document.querySelector("#listingGrid");
const resultCount = document.querySelector("#resultCount");
const resultLabel = document.querySelector("#resultLabel");
const emptyState = document.querySelector("#emptyState");
const savedList = document.querySelector("#savedList");
const categoryFilter = document.querySelector("#categoryFilter");
const locationFilter = document.querySelector("#locationFilter");
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
const aiStatus = document.querySelector("#aiStatus");
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

function normalizeItem(item) {
  return {
    id: item.id,
    title: item.title,
    price: Number(item.price) || 0,
    category: item.category || "Dorm",
    condition: item.condition || "Used",
    image: item.image || item.image_url || FALLBACK_IMAGE_URL,
    seller: item.seller || item.owner || "northwestern_market",
    locations: Array.isArray(item.locations) && item.locations.length > 0 ? item.locations : DEFAULT_LOCATIONS,
    active: item.active !== false,
    saved: Boolean(item.saved),
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
    password: user.password || "",
    savedItems: Array.isArray(user.savedItems) ? user.savedItems.map(Number) : [],
  };
}

function initializeStorage() {
  if (!localStorage.getItem(ITEMS_KEY)) {
    localStorage.setItem(ITEMS_KEY, JSON.stringify(mockMarketplaceItems));
  } else {
    saveItems(getItems().map(normalizeItem));
  }

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
    localStorage.setItem(ITEMS_KEY, JSON.stringify(mockMarketplaceItems));
    return [...mockMarketplaceItems];
  }
}

function saveItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items.map(normalizeItem)));
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

function setCurrentUser(username) {
  setSessionCookie(SESSION_KEY, username);
  updateAuthUI();
  render();
  startChatSync(username);
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
  return Array.from(document.querySelectorAll('input[name="transactionLocation"]:checked')).map(
    (checkbox) => checkbox.value
  );
}

function setSelectedLocations(locations) {
  const selected = new Set(locations);
  document.querySelectorAll('input[name="transactionLocation"]').forEach((checkbox) => {
    checkbox.checked = selected.has(checkbox.value);
  });
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

// Apply view, search, category, price, and sort controls before rendering.
function getVisibleItems() {
  const normalizedQuery = state.query.trim().toLowerCase();

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

      return matchesSearch && matchesCategory && matchesPrice;
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
  listingGrid.classList.toggle("inbox-grid", state.view === "inbox");
  listingGrid.classList.toggle("dashboard-grid", state.view === "profile");
  renderListings();
  renderSavedSummary();
  updateDialogSaveButton();
}

function updateNavLinks() {
  document.querySelectorAll("[data-nav-view]").forEach((link) => {
    link.classList.toggle("active", link.dataset.navView === state.view);
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

  refreshIcons();
}

function setView(view) {
  if (view === "saved" && !requireLogin("Please log in to view your saved items.")) return;
  if (view === "inbox" && !requireLogin("Please log in to view your inbox.")) return;
  if (view === "profile" && !requireLogin("Please log in to view your profile.")) return;

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

  updateDialogSaveButton();
  listingDialog.showModal();
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

  prepareSellFormForCreate();
  sellDialog.showModal();
  refreshIcons();
}

function prepareSellFormForCreate() {
  state.editingItemId = null;
  state.selectedImageFile = null;
  sellForm.reset();
  setSelectedLocations([]);
  sellForm.classList.remove("ai-analyzing");
  aiStatus.textContent = "✨ AI will automatically parse your photo to pre-fill the details below.";
  sellModalEyebrow.textContent = "Create listing";
  sellModalTitle.textContent = "Sell an item";
  sellSubmitButton.innerHTML = '<i data-lucide="plus"></i>Add listing';
}

function openEditListing(id) {
  if (!requireLogin("Please log in before editing a listing.")) return;

  const item = getItems().find((currentItem) => Number(currentItem.id) === Number(id));
  if (!item || item.seller !== getCurrentUsername()) return;

  state.editingItemId = Number(id);
  state.selectedImageFile = null;
  sellForm.reset();
  sellForm.classList.remove("ai-analyzing");
  aiStatus.textContent = "Upload a new image to let AI refresh these details.";
  sellModalEyebrow.textContent = "Edit listing";
  sellModalTitle.textContent = "Update item";
  sellSubmitButton.innerHTML = '<i data-lucide="save"></i>Save changes';
  document.querySelector("#itemTitle").value = item.title;
  document.querySelector("#itemPrice").value = item.price;
  document.querySelector("#itemCategory").value = item.category;
  document.querySelector("#itemCondition").value = item.condition;
  document.querySelector("#itemImageUrl").value = item.image.startsWith("data:") ? "" : item.image;
  setSelectedLocations(item.locations);
  sellDialog.showModal();
  refreshIcons();
}

function toggleListingActive(id) {
  const username = getCurrentUsername();
  const items = getItems().map((item) => {
    if (Number(item.id) !== Number(id) || item.seller !== username) return item;
    return { ...item, active: !item.active };
  });

  saveItems(items);
  render();
}

function deleteItem(itemId) {
  const confirmed = confirm("Are you sure you want to permanently delete this listing?");
  if (!confirmed) return;

  const username = getCurrentUsername();
  const items = getItems().filter(
    (item) => Number(item.id) !== Number(itemId) || item.seller !== username
  );

  saveItems(items);
  state.view = "profile";
  render();
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

function logout() {
  stopChatSync();
  deleteSessionCookie(SESSION_KEY);
  state.view = "market";
  updateAuthUI();
  setView("market");
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
    console.warn("Supabase signup failed:", authError.message);
    return;
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
    console.warn("Supabase profile upsert failed:", profileError.message);
  }
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
  if (!supabaseClient) return;

  const { data: sessionData } = await supabaseClient.auth.getUser();
  const { error } = await supabaseClient.from("item_listings").insert({
    seller_auth_user_id: sessionData.user?.id || null,
    seller_username: item.seller,
    local_item_id: String(item.id),
    title: item.title,
    description: item.title,
    category: item.category,
    price: Number(item.price),
    condition: item.condition,
    pickup_location: item.locations.join(", "),
    image_url: item.image.startsWith("data:") ? null : item.image,
    active: item.active,
  });

  if (error) {
    console.warn("Supabase listing insert failed:", error.message);
  }
}

async function updateListingInSupabase(item) {
  if (!supabaseClient) return;

  const { error } = await supabaseClient
    .from("item_listings")
    .update({
      title: item.title,
      category: item.category,
      price: Number(item.price),
      condition: item.condition,
      pickup_location: item.locations.join(", "),
      image_url: item.image,
    })
    .eq("local_item_id", String(item.id));

  if (error) {
    console.warn("Supabase listing update failed:", error.message);
  }
}

function parseImageFileName(fileName) {
  const baseName = fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\bv\d+\b/g, " ")
    .replace(/\b(img|image|photo|pic|copy|final)\b/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const category = matchImageCategory(baseName);

  return {
    title: generateTitleFromFileName(baseName),
    category,
    price: getDefaultPriceForCategory(category),
  };
}

function matchImageCategory(fileName) {
  const keywordGroups = [
    { category: "Clothing", words: ["hoodie", "shirt", "pants", "jacket"] },
    { category: "Textbooks", words: ["textbook", "book", "chem"] },
    { category: "Electronics", words: ["lamp", "electronics", "charger", "monitor"] },
    { category: "Bikes", words: ["bike", "bicycle"] },
    { category: "Dorm", words: ["household", "rug", "fridge", "microwave", "fan", "storage"] },
    { category: "Furniture", words: ["desk", "chair", "table", "dresser", "couch", "shelf"] },
  ];

  const match = keywordGroups.find((group) => group.words.some((word) => fileName.includes(word)));
  return match ? match.category : "Dorm";
}

function generateTitleFromFileName(fileName) {
  return fileName
    .split(" ")
    .filter(Boolean)
    .filter((word) => !/^\d+$/.test(word))
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  const category = document.querySelector("#itemCategory").value;
  const condition = document.querySelector("#itemCondition").value;
  const estimatedPrice = estimateItemPrice(category, condition);

  if (estimatedPrice !== null) {
    document.querySelector("#itemPrice").value = estimatedPrice;
  }
}

function runVisionAutoFill(file) {
  if (!file) return;

  aiStatus.textContent = "AI is analyzing image features...";
  sellForm.classList.add("ai-analyzing");

  window.setTimeout(() => {
    const parsed = parseImageFileName(file.name);
    document.querySelector("#itemTitle").value = parsed.title;
    document.querySelector("#itemPrice").value = parsed.price;
    document.querySelector("#itemCategory").value = parsed.category;
    updateEstimatedPrice();

    aiStatus.textContent = "AI filled the details from your image filename.";
    sellForm.classList.remove("ai-analyzing");
  }, 600);
}

document.querySelector(".mobile-menu-button").addEventListener("click", () => {
  const isHidden = mobileNav.hidden;
  mobileNav.hidden = !isHidden;
  document.querySelector(".mobile-menu-button").setAttribute("aria-expanded", String(isHidden));
});

document.querySelectorAll("[data-nav-view]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView(link.dataset.navView);
    closeMobileNav();
    document.querySelector("#market").scrollIntoView({ behavior: "smooth" });
  });
});

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

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = document.querySelector("#loginUsername").value.trim();
  const password = document.querySelector("#loginPassword").value;
  const user = getUsers().find(
    (currentUser) => currentUser.username === username && currentUser.password === password
  );

  if (!username || !password) {
    loginMessage.textContent = "Enter both username and password.";
    return;
  }

  if (!user) {
    loginMessage.textContent = "Username or password is incorrect.";
    return;
  }

  loginForm.reset();
  authDialog.close();
  setCurrentUser(username);
});

signupForm.addEventListener("submit", (event) => {
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

  users.push({ username, password, savedItems: [] });
  saveUsers(users);
  syncSignupToSupabase({ username, password }).catch((error) => {
    console.warn("Supabase background signup failed:", error);
  });
  signupForm.reset();
  authDialog.close();
  setCurrentUser(username);
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

maxPrice.addEventListener("input", (event) => {
  state.maxPrice = Number(event.target.value);
  priceValue.textContent = `$${state.maxPrice}`;
  render();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  render();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setCategory(tab.dataset.category));
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
  state.maxPrice = 250;
  state.view = "market";

  searchInput.value = "";
  categoryFilter.value = "all";
  locationFilter.value = "all";
  maxPrice.value = "250";
  priceValue.textContent = "$250";
  document.querySelectorAll('input[name="condition"]').forEach((checkbox) => {
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
  const file = event.target.files[0];
  state.selectedImageFile = file || null;
  runVisionAutoFill(file);
});

document.querySelector("#itemCategory").addEventListener("change", updateEstimatedPrice);
document.querySelector("#itemCondition").addEventListener("change", updateEstimatedPrice);

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

  const file = Array.from(event.dataTransfer.files).find((candidate) =>
    candidate.type.startsWith("image/")
  );
  if (!file) return;

  state.selectedImageFile = file;
  runVisionAutoFill(file);
});

sellForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!requireLogin("Please log in before selling an item.")) return;

  const title = document.querySelector("#itemTitle").value.trim();
  const price = Number(document.querySelector("#itemPrice").value);
  const category = document.querySelector("#itemCategory").value;
  const condition = document.querySelector("#itemCondition").value;
  const imageUrl = document.querySelector("#itemImageUrl").value.trim();
  const imageFile = state.selectedImageFile || sellImageFile.files[0];
  const locations = getSelectedLocations();
  if (!title || Number.isNaN(price) || !category || !condition) return;
  if (locations.length === 0) {
    alert("Please select at least one preferred transaction location.");
    return;
  }

  let uploadedImage = "";
  try {
    uploadedImage = await readUploadedImage(imageFile);
  } catch (error) {
    alert("The selected image could not be read. Please try a different file.");
    return;
  }

  const image = uploadedImage || imageUrl || FALLBACK_IMAGE_URL;
  const items = getItems();
  const editingItem = items.find((item) => Number(item.id) === Number(state.editingItemId));

  if (editingItem && editingItem.seller === getCurrentUsername()) {
    editingItem.title = title;
    editingItem.price = price;
    editingItem.category = category;
    editingItem.condition = condition;
    editingItem.image = uploadedImage || imageUrl || editingItem.image;
    editingItem.locations = locations;
    updateListingInSupabase(editingItem).catch((error) => {
      console.warn("Supabase background listing update failed:", error);
    });
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

    items.push(newItem);
    insertListingIntoSupabase(newItem).catch((error) => {
      console.warn("Supabase background listing insert failed:", error);
    });
  }

  saveItems(items);
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
  state.selectedImageFile = null;
  sellForm.reset();
  render();
  document.querySelector("#market").scrollIntoView({ behavior: "smooth" });
});

initializeStorage();
updateAuthUI();
setView("market");
startChatSync();
refreshIcons();
