
const jsonHeaders = {
  "Content-Type": "application/json"
};

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (
    secret &&
    event.headers?.["x-telegram-bot-api-secret-token"] !== secret
  ) {
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: false, error: "Unauthorized" })
    };
  }

  try {
    const update = JSON.parse(event.body || "{}");
    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text || "";

    if (chatId && text.startsWith("/start")) {
      const botToken = process.env.BOT_TOKEN;
      const webAppUrl = process.env.WEBAPP_URL;

      if (!botToken || !webAppUrl) {
        console.error("BOT_TOKEN or WEBAPP_URL is not configured");
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ ok: true })
        };
      }

      const telegramResponse = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            chat_id: chatId,
            text: "Welcome to Earn Hub! 🎉\nOpen the Mini App to get started.",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🚀 Open Earn Hub",
                    web_app: { url: webAppUrl }
                  }
                ]
              ]
            }
          })
        }
      );

      if (!telegramResponse.ok) {
        console.error("Telegram sendMessage request failed");
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
