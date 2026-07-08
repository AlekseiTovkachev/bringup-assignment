import { listPortalClientOptions } from "../lib/portal-service.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "שיטת הבקשה אינה נתמכת." });
  }

  try {
    const clients = await listPortalClientOptions();
    return res.status(200).json({ clients });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "לא ניתן לטעון את רשימת הלקוחות לדמו." });
  }
}
