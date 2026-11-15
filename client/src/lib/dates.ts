export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatClock(dateTime: string | null): string {
  if (!dateTime) return "";
  return dateTime.includes("T") ? dateTime.slice(11, 16) : dateTime.slice(0, 5);
}

export function formatShortDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric"
  }).format(date);
}

export function formatFullDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}
