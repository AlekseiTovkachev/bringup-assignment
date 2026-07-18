import { buildWeeklyReport } from "../lib/weekly-report-service.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "שיטת הבקשה אינה נתמכת." });
  }

  const configuredSecret = process.env.MAKE_WEEKLY_REPORT_API_SECRET || "";
  const providedSecret = req.headers["x-weekly-report-secret"] || req.query.secret || "";
  if (configuredSecret && providedSecret !== configuredSecret) {
    return res.status(401).json({ error: "אין הרשאה להפקת הדוח." });
  }

  try {
    const report = await buildWeeklyReport();
    if (req.query.format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Weekly-Report-Subject", encodeURIComponent(report.subject));
      return res.status(200).send(report.html);
    }

    return res.status(200).json(report);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "לא ניתן להפיק את הדוח השבועי." });
  }
}
