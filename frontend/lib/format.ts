export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
export const dateTime = (d: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(d));
export const dateOnly = (d: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(d));
