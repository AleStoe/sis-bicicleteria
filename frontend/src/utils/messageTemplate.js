export function renderMessageTemplate(template, variables = {}) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const value = variables[key];
    return value == null ? "" : String(value);
  }).trim();
}
