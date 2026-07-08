const onboardingSteps = [
  "lead",
  "questionnaire_sent",
  "documents_received",
  "file_opened",
  "active",
];

const lookupForm = document.querySelector("#lookup-form");
const clientPicker = document.querySelector("#client-picker");
const taxIdInput = document.querySelector("#tax-id");
const resultPanel = document.querySelector("#result-panel");
const template = document.querySelector("#client-template");

loadClientOptions();

clientPicker.addEventListener("change", () => {
  taxIdInput.value = clientPicker.value;
});

taxIdInput.addEventListener("input", () => {
  if (normalizeTaxId(taxIdInput.value) !== clientPicker.value) {
    clientPicker.value = "";
  }
});

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(lookupForm);
  const taxId = normalizeTaxId(formData.get("tax-id"));

  if (!taxId) {
    renderMessage("יש להזין ח.פ או מספר מזהה.", "לצורך הדמו יש להשתמש בספרות בלבד.", "warning");
    return;
  }

  await lookupClient(taxId);
});

async function loadClientOptions() {
  try {
    const response = await fetch("/api/portal-client-options");
    const payload = await parseJsonResponse(response);
    renderClientOptions(payload.clients || []);
  } catch {
    clientPicker.replaceChildren(new Option("בחירה מרשימה לא זמינה כרגע", ""));
  }
}

function renderClientOptions(clients) {
  const placeholder = new Option("בחרו לקוח לדמו או הזינו מספר ידנית", "");
  clientPicker.replaceChildren(placeholder);

  for (const client of clients) {
    if (!client.taxId) continue;

    const option = new Option(`${client.name} - ${client.taxId}`, client.taxId);
    option.dir = "rtl";
    clientPicker.append(option);
  }
}

async function lookupClient(taxId) {
  renderLoading("טוען את תיק הלקוח...");
  setLookupBusy(true);

  try {
    const response = await fetch(`/api/portal-client?taxId=${encodeURIComponent(taxId)}`);
    const payload = await parseJsonResponse(response);
    renderClient(payload.client);
  } catch (error) {
    renderMessage("לא ניתן לטעון את תיק הלקוח.", error.message, "danger");
  } finally {
    setLookupBusy(false);
  }
}

function renderClient(client) {
  const fragment = template.content.cloneNode(true);
  const currentStep = canonicalOnboardingStatus(client.onboardingStatus);
  const currentStepIndex = onboardingSteps.indexOf(currentStep);
  const openTasks = client.tasks.filter((task) => !isDoneStatus(task.status));

  const clientName = fragment.querySelector("[data-client-name]");
  clientName.textContent = client.name;
  clientName.dir = "auto";
  fragment.querySelector("[data-client-meta]").textContent = [
    localizeValue(client.entityType),
    `מספר מזהה ${client.taxId}`,
  ]
    .filter(Boolean)
    .join(" | ");
  const accountantPanel = fragment.querySelector("[data-accountant-panel]");
  const accountantName = fragment.querySelector("[data-accountant-name]");
  accountantName.textContent = client.accountant || "טרם שובץ";
  accountantName.dir = "auto";
  if (!client.accountant) accountantPanel.classList.add("is-empty");
  fragment.querySelector("[data-status-pill]").textContent = clientFacingStatus(
    currentStep || client.onboardingStatus,
  );
  fragment.querySelector("[data-task-count]").textContent =
    formatOpenTaskCount(openTasks.length);

  const progressTrack = fragment.querySelector("[data-progress-track]");
  for (const [index, step] of onboardingSteps.entries()) {
    const item = document.createElement("li");
    item.textContent = clientFacingStatus(step);

    if (index < currentStepIndex) item.className = "is-complete";
    if (index === currentStepIndex) item.className = "is-current";

    progressTrack.append(item);
  }

  const taskList = fragment.querySelector("[data-task-list]");
  if (openTasks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "אין כרגע בקשות פתוחות מהלקוח.";
    taskList.append(empty);
  } else {
    for (const task of openTasks) {
      taskList.append(createTaskCard(task));
    }
  }

  const responseForm = fragment.querySelector("[data-response-form]");
  const responseMessage = fragment.querySelector("[data-response-message]");
  responseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(responseForm);
    const submitButton = responseForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    responseMessage.textContent = "העדכון נשלח...";
    responseMessage.className = "response-message";

    try {
      const payload = {
        taxId: client.taxId,
        responseType: formData.get("response-type"),
        details: String(formData.get("response-details") || "").trim(),
      };
      const response = await fetch("/api/portal-response", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await parseJsonResponse(response);
      responseMessage.textContent = `העדכון נשלח בתאריך ${formatDate(result.submittedDate)}.`;
      responseForm.reset();
    } catch (error) {
      responseMessage.textContent = error.message;
      responseMessage.className = "response-message is-error";
    } finally {
      submitButton.disabled = false;
    }
  });

  resultPanel.replaceChildren(fragment);
}

