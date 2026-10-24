"use strict";

const tg = window.Telegram?.WebApp;

let verifiedTelegramUser = null;
let telegramVerificationStatus = "not_started";
let walletBalance = null;

function byId(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function setVerificationMessage(message, state = "") {
  const element = byId("verificationStatus");
  if (!element) return;

  element.textContent = message;
  element.dataset.state = state;
}

function formatUSD(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "$0.00";

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showWalletBalance(value) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    walletBalance = null;
    setText("balance", "$0.00");
    setText("withdrawBalance", "Balance unavailable.");
    setText("balanceLabel", "Unavailable");
    return;
  }

  walletBalance = amount;
  setText("balance", formatUSD(amount));
  setText("withdrawBalance", `Available balance: ${formatUSD(amount)}`);
  setText("balanceLabel", "Live balance");
}

async function loadWalletBalance() {
  if (!verifiedTelegramUser || !tg?.initData) return;

  setText("balanceLabel", "Loading...");

  try {
    const response = await fetch("/.netlify/functions/wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        initData: tg.initData
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "WALLET_LOAD_FAILED");
    }

    showWalletBalance(result.balance);
  } catch (error) {
    console.error("Wallet balance error:", error);
    walletBalance = null;
    setText("balance", "—");
    setText("balanceLabel", "Unavailable");
    setText("withdrawBalance", "Could not load balance. Please retry.");
  }
}

async function verifyTelegramUser() {
  if (!tg) {
    telegramVerificationStatus = "failed";
    setVerificationMessage(
      "Please open TaskFlow inside Telegram.",
      "error"
    );
    setText("balanceLabel", "Telegram required");
    return;
  }

  tg.ready();
  tg.expand();

  if (!tg.initData) {
    telegramVerificationStatus = "failed";
    setVerificationMessage(
      "Telegram verification data is unavailable. Reopen the Mini App from Telegram.",
      "error"
    );
    setText("balanceLabel", "Not connected");
    return;
  }

  telegramVerificationStatus = "checking";
  setVerificationMessage("Verifying Telegram account...", "loading");

  try {
    const response = await fetch("/.netlify/functions/telegram", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        initData: tg.initData
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok || !result.user) {
      throw new Error(result.error || "TELEGRAM_VERIFICATION_FAILED");
    }

    verifiedTelegramUser = result.user;
    telegramVerificationStatus = "verified";

    const displayName =
      [result.user.first_name, result.user.last_name]
        .filter(Boolean)
        .join(" ") ||
      (result.user.username ? `@${result.user.username}` : "Telegram user");

    setVerificationMessage("Telegram account verified.", "success");
    setText("welcomeMessage", `Welcome, ${displayName}!`);
    setText(
      "profileUsername",
      result.user.username ? `@${result.user.username}` : displayName
    );
    setText("profileTelegramId", String(result.user.id));

    await loadWalletBalance();
  } catch (error) {
    console.error("Telegram verification error:", error);
    verifiedTelegramUser = null;
    telegramVerificationStatus = "failed";

    setVerificationMessage(
      "Telegram verification failed. Reopen the app and try again.",
      "error"
    );
    setText("balance", "—");
    setText("balanceLabel", "Unavailable");
  }
}

function showPage(page, button) {
  const allowedPages = [
    "home",
    "referral",
    "tasks",
    "addtask",
    "ads",
    "profile"
  ];

  if (!allowedPages.includes(page)) return;

  document.querySelectorAll("main .page").forEach((section) => {
    section.classList.toggle("hidden", section.id !== page);
  });

  document.querySelectorAll(".bottom button").forEach((navButton) => {
    navButton.classList.remove("active");
    navButton.removeAttribute("aria-current");
  });

  if (button) {
    button.classList.add("active");
    button.setAttribute("aria-current", "page");
  } else {
    const navButton = [...document.querySelectorAll(".bottom button")]
      .find((item) => {
        const handler = item.getAttribute("onclick") || "";
        return handler.includes(`'${page}'`);
      });

    if (navButton) {
      navButton.classList.add("active");
      navButton.setAttribute("aria-current", "page");
    }
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveWalletDetails(event) {
  if (event) event.preventDefault();

  const message = byId("walletSettingsMessage");
  const addressInput = byId("usdtAddress");
  const payIdInput = byId("binancePayId");
  const saveButton = byId("saveWalletButton");

  if (!message || !addressInput || !payIdInput) return;

  if (!verifiedTelegramUser || !tg?.initData) {
    message.textContent = "Verify your Telegram account first.";
    return;
  }

  const usdt_address = addressInput.value.trim();
  const binance_pay_id = payIdInput.value.trim();

  if (!usdt_address && !binance_pay_id) {
    message.textContent = "Enter at least one wallet detail.";
    return;
  }

  if (usdt_address && !/^0x[a-fA-F0-9]{40}$/.test(usdt_address)) {
    message.textContent =
      "The BEP20 address format is invalid. Check the address and try again.";
    return;
  }

  if (usdt_address.length > 100 || binance_pay_id.length > 100) {
    message.textContent = "One of the fields is too long.";
    return;
  }

  message.textContent = "Saving wallet details...";

  if (saveButton) saveButton.disabled = true;

  try {
    const response = await fetch("/.netlify/functions/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store",
      body: JSON.stringify({
        initData: tg.initData,
        usdt_address,
        binance_pay_id
      })
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      if (result.error === "USER_NOT_REGISTERED") {
        message.textContent =
          "Your TaskFlow profile is not registered yet. Registration must be connected first.";
      } else if (
        result.error === "INVALID_TELEGRAM_HASH" ||
        result.error === "TELEGRAM_AUTH_EXPIRED"
      ) {
        message.textContent =
          "Your Telegram session has expired. Reopen TaskFlow and try again.";
      } else {
        message.textContent =
          `Could not save details: ${result.error || "Unknown error"}`;
      }
      return;
    }

    message.textContent = "Wallet details saved successfully.";
  } catch (error) {
    console.error("Save wallet details error:", error);
    message.textContent = "Network error. Please try again.";
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

async function copyReferralLink() {
  const message = byId("referralStatus");

  if (!verifiedTelegramUser || !verifiedTelegramUser.id) {
    if (message) message.textContent = "Verify your Telegram account first.";
    return;
  }

  // A valid referral URL requires the actual Telegram bot username
  // and a server-side referral registration flow.
  if (message) {
    message.textContent =
      "Referral links are not enabled yet. The bot username and referral backend must be configured first.";
  }
}

function handleAddTaskSubmit(event) {
  event.preventDefault();

  const message = byId("addTaskMessage");
  if (!message) return;

  if (!verifiedTelegramUser || !tg?.initData) {
    message.textContent = "Verify your Telegram account first.";
    return;
  }

  message.textContent =
    "Task submission API is not connected yet. No task request has been submitted.";
}

function initializeTaskFlow() {
  const walletForm = byId("walletForm");
  if (walletForm) {
    walletForm.addEventListener("submit", saveWalletDetails);
  }

  const taskForm = byId("addTaskForm");
  if (taskForm) {
    taskForm.addEventListener("submit", handleAddTaskSubmit);
  }

  if (tg) {
    tg.ready();
    tg.expand();
  }

  verifyTelegramUser();
}

document.addEventListener("DOMContentLoaded", initializeTaskFlow);
