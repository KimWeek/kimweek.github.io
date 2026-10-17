import { rollingText } from "./rolling.js";

export const PROFILE = Object.freeze({
  discordId: "704112831653609543",
  discordName: "kim_week",
  counter: "https://kimweek.goatcounter.com",
  email: "week4452@gmail.com"
});
export const STATUS = Object.freeze({ online: "온라인", idle: "자리 비움", dnd: "방해 금지", offline: "오프라인" });

export function seoulDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function clockParts(date, use12Hour) {
  const parts = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: use12Hour ? "h12" : "h23" }).formatToParts(date);
  const part = type => parts.find(p => p.type === type)?.value || "";
  return { period: part("dayPeriod"), time: `${part("hour")}:${part("minute")}`, seconds: part("second") };
}

export function counterUrl(start = "") {
  return `${PROFILE.counter}/counter/TOTAL.json${start ? `?start=${encodeURIComponent(start)}` : ""}`;
}

function startInfo() {
  const $ = id => document.getElementById(id);
  const page = document.querySelector(".page");
  let showingInfo = false;
  addEventListener("portfolio-scenechange", event => { showingInfo = event.detail.info; });

  let use12Hour = false;
  try { use12Hour = localStorage.getItem("kimweek-time-format") === "12"; } catch {}
  function renderClock(immediate = false) {
    const now = new Date();
    const parts = clockParts(now, use12Hour);
    rollingText($("clock-value"), parts.time, immediate);
    rollingText($("clock-seconds"), parts.seconds, immediate);
    $("clock-period").textContent = parts.period;
    page.dataset.clock = use12Hour ? "12" : "24";
    $("clock-value").dateTime = now.toISOString();
    $("clock-meta").textContent = "GMT+9";
    $("clock-button").setAttribute("aria-label", `서울 기준 ${parts.period} ${parts.time} · ${use12Hour ? "24" : "12"}시간 표시로 전환`);
    $("clock-date").textContent = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(now);
  }
  function toggleFormat() {
    use12Hour = !use12Hour;
    try { localStorage.setItem("kimweek-time-format", use12Hour ? "12" : "24"); } catch {}
    renderClock();
  }
  $("clock-button").addEventListener("click", toggleFormat);
  renderClock(true);
  setInterval(() => { if (!document.hidden && showingInfo) renderClock(); }, 1000);

  async function fetchJSON(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Unavailable");
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  let presenceBusy = false;
  let lastPresence = 0;
  async function updatePresence() {
    if (presenceBusy) return;
    presenceBusy = true;
    try {
      const payload = await fetchJSON(`https://api.lanyard.rest/v1/users/${PROFILE.discordId}`);
      const status = payload.success && payload.data?.discord_status;
      if (!Object.hasOwn(STATUS, status)) throw new Error("Invalid presence");
      $("discord-status").textContent = STATUS[status];
      $("status-orb").dataset.status = status;
      lastPresence = Date.now();
    } catch {
      $("discord-status").textContent = "확인 불가";
      $("status-orb").dataset.status = "unknown";
    } finally { presenceBusy = false; }
  }
  let visitsBusy = false;
  let lastVisits = 0;
  async function updateVisits() {
    if (visitsBusy) return;
    visitsBusy = true;
    const results = await Promise.allSettled([fetchJSON(counterUrl(seoulDate())), fetchJSON(counterUrl())]);
    results.forEach((result, i) => {
      const element = $(i ? "total-visits" : "today-visits");
      const count = result.status === "fulfilled" ? result.value.count : null;
      const valid = typeof count === "number" ? Number.isFinite(count) && count >= 0 : typeof count === "string" && /^\d[\d,.\s]*$/.test(count);
      if (valid) rollingText(element, String(count));
      else { element.textContent = "—"; delete element.dataset.value; }
      element.title = valid ? "" : "방문자 데이터를 불러올 수 없음";
    });
    lastVisits = Date.now();
    visitsBusy = false;
  }
  function refresh() {
    if (document.hidden) return;
    renderClock();
    if (Date.now() - lastPresence >= 25000) updatePresence();
    if (Date.now() - lastVisits >= 55000) updateVisits();
  }
  addEventListener("portfolio-scenechange", event => { if (event.detail.info) refresh(); });
  document.addEventListener("visibilitychange", refresh);
  addEventListener("online", refresh);
  setInterval(() => { if (showingInfo) refresh(); }, 30000);
  updatePresence();
  updateVisits();

  let noticeTimer = 0;
  $("copy-discord").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PROFILE.discordName);
      $("copy-notice").textContent = "Discord ID 복사됨";
    } catch {
      const range = document.createRange();
      range.selectNodeContents($("discord-id"));
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      $("copy-notice").textContent = "kim_week · 선택한 ID를 복사해 줘";
    }
    $("copy-notice").classList.add("is-visible");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => $("copy-notice").classList.remove("is-visible"), 2400);
  });
  if (PROFILE.email) {
    $("contact-email").href = `mailto:${PROFILE.email}`;
    $("contact-email").hidden = false;
  }
}

if (typeof document !== "undefined") startInfo();
