const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const script = fs.readFileSync(path.join(root, "assets", "js", "main.js"), "utf8");
const recipient = "https://formsubmit.co/jiservicesconstruction@gmail.com";

function makeElement(properties = {}) {
  const attributes = new Map();
  const listeners = new Map();
  const classes = new Set();
  return Object.assign({
    value: "",
    type: "text",
    required: false,
    checked: false,
    hidden: false,
    disabled: false,
    textContent: "",
    focused: false,
    classList: {
      add(name) { classes.add(name); },
      contains(name) { return classes.has(name); },
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) || null; },
    removeAttribute(name) { attributes.delete(name); },
    focus() { this.focused = true; },
    dispatch(name, event) { listeners.get(name)(event); },
  }, properties);
}

function createForm(fetchResponse, options = {}) {
  const fields = [
    makeElement({ name: "_subject", type: "hidden", value: "New roofing estimate request" }),
    makeElement({ name: "_template", type: "hidden", value: "table" }),
    makeElement({ name: "_honey" }),
    makeElement({ name: "name", required: true, value: "Example Customer" }),
    makeElement({ name: "phone", type: "tel", required: true, value: "2125550101" }),
    makeElement({ name: "email", type: "email", required: true, value: "customer@example.test" }),
    makeElement({ name: "zip", required: true, value: "10001" }),
    makeElement({ name: "address", value: "123 Example Street" }),
    makeElement({ name: "service", required: true, value: "Roof replacement" }),
    makeElement({ name: "property", value: "Single-family home" }),
    makeElement({ name: "timeline", value: "As soon as possible" }),
    makeElement({ name: "contactPref", value: "Email" }),
    makeElement({ name: "message", value: "Example project details" }),
    makeElement({ name: "consent", type: "checkbox", required: true, checked: true, value: "on" }),
  ];
  const errors = new Map(fields.map(field => [field.name, makeElement()]));
  const error = makeElement({ hidden: true });
  const errorMessage = makeElement({ textContent: "We couldn't confirm your request was sent." });
  const status = makeElement({ hidden: true });
  const button = makeElement();
  const label = makeElement({ textContent: "Send My Request" });
  const success = makeElement();
  success.classList.add("form-success");

  const form = makeElement({
    action: recipient,
    nextElementSibling: success,
    parentElement: {
      querySelector(selector) {
        assert.equal(selector, "[data-form-status]");
        return options.noStatus ? null : status;
      },
    },
    querySelector(selector) {
      if (selector === "[data-form-error]") return error;
      if (selector === "[data-form-error-message]") return errorMessage;
      if (selector === 'button[type="submit"]') return button;
      if (selector === "[data-submit-label]") return label;
      const match = /^\[data-error-for="([^"]+)"\]$/.exec(selector);
      return match ? errors.get(match[1]) : null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, "input, select, textarea");
      return fields;
    },
  });

  class FormData {
    constructor() {
      this.values = Object.fromEntries(
        fields
          .filter(field => !field.disabled && (field.type !== "checkbox" || field.checked))
          .map(field => [field.name, field.value])
      );
    }
  }

  const requests = [];
  const logs = [];
  const timers = new Map();
  let nextTimerId = 0;
  let now = 0;
  const window = {
    FormData,
    URL,
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };
  if (options.abortController !== false) window.AbortController = AbortController;
  if (fetchResponse) {
    window.fetch = function (url, options) {
      requests.push({ url, options });
      return fetchResponse(url, options);
    };
  }
  const document = {
    readyState: "complete",
    querySelector() { return null; },
    querySelectorAll(selector) {
      return selector === "form[data-lead-form]" ? [form] : [];
    },
  };
  vm.runInNewContext(script, {
    document,
    window,
    FormData,
    URL,
    console: { error(...args) { logs.push(args); } },
  });

  return {
    form, fields, errors, error, errorMessage, status, button, label, success, requests, logs, timers,
    submit() {
      const event = {
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
      };
      form.dispatch("submit", event);
      return event;
    },
    advanceTime(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break;
        const [id, timer] = due;
        now = timer.due;
        timers.delete(id);
        timer.callback();
      }
      now = target;
    },
  };
}

