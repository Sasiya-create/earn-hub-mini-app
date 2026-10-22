
const tg = window.Telegram?.WebApp;

const $ = (selector) => document.querySelector(selector);

const pageDetails = {
  home: {
    title: "Explore Earn Hub",
    description: "Your earning journey starts here.",
    content: "✨ Choose a feature above to get started."
  },
  tasks: {
    title: "Daily Tasks",
    description: "Join our channels to get started.",
    content: `
      <div class="task-item">
        <strong>📢 Join Channel 1</strong>
        <p>@mini_earing_bot</p>
        <a class="action-link" href="https://t.me/mini_earing_bot"
           target="_blank" rel="noopener noreferrer">Open Channel ↗</a>
      </div>
      <div class="task-item">
        <strong>📢 Join Channel 2</strong>
        <p>@earn_mini_pay</p>
        <a class="action-link" href="https://t.me/earn_mini_pay"
           target="_blank" rel="noopener noreferrer">Open Channel ↗</a>
      </div>
      <p class="notice">Task rewards will be enabled after server verification.</p>
    `
  },
  ads: {
    title: "Watch Ads",
    description: "Advertising rewards",
    content: "<p>Monetag Ads will be configured here later.</p>"
  },
  daily: {
    title: "Daily Reward",
    description: "Come back every day",
    content: "<p>Daily rewards will be available after the reward API is implemented.</p>"
  },
  spin: {
    title: "Spin Wheel",
    description: "Your daily spin",
    content: "<p>The daily spin will be connected to the secure backend.</p>"
  },
  referrals: {
    title: "Refer & Earn",
    description: "Invite friends to Earn Hub",
    content: "<p>Your personal referral link will appear after the referral backend is ready.</p>"
  },
  leaderboard: {
    title: "Leaderboard",
    description: "Top earners",
    content: "<p>The leaderboard will load verified results from the database.</p>"
  },
  withdraw: {
    title: "Withdraw",
    description: "Request a payout",
    content: "<p>Withdrawals will be enabled after secure balance checks and admin approval are implemented.</p>"
  },
  profile: {
    title: "Your Profile",
    description: "Telegram account",
    content: "<p>Loading profile...</p>"
  }
};

function showPage(page) {
  const details = pageDetails[page] || pageDetails.home;

  $("#pageTitle").textContent = details.title;
  $("#pageDescription").textContent = details.description;
  $("#pageContent").innerHTML = details.content;

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  tg?.HapticFeedback?.selectionChanged();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;

  event.preventDefault();
  showPage(button.dataset.page);
});

$("#profileButton")?.addEventListener("click", () => showPage("profile"));

async function initializeApp() {
  if (!tg) {
    $("#userName").textContent = "Guest";
    $("#pageDescription").textContent =
      "Open this Mini App through Telegram to sign in.";
    return;
  }

  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#0b1020");
  tg.setBackgroundColor?.("#0b1020");

  const initData = tg.initData;

  if (!initData) {
    $("#userName").textContent = "Guest";
    $("#pageDescription").textContent =
      "Please open Earn Hub using the Telegram bot.";
    return;
  }

  try {
    const response = await fetch("/.netlify/functions/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Authentication failed");
    }

    $("#userName").textContent = result.user.first_name || "User";
    $("#balance").textContent =
      "$" + Number(result.balance).toFixed(4);

    $("#pageDescription").textContent = "Your account is connected.";
  } catch (error) {
    console.error("Initialization failed:", error);
    $("#pageDescription").textContent =
      "Unable to connect right now. Please try again later.";
  }
}

showPage("home");
initializeApp();
