import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const seedItems = [
  { name:'גנרטור',category:'חשמל ותאורה',qty:1,priority:'required',claimedBy:'',done:false },
  { name:'מיכל דלק',category:'חשמל ותאורה',qty:1,priority:'required',claimedBy:'',done:false },
  { name:'אורות שרשרת',category:'חשמל ותאורה',qty:2,priority:'important',claimedBy:'',done:false },
  { name:'מאוורר',category:'חשמל ותאורה',qty:1,priority:'important',claimedBy:'',done:false },
  { name:'אוהל',category:'שינה ומחסה',qty:2,priority:'required',claimedBy:'',done:false },
  { name:'מזרנים',category:'שינה ומחסה',qty:4,priority:'required',claimedBy:'',done:false },
  { name:'ערסל',category:'שינה ומחסה',qty:1,priority:'bonus',claimedBy:'',done:false },
  { name:'רמקול JBL',category:'ילדים ופנאי',qty:1,priority:'important',claimedBy:'',done:false },
  { name:'שש-בש',category:'ילדים ופנאי',qty:1,priority:'bonus',claimedBy:'',done:false },
  { name:'מחצלות',category:'שינה ומחסה',qty:3,priority:'important',claimedBy:'',done:false },
  { name:'צידנית',category:'כללי',qty:2,priority:'required',claimedBy:'',done:false },
  { name:'שולחן כתר',category:'כללי',qty:1,priority:'important',claimedBy:'',done:false },
  { name:'כבל מאריך',category:'חשמל ותאורה',qty:2,priority:'required',claimedBy:'',done:false },
  { name:'מפצלים',category:'חשמל ותאורה',qty:2,priority:'important',claimedBy:'',done:false }
];

const firebaseConfig = window.FIREBASE_CONFIG || {};
const missingConfig = Object.values(firebaseConfig).some(v => !v || v === 'PASTE_HERE');

const els = {
  loadingScreen: byId("loadingScreen"),
  authScreen: byId("authScreen"),
  appScreen: byId("appScreen"),
  displayNameInput: byId("displayNameInput"),
  createRoomBtn: byId("createRoomBtn"),
  joinRoomToggleBtn: byId("joinRoomToggleBtn"),
  joinRoomBtn: byId("joinRoomBtn"),
  joinRoomBox: byId("joinRoomBox"),
  roomCodeInput: byId("roomCodeInput"),
  tripTitle: byId("tripTitle"),
  currentUserLabel: byId("currentUserLabel"),
  copyRoomCodeBtn: byId("copyRoomCodeBtn"),
  openSettingsBtn: byId("openSettingsBtn"),
  leaveRoomBtn: byId("leaveRoomBtn"),
  settingsTripName: byId("settingsTripName"),
  settingsTripSubtitle: byId("settingsTripSubtitle"),
  saveSettingsBtn: byId("saveSettingsBtn"),
  tabChecklist: byId("tab-checklist"),
  tabMembers: byId("tab-members"),
  tabIdeas: byId("tab-ideas"),
  tabExpenses: byId("tab-expenses"),
  badgeChecklist: byId("badgeChecklist"),
  badgeIdeas: byId("badgeIdeas"),
  badgeExpenses: byId("badgeExpenses"),
  fabChecklist: byId("fabChecklist"),
  fabExpenses: byId("fabExpenses"),
  itemNameInput: byId("itemNameInput"),
  itemCategoryInput: byId("itemCategoryInput"),
  itemQtyInput: byId("itemQtyInput"),
  itemPriorityInput: byId("itemPriorityInput"),
  saveItemBtn: byId("saveItemBtn"),
  ideaTextInput: byId("ideaTextInput"),
  saveIdeaBtn: byId("saveIdeaBtn"),
  expenseNameInput: byId("expenseNameInput"),
  expenseAmountInput: byId("expenseAmountInput"),
  expensePaidByInput: byId("expensePaidByInput"),
  saveExpenseBtn: byId("saveExpenseBtn"),
  memberNameInput: byId("memberNameInput"),
  memberPhoneInput: byId("memberPhoneInput"),
  saveMemberBtn: byId("saveMemberBtn"),
  confirmDeleteBtn: byId("confirmDeleteBtn"),
  toast: byId("toast")
};

