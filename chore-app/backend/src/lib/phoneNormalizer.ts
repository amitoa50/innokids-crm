export function normalizePhone(raw: string): string {
  // Strip spaces, dashes, parentheses, dots
  let cleaned = raw.replace(/[\s\-().]/g, "")

  // Handle Israeli formats
  if (cleaned.startsWith("0")) {
    // 0501234567 -> +972501234567
    cleaned = "+972" + cleaned.slice(1)
  } else if (cleaned.startsWith("972") && !cleaned.startsWith("+972")) {
    // 972501234567 -> +972501234567
    cleaned = "+" + cleaned
  } else if (!cleaned.startsWith("+")) {
    // Add + prefix if missing for international numbers
    cleaned = "+" + cleaned
  }

  return cleaned
}
