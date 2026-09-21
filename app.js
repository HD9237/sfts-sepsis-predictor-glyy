const API_URL = "https://sfts-sepsis-backend.onrender.com/predict";

const fields = [
  { key: "creatinine", label: "Serum creatinine (SCr)", unit: "μmol/L", min: 0, step: "0.1", placeholder: "72" },
  { key: "gcs", label: "Glasgow Coma Scale (GCS)", unit: "points", min: 3, max: 15, step: "1", placeholder: "15" },
  { key: "heartRate", label: "Heart rate (HR)", unit: "beats/min", min: 0, step: "1", placeholder: "80" },
  { key: "age", label: "Age (AGE)", unit: "years", min: 18, max: 120, step: "1", placeholder: "64" },
  { key: "pt", label: "Prothrombin time (PT)", unit: "seconds", min: 0, step: "0.1", placeholder: "11.8" },
  { key: "anc", label: "Absolute neutrophil count (ANC)", unit: "×10⁹/L", min: 0, step: "0.01", placeholder: "1.50" },
];

const form = document.querySelector("#calculator");
const grid = document.querySelector("#field-grid");
const calculateButton = document.querySelector("#calculate");
const clearButton = document.querySelector("#clear");
const error = document.querySelector("#error");
const result = document.querySelector("#result");
const probabilityText = document.querySelector("#probability");

const inputs = {};
let isSubmitting = false;

for (const field of fields) {
  const label = document.createElement("label");
  const title = document.createElement("span");
  title.textContent = field.label;

  const row = document.createElement("div");
  row.className = "input-row";

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.min = String(field.min);
  if (field.max !== undefined) input.max = String(field.max);
  input.step = field.step;
  input.placeholder = field.placeholder;
  input.setAttribute("aria-label", `${field.label}, ${field.unit}`);

  const unit = document.createElement("small");
  unit.textContent = field.unit;

  input.addEventListener("input", () => {
    result.hidden = true;
    error.hidden = true;
    refreshState();
  });

  inputs[field.key] = input;
  row.append(input, unit);
  label.append(title, row);
  grid.append(label);
}

function getStatus() {
  let complete = true;
  let hasValues = false;
  let invalid = false;

  for (const field of fields) {
    const input = inputs[field.key];
    const raw = input.value;
    const value = Number(raw);
    const bad = raw !== "" && (
      !Number.isFinite(value)
      || value < field.min
      || (field.max !== undefined && value > field.max)
    );

    input.closest("label").classList.toggle("invalid", bad);
    input.setAttribute("aria-invalid", String(bad));
    complete = complete && raw !== "";
    hasValues = hasValues || raw !== "";
    invalid = invalid || bad;
  }

  return { complete, hasValues, invalid };
}

function refreshState() {
  const state = getStatus();
  calculateButton.disabled = isSubmitting || !state.complete || state.invalid;
  clearButton.disabled = isSubmitting || (!state.hasValues && result.hidden);
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = getStatus();

  if (!state.complete || state.invalid || isSubmitting) {
    if (state.invalid) {
      showError("One or more values are outside the accepted range.");
    }
    return;
  }

  const payload = Object.fromEntries(
    fields.map((field) => [field.key, Number(inputs[field.key].value)]),
  );

  isSubmitting = true;
  result.hidden = true;
  error.hidden = true;
  calculateButton.textContent = "Calculating…";
  refreshState();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
    });

    if (!response.ok) {
      throw new Error(`Prediction service returned ${response.status}`);
    }

    const data = await response.json();
    const probability = Number(data.probability);

    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error("Prediction service returned an invalid result");
    }

    probabilityText.textContent = `${(probability * 100).toFixed(1)}%`;
    result.hidden = false;
  } catch (requestError) {
    console.error(requestError);
    showError("The prediction service is temporarily unavailable. Please wait a moment and try again.");
  } finally {
    isSubmitting = false;
    calculateButton.textContent = "Calculation";
    refreshState();
  }
});

clearButton.addEventListener("click", () => {
  for (const input of Object.values(inputs)) input.value = "";
  result.hidden = true;
  error.hidden = true;
  refreshState();
});

refreshState();