function createTaskCard(task) {
  const article = document.createElement("article");
  article.className = "task-card";

  const body = document.createElement("div");
  const title = document.createElement("h4");
  const meta = document.createElement("p");
  const badge = document.createElement("span");

  title.textContent = task.title;
  title.dir = "auto";
  meta.textContent = [
    localizeValue(task.serviceType),
    task.reportingPeriod,
    task.dueDate ? `לתאריך ${formatDate(task.dueDate)}` : "",
    task.clientRequest ? `בקשה: ${task.clientRequest}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  badge.className = "task-badge";
  badge.textContent = localizeValue(task.status);

  body.append(title, meta);
  article.append(body, badge);

  return article;
}

function renderLoading(message) {
  const container = document.createElement("div");
  container.className = "empty-state";

  const title = document.createElement("h2");
  title.textContent = message;

  const details = document.createElement("p");
  details.textContent = "מביאים את התצוגה העדכנית והבטוחה ללקוח.";

  container.append(title, details);
  resultPanel.replaceChildren(container);
}

function renderMessage(titleText, bodyText, tone = "neutral") {
  const message = document.createElement("div");
  message.className = `not-found tone-${tone}`;

  const title = document.createElement("h2");
  title.textContent = titleText;

  const details = document.createElement("p");
  details.className = "muted";
  details.textContent = bodyText;

  message.append(title, details);
  resultPanel.replaceChildren(message);
}

function setLookupBusy(isBusy) {
  const button = lookupForm.querySelector("button[type='submit']");
  button.disabled = isBusy;
}

async function parseJsonResponse(response) {
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("השרת החזיר תשובה שלא ניתן לקרוא.");
  }

  if (!response.ok) {
    throw new Error(payload.error || "הבקשה נכשלה.");
  }

  return payload;
}

function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "");
}

function clientFacingStatus(status) {
  const labels = {
    lead: "בקשה חדשה התקבלה",
    Lead: "בקשה חדשה התקבלה",
    ליד: "בקשה חדשה התקבלה",
    questionnaire_sent: "שאלון נשלח",
    "Questionnaire Sent": "שאלון נשלח",
    "שאלון נשלח": "שאלון נשלח",
    documents_received: "מסמכים התקבלו",
    "Documents Received": "מסמכים התקבלו",
    "מסמכים התקבלו": "מסמכים התקבלו",
    file_opened: "תיק נפתח",
    "File Opened": "תיק נפתח",
    "תיק נפתח": "תיק נפתח",
    active: "שירות פעיל",
    Active: "שירות פעיל",
    פעיל: "שירות פעיל",
  };

  return labels[status] || localizeValue(status) || "סטטוס לא זמין";
}

function canonicalOnboardingStatus(status) {
  const statuses = {
    Lead: "lead",
    ליד: "lead",
    lead: "lead",
    "Questionnaire Sent": "questionnaire_sent",
    "שאלון נשלח": "questionnaire_sent",
    questionnaire_sent: "questionnaire_sent",
    "Documents Received": "documents_received",
    "מסמכים התקבלו": "documents_received",
    documents_received: "documents_received",
    "File Opened": "file_opened",
    "תיק נפתח": "file_opened",
    file_opened: "file_opened",
    Active: "active",
    פעיל: "active",
    active: "active",
  };

  return statuses[status] || "";
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatOpenTaskCount(count) {
  if (count === 0) return "אין פריטים פתוחים";
  if (count === 1) return "פריט פתוח אחד";
  return `${count} פריטים פתוחים`;
}

function isDoneStatus(status) {
  return ["Done", "בוצע", "Done.", "הושלם", "Complete", "Completed"].includes(status);
}

function localizeValue(value) {
  const labels = {
    Individual: "יחיד / עצמאי",
    "יחיד / עצמאי": "יחיד / עצמאי",
    Company: "חברה בע״מ",
    "חברה בע״מ": "חברה בע״מ",
    Partnership: "שותפות",
    שותפות: "שותפות",
    Nonprofit: "עמותה",
    עמותה: "עמותה",
    Other: "אחר",
    אחר: "אחר",
    Bookkeeping: "הנהלת חשבונות",
    "הנהלת חשבונות": "הנהלת חשבונות",
    Payroll: "שכר",
    שכר: "שכר",
    "Monthly Reporting": "דיווח חודשי",
    "דיווח חודשי": "דיווח חודשי",
    "VAT Reporting": "דיווח מע״מ",
    "דיווח מע״מ": "דיווח מע״מ",
    Deductions: "ניכויים",
    ניכויים: "ניכויים",
    "Annual Report": "דוח שנתי",
    "דוח שנתי": "דוח שנתי",
    "Not Started": "טרם התחיל",
    "טרם התחיל": "טרם התחיל",
    "In Progress": "בתהליך",
    בתהליך: "בתהליך",
    "Waiting for Client": "ממתין ללקוח",
    "ממתין ללקוח": "ממתין ללקוח",
    "Working on it": "בטיפול",
    Stuck: "תקוע",
    Complete: "בוצע",
    Completed: "בוצע",
    Done: "בוצע",
    בוצע: "בוצע",
    "Documents Sent": "מסמכים נשלחו",
    "מסמכים נשלחו": "מסמכים נשלחו",
    "Response Received": "תגובה התקבלה",
    "תגובה התקבלה": "תגובה התקבלה",
    "Needs Review": "דורש בדיקה",
    "דורש בדיקה": "דורש בדיקה",
    None: "אין תגובה",
    "אין תגובה": "אין תגובה",
  };

  return labels[value] || value || "";
}
