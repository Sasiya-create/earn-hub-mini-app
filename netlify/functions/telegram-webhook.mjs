
const jsonHeaders = {
  "Content-Type": "application/json"
};

async function telegramRequest(method, botToken, payload) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/${method}`,
    {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error(`Telegram ${method} failed`);
  }

  return result;
}

function mainMenu(webAppUrl) {
  return {
    inline_keyboard: [
      [
        {
          text: "🚀 Open Earn Hub",
          web_app: { url: webAppUrl }
        }
      ]
    ]
  };
}

function adminMenu() {
  return {
    inline_keyboard: [
      [
        { text: "📊 Dashboard", callback_data: "admin_dashboard" },
        { text: "👥 Users", callback_data: "admin_users" }
      ],
      [
        { text: "📋 Tasks", callback_data: "admin_tasks" },
        { text: "💸 Withdrawals", callback_data: "admin_withdrawals" }
      ],
      [
        { text: "📈 Statistics", callback_data: "admin_stats" }
      ]
    ]
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed"
      })
    };
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  const receivedSecret =
    event.headers?.["x-telegram-bot-api-secret-token"];

  if (secret && receivedSecret !== secret) {
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({
        ok: false,
        error: "Unauthorized"
      })
    };
  }

  try {
    const update = JSON.parse(event.body || "{}");
    const botToken = process.env.BOT_TOKEN;
    const webAppUrl = process.env.WEBAPP_URL;
    const adminId = String(process.env.ADMIN_ID || "").trim();

    if (!botToken) {
      console.error("BOT_TOKEN is not configured");
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true })
      };
    }

    // Handle normal messages and commands
    const message = update.message;

    if (message?.chat?.id && message?.from?.id) {
      const chatId = message.chat.id;
      const senderId = String(message.from.id);
      const command = (message.text || "")
        .trim()
        .split(/\s+/)[0]
        .split("@")[0]
        .toLowerCase();

      if (command === "/start") {
        if (!webAppUrl) {
          console.error("WEBAPP_URL is not configured");
        } else {
          await telegramRequest("sendMessage", botToken, {
            chat_id: chatId,
            text:
              "Welcome to Earn Hub! 🎉\n" +
              "Open the Mini App to get started.",
            reply_markup: mainMenu(webAppUrl)
          });
        }
      }

      if (command === "/admin") {
        if (!adminId || senderId !== adminId) {
          await telegramRequest("sendMessage", botToken, {
            chat_id: chatId,
            text: "⛔ You are not authorized to use the Admin Menu."
          });
        } else {
          await telegramRequest("sendMessage", botToken, {
            chat_id: chatId,
            text: "🛡️ Earn Hub Admin Panel\n\nSelect an option:",
            reply_markup: adminMenu()
          });
        }
      }
    }

    // Handle Admin Menu button presses
    const callback = update.callback_query;

    if (callback?.id && callback?.from?.id) {
      const senderId = String(callback.from.id);
      const data = callback.data || "";

      if (data.startsWith("admin_")) {
        if (!adminId || senderId !== adminId) {
          await telegramRequest("answerCallbackQuery", botToken, {
            callback_query_id: callback.id,
            text: "⛔ Not authorized",
            show_alert: true
          });
        } else {
          await telegramRequest("answerCallbackQuery", botToken, {
            callback_query_id: callback.id
          });

          const chatId = callback.message?.chat?.id;

          const messages = {
            admin_dashboard:
              "📊 Dashboard\n\nFull database statistics will be connected next.",
            admin_users:
              "👥 Users\n\nUser listing and search will be connected next.",
            admin_tasks:
              "📋 Tasks\n\nTask management will be connected next.",
            admin_withdrawals:
              "💸 Withdrawals\n\nWithdrawal review will be connected next.",
            admin_stats:
              "📈 Statistics\n\nLive statistics will be connected next."
          };

          if (chatId && messages[data]) {
            await telegramRequest("sendMessage", botToken, {
              chat_id: chatId,
              text: messages[data],
              reply_markup: adminMenu()
            });
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true })
    };
  } catch (error) {
    console.error("Webhook processing failed:", error.message);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true })
    };
  }
}
