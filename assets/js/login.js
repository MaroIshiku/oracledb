const user = "EVOSS";
const pass = "V0SS-7349-OMEGA-1182-AXIOM-7704";
const todayKey = new Date().toISOString().slice(0, 10);
const loginKey = "oracle-db-login-date";

function getStoredLoginDate() {
  try {
    return localStorage.getItem(loginKey);
  } catch {
    return null;
  }
}

function storeLoginDate() {
  try {
    localStorage.setItem(loginKey, todayKey);
  } catch {
    // If storage is blocked, the login simply behaves like a normal page gate.
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function goToIndex() {
  window.location.replace("/index/");
}

async function typeInto(node, value, delay) {
  if (!node) return;
  node.classList.add("active");
  node.textContent = "";
  for (const char of value) {
    node.textContent += char;
    await wait(delay);
  }
  node.classList.remove("active");
}

async function typePasswordWithCorrections(node, length) {
  if (!node) return;
  node.classList.add("active");
  node.textContent = "";

  const correctionPoints = new Set([11, 24]);
  for (let index = 0; index < length; index += 1) {
    node.textContent += "*";
    await wait(38 + Math.floor(Math.random() * 48));

    if (correctionPoints.has(index) && node.textContent.length > 2) {
      node.textContent = node.textContent.slice(0, -1);
      await wait(120 + Math.floor(Math.random() * 110));
      node.textContent += "*";
      await wait(45 + Math.floor(Math.random() * 55));
    }
  }
  node.classList.remove("active");
}

async function bootOracleLogin() {
  const login = document.querySelector("#login");
  const userNode = document.querySelector("#loginUser");
  const passNode = document.querySelector("#loginPass");
  const statusNode = document.querySelector("#loginStatus");

  if (!login || !userNode || !passNode || !statusNode) return;

  if (getStoredLoginDate() === todayKey) {
    goToIndex();
    return;
  }

  await wait(420);
  await typeInto(userNode, user, 105);
  statusNode.textContent = "Operator erkannt";
  await wait(360);
  await typePasswordWithCorrections(passNode, pass.length);
  statusNode.textContent = "Schluessel wird geprueft";
  await wait(560);
  statusNode.textContent = "Zugriff bestaetigt";
  await wait(440);
  storeLoginDate();
  login.classList.add("done");
  await wait(260);
  goToIndex();
}

bootOracleLogin();
