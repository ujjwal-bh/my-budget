import NepaliDate from "nepali-date-converter";

export const nepaliMonths = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];

export function currentBsMonth() {
  const date = new NepaliDate(new Date());
  return `${date.getYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function bsMonthStart(month: string) {
  return new NepaliDate(`${month}-01`).toJsDate();
}

export function bsMonthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  return bsMonthStart(nextMonth);
}

export function isInBsMonth(date: string | Date, month: string) {
  const value = new Date(date);
  return value >= bsMonthStart(month) && value < bsMonthEnd(month);
}

export function formatBsDate(date: string | Date) {
  return new NepaliDate(new Date(date)).format("DD MMMM YYYY");
}

export function formatBsMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${nepaliMonths[monthNumber - 1]} ${year}`;
}

export function previousBsMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
}
