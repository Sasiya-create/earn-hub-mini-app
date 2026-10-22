
import pg from "pg";

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

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function response(statusCode, data) {
  return {
    statusCode,
    headers: jsonHeaders,
    body: JSON.stringify(data)
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        ...jsonHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "GET") {
    return response(405, {
      ok: false,
      error: "Method not allowed"
    });
  }

  const path = event.path.replace(/^.*\/api\/?/, "") || "health";

  try {
    if (path === "health") {
      const db = getPool();
      await db.query("SELECT 1");

      return response(200, {
        ok: true,
        service: "Earn Hub API",
        database: "connected"
      });
    }

    return response(404, {
      ok: false,
      error: "Endpoint not found"
    });
  } catch (error) {
    console.error("API error:", error.message);

    return response(500, {
      ok: false,
      error: "Service temporarily unavailable"
    });
  }
}