function response(result, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(result),
  });
}

function settle() {
  return new Promise(resolve => setImmediate(resolve));
}

test("both HTML forms post to the recipient and retain native validation", () => {
  const pages = [
    ["index.html", ["name", "phone", "zip", "service"], ["name", "phone", "zip"]],
    ["contact.html", ["name", "phone", "email", "zip", "address", "service", "property", "timeline", "contactPref", "message", "consent"], ["name", "phone", "email", "zip", "service", "consent"]],
  ];
  for (const [file, fields, requiredFields] of pages) {
    const html = fs.readFileSync(path.join(root, file), "utf8");
    const form = html.match(/<form\b[^>]*\bdata-lead-form\b[^>]*>[\s\S]*?<\/form>/i);
    assert.ok(form, `${file} has a lead form`);
    const openingTag = form[0].match(/<form\b[^>]*>/i)[0];
    assert.match(openingTag, /action="https:\/\/formsubmit\.co\/jiservicesconstruction@gmail\.com"/);
    assert.match(openingTag, /method="POST"/);
    assert.doesNotMatch(openingTag, /\bnovalidate\b/i);
    assert.match(html, /<noscript><style>\.reveal \{ opacity: 1; transform: none; \}<\/style><\/noscript>/);
    assert.match(html, /<\/form>\s*<div class="form-success">/);
    assert.match(html, /<p class="form-status" data-form-status role="status" hidden>/);
    for (const name of fields) {
      assert.match(form[0], new RegExp(`name="${name}"`));
    }
    for (const name of requiredFields) {
      assert.match(form[0], new RegExp(`<[^>]+name="${name}"[^>]+required`));
    }
    for (const marker of ['name="_subject"', 'name="_template"', 'name="_honey"', "data-form-error", "data-form-error-message", "data-submit-label", 'href="tel:+16315699084"', 'href="mailto:jiservicesconstruction@gmail.com"']) {
      assert.ok(form[0].includes(marker), `${file} includes ${marker}`);
    }
  }
});

test("valid submissions send all fields once and show confirmed success", async () => {
  let resolveRequest;
  const pending = new Promise(resolve => { resolveRequest = resolve; });
  const fixture = createForm(() => pending);

  assert.equal(fixture.submit().defaultPrevented, true);
  assert.equal(fixture.button.disabled, true);
  assert.equal(fixture.label.textContent, "Sending...");
  assert.equal(fixture.form.getAttribute("aria-busy"), "true");
  assert.equal(fixture.status.hidden, true);
  assert.ok(fixture.fields.every(field => field.disabled));
  assert.equal(fixture.submit().defaultPrevented, true);
  await settle();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].url, "https://formsubmit.co/ajax/jiservicesconstruction@gmail.com");
  assert.equal(fixture.requests[0].options.method, "POST");
  assert.deepEqual(fixture.requests[0].options.body.values, {
    _subject: "New roofing estimate request",
    _template: "table",
    _honey: "",
    name: "Example Customer",
    phone: "2125550101",
    email: "customer@example.test",
    zip: "10001",
    address: "123 Example Street",
    service: "Roof replacement",
    property: "Single-family home",
    timeline: "As soon as possible",
    contactPref: "Email",
    message: "Example project details",
    consent: "on",
  });

  resolveRequest({ ok: true, json: () => Promise.resolve({ success: "true" }) });
  await settle();
  assert.equal(fixture.form.classList.contains("is-submitted"), true);
  assert.equal(fixture.success.classList.contains("is-visible"), true);
  assert.equal(fixture.success.focused, true);
  assert.equal(fixture.error.hidden, true);
  assert.equal(fixture.status.hidden, true);
  assert.equal(fixture.timers.size, 0);
});