let app, auth, db, currentUser = null, currentRoomCode = null;
let roomUnsub = null, itemsUnsub = null, ideasUnsub = null, expensesUnsub = null, membersUnsub = null;
let roomData = null, items = [], ideas = [], expenses = [], members = [];
let currentTab = 'checklist';
let currentFilter = 'all';
let pendingDelete = null;

boot();

function boot() {
  bindUI();

  if (missingConfig) {
    showToast("צריך להדביק Firebase config בתוך index.html", "error");
    els.loadingScreen.classList.remove("active");
    els.authScreen.classList.add("active");
    return;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  const savedName = localStorage.getItem("kinneret_live_display_name") || "";
  const savedRoom = localStorage.getItem("kinneret_live_room_code") || "";
  els.displayNameInput.value = savedName;
  els.roomCodeInput.value = savedRoom;

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      els.loadingScreen.classList.remove("active");
      const savedNameNow = localStorage.getItem("kinneret_live_display_name");
      const savedRoomNow = localStorage.getItem("kinneret_live_room_code");
      if (savedNameNow && savedRoomNow) {
        await joinExistingRoom(savedRoomNow, savedNameNow);
      } else {
        showScreen("authScreen");
      }
      return;
    }

    try {
      await signInAnonymously(auth);
    } catch (err) {
      console.error(err);
      els.loadingScreen.classList.remove("active");
      showScreen("authScreen");
      showToast("שגיאת התחברות ל-Firebase", "error");
    }
  });
}

function bindUI() {
  els.createRoomBtn.addEventListener("click", createRoom);
  els.joinRoomToggleBtn.addEventListener("click", () => els.joinRoomBox.classList.toggle("hidden"));
  els.joinRoomBtn.addEventListener("click", joinRoomFromInput);
  els.copyRoomCodeBtn.addEventListener("click", copyRoomCode);
  els.openSettingsBtn.addEventListener("click", openSettings);
  els.leaveRoomBtn.addEventListener("click", leaveRoom);
  els.saveSettingsBtn.addEventListener("click", saveRoomSettings);
  els.saveItemBtn.addEventListener("click", addItem);
  els.saveIdeaBtn.addEventListener("click", addIdea);
  els.saveExpenseBtn.addEventListener("click", addExpense);
  els.saveMemberBtn.addEventListener("click", addMember);
  els.confirmDeleteBtn.addEventListener("click", async () => {
    if (pendingDelete) await pendingDelete();
    pendingDelete = null;
    closeModal("confirmModal");
  });

  document.querySelectorAll(".close-modal-btn").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.closest(".modal").id));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  els.fabChecklist.addEventListener("click", () => openModal("itemModal"));
  els.fabExpenses.addEventListener("click", () => openModal("expenseModal"));
}

function byId(id) { return document.getElementById(id); }
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  byId(id).classList.add("active");
}
function openModal(id) { byId(id).classList.add("open"); }
function closeModal(id) { byId(id).classList.remove("open"); }

function showToast(msg, type = "success") {
  els.toast.textContent = msg;
  els.toast.className = `toast ${type} show`;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}
function randomRoomCode() {
  return "TRIP" + Math.random().toString(36).slice(2, 6).toUpperCase();
}
function priorityBadge(priority) {
  if (priority === "required") return `<span class="badge req">חובה</span>`;
  if (priority === "important") return `<span class="badge imp">חשוב</span>`;
  return `<span class="badge bonus">בונוס</span>`;
}
function esc(str) {
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}
function todayText() {
  return new Date().toLocaleDateString("he-IL", { day:"2-digit", month:"2-digit" });
}
function fmt(n) {
  return Number(n || 0).toLocaleString("he-IL");
}
function categoryIcon(cat) {
  if ((cat || "").includes("חשמל")) return "⚡";
  if ((cat || "").includes("שינה")) return "⛺";
  if ((cat || "").includes("ילדים") || (cat || "").includes("פנאי")) return "🏄";
  if ((cat || "").includes("אוכל")) return "🍖";
  return "📦";
}
function avatarGradient(name) {
  const colors = [
    "linear-gradient(135deg,#f472b6,#ec4899)",
    "linear-gradient(135deg,#34d399,#059669)",
    "linear-gradient(135deg,#fbbf24,#d97706)",
    "linear-gradient(135deg,#a78bfa,#7c3aed)",
    "linear-gradient(135deg,#fb7185,#e11d48)"
  ];
  let sum = 0;
  for (const ch of name || "") sum += ch.charCodeAt(0);
  return colors[sum % colors.length];
}

