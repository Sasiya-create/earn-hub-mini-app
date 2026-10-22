
import pg from "pg";
import crypto from "node:crypto";

const { Pool } = pg;
let pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000
    });
  }

  return pool;
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDate = Number(params.get("auth_date"));

  if (!receivedHash || !Number.isFinite(authDate)) return null;

  // Reject stale authentication data older than one hour.
  const now = Math.floor(Date.now() / 1000);
  if (authDate > now + 30 || now - authDate > 3600) return null;

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(calculatedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const user = JSON.parse(params.get("user") || "null");
    if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, error: "Use POST" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const user = verifyTelegramInitData(
    body.initData,
    process.env.BOT_TOKEN
  );

  if (!user) {
    return json(401, {
      ok: false,
      error: "Telegram authentication failed. Open this app through Telegram."
    });
  }

  try {
    const db = getPool();

    await db.query(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (telegram_id)
       DO UPDATE SET username = EXCLUDED.username,
                     first_name = EXCLUDED.first_name`,
      [
        String(user.id),
        user.username || null,
        user.first_name || null
      ]
    );

    const result = await db.query(
      `SELECT balance_usd
       FROM users
       WHERE telegram_id = $1`,
      [String(user.id)]
    );

    return json(200, {
      ok: true,
      user: {
        id: user.id,
        first_name: user.first_name || "User",
        username: user.username || null
      },
      balance: Number(result.rows[0]?.balance_usd || 0)
    });
  } catch (error) {
    console.error("API/database error:", error.message);
    return json(500, {
      ok: false,
      error: "Service temporarily unavailable"
    });
  }
}
