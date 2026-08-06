function isBlankOptionalValue(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function optionalNumberValue(value: unknown) {
  return isBlankOptionalValue(value) ? null : Number(value);
}

export function optionalStringValue(value: unknown) {
  return isBlankOptionalValue(value) ? null : String(value);
}

export function updateOptionalNumberValue(value: unknown) {
  return value === undefined ? undefined : optionalNumberValue(value);
}

export function updateOptionalStringValue(value: unknown) {
  return value === undefined ? undefined : optionalStringValue(value);
}

export function updateOptionalDateValue(value: unknown) {
  if (value === undefined) return undefined;
  if (isBlankOptionalValue(value)) return null;
  return new Date(String(value));
}