async function createRoom() {
  const displayName = els.displayNameInput.value.trim();
  if (!displayName) return showToast("צריך לרשום את השם שלך", "error");

  const roomCode = randomRoomCode();
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  if (roomSnap.exists()) return createRoom();

  const createdAt = serverTimestamp();
  await setDoc(roomRef, {
    roomCode,
    tripName: "כנרת 2026",
    tripSubtitle: "יום העצמאות",
    createdAt,
    createdByUid: currentUser.uid
  });

  await ensureMemberExists(roomCode, currentUser.uid, displayName, "", true);

  for (const item of seedItems) {
    await addDoc(collection(db, "rooms", roomCode, "items"), {
      ...item,
      createdAt
    });
  }

  localStorage.setItem("kinneret_live_display_name", displayName);
  localStorage.setItem("kinneret_live_room_code", roomCode);
  await joinExistingRoom(roomCode, displayName);
  showToast("החדר נוצר בהצלחה", "success");
}

async function joinRoomFromInput() {
  const displayName = els.displayNameInput.value.trim();
  const roomCode = normalizeRoomCode(els.roomCodeInput.value);
  if (!displayName) return showToast("צריך לרשום את השם שלך", "error");
  if (!roomCode) return showToast("צריך קוד חדר", "error");

  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return showToast("החדר לא נמצא", "error");

  localStorage.setItem("kinneret_live_display_name", displayName);
  localStorage.setItem("kinneret_live_room_code", roomCode);
  await ensureMemberExists(roomCode, currentUser.uid, displayName, "", false);
  await joinExistingRoom(roomCode, displayName);
  showToast("התחברת לחדר", "success");
}

async function joinExistingRoom(roomCode, displayName) {
  currentRoomCode = roomCode;
  startListeners(roomCode);
  showScreen("appScreen");
  els.currentUserLabel.textContent = `👤 ${displayName}`;
}

function unsubscribeAll() {
  [roomUnsub, itemsUnsub, ideasUnsub, expensesUnsub, membersUnsub].forEach(fn => {
    if (typeof fn === "function") fn();
  });
  roomUnsub = itemsUnsub = ideasUnsub = expensesUnsub = membersUnsub = null;
}

