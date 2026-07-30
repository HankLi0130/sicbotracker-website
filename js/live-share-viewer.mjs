import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getAnalytics,
  isSupported as isAnalyticsSupported,
  logEvent,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js";
import {
  getDatabase,
  onValue,
  ref,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import {
  analyzeRolls,
  formatPercent,
  isValidShareId,
  parseSnapshot,
} from "./live-share-core.mjs";

const firebaseConfig = {
  apiKey: "AIzaSyDXpuF4zXzpgulcJiWINgh8-SKz886gZek",
  authDomain: "sicbotracker-b720d.firebaseapp.com",
  databaseURL: "https://sicbotracker-b720d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sicbotracker-b720d",
  storageBucket: "sicbotracker-b720d.firebasestorage.app",
  messagingSenderId: "1094129552365",
  appId: "1:1094129552365:web:35725798348c46d71435e4",
  measurementId: "G-ZDWYRZB3PV",
};

const stateElements = {
  loading: document.querySelector("#loading-state"),
  invalid: document.querySelector("#invalid-state"),
  network: document.querySelector("#network-state"),
  empty: document.querySelector("#empty-state"),
  content: document.querySelector("#share-content"),
};

let unsubscribe = null;
let validSnapshotLogged = false;

initializeSectionPreferences();
startViewer();
window.addEventListener("pagehide", stopListening, { once: true });
window.addEventListener("offline", () => {
  if (unsubscribe) showState("network");
});
window.addEventListener("online", () => {
  if (unsubscribe) showState("loading");
});

function startViewer() {
  const shareId = new URLSearchParams(window.location.search).get("s");
  if (!isValidShareId(shareId)) {
    showState("invalid");
    return;
  }

  const app = initializeApp(firebaseConfig);
  const database = getDatabase(app);
  const analyticsPromise = isAnalyticsSupported()
    .then((supported) => (supported ? getAnalytics(app) : null))
    .catch(() => null);

  unsubscribe = onValue(
    ref(database, `shares/${shareId}`),
    (snapshot) => {
      if (!snapshot.exists()) {
        showState("invalid");
        return;
      }

      try {
        const parsed = parseSnapshot(snapshot.val());
        renderSnapshot(parsed);
        logValidViewerOpen(analyticsPromise);
      } catch {
        showState("invalid");
      }
    },
    (error) => {
      showState(error?.code === "PERMISSION_DENIED" ? "invalid" : "network");
    },
  );
  if (!window.navigator.onLine) showState("network");
}

function stopListening() {
  unsubscribe?.();
  unsubscribe = null;
}

function showState(visibleState) {
  for (const [name, element] of Object.entries(stateElements)) {
    element.hidden = name !== visibleState;
  }
}

function renderSnapshot(snapshot) {
  const analysis = analyzeRolls(snapshot.rolls);
  const updatedLabel = `最後更新：${formatDate(snapshot.updatedAt)}`;

  document.querySelector("#empty-updated-at").textContent = updatedLabel;
  if (snapshot.rolls.length === 0) {
    showState("empty");
    return;
  }

  document.querySelector("#updated-at").textContent = updatedLabel;
  document.querySelector("#total-rolls").textContent = String(analysis.totalRolls);
  renderRecords(analysis.rolls);
  renderBasicAnalysis(analysis.basic);
  renderTripleRates(analysis.tripleRates);
  renderDiceHeat(analysis.diceHeat);
  renderSumDistribution(
    analysis.sumDistribution,
    analysis.hotSum,
    analysis.coldSum,
  );
  showState("content");
}

function renderRecords(rolls) {
  const list = document.querySelector("#record-list");
  list.replaceChildren(
    ...rolls.map((roll) => {
      const row = element("article", "record-row");
      const dice = element(
        "span",
        "record-dice",
        `${roll.dice1} · ${roll.dice2} · ${roll.dice3}`,
      );
      const tags = [
        `總和 ${roll.sum}`,
        roll.isTriple ? "豹子" : roll.bigSmall,
        roll.isTriple ? null : roll.oddEven,
      ].filter(Boolean);
      const result = element("span", "record-result", tags.join(" · "));
      const time = element("time", "record-time", formatDate(roll.timestamp));
      time.dateTime = new Date(roll.timestamp).toISOString();
      row.append(dice, result, time);
      return row;
    }),
  );
}

function renderBasicAnalysis(basic) {
  const metrics = [
    ["大", basic.bigPercent],
    ["小", basic.smallPercent],
    ["單", basic.oddPercent],
    ["雙", basic.evenPercent],
    ["豹子", basic.triplePercent],
  ];
  document.querySelector("#basic-analysis").replaceChildren(
    ...metrics.map(([label, percentage]) => metricCard(label, percentage)),
  );
}

function renderTripleRates(rates) {
  document.querySelector("#triple-rates").replaceChildren(
    ...rates.map((rate) => metricCard(`${rate.face}-${rate.face}-${rate.face}`, rate.percentage)),
  );
}

function renderDiceHeat(diceHeat) {
  document.querySelector("#dice-heat").replaceChildren(
    ...diceHeat.frequencies.map((frequency) => {
      const marker = frequency.number === diceHeat.hotNumber
        ? "熱門"
        : frequency.number === diceHeat.coldNumber
          ? "冷門"
          : null;
      const row = element(
        "div",
        `bar-row${marker === "熱門" ? " hot" : ""}${marker === "冷門" ? " cold" : ""}`,
      );
      const face = element("strong", "", String(frequency.number));
      if (marker) face.append(element("span", "marker", marker));
      const track = element("div", "bar-track");
      const fill = element("div", "bar-fill");
      fill.style.width = `${frequency.percentage}%`;
      track.append(fill);
      row.append(
        face,
        track,
        element("span", "bar-label", formatPercent(frequency.percentage)),
      );
      return row;
    }),
  );
}

function renderSumDistribution(distribution, hotSum, coldSum) {
  document.querySelector("#sum-distribution").replaceChildren(
    ...distribution.map((rate) => {
      const classes = [
        "distribution-cell",
        rate.sum === hotSum ? "hot" : "",
        rate.sum === coldSum ? "cold" : "",
      ].filter(Boolean).join(" ");
      const cell = element("div", classes);
      const marker = rate.sum === hotSum ? "熱門" : rate.sum === coldSum ? "冷門" : "";
      cell.append(
        element("strong", "", `${rate.sum}${marker ? ` · ${marker}` : ""}`),
        element("span", "", formatPercent(rate.percentage)),
      );
      return cell;
    }),
  );
}

function metricCard(label, percentage) {
  const card = element("div", "metric-card");
  card.append(
    element("strong", "", formatPercent(percentage)),
    element("span", "", label),
  );
  return card;
}

function element(tagName, className, textContent) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(timestamp));
}

function initializeSectionPreferences() {
  for (const details of document.querySelectorAll("details[data-section]")) {
    const storageKey = `liveShare.section.${details.dataset.section}`;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved != null) details.open = saved === "true";
    } catch {
      // Storage can be unavailable in privacy modes; default open states still work.
    }

    details.addEventListener("toggle", () => {
      try {
        window.localStorage.setItem(storageKey, String(details.open));
      } catch {
        // Section controls remain usable even when preferences cannot be persisted.
      }
    });
  }
}

async function logValidViewerOpen(analyticsPromise) {
  if (validSnapshotLogged) return;
  validSnapshotLogged = true;
  const analytics = await analyticsPromise;
  if (analytics) logEvent(analytics, "live_share_view_opened");
}