for (const [name, getResponse] of [
  ["pending activation", () => response({ success: "false", message: "Form needs activation" })],
  ["HTTP failure", () => response({ success: true }, 500)],
  ["network failure", () => Promise.reject(new Error("Network error"))],
  ["synchronous request failure", () => { throw new Error("Request failed"); }],
  ["invalid JSON", () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("Invalid JSON")) })],
  ["missing confirmation", () => response({})],
]) {
  test(`${name} preserves the form and reports an error`, async () => {
    const fixture = createForm(getResponse);
    fixture.submit();
    await settle();

    assert.equal(fixture.form.classList.contains("is-submitted"), false);
    assert.equal(fixture.success.classList.contains("is-visible"), false);
    assert.equal(fixture.error.hidden, false);
    assert.equal(fixture.error.focused, true);
    assert.equal(fixture.button.disabled, false);
    assert.ok(fixture.fields.every(field => !field.disabled));
    assert.equal(fixture.label.textContent, "Send My Request");
    assert.equal(fixture.form.getAttribute("aria-busy"), null);
    assert.equal(fixture.fields.find(field => field.name === "message").value, "Example project details");
    assert.equal(fixture.errorMessage.textContent, "We couldn't confirm your request was sent.");
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.status.hidden, true);
    assert.equal(fixture.timers.size, 0);
  });
}

for (const delay of [36000, 54000]) {
  test(`a successful response after ${delay / 1000} seconds is not timed out`, async () => {
    let resolveRequest;
    const fixture = createForm(() => new Promise(resolve => { resolveRequest = resolve; }));
    fixture.submit();
    await settle();

    fixture.advanceTime(9999);
    assert.equal(fixture.status.hidden, true);
    fixture.advanceTime(1);
    assert.equal(fixture.status.hidden, false);
    assert.equal(fixture.label.textContent, "Still sending...");
    assert.equal(fixture.success.classList.contains("is-visible"), false);
    fixture.advanceTime(delay - 10000);
    assert.equal(fixture.error.hidden, true);
    assert.equal(fixture.requests[0].options.signal.aborted, false);
    assert.equal(fixture.submit().defaultPrevented, true);
    assert.equal(fixture.requests.length, 1);

    resolveRequest({ ok: true, json: () => Promise.resolve({ success: "true" }) });
    await settle();
    assert.equal(fixture.status.hidden, true);
    assert.equal(fixture.success.classList.contains("is-visible"), true);
    assert.equal(fixture.timers.size, 0);
  });
}

test("a delayed submission can still succeed with older page markup", async () => {
  let resolveRequest;
  const fixture = createForm(
    () => new Promise(resolve => { resolveRequest = resolve; }),
    { noStatus: true }
  );
  fixture.submit();
  await settle();
  fixture.advanceTime(36000);
  assert.equal(fixture.label.textContent, "Still sending...");

  resolveRequest({ ok: true, json: () => Promise.resolve({ success: "true" }) });
  await settle();
  assert.equal(fixture.success.classList.contains("is-visible"), true);
});

test("a delayed provider failure clears the progress message and unlocks the form", async () => {
  let resolveRequest;
  const fixture = createForm(() => new Promise(resolve => { resolveRequest = resolve; }));
  fixture.submit();
  await settle();
  fixture.advanceTime(36000);
  assert.equal(fixture.status.hidden, false);

  resolveRequest({ ok: true, json: () => Promise.resolve({ success: "false" }) });
  await settle();
  assert.equal(fixture.status.hidden, true);
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.button.disabled, false);
  assert.ok(fixture.fields.every(field => !field.disabled));
  assert.equal(fixture.success.classList.contains("is-visible"), false);
  assert.equal(fixture.timers.size, 0);
});

