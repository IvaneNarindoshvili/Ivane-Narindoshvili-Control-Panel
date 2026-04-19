import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyATaL1nfnQdrk96ikK0BrQn9TJcOsP4DtI",
  authDomain: "apex-node-22616.firebaseapp.com",
  projectId: "apex-node-22616",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "apex-node");

let sessionUser = JSON.parse(sessionStorage.getItem("apex_session")) || null;
let allUsers = [];
let generatedOTP = "";

window.onload = () => {
  if (sessionUser) {
    launch();
    updateOnlineStatus(sessionUser.email, true);
  }
  listenToUsers();
  listenToMessages();
};

window.onbeforeunload = () => {
  if (sessionUser) updateOnlineStatus(sessionUser.email, false);
};

async function updateOnlineStatus(email, status) {
  await updateDoc(doc(db, "users", email), { online: status });
}

function listenToMessages() {
  const seen = JSON.parse(localStorage.getItem("seenMessages") || "{}");
  const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));

  onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const msg = change.doc.data();
        const id = change.doc.id;
        const to = (msg.to || "").toLowerCase();
        const myEmail = sessionUser?.email?.toLowerCase();
        if ((to === "all" || to === myEmail) && !seen[id]) {
          showToast(`📩 ${msg.from}: ${msg.text}`, id);
        }
      }
    });
  });
}

async function sendMessage(to, text) {
  const sender = sessionUser?.name || "Anonymous";
  const senderEmail = sessionUser?.email?.toLowerCase() || "anon";
  await setDoc(doc(db, "messages", Date.now().toString()), {
    to: (to || "all").toLowerCase(),
    text,
    from: sender,
    fromEmail: senderEmail,
    timestamp: Date.now(),
  });
}

document.getElementById("unifiedAuthForm").onsubmit = async (e) => {
  e.preventDefault();
  const errBox = document.getElementById("authError");
  errBox.style.display = "none";

  const name = document.getElementById("uName").value.trim();
  const email = document.getElementById("uEmail").value.trim().toLowerCase();
  const pass = document.getElementById("uPass").value;

  const userRef = doc(db, "users", email);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    if (data.name !== name) {
      errBox.textContent = "❌ ეს Gmail უკვე გამოყენებულია სხვა სახელით!";
      errBox.style.display = "block";
      return;
    }
    if (data.password !== pass) {
      errBox.textContent = "❌ პაროლი არასწორია!";
      errBox.style.display = "block";
      return;
    }
    sessionUser = data;
  } else {
    sessionUser = {
      name,
      email,
      password: pass,
      role: name.toLowerCase() === "admin" ? "admin" : "user",
      avatar: null,
      online: true,
    };
    await setDoc(userRef, sessionUser);
  }

  generatedOTP = Math.floor(1000 + Math.random() * 9000).toString();
  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("otpBox").classList.remove("hidden");
  document.getElementById("otpDisplay").textContent = generatedOTP;
};

document.getElementById("verifyOtpBtn").onclick = () => {
  if (document.getElementById("otpIn").value === generatedOTP) {
    sessionStorage.setItem("apex_session", JSON.stringify(sessionUser));
    updateOnlineStatus(sessionUser.email, true);
    launch();
  } else alert("❌ არასწორი კოდი!");
};

let statsInterval;

function launch() {
  statsInterval = setInterval(updateLiveStats, 2000);
  document.getElementById("authView").classList.add("hidden");
  document.getElementById("dashboardView").classList.remove("hidden");
  loadHistory();
  initTerminal();
  syncUI();
  bindSidebar();
  startOscilloscope();
  setInterval(updateLiveStats, 2000);
}

function renderRegistry() {
  const registryBody = document.getElementById("publicRegistry");
  if (!registryBody) return;

  registryBody.innerHTML = ""; // ჯერ ვასუფთავებთ ძველ სიას

  allUsers.forEach((user) => {
    const row = document.createElement("tr");

    // ვადგენთ სტატუსს
    const statusColor = user.online ? "var(--success)" : "var(--text-dim)";
    const statusText = user.online ? "ONLINE" : "OFFLINE";

    row.innerHTML = `
      <td><span style="color: ${statusColor}; font-weight: 800; font-size: 0.7rem;">● ${statusText}</span></td>
      <td style="font-weight: 600;">${user.name}</td>
      <td style="color: var(--text-dim); font-family: 'Fira Code', monospace; font-size: 0.85rem;">${user.email}</td>
    `;
    registryBody.appendChild(row);
  });
}

function listenToUsers() {
  onSnapshot(collection(db, "users"), (snapshot) => {
    allUsers = snapshot.docs.map((d) => d.data());

    const userCountEl = document.getElementById("userCount");
    if (userCountEl) {
      userCountEl.textContent = allUsers.filter((u) => u.online).length;
    }

    if (sessionUser?.role === "admin") {
      renderRegistry();
    }
  });
}

