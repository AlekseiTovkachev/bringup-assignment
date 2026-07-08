import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const portalRoot = path.join(repoRoot, "portal");

const fixtureTaxId = "515123456";
const fixtureClient = {
  name: "חברת הדמו בע״מ",
  entityType: "Company",
  taxId: fixtureTaxId,
  accountant: "Dana Cohen",
  onboardingStatus: "file_opened",
  tasks: [
    {
      title: "העלאת חשבוניות יוני",
      serviceType: "Bookkeeping",
      reportingPeriod: "יוני 2026",
      dueDate: "2026-07-15",
      clientRequest: "נא לצרף חשבוניות חסרות",
      status: "Waiting for Client",
    },
    {
      title: "בדיקת פרטי חשבון",
      serviceType: "Payroll",
      reportingPeriod: "יולי 2026",
      dueDate: "2026-07-20",
      clientRequest: "",
      status: "Done",
    },
  ],
};

async function main() {
  const indexHtml = await readPortalText("index.html");
  await assertStaticPortal(indexHtml);
  await assertClientBehavior();
  console.log("Portal smoke passed: local page, RTL Hebrew UI, lookup flow, and response flow are healthy.");
}

async function assertStaticPortal(indexHtml) {
  assert.match(indexHtml, /<html[^>]+lang="he"[^>]+dir="rtl"/);
  assert.match(indexHtml, /פורטל תיק לקוח/);
  assert.match(indexHtml, /id="client-picker"/);
  assert.match(indexHtml, /id="tax-id"/);
  assert.match(indexHtml, /name="response-type"/);
  assert.match(indexHtml, /<script src="\.\/app\.js"><\/script>/);

  assert.match(await readPortalText("styles.css"), /direction:\s*rtl/);
  assert.match(await readPortalText("app.js"), /loadClientOptions/);
}

async function assertClientBehavior() {
  const harness = createDomHarness();
  const fetchCalls = [];
  const errors = [];
  const appSource = await readPortalText("app.js");

  const sandbox = {
    console: {
      log: () => {},
      error: (...args) => errors.push(args),
    },
    document: harness.document,
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url: String(url), options });
      assert.match(String(url), /^\/api\/portal-(client-options|client|response)(\?|$)/);
      return mockPortalFetch(url, options);
    },
    FormData: harness.FormData,
    Intl,
    Option: harness.Option,
    String,
    URLSearchParams,
    encodeURIComponent,
  };

  vm.runInNewContext(appSource, sandbox, { filename: "portal/app.js" });
  await flushAsync();

  const { clientPicker, lookupForm, resultPanel, taxIdInput } = harness;
  assert.equal(clientPicker.children.length, 2);
  assert.equal(clientPicker.children[1].value, fixtureTaxId);
  assert.match(clientPicker.textContent, /חברת הדמו/);

  clientPicker.value = fixtureTaxId;
  clientPicker.dispatchEvent(event("change"));
  assert.equal(taxIdInput.value, fixtureTaxId);

  taxIdInput.value = "00";
  taxIdInput.dispatchEvent(event("input"));
  assert.equal(clientPicker.value, "");

  taxIdInput.value = fixtureTaxId;
  await lookupForm.dispatchEvent(event("submit"));
  await flushAsync();

  assert.match(resultPanel.textContent, /חברת הדמו בע״מ/);
  assert.match(resultPanel.textContent, /Dana Cohen/);
  assert.match(resultPanel.textContent, /משימות ובקשות פתוחות/);
  assert.match(resultPanel.textContent, /ממתין ללקוח/);
  assert.doesNotMatch(resultPanel.textContent, /בדיקת פרטי חשבון/);
  assert.match(resultPanel.textContent, /שליחת עדכון/);

  const responseForm = resultPanel.querySelector("[data-response-form]");
  const responseTypes = responseForm.querySelectorAll("input[name='response-type']");
  assert.equal(responseTypes.length, 3);
  responseTypes[0].checked = false;
  responseTypes[1].checked = true;
  responseForm.querySelector("#response-details").value = "המסמכים צורפו לבדיקה";

  await responseForm.dispatchEvent(event("submit"));
  await flushAsync();

  assert.match(resultPanel.textContent, /העדכון נשלח בתאריך/);
  assert.equal(errors.length, 0);
  assert.deepEqual(
    fetchCalls.map((call) => call.url.split("?")[0]),
    ["/api/portal-client-options", "/api/portal-client", "/api/portal-response"],
  );
}