test("a stalled request times out, is aborted, and can be retried without a late success", async () => {
  const resolveRequests = [];
  const fixture = createForm(() => new Promise(resolve => { resolveRequests.push(resolve); }));
  const disabledField = fixture.fields.find(field => field.name === "property");
  disabledField.disabled = true;
  fixture.submit();
  await settle();

  assert.equal(fixture.requests[0].options.signal.aborted, false);
  fixture.advanceTime(119999);
  assert.equal(fixture.status.hidden, false);
  assert.equal(fixture.error.hidden, true);
  assert.equal(fixture.requests[0].options.signal.aborted, false);
  fixture.advanceTime(1);
  await settle();
  assert.equal(fixture.requests[0].options.signal.aborted, true);
  assert.equal(fixture.form.classList.contains("is-submitted"), false);
  assert.equal(fixture.success.classList.contains("is-visible"), false);
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.error.focused, true);
  assert.equal(fixture.errorMessage.textContent, "The request timed out. It may still have been received.");
  assert.equal(fixture.button.disabled, false);
  assert.equal(disabledField.disabled, true);
  assert.ok(fixture.fields.filter(field => field !== disabledField).every(field => !field.disabled));
  assert.equal(fixture.label.textContent, "Send My Request");
  assert.equal(fixture.form.getAttribute("aria-busy"), null);
  assert.equal(fixture.fields.find(field => field.name === "message").value, "Example project details");
  assert.equal(fixture.logs.length, 1);
  assert.equal(fixture.status.hidden, true);
  assert.equal(fixture.timers.size, 0);

  fixture.submit();
  await settle();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.error.hidden, true);
  resolveRequests[0]({ ok: true, json: () => Promise.resolve({ success: "true" }) });
  await settle();
  assert.equal(fixture.success.classList.contains("is-visible"), false);
  assert.equal(fixture.button.disabled, true);

  resolveRequests[1]({ ok: true, json: () => Promise.resolve({ success: true }) });
  await settle();
  assert.equal(fixture.success.classList.contains("is-visible"), true);
  assert.equal(fixture.timers.size, 0);
});

test("a stalled response body is covered by the same timeout", async () => {
  let resolveBody;
  const fixture = createForm(() => Promise.resolve({
    ok: true,
    json: () => new Promise(resolve => { resolveBody = resolve; }),
  }));
  fixture.submit();
  await settle();
  assert.equal(typeof resolveBody, "function");
  fixture.advanceTime(120000);
  await settle();
  assert.equal(fixture.requests[0].options.signal.aborted, true);
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.success.classList.contains("is-visible"), false);

  resolveBody({ success: "true" });
  await settle();
  assert.equal(fixture.success.classList.contains("is-visible"), false);
});

test("a stalled request still times out without AbortController", async () => {
  const fixture = createForm(() => new Promise(() => {}), { abortController: false });
  fixture.submit();
  await settle();
  assert.equal(fixture.requests[0].options.signal, undefined);
  fixture.advanceTime(120000);
  await settle();
  assert.equal(fixture.error.hidden, false);
  assert.equal(fixture.button.disabled, false);
  assert.equal(fixture.success.classList.contains("is-visible"), false);
});

test("a failed request can be retried", async () => {
  let attempts = 0;
  const fixture = createForm(() => response(++attempts === 1 ? { success: "false" } : { success: true }));
  fixture.submit();
  await settle();
  assert.equal(fixture.error.hidden, false);

  fixture.submit();
  assert.equal(fixture.error.hidden, true);
  await settle();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.success.classList.contains("is-visible"), true);
});

test("invalid inputs do not submit and browsers without fetch use the native form", () => {
  const fixture = createForm(null);
  const email = fixture.fields.find(field => field.name === "email");
  const consent = fixture.fields.find(field => field.name === "consent");
  email.value = "invalid";
  consent.checked = false;
  assert.equal(fixture.submit().defaultPrevented, true);
  assert.equal(fixture.errors.get("email").textContent, "Enter a valid email address.");
  assert.equal(fixture.errors.get("consent").textContent, "Please confirm to continue.");
  assert.equal(email.focused, true);
  assert.equal(fixture.requests.length, 0);

  email.value = "customer@example.test";
  consent.checked = true;
  const phone = fixture.fields.find(field => field.name === "phone");
  phone.value = "123";
  assert.equal(fixture.submit().defaultPrevented, true);
  assert.equal(fixture.errors.get("phone").textContent, "Enter a 10-digit phone number.");
  assert.equal(phone.focused, true);

  phone.value = "2125550101";
  assert.equal(fixture.submit().defaultPrevented, false);
  assert.equal(fixture.form.action, recipient);
});
