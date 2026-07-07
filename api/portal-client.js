import { getPortalClientByTaxId } from "../lib/portal-service.js";
import { PublicError, validateTaxId } from "../lib/validation.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const taxId = validateTaxId(req.query.taxId);
    const payload = await getPortalClientByTaxId(taxId);
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
  return res.status(500).json({ error: "The client portal could not reach monday.com." });
}
