const onboardingSteps = [
  "Lead",
  "Questionnaire Sent",
  "Documents Received",
  "File Opened",
  "Active",
];

const lookupForm = document.querySelector("#lookup-form");
const resultPanel = document.querySelector("#result-panel");
const template = document.querySelector("#client-template");

lookupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(lookupForm);
  const taxId = normalizeTaxId(formData.get("tax-id"));

  if (!taxId) {
    renderMessage("Enter a legal or tax ID.", "Use digits only for the demo lookup.", "warning");
    return;
  }

  await lookupClient(taxId);
});

async function lookupClient(taxId) {
  renderLoading("Loading client file...");
  setLookupBusy(true);

  try {
    const response = await fetch(`/api/portal-client?taxId=${encodeURIComponent(taxId)}`);
    const payload = await parseJsonResponse(response);
    renderClient(payload.client);
  } catch (error) {
    renderMessage("Client file could not be loaded.", error.message, "danger");
  } finally {
    setLookupBusy(false);
  }
}

function renderClient(client) {
  const fragment = template.content.cloneNode(true);
  const currentStepIndex = onboardingSteps.indexOf(client.onboardingStatus);
  const openTasks = client.tasks.filter((task) => task.status !== "Done");

  fragment.querySelector("[data-client-name]").textContent = client.name;
  fragment.querySelector("[data-client-meta]").textContent = [
    client.entityType,
    `Tax ID ${client.taxId}`,
    client.accountant ? `Accountant ${client.accountant}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  fragment.querySelector("[data-status-pill]").textContent = clientFacingStatus(
    client.onboardingStatus,
  );
  fragment.querySelector("[data-task-count]").textContent =
    `${openTasks.length} open ${openTasks.length === 1 ? "item" : "items"}`;

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
    empty.textContent = "There are no open client requests at the moment.";
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
    responseMessage.textContent = "Sending update...";
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
      responseMessage.textContent = `Update sent on ${formatDate(result.submittedDate)}.`;
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
  meta.textContent = [
    task.serviceType,
    task.reportingPeriod,
    task.dueDate ? `Due ${formatDate(task.dueDate)}` : "",
    task.clientRequest ? `Request: ${task.clientRequest}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
  badge.className = "task-badge";
  badge.textContent = task.status;

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
  details.textContent = "Fetching the latest safe client view from monday.com.";

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
    throw new Error("The server returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(payload.error || "The request failed.");
  }

  return payload;
}

function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "");
}

function clientFacingStatus(status) {
  const labels = {
    Lead: "New request received",
    "Questionnaire Sent": "Questionnaire sent",
    "Documents Received": "Documents received",
    "File Opened": "File opened",
    Active: "Active service",
  };

  return labels[status] || status || "Status unavailable";
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}
