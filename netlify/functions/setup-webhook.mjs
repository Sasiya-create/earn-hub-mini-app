
export default async (request) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Use POST" }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  const setupKey = process.env.WEBHOOK_SETUP_KEY;
  const botToken = process.env.BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!setupKey || !botToken) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing environment variables"
      }),
      { status: 500 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON" }),
      { status: 400 }
    );
  }

  if (body.key !== setupKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401 }
    );
  }

  const webhookUrl =
    "https://earn-hub-mini-app.netlify.app/.netlify/functions/telegram-webhook";

  const payload = {
    url: webhookUrl,
    ...(webhookSecret ? { secret_token: webhookSecret } : {})
  };

  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }
  );

  const result = await response.json();

  return new Response(JSON.stringify(result), {
    status: response.ok ? 200 : 502,
    headers: { "Content-Type": "application/json" }
  });
};