function createDomHarness() {
  const document = new FakeDocument();
  const lookupForm = new FakeElement("form", { id: "lookup-form" });
  const clientPicker = new FakeSelectElement({ id: "client-picker", name: "client-picker" });
  const taxIdInput = new FakeInputElement({ id: "tax-id", name: "tax-id" });
  const lookupButton = new FakeElement("button", { type: "submit" });
  const resultPanel = new FakeElement("section", { id: "result-panel" });
  const template = new FakeTemplateElement({ id: "client-template" }, createClientTemplateContent);

  lookupButton.textContent = "הצגת התיק";
  lookupForm.append(clientPicker, taxIdInput, lookupButton);
  document.append(lookupForm, resultPanel, template);

  return {
    clientPicker,
    document,
    FormData: FakeFormData,
    lookupForm,
    Option: FakeOption,
    resultPanel,
    taxIdInput,
  };
}

function createClientTemplateContent() {
  const fragment = new FakeDocumentFragment();
  const article = new FakeElement("article", { class: "client-view" });
  const header = new FakeElement("header", { class: "client-header" });
  const titleGroup = new FakeElement("div");
  const eyebrow = new FakeElement("p", { class: "eyebrow" });
  const clientName = new FakeElement("h2", { "data-client-name": "" });
  const clientMeta = new FakeElement("p", { class: "muted", "data-client-meta": "" });
  const headerSide = new FakeElement("div", { class: "client-header-side" });
  const statusPill = new FakeElement("div", { class: "status-pill", "data-status-pill": "" });
  const accountantPanel = new FakeElement("div", {
    class: "accountant-panel",
    "data-accountant-panel": "",
  });
  const accountantLabel = new FakeElement("span");
  const accountantName = new FakeElement("strong", { "data-accountant-name": "" });
  const progressSection = new FakeElement("section", { class: "progress-section" });
  const progressHeading = new FakeElement("h3", { id: "progress-heading" });
  const progressTrack = new FakeElement("ol", {
    class: "progress-track",
    "data-progress-track": "",
  });
  const taskSection = new FakeElement("section", { class: "task-section" });
  const sectionHeading = new FakeElement("div", { class: "section-heading" });
  const tasksHeading = new FakeElement("h3", { id: "tasks-heading" });
  const taskCount = new FakeElement("span", { "data-task-count": "" });
  const taskList = new FakeElement("div", { class: "task-list", "data-task-list": "" });
  const responseSection = new FakeElement("section", { class: "response-section" });
  const responseHeading = new FakeElement("h3", { id: "response-heading" });
  const responseForm = new FakeElement("form", { class: "response-form", "data-response-form": "" });
  const fieldset = new FakeElement("fieldset", { class: "response-type-group" });
  const legend = new FakeElement("legend");
  const detailsLabel = new FakeElement("label", { for: "response-details" });
  const details = new FakeTextAreaElement({ id: "response-details", name: "response-details" });
  const responseButton = new FakeElement("button", { type: "submit" });
  const responseMessage = new FakeElement("p", {
    class: "response-message",
    "data-response-message": "",
  });

  eyebrow.textContent = "תיק לקוח";
  accountantLabel.textContent = "רואה/ת חשבון מטפל/ת";
  progressHeading.textContent = "התקדמות קליטה";
  tasksHeading.textContent = "משימות ובקשות פתוחות";
  responseHeading.textContent = "שליחת עדכון";
  legend.textContent = "סוג עדכון";
  detailsLabel.textContent = "פירוט";
  responseButton.textContent = "שליחת עדכון";

  fieldset.append(
    responseTypeLabel("מסמכים נשלחו", "המסמכים נשלחו", true),
    responseTypeLabel("תגובה התקבלה", "השבתי עם המידע שהתבקש", false),
    responseTypeLabel("דורש בדיקה", "נא לבדוק את העדכון האחרון שלי", false),
  );
  responseForm.append(fieldset, detailsLabel, details, responseButton, responseMessage);
  responseSection.append(responseHeading, responseForm);
  sectionHeading.append(tasksHeading, taskCount);
  taskSection.append(sectionHeading, taskList);
  progressSection.append(progressHeading, progressTrack);
  accountantPanel.append(accountantLabel, accountantName);
  headerSide.append(statusPill, accountantPanel);
  titleGroup.append(eyebrow, clientName, clientMeta);
  header.append(titleGroup, headerSide);
  article.append(header, progressSection, taskSection, responseSection);
  fragment.append(article);
  return fragment;
}