function startListeners(roomCode) {
  unsubscribeAll();

  roomUnsub = onSnapshot(doc(db, "rooms", roomCode), (snap) => {
    roomData = snap.exists() ? snap.data() : null;
    renderAll();
  });

  itemsUnsub = onSnapshot(query(collection(db, "rooms", roomCode, "items"), orderBy("createdAt")), (snap) => {
    items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  ideasUnsub = onSnapshot(query(collection(db, "rooms", roomCode, "ideas"), orderBy("createdAt")), (snap) => {
    ideas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  expensesUnsub = onSnapshot(query(collection(db, "rooms", roomCode, "expenses"), orderBy("createdAt")), (snap) => {
    expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  membersUnsub = onSnapshot(query(collection(db, "rooms", roomCode, "members"), orderBy("createdAt")), (snap) => {
    members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  });
}

async function ensureMemberExists(roomCode, uid, name, phone = "", isSelf = false) {
  const memberRef = doc(db, "rooms", roomCode, "members", uid);
  const memberSnap = await getDoc(memberRef);
  const payload = {
    uid,
    name,
    phone,
    isSelf,
    updatedAt: serverTimestamp()
  };
  if (memberSnap.exists()) {
    await updateDoc(memberRef, payload);
  } else {
    await setDoc(memberRef, {
      ...payload,
      createdAt: serverTimestamp()
    });
  }
}

function renderAll() {
  if (!roomData) return;
  renderHeader();
  renderChecklist();
  renderMembers();
  renderIdeas();
  renderExpenses();
  fillExpenseMembers();
  syncTabVisibility();
}

function renderHeader() {
  const title = roomData.tripSubtitle
    ? `${roomData.tripName} — ${roomData.tripSubtitle}`
    : roomData.tripName;
  els.tripTitle.textContent = `${title} 🏕️`;
  els.copyRoomCodeBtn.textContent = currentRoomCode || "----";
  const me = members.find(m => m.uid === currentUser?.uid);
  els.currentUserLabel.textContent = `👤 ${me?.name || localStorage.getItem("kinneret_live_display_name") || ""}`;
}

function filteredItems() {
  const meName = members.find(m => m.uid === currentUser?.uid)?.name || "";
  if (currentFilter === "free") return items.filter(i => !i.claimedBy);
  if (currentFilter === "mine") return items.filter(i => i.claimedBy === meName);
  if (currentFilter === "done") return items.filter(i => i.done);
  return items;
}

function renderChecklist() {
  const total = items.length;
  const claimed = items.filter(x => !!x.claimedBy).length;
  const done = items.filter(x => x.done).length;
  const meName = members.find(m => m.uid === currentUser?.uid)?.name || "";
  const mine = items.filter(x => x.claimedBy === meName).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const grouped = {};
  filteredItems().forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  els.tabChecklist.innerHTML = `
    <div class="stats">
      <div class="stats-grid">
        <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">סה"כ</div></div>
        <div class="stat"><div class="stat-num" style="color:#f59e0b">${claimed}</div><div class="stat-label">נלקחו</div></div>
        <div class="stat"><div class="stat-num" style="color:#22c55e">${done}</div><div class="stat-label">הושלמו</div></div>
        <div class="stat"><div class="stat-num">${mine}</div><div class="stat-label">שלי</div></div>
      </div>
      <div class="progress"><div style="width:${pct}%"></div></div>
    </div>
    <div class="filter-row">
      <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">הכל</button>
      <button class="filter-btn ${currentFilter === 'free' ? 'active' : ''}" data-filter="free">פנויים</button>
      <button class="filter-btn ${currentFilter === 'mine' ? 'active' : ''}" data-filter="mine">שלי</button>
      <button class="filter-btn ${currentFilter === 'done' ? 'active' : ''}" data-filter="done">הושלמו</button>
    </div>
    <div class="section" id="checklistGroups"></div>
  `;

  els.tabChecklist.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      renderChecklist();
    });
  });

  const wrap = byId("checklistGroups");
  const categories = Object.keys(grouped);
  if (!categories.length) {
    wrap.innerHTML = `<div class="empty"><div class="icon">📭</div><div class="t">אין פריטים להצגה</div></div>`;
  } else {
    categories.forEach(category => {
      const sec = document.createElement("div");
      sec.innerHTML = `
        <div class="section-title">
          <span style="font-size:18px">${categoryIcon(category)}</span>
          <span class="ttl">${esc(category)}</span>
          <span class="cnt">(${grouped[category].length})</span>
        </div>
      `;
      grouped[category].forEach(item => {
        const mine = item.claimedBy && item.claimedBy === meName;
        const ownerHtml = item.claimedBy
          ? `<div class="item-sub ${mine ? 'owner-mine' : 'owner-other'}">${mine ? '✅ אני מביא' : '👤 ' + esc(item.claimedBy)}</div>`
          : `<div class="item-sub owner-free">לא נלקח</div>`;

        const card = document.createElement("div");
        card.className = `item-card ${item.claimedBy ? 'claimed' : ''} ${item.done ? 'done' : ''}`;
        card.innerHTML = `
          <div class="item-row">
            <div class="check ${item.done ? 'checked' : ''}" data-id="${item.id}" data-action="done">${item.done ? '✓' : ''}</div>
            <div class="item-body">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span class="item-name ${item.done ? 'done-text' : ''}">${esc(item.name)}</span>
                ${item.qty > 1 ? `<span class="muted">×${item.qty}</span>` : ''}
                ${priorityBadge(item.priority)}
              </div>
              ${ownerHtml}
            </div>
            <div class="item-actions">
              ${mine
                ? `<button class="mini-btn release-btn" data-id="${item.id}" data-action="release">שחרר</button>`
                : !item.claimedBy
                  ? `<button class="mini-btn claim-btn" data-id="${item.id}" data-action="claim">אני מביא</button>`
                  : `<button class="mini-btn claim-btn" data-id="${item.id}" data-action="take">קח ממני</button>`
              }
              <button class="tiny-btn" data-id="${item.id}" data-action="delete">🗑️</button>
            </div>
          </div>
        `;
        sec.appendChild(card);
      });
      wrap.appendChild(sec);
    });
  }

  wrap.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", () => handleItemAction(el.dataset.action, el.dataset.id));
  });

  els.badgeChecklist.textContent = `${done}/${total}`;
}

