import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(2)} tỷ`;
  }
  return `${value.toLocaleString("vi-VN")}M`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