function responseTypeLabel(value, text, checked) {
  const label = new FakeElement("label");
  const input = new FakeInputElement({ type: "radio", name: "response-type", value });
  const span = new FakeElement("span");
  input.checked = checked;
  span.textContent = text;
  label.append(input, span);
  return label;
}

class FakeNode {
  constructor() {
    this.children = [];
    this.parentNode = null;
    this._textContent = "";
  }

  append(...nodes) {
    for (const node of nodes.flat()) {
      node.parentNode = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    this.children = [];
    this._textContent = "";
    this.append(...nodes);
  }

  cloneNode(deep = false) {
    const clone = new this.constructor(this.tagName?.toLowerCase?.() || undefined, { ...this.attributes });
    this.copyTo(clone);
    if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
    return clone;
  }

  copyTo(clone) {
    clone._textContent = this._textContent;
  }

  get textContent() {
    return `${this._textContent}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value) {
    this._textContent = String(value);
    this.children = [];
  }
}

class FakeDocumentFragment extends FakeNode {
  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    return querySelectorAll(this, selector);
  }

  cloneNode(deep = false) {
    const clone = new FakeDocumentFragment();
    this.copyTo(clone);
    if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
    return clone;
  }
}

class FakeElement extends FakeNode {
  constructor(tagName = "div", attributes = {}) {
    super();
    this.tagName = String(tagName).toUpperCase();
    this.attributes = { ...attributes };
    this.eventListeners = new Map();
    this.disabled = false;
    this.dir = attributes.dir || "";
    this.id = attributes.id || "";
    this.name = attributes.name || "";
    this.type = attributes.type || "";
    this.value = attributes.value || "";
    this.checked = Boolean(attributes.checked);
    this.className = attributes.class || "";
    this.classList = {
      add: (...names) => {
        const existing = new Set(this.className.split(/\s+/).filter(Boolean));
        for (const name of names) existing.add(name);
        this.className = [...existing].join(" ");
        this.attributes.class = this.className;
      },
    };
  }

  append(...nodes) {
    super.append(...nodes);
    if (this.tagName === "FORM") indexFormControls(this);
  }

  addEventListener(type, listener) {
    const listeners = this.eventListeners.get(type) || [];
    listeners.push(listener);
    this.eventListeners.set(type, listeners);
  }

  async dispatchEvent(eventToDispatch) {
    eventToDispatch.target = this;
    const listeners = this.eventListeners.get(eventToDispatch.type) || [];
    for (const listener of listeners) {
      await listener(eventToDispatch);
    }
    return !eventToDispatch.defaultPrevented;
  }

  querySelector(selector) {
    return querySelector(this, selector);
  }

  querySelectorAll(selector) {
    return querySelectorAll(this, selector);
  }

  cloneNode(deep = false) {
    const clone =
      this.constructor === FakeElement
        ? new FakeElement(this.tagName.toLowerCase(), { ...this.attributes })
        : new this.constructor({ ...this.attributes });
    this.copyTo(clone);
    if (deep) clone.append(...this.children.map((child) => child.cloneNode(true)));
    return clone;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  reset() {
    for (const control of this.querySelectorAll("input")) {
      if (control.type === "radio") {
        control.checked = Boolean(control.defaultChecked);
      } else {
        control.value = "";
      }
    }
    for (const control of this.querySelectorAll("textarea")) {
      control.value = "";
    }
  }

  copyTo(clone) {
    super.copyTo(clone);
    clone.disabled = this.disabled;
    clone.dir = this.dir;
    clone.id = this.id;
    clone.name = this.name;
    clone.type = this.type;
    clone.value = this.value;
    clone.checked = this.checked;
    clone.defaultChecked = this.defaultChecked;
    clone.className = this.className;
  }
}

class FakeDocument extends FakeElement {
  constructor() {
    super("#document");
  }

  createElement(tagName) {
    if (tagName === "input") return new FakeInputElement();
    if (tagName === "textarea") return new FakeTextAreaElement();
    if (tagName === "select") return new FakeSelectElement();
    return new FakeElement(tagName);
  }
}

class FakeTemplateElement extends FakeElement {
  constructor(attributes, contentFactory) {
    super("template", attributes);
    this.content = contentFactory();
  }

  cloneNode() {
    return new FakeTemplateElement({ ...this.attributes }, () => this.content.cloneNode(true));
  }
}

class FakeInputElement extends FakeElement {
  constructor(attributes = {}) {
    super("input", attributes);
    this.defaultChecked = Boolean(attributes.checked);
  }
}

class FakeTextAreaElement extends FakeElement {
  constructor(attributes = {}) {
    super("textarea", attributes);
  }
}

class FakeSelectElement extends FakeElement {
  constructor(attributes = {}) {
    super("select", attributes);
  }
}

class FakeOption extends FakeElement {
  constructor(text, value) {
    super("option", { value });
    this.textContent = text;
    this.value = value;
  }
}

class FakeFormData {
  constructor(form) {
    this.form = form;
  }

  get(name) {
    const controls = this.form.querySelectorAll(`[name='${name}']`);
    const radio = controls.find((control) => control.type === "radio");
    if (radio) return controls.find((control) => control.checked)?.value || "";
    return controls[0]?.value || "";
  }
}

function indexFormControls(form) {
  for (const control of form.querySelectorAll("input")) {
    if (control.type === "radio") control.defaultChecked = control.checked;
  }
}

function querySelector(root, selector) {
  return querySelectorAll(root, selector)[0] || null;
}

function querySelectorAll(root, selector) {
  const matches = [];
  for (const node of walk(root)) {
    if (node !== root && matchesSelector(node, selector)) matches.push(node);
  }
  return matches;
}

function* walk(node) {
  yield node;
  for (const child of node.children || []) {
    yield* walk(child);
  }
}

function matchesSelector(node, selector) {
  if (!(node instanceof FakeElement)) return false;
  if (selector.startsWith("#")) return node.id === selector.slice(1);
  if (selector === "input") return node.tagName === "INPUT";
  if (selector === "textarea") return node.tagName === "TEXTAREA";
  if (selector === "button[type='submit']") {
    return node.tagName === "BUTTON" && node.type === "submit";
  }
  const dataMatch = selector.match(/^\[([^=\]]+)(?:=['"]?([^'"\]]+)['"]?)?\]$/);
  if (dataMatch) {
    const [, name, value] = dataMatch;
    return value === undefined ? name in node.attributes : node.attributes[name] === value;
  }
  const inputNameMatch = selector.match(/^input\[name=['"]([^'"]+)['"]\]$/);
  if (inputNameMatch) {
    return node.tagName === "INPUT" && node.name === inputNameMatch[1];
  }
  return node.tagName.toLowerCase() === selector.toLowerCase();
}

function event(type) {
  return {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    type,
  };
}

async function mockPortalFetch(url, options = {}) {
  const parsedUrl = new URL(String(url), "http://portal-smoke.local");
  const method = options.method || "GET";

  if (parsedUrl.pathname === "/api/portal-client-options" && method === "GET") {
    return jsonResponse({
      clients: [{ name: fixtureClient.name, taxId: fixtureClient.taxId }],
    });
  }

  if (parsedUrl.pathname === "/api/portal-client" && method === "GET") {
    assert.equal(parsedUrl.searchParams.get("taxId"), fixtureTaxId);
    return jsonResponse({ client: fixtureClient });
  }

  if (parsedUrl.pathname === "/api/portal-response" && method === "POST") {
    const payload = JSON.parse(options.body);
    assert.equal(payload.taxId, fixtureTaxId);
    assert.equal(payload.responseType, "תגובה התקבלה");
    assert.equal(payload.details, "המסמכים צורפו לבדיקה");
    return jsonResponse({ submittedDate: "2026-07-08" });
  }

  return jsonResponse({ error: "Unexpected portal smoke URL" }, 404);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
}

async function readPortalText(fileName) {
  return readFile(path.join(portalRoot, fileName), "utf8");
}

async function flushAsync() {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

await main();
