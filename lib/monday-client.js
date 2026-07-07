const MONDAY_ENDPOINT = "https://api.monday.com/v2";

export async function mondayGraphQL(query, variables = {}) {
  const token = requiredEnv("MONDAY_API_TOKEN");
  const headers = {
    "content-type": "application/json",
    authorization: token,
  };

  if (process.env.MONDAY_API_VERSION) {
    headers["api-version"] = process.env.MONDAY_API_VERSION;
  }

  const response = await fetch(MONDAY_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error_message || `monday API returned ${response.status}`);
  }

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return payload.data;
}

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function env(name, fallback = "") {
  return process.env[name] || fallback;
}
