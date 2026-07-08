const ALLOWED_RESPONSE_TYPES = new Set([
  "Documents Sent",
  "Response Received",
  "Needs Review",
  "מסמכים נשלחו",
  "תגובה התקבלה",
  "דורש בדיקה",
]);

export function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateTaxId(value) {
  const taxId = normalizeTaxId(value);
  if (taxId.length < 5 || taxId.length > 20) {
    throw new PublicError("יש להזין ח.פ או מספר מזהה תקין.", 400);
  }
  return taxId;
}

export function validatePortalResponse(body = {}) {
  const taxId = validateTaxId(body.taxId);
  const responseType = String(body.responseType || "").trim();
  const details = String(body.details || "").trim();

  if (!ALLOWED_RESPONSE_TYPES.has(responseType)) {
    throw new PublicError("יש לבחור סוג עדכון תקין.", 400);
  }

  if (details.length > 1200) {
    throw new PublicError("יש להגביל את העדכון ל-1200 תווים.", 400);
  }

  return { taxId, responseType, details };
}

export class PublicError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