async function handleItemAction(action, id) {
  const itemRef = doc(db, "rooms", currentRoomCode, "items", id);
  const meName = members.find(m => m.uid === currentUser?.uid)?.name || "";

  if (action === "done") {
    const item = items.find(i => i.id === id);
    await updateDoc(itemRef, { done: !item.done });
  }
  if (action === "claim" || action === "take") {
    await updateDoc(itemRef, { claimedBy: meName });
  }
  if (action === "release") {
    await updateDoc(itemRef, { claimedBy: "" });
  }
  if (action === "delete") {
    pendingDelete = async () => deleteDoc(itemRef);
    openModal("confirmModal");
  }
}

function renderMembers() {
  const claimed = items.filter(x => !!x.claimedBy).length;
  const free = items.filter(x => !x.claimedBy).length;

  els.tabMembers.innerHTML = `
    <div class="stats">
      <div class="topbar">
        <div>
          <div class="muted" style="margin:0 0 4px 0">קוד הזמנה לחדר</div>
          <div style="font-family:Rubik,sans-serif;font-size:24px;font-weight:900;letter-spacing:3px">${esc(currentRoomCode || "")}</div>
        </div>
        <button id="copyRoomCodeBtn2" class="btn btn-light" style="width:auto;padding:10px 14px">📋 העתק</button>
      </div>
      <div class="row gap12">
        <div class="box" style="text-align:center;padding:10px"><div class="stat-num">${members.length}</div><div class="stat-label">חברים</div></div>
        <div class="box" style="text-align:center;padding:10px"><div class="stat-num" style="color:#16a34a">${claimed}</div><div class="stat-label">נלקחו</div></div>
        <div class="box" style="text-align:center;padding:10px"><div class="stat-num" style="color:#d97706">${free}</div><div class="stat-label">פנויים</div></div>
      </div>
    </div>
    <div class="section">
      <div class="topbar">
        <div class="section-title" style="margin:0;padding:0"><span class="ttl">חברי הקבוצה (${members.length})</span></div>
        <button id="openMemberModalBtn" class="btn btn-light" style="width:auto;padding:9px 14px">+ חבר</button>
      </div>
      <div id="membersCards"></div>
    </div>
  `;

  byId("copyRoomCodeBtn2").addEventListener("click", copyRoomCode);
  byId("openMemberModalBtn").addEventListener("click", () => openModal("memberModal"));

  const wrap = byId("membersCards");
  if (!members.length) {
    wrap.innerHTML = `<div class="empty"><div class="icon">👥</div><div class="t">אין חברים עדיין</div></div>`;
    return;
  }

  members.forEach(member => {
    const memberItems = items.filter(it => it.claimedBy === member.name);
    const doneCount = memberItems.filter(i => i.done).length;
    const avatarChar = (member.name || "?").charAt(0);
    const card = document.createElement("div");
    card.className = `person-card ${member.uid === currentUser?.uid ? 'me' : ''}`;
    card.innerHTML = `
      <div class="person-top">
        <div class="avatar" style="background:${member.uid === currentUser?.uid ? 'linear-gradient(135deg,#0ca4e7,#0082c5)' : avatarGradient(member.name)}">${esc(avatarChar)}</div>
        <div>
          <div style="font-family:Rubik,sans-serif;font-size:16px;font-weight:800">
            ${esc(member.name)}
            ${member.uid === currentUser?.uid ? '<span class="badge" style="background:#eff9ff;color:#0369a1;border:1px solid #bae6fd">אני</span>' : ''}
          </div>
          <div class="muted" dir="ltr">${esc(member.phone || '')}</div>
        </div>
        <div class="person-stat"><div class="n">${memberItems.length}</div><div class="l">פריטים</div></div>
      </div>
      <div style="margin-top:12px;height:5px;background:#eef2f7;border-radius:999px;overflow:hidden">
        <div style="height:100%;width:${memberItems.length ? Math.round((doneCount / memberItems.length) * 100) : 0}%;background:#4ade80"></div>
      </div>
      <div class="chips">
        ${memberItems.length ? memberItems.slice(0, 6).map(it => `<span class="chip ${it.done ? 'done' : ''}">${esc(it.name)}</span>`).join('') : '<span class="chip">אין פריטים כרגע</span>'}
        ${memberItems.length > 6 ? `<span class="chip">+${memberItems.length - 6}</span>` : ''}
      </div>
      ${member.uid !== currentUser?.uid ? `<div style="margin-top:10px"><button class="mini-btn" data-remove-member="${member.id}">מחק חבר</button></div>` : ''}
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll("[data-remove-member]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const memberId = btn.dataset.removeMember;
      pendingDelete = async () => {
        const member = members.find(m => m.id === memberId);
        if (member) {
          const relatedItems = items.filter(i => i.claimedBy === member.name);
          for (const item of relatedItems) {
            await updateDoc(doc(db, "rooms", currentRoomCode, "items", item.id), { claimedBy: "" });
          }
        }
        await deleteDoc(doc(db, "rooms", currentRoomCode, "members", memberId));
      };
      openModal("confirmModal");
    });
  });
}

function renderIdeas() {
  const openIdeas = ideas.filter(x => !x.done).length;
  const doneIdeas = ideas.filter(x => x.done).length;

  els.tabIdeas.innerHTML = `
    <div class="stats">
      <div class="topbar">
        <div style="display:flex;gap:20px">
          <div class="stat"><div class="stat-num" style="color:#f59e0b">${openIdeas}</div><div class="stat-label">פתוחים</div></div>
          <div class="stat"><div class="stat-num" style="color:#22c55e">${doneIdeas}</div><div class="stat-label">הושלמו</div></div>
        </div>
        <button id="openIdeaModalBtn" class="btn btn-light" style="width:auto;padding:9px 14px;background:#fffbeb;color:#b45309">+ רעיון חדש</button>
      </div>
    </div>
    <div class="section"><div id="ideasWrap"></div></div>
  `;

  byId("openIdeaModalBtn").addEventListener("click", () => openModal("ideaModal"));

  const wrap = byId("ideasWrap");
  if (!ideas.length) {
    wrap.innerHTML = `<div class="empty"><div class="icon">💡</div><div class="t">אין רעיונות עדיין</div></div>`;
  } else {
    ideas.filter(x => !x.done).forEach(idea => wrap.appendChild(ideaEl(idea)));
    if (doneIdeas) {
      const sep = document.createElement("div");
      sep.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:16px 0 8px"><div style="flex:1;height:1px;background:#eef2f7"></div><span class="muted">הושלמו (${doneIdeas})</span><div style="flex:1;height:1px;background:#eef2f7"></div></div>`;
      wrap.appendChild(sep);
      ideas.filter(x => x.done).forEach(idea => wrap.appendChild(ideaEl(idea)));
    }
  }
  wrap.querySelectorAll("[data-idea-action]").forEach(btn => {
    btn.addEventListener("click", () => handleIdeaAction(btn.dataset.ideaAction, btn.dataset.id));
  });

  els.badgeIdeas.textContent = openIdeas;
}

