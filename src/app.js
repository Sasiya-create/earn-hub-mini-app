
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.("#0b1020");
  tg.setBackgroundColor?.("#0b1020");
}

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
      <p class="notice">Task rewards become available after server-side verification is connected.</p>
    `
  },
  ads: {
    title: "Watch Ads",
    description: "Advertising rewards",
    content: `
      <div class="empty-icon">📺</div>
      <p>Monetag ads will be configured here later.</p>
      <p class="notice">Ad rewards are not enabled yet.</p>
    `
  },
  daily: {
    title: "Daily Reward",
    description: "Come back every day",
    content: `
      <div class="empty-icon">🎁</div>
      <p>Daily rewards will be enabled after the secure API is connected.</p>
    `
  },
  spin: {
    title: "Spin Wheel",
    description: "Your daily spin",
    content: `
      <div class="empty-icon">🎡</div>
      <p>The spin feature will be connected to the database next.</p>
    `
  },
  referrals: {
    title: "Refer & Earn",
    description: "Invite friends to Earn Hub",
    content: `
      <div class="empty-icon">👥</div>
      <p>Your personal referral link will appear here after the bot backend is connected.</p>
    `
  },
  leaderboard: {
    title: "Leaderboard",
    description: "Top earners",
    content: `
      <div class="empty-icon">🏆</div>
      <p>The leaderboard will load verified balances from the database.</p>
    `
  },
  withdraw: {
    title: "Withdraw",
    description: "Request a payout",
    content: `
      <div class="empty-icon">💳</div>
      <p>Withdrawals will be enabled after balance checks and admin approval are implemented.</p>
    `
  },
  profile: {
    title: "Your Profile",
    description: "Telegram account",
    content: `<p>Your account information will load after secure Telegram authentication is connected.</p>`
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

  if (tg?.HapticFeedback) {
    tg.HapticFeedback.selectionChanged();
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-page]");
  if (!button) return;

  event.preventDefault();
  showPage(button.dataset.page);
});

$("#profileButton")?.addEventListener("click", () => {
  showPage("profile");
});

const telegramUser = tg?.initDataUnsafe?.user;

if (telegramUser) {
  const firstName = telegramUser.first_name || "User";
  $("#userName").textContent = firstName;
} else {
  $("#userName").textContent = "Guest";
}

showPage("home");
