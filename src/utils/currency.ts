export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  position: 'before' | 'after';
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyInfo> = {
  USD: {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    position: 'before',
    decimals: 2
  },
  EUR: {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    position: 'before',
    decimals: 2
  },
  GBP: {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    position: 'before',
    decimals: 2
  },
  CAD: {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    position: 'before',
    decimals: 2
  },
  AUD: {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    position: 'before',
    decimals: 2
  },
  JPY: {
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    position: 'before',
    decimals: 0
  },
  CNY: {
    code: 'CNY',
    name: 'Chinese Yuan',
    symbol: '¥',
    position: 'before',
    decimals: 2
  },
  INR: {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    position: 'before',
    decimals: 2
  },
  AED: {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'د.إ',
    position: 'after',
    decimals: 2
  },
  SAR: {
    code: 'SAR',
    name: 'Saudi Riyal',
    symbol: '﷼',
    position: 'before',
    decimals: 2
  },
  NGN: {
    code: 'NGN',
    name: 'Nigerian Naira',
    symbol: '₦',
    position: 'before',
    decimals: 2
  },
  VND: {
    code: 'VND',
    name: 'Vietnamese Dong',
    symbol: '₫',
    position: 'after',
    decimals: 0
  },
  DOP: {
    code: 'DOP',
    name: 'Dominican Peso',
    symbol: 'RD$',
    position: 'before',
    decimals: 2
  }
};

export class CurrencyUtils {
  static getCurrencyInfo(currencyCode: string): CurrencyInfo {
    return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES.USD;
  }

  static formatAmount(amount: number, currencyCode: string): string {
    const currency = this.getCurrencyInfo(currencyCode);
    const formattedAmount = amount.toFixed(currency.decimals);
    
    if (currency.position === 'before') {
      return `${currency.symbol}${formattedAmount}`;
    } else {
      return `${formattedAmount} ${currency.symbol}`;
    }
  }

  static getCurrencySymbol(currencyCode: string): string {
    return this.getCurrencyInfo(currencyCode).symbol;
  }

  static getAllCurrencies(): CurrencyInfo[] {
    return Object.values(SUPPORTED_CURRENCIES);
  }
}

export default CurrencyUtils; 