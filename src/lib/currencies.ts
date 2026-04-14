export const CURRENCIES = [
  { code: 'USD', symbol: '$',    label: 'USD — US Dollar'         },
  { code: 'INR', symbol: '₹',   label: 'INR — Indian Rupee'      },
  { code: 'EUR', symbol: '€',   label: 'EUR — Euro'              },
  { code: 'AUD', symbol: 'A$',  label: 'AUD — Australian Dollar' },
  { code: 'SGD', symbol: 'S$',  label: 'SGD — Singapore Dollar'  },
  { code: 'GBP', symbol: '£',   label: 'GBP — British Pound'     },
  { code: 'AED', symbol: 'AED ',label: 'AED — UAE Dirham'        },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find(c => c.code === code)?.symbol ?? '$';
}

export function formatCurrency(value: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${value.toLocaleString()}`;
}
