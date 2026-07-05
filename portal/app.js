const onboardingSteps = [
  "Lead",
  "Questionnaire Sent",
  "Documents Received",
  "File Opened",
  "Active",
];

const clients = {
  "512345678": {
    name: "Acme Ltd",
    taxId: "512345678",
    entityType: "Company Ltd",
    accountant: "Dana Cohen",
    status: "File Opened",
    tasks: [
      {
        title: "Upload signed payroll authorization",
        serviceType: "Payroll",
        reportingPeriod: "July 2026",
        dueDate: "2026-07-15",
        status: "Waiting for Client",
      },
      {
        title: "Confirm VAT invoice packet",
        serviceType: "VAT Reporting",
        reportingPeriod: "June 2026",
        dueDate: "2026-07-20",
        status: "Waiting for Client",
      },
    ],
  },
  "514200111": {
    name: "North Star Studio",
    taxId: "514200111",
    entityType: "Partnership",
    accountant: "Noam Levi",
    status: "Active",
    tasks: [
      {
        title: "Send monthly expense summary",
        serviceType: "Bookkeeping",
        reportingPeriod: "July 2026",
        dueDate: "2026-07-25",
        status: "Waiting for Client",
      },
    ],
  },
  "580044321": {
    name: "Green Path Nonprofit",
    taxId: "580044321",
    entityType: "Nonprofit",
    accountant: "Maya Rosen",
    status: "Documents Received",
    tasks: [],
  },
};

const lookupForm = document.querySelector("#lookup-form");
const resultPanel = document.querySelector("#result-panel");
const template = document.querySelector("#client-template");

lookupForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(lookupForm);
  const taxId = String(formData.get("tax-id") || "").replace(/\D/g, "");
  const client = clients[taxId];

  if (!client) {
    renderNotFound(taxId);
    return;
  }

  renderClient(client);
});

function renderClient(client) {
  const fragment = template.content.cloneNode(true);
  const currentStepIndex = onboardingSteps.indexOf(client.status);
  const openTasks = client.tasks.filter((task) => task.status !== "Done");

  fragment.querySelector("[data-client-name]").textContent = client.name;
  fragment.querySelector("[data-client-meta]").textContent =
    `${client.entityType} | Tax ID ${client.taxId} | Accountant ${client.accountant}`;
  fragment.querySelector("[data-status-pill]").textContent = clientFacingStatus(client.status);
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
  responseForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(responseForm);
    const responseType = formData.get("response-type");
    const details = String(formData.get("response-details") || "").trim();
    const submittedAt = new Date().toLocaleString();

    responseMessage.textContent =
      `Demo update saved: ${responseType} at ${submittedAt}${details ? ` - ${details}` : ""}`;
    responseForm.reset();
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
  meta.textContent = `${task.serviceType} | ${task.reportingPeriod} | Due ${formatDate(task.dueDate)}`;
  badge.className = "task-badge";
  badge.textContent = task.status;

  body.append(title, meta);
  article.append(body, badge);

  return article;
}

function renderNotFound(taxId) {
  const message = document.createElement("div");
  message.className = "not-found";

  const title = document.createElement("h2");
  title.textContent = "No matching client file found.";

  const details = document.createElement("p");
  details.className = "muted";
  details.textContent = taxId
    ? `No demo record exists for tax ID ${taxId}.`
    : "Enter a legal or tax ID to search the demo data.";

  message.append(title, details);
  resultPanel.replaceChildren(message);
}

function clientFacingStatus(status) {
  const labels = {
    Lead: "New request received",
    "Questionnaire Sent": "Questionnaire sent",
    "Documents Received": "Documents received",
    "File Opened": "File opened",
    Active: "Active service",
  };

  return labels[status] || status;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

renderClient(clients["512345678"]);