function ideaEl(idea) {
  const el = document.createElement("div");
  el.className = `idea-card ${idea.done ? 'done' : ''}`;
  el.innerHTML = `
    <div class="idea-row">
      <div class="check ${idea.done ? 'checked' : ''}" data-idea-action="toggle" data-id="${idea.id}">${idea.done ? '✓' : ''}</div>
      <div class="idea-text-wrap">
        <div class="${idea.done ? 'done-text' : ''}" style="font-size:14px;color:#374151;line-height:1.5">${esc(idea.text)}</div>
      </div>
      <div class="tiny-actions">
        <button class="tiny-btn" data-idea-action="delete" data-id="${idea.id}">🗑️</button>
      </div>
    </div>
  `;
  return el;
}

async function handleIdeaAction(action, id) {
  const ideaRef = doc(db, "rooms", currentRoomCode, "ideas", id);
  if (action === "toggle") {
    const idea = ideas.find(i => i.id === id);
    await updateDoc(ideaRef, { done: !idea.done });
  }
  if (action === "delete") {
    pendingDelete = async () => deleteDoc(ideaRef);
    openModal("confirmModal");
  }
}

function renderExpenses() {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const count = Math.max(1, members.length);
  const perPerson = Math.round(total / count);

  els.tabExpenses.innerHTML = `
    <div class="summary">
      <div class="split-row">
        <div>
          <div class="muted">סה"כ הוצאות</div>
          <div class="big">₪${fmt(total)}</div>
        </div>
        <div style="text-align:left">
          <div class="muted">חלוקה שווה</div>
          <div style="font-family:Rubik,sans-serif;font-size:20px;font-weight:800;color:#0284c7">₪${fmt(perPerson)}</div>
        </div>
      </div>
      <div class="split-list">
        ${members.map(m => {
          const paid = expenses.filter(e => e.paidBy === m.name).reduce((sum, e) => sum + Number(e.amount || 0), 0);
          return `
            <div class="pill ${m.uid === currentUser?.uid ? 'me' : ''}">
              <div class="a">₪${fmt(paid)}</div>
              <div class="n">${esc(m.uid === currentUser?.uid ? 'אני' : m.name)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
    <div class="section"><div id="expensesWrap"></div></div>
  `;

  const wrap = byId("expensesWrap");
  if (!expenses.length) {
    wrap.innerHTML = `<div class="empty"><div class="icon">💳</div><div class="t">אין הוצאות עדיין</div></div>`;
  } else {
    [...expenses].reverse().forEach(exp => {
      const mine = exp.paidBy === members.find(m => m.uid === currentUser?.uid)?.name;
      const card = document.createElement("div");
      card.className = `expense-card ${mine ? 'claimed' : ''}`;
      card.innerHTML = `
        <div class="expense-row">
          <div style="width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:${mine ? 'var(--water-500)' : '#f1f5f9'};color:${mine ? '#fff' : '#334155'};font-family:Rubik,sans-serif;font-weight:800;font-size:12px;flex-shrink:0">₪${fmt(exp.amount)}</div>
          <div style="flex:1;min-width:0">
            <div class="expense-name">${esc(exp.name)}</div>
            <div class="expense-sub ${mine ? 'owner-mine' : ''}">${mine ? '💳 אני שילמתי' : '👤 ' + esc(exp.paidBy)} · ${esc(exp.date || '')}</div>
          </div>
          <div style="font-family:Rubik,sans-serif;font-weight:800;font-size:16px">₪${fmt(exp.amount)}</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid #f8fafc">
          <button class="mini-btn" data-expense-delete="${exp.id}">🗑️ מחיקה</button>
        </div>
      `;
      wrap.appendChild(card);
    });
  }

  wrap.querySelectorAll("[data-expense-delete]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.expenseDelete;
      pendingDelete = async () => deleteDoc(doc(db, "rooms", currentRoomCode, "expenses", id));
      openModal("confirmModal");
    });
  });

  els.badgeExpenses.textContent = expenses.length;
}

function fillExpenseMembers() {
  els.expensePaidByInput.innerHTML = members.map(m => `<option value="${esc(m.name)}">${esc(m.name)}</option>`).join("");
  const me = members.find(m => m.uid === currentUser?.uid);
  if (me) els.expensePaidByInput.value = me.name;
}

async function addItem() {
  const name = els.itemNameInput.value.trim();
  const category = els.itemCategoryInput.value.trim() || "כללי";
  const qty = Math.max(1, Number(els.itemQtyInput.value || 1));
  const priority = els.itemPriorityInput.value;
  if (!name) return showToast("צריך שם לפריט", "error");

  await addDoc(collection(db, "rooms", currentRoomCode, "items"), {
    name, category, qty, priority,
    claimedBy: "",
    done: false,
    createdAt: serverTimestamp()
  });

  els.itemNameInput.value = "";
  els.itemCategoryInput.value = "";
  els.itemQtyInput.value = "1";
  els.itemPriorityInput.value = "required";
  closeModal("itemModal");
  showToast("פריט נוסף", "success");
}

async function addIdea() {
  const text = els.ideaTextInput.value.trim();
  if (!text) return showToast("צריך לכתוב רעיון", "error");

  await addDoc(collection(db, "rooms", currentRoomCode, "ideas"), {
    text,
    done: false,
    createdAt: serverTimestamp()
  });

  els.ideaTextInput.value = "";
  closeModal("ideaModal");
  showToast("רעיון נוסף", "success");
}

async function addExpense() {
  const name = els.expenseNameInput.value.trim();
  const amount = Number(els.expenseAmountInput.value || 0);
  const paidBy = els.expensePaidByInput.value;
  if (!name) return showToast("צריך שם להוצאה", "error");
  if (amount <= 0) return showToast("צריך סכום תקין", "error");

  await addDoc(collection(db, "rooms", currentRoomCode, "expenses"), {
    name,
    amount,
    paidBy,
    date: todayText(),
    createdAt: serverTimestamp()
  });

  els.expenseNameInput.value = "";
  els.expenseAmountInput.value = "";
  closeModal("expenseModal");
  showToast("הוצאה נוספה", "success");
}

async function addMember() {
  const name = els.memberNameInput.value.trim();
  const phone = els.memberPhoneInput.value.trim();
  if (!name) return showToast("צריך שם לחבר", "error");

  const id = crypto.randomUUID();
  await setDoc(doc(db, "rooms", currentRoomCode, "members", id), {
    uid: id,
    name,
    phone,
    isSelf: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  els.memberNameInput.value = "";
  els.memberPhoneInput.value = "";
  closeModal("memberModal");
  showToast("חבר נוסף", "success");
}

function openSettings() {
  els.settingsTripName.value = roomData?.tripName || "";
  els.settingsTripSubtitle.value = roomData?.tripSubtitle || "";
  openModal("settingsModal");
}

async function saveRoomSettings() {
  await updateDoc(doc(db, "rooms", currentRoomCode), {
    tripName: els.settingsTripName.value.trim() || "כנרת 2026",
    tripSubtitle: els.settingsTripSubtitle.value.trim() || ""
  });
  closeModal("settingsModal");
  showToast("ההגדרות נשמרו", "success");
}

function copyRoomCode() {
  navigator.clipboard?.writeText(currentRoomCode || "").then(() => {
    showToast("הקוד הועתק", "success");
  }).catch(() => {
    showToast("לא הצלחתי להעתיק", "error");
  });
}

function leaveRoom() {
  localStorage.removeItem("kinneret_live_room_code");
  unsubscribeAll();
  roomData = null;
  items = [];
  ideas = [];
  expenses = [];
  members = [];
  currentRoomCode = null;
  showScreen("authScreen");
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  byId(`tab-${tab}`).classList.add("active");
  document.querySelectorAll(".nav-tab").forEach(btn => btn.classList.remove("active"));
  document.querySelector(`.nav-tab[data-tab="${tab}"]`).classList.add("active");
  syncTabVisibility();
}

function syncTabVisibility() {
  els.fabChecklist.classList.toggle("hidden", currentTab !== "checklist");
  els.fabExpenses.classList.toggle("hidden", currentTab !== "expenses");
}
