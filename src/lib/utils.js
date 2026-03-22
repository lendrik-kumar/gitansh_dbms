import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

export function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export function formatCurrency(amount) {
  if (amount == null) return '-'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}
