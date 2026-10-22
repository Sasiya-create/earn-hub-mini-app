
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

  const now = Math.floor(Date.now() / 1000);

  if (authDate > now + 30 || now - authDate > 3600) {
    return null;
  }

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

async function isTelegramChannelMember(channel, userId) {
  const token = process.env.BOT_TOKEN;

  if (!token) {
    throw new Error("BOT_TOKEN is not configured");
  }

  const url =
    `https://api.telegram.org/bot${token}/getChatMember` +
    `?chat_id=${encodeURIComponent(channel)}` +
    `&user_id=${encodeURIComponent(userId)}`;

  const response = await fetch(url);
  const result = await response.json();

  if (!response.ok || !result.ok) {
    console.error("Telegram membership check failed:", result.description);
    throw new Error("Unable to verify channel membership");
  }

  const member = result.result;

  return (
    member.status === "creator" ||
    member.status === "administrator" ||
    member.status === "member" ||
    (member.status === "restricted" && member.is_member === true)
  );
}

async function listTasks(db, telegramId) {
  const result = await db.query(
    `SELECT
       t.id::text AS id,
       t.title,
       t.channel_username,
       t.reward_usd::text AS reward_usd,
       EXISTS (
         SELECT 1
         FROM task_completions tc
         WHERE tc.telegram_id = $1
           AND tc.task_id = t.id
           AND tc.status = 'completed'
       ) AS completed
     FROM tasks t
     WHERE t.active = TRUE
     ORDER BY t.id`,
    [String(telegramId)]
  );

  return result.rows;
}

async function completeTask(db, telegramId, taskId) {
  if (
    typeof taskId !== "string" &&
    typeof taskId !== "number"
  ) {
    return json(400, { ok: false, error: "Invalid task ID" });
  }

  const safeTaskId = String(taskId);

  if (!/^[1-9]\d*$/.test(safeTaskId)) {
    return json(400, { ok: false, error: "Invalid task ID" });
  }

  const taskResult = await db.query(
    `SELECT id, title, channel_username, reward_usd
     FROM tasks
     WHERE id = $1 AND active = TRUE`,
    [safeTaskId]
  );

  if (taskResult.rowCount === 0) {
    return json(404, { ok: false, error: "Task not found" });
  }

  const task = taskResult.rows[0];

  if (!task.channel_username) {
    return json(400, {
      ok: false,
      error: "This task has no channel configured"
    });
  }

  const alreadyDone = await db.query(
    `SELECT 1
     FROM task_completions
     WHERE telegram_id = $1
       AND task_id = $2
       AND status = 'completed'`,
    [String(telegramId), safeTaskId]
  );

  if (alreadyDone.rowCount > 0) {
    return json(409, {
      ok: false,
      error: "Task already completed"
    });
  }

  const isMember = await isTelegramChannelMember(
    task.channel_username,
    telegramId
  );

  if (!isMember) {
    return json(403, {
      ok: false,
      error: "Please join the channel before claiming this reward"
    });
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Insert the completion first. The existing composite
    // primary key prevents duplicate rewards for the same task.
    const inserted = await client.query(
      `INSERT INTO task_completions
         (telegram_id, task_id, completed_at, status, reward_usd)
       VALUES ($1, $2, NOW(), 'completed', $3)
       ON CONFLICT (telegram_id, task_id) DO NOTHING
       RETURNING task_id`,
      [String(telegramId), safeTaskId, task.reward_usd]
    );

    if (inserted.rowCount === 0) {
      await client.query("ROLLBACK");

      return json(409, {
        ok: false,
        error: "Task already claimed"
      });
    }

    const updated = await client.query(
      `UPDATE users
       SET balance_usd = balance_usd + $1,
           updated_at = NOW()
       WHERE telegram_id = $2
       RETURNING balance_usd`,
      [task.reward_usd, String(telegramId)]
    );

    if (updated.rowCount === 0) {
      throw new Error("User account not found");
    }

    await client.query(
      `INSERT INTO balance_transactions
         (telegram_id, amount_usd, transaction_type,
          reference_id, description)
       VALUES ($1, $2, 'task_reward', $3, $4)`,
      [
        String(telegramId),
        task.reward_usd,
        safeTaskId,
        `Completed task: ${task.title}`
      ]
    );

    await client.query("COMMIT");

    return json(200, {
      ok: true,
      message: "Task completed and reward credited",
      task_id: safeTaskId,
      reward: Number(task.reward_usd),
      balance: Number(updated.rows[0].balance_usd)
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
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
       DO UPDATE SET
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name`,
      [
        String(user.id),
        user.username || null,
        user.first_name || null
      ]
    );

    if (body.action === "list_tasks") {
      const tasks = await listTasks(db, user.id);

      return json(200, {
        ok: true,
        tasks
      });
    }

    if (body.action === "complete_task") {
      return await completeTask(db, user.id, body.taskId);
    }

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

    if (error.message === "Unable to verify channel membership") {
      return json(502, {
        ok: false,
        error: "Telegram could not verify membership. Check the channel username and bot permissions."
      });
    }

    return json(500, {
      ok: false,
      error: "Service temporarily unavailable"
    });
  }
}
