const ALLOWED_RESPONSE_TYPES = new Set([
  "Documents Sent",
  "Response Received",
  "Needs Review",
]);

export function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateTaxId(value) {
  const taxId = normalizeTaxId(value);
  if (taxId.length < 5 || taxId.length > 20) {
    throw new PublicError("Enter a valid legal or tax ID.", 400);
  }
  return taxId;
}

export function validatePortalResponse(body = {}) {
  const taxId = validateTaxId(body.taxId);
  const responseType = String(body.responseType || "").trim();
  const details = String(body.details || "").trim();

  if (!ALLOWED_RESPONSE_TYPES.has(responseType)) {
    throw new PublicError("Choose a valid update type.", 400);
  }

  if (details.length > 1200) {
    throw new PublicError("Keep the update under 1200 characters.", 400);
  }

  return { taxId, responseType, details };
}

export class PublicError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
