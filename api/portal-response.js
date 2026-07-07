import { recordPortalResponse } from "../lib/portal-service.js";
import { PublicError, validatePortalResponse } from "../lib/validation.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const input = validatePortalResponse(req.body);
    const payload = await recordPortalResponse(input);
    return res.status(200).json(payload);
  } catch (error) {
    return handleError(res, error);
  }
}

function handleError(res, error) {
  if (error instanceof PublicError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  console.error(error);
  return res.status(500).json({ error: "The client update could not be saved." });
}
