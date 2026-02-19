export const PRICING_AMOUNTS = {
    '1m': '0.99',
    '3m': '3.99',
    '6m': '6.99',
    '12m': '12.99',
    'life': '19.99'
};

export const ENTITLEMENT_RULES = [
    { min: 19.99, label: 'lifetime', termCode: 'LIFETIME', expirationDate: '2099-12-31' },
    { min: 12.99, label: '1 year', termCode: '1Y', days: 365 },
    { min: 6.99, label: '6 months', termCode: '6M', days: 180 },
    { min: 3.99, label: '3 months', termCode: '3M', days: 90 },
    { min: 0.99, label: '1 month', termCode: '1M', days: 30 }
];

export function resolveEntitlement(pricePaid, now = new Date()) {
    const match = ENTITLEMENT_RULES.find((rule) => pricePaid >= rule.min);
    if (!match) {
        throw new Error('Payment amount below minimum threshold');
    }

    if (match.expirationDate) {
        return {
            label: match.label,
            termCode: match.termCode,
            expirationDate: match.expirationDate
        };
    }

    const expirationDate = addDays(now, match.days || 0);
    return {
        label: match.label,
        termCode: match.termCode,
        expirationDate
    };
}

function addDays(date, days) {
    const target = new Date(date);
    target.setUTCDate(target.getUTCDate() + days);
    return target.toISOString().split('T')[0];
}
