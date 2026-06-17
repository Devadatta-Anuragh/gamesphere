/** Money is integer MINOR units (kobo). Format to ₦ major units. */
export const formatMoney = (minor: number): string =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 2,
  }).format(minor / 100);

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('en-US').format(n);

export const formatPercent = (ratio: number, digits = 1): string =>
  `${(ratio * 100).toFixed(digits)}%`;

export const formatTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-GB', { hour12: false });

export const shortId = (id: string): string =>
  id.length <= 10 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