function syncUI() {
  document.getElementById("sideUserName").textContent = sessionUser.name;
  document.getElementById("roleBadge").textContent =
    sessionUser.role === "admin" ? "System Admin" : "Active Node";
  const av = sessionUser.avatar
    ? `<img src="${sessionUser.avatar}">`
    : sessionUser.name[0].toUpperCase();
  document.getElementById("avatarIcon").innerHTML = av;
  document.getElementById("profAvatar").innerHTML = av;
  if (sessionUser.role === "admin") {
    document.getElementById("adminSidebarTab").classList.remove("hidden");
    document.getElementById("adminNodesList").classList.remove("hidden");
  }
}

function bindSidebar() {
  document.getElementById("sidebarMenu").onclick = (e) => {
    if (e.target.dataset.tab) {
      document
        .querySelectorAll("[id^='tab-']")
        .forEach((el) => el.classList.add("hidden"));
      document
        .querySelectorAll(".sidebar-item")
        .forEach((el) => el.classList.remove("active-tab"));
      document
        .getElementById("tab-" + e.target.dataset.tab)
        .classList.remove("hidden");
      e.target.classList.add("active-tab");
    }
  };
}

function initTerminal() {
  const termInput = document.getElementById("termInput");
  const termWindow = document.getElementById("termWindow");
  if (!termInput) return;

  termInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;
    const val = termInput.value.trim();
    if (!val) return;
    const parts = val.split(" ");
    const cmd = parts[0].toLowerCase();

    try {
      if (cmd === "msg") await sendMessage("all", parts.slice(1).join(" "));
      if (cmd === "pmsg") await sendMessage(parts[1], parts.slice(2).join(" "));
      if (cmd === "block") await deleteDoc(doc(db, "users", parts[1]));
      if (cmd === "clear")
        document.getElementById("termHistory").innerHTML = "";
    } catch (err) {
      printToTerm("> ERROR", "var(--error)");
    }
    termInput.value = "";
    termWindow.scrollTop = termWindow.scrollHeight;
  });
}

function printToTerm(text, color = "#fff") {
  const div = document.createElement("div");
  div.style.color = color;
  div.style.marginBottom = "6px";
  div.textContent = text;
  document.getElementById("termHistory").appendChild(div);
}

function loadHistory() {
  const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
  onSnapshot(q, (snapshot) => {
    const hist = document.getElementById("termHistory");
    hist.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const msg = docSnap.data();
      const to = (msg.to || "").toLowerCase();
      const currentEmail = sessionUser?.email?.toLowerCase();
      if (to === "all" || (currentEmail && to === currentEmail)) {
        printToTerm(`${msg.from}: ${msg.text}`);
      }
    });
  });
}

function showToast(text, id) {
  const toast = document.getElementById("toast");
  document.getElementById("toastText").textContent = text;
  toast.style.display = "block";
  document.getElementById("toastClose").onclick = () => {
    toast.style.display = "none";
    const seen = JSON.parse(localStorage.getItem("seenMessages") || "{}");
    seen[id] = true;
    localStorage.setItem("seenMessages", JSON.stringify(seen));
  };
}

function startOscilloscope() {
  const canvas = document.getElementById("monitorCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let offset = 0;
  function draw() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(0,242,254,0.25)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x < canvas.width; x++) {
      const y = canvas.height / 2 + Math.sin(x * 0.03 + offset) * 45;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    offset += 0.08;
    requestAnimationFrame(draw);
  }
  draw();
}

function updateLiveStats() {
  const cpuEl = document.getElementById("cpuVal");
  const memEl = document.getElementById("memVal");

  // ვამოწმებთ, აქვს თუ არა მოწყობილობას მეხსიერების API-ს მხარდაჭერა
  // (შენიშვნა: ბრაუზერების უმეტესობა უსაფრთხოების გამო რეალურ RAM-ს არ აჩვენებს)
  if (
    (window.performance && window.performance.memory) ||
    navigator.hardwareConcurrency
  ) {
    cpuEl.textContent = Math.floor(Math.random() * 10 + 2) + "%";
    memEl.textContent = Math.floor(Math.random() * 5 + 35) + "%";
  } else {
    const errorText =
      "თქვენს მოწყობილობას არ აქვს მონაცემები, რათა დავიწყოთ კალკულაცია, ამიტომ ამ ნაწილს ვერ გამოიყენებთ";

    cpuEl.parentElement.innerHTML = `<p class="no-data-msg">${errorText}</p>`;
    memEl.parentElement.innerHTML = `<p class="no-data-msg">${errorText}</p>`;

    // ვაჩერებთ ინტერვალს, რომ აღარ იწვალოს
    clearInterval(statsInterval);
  }
}

document.getElementById("themeBtn").onclick = () => {
  const isLight =
    document.documentElement.getAttribute("data-theme") === "light";
  if (isLight) {
    document.documentElement.removeAttribute("data-theme");
    sessionStorage.setItem("theme", "dark");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    sessionStorage.setItem("theme", "light");
  }
};

document.getElementById("logoutBtn").onclick = async () => {
  await updateOnlineStatus(sessionUser.email, false);
  sessionStorage.clear();
  location.reload();
};
