const {
    escapeHtml,
    sanitizeText,
    sanitizeRawText,
    isStrongPassword,
    isValidPhone,
    normalizeEmail,
    parsePositiveInt,
    generateTempPassword,
    validateReservationPayload
} = require('../src/utils/validation');

describe('escapeHtml', () => {
    test('escapes HTML special characters', () => {
        expect(escapeHtml('<script>alert("xss")</script>')).toBe(
            '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
        );
    });

    test('escapes ampersand', () => {
        expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    test('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    test('returns empty string for non-string', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
        expect(escapeHtml(123)).toBe('');
    });

    test('returns empty string for empty input', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('does not modify safe strings', () => {
        expect(escapeHtml('hello world 123')).toBe('hello world 123');
    });
});

describe('sanitizeText', () => {
    test('trims and escapes', () => {
        expect(sanitizeText('  <b>test</b>  ')).toBe('&lt;b&gt;test&lt;/b&gt;');
    });

    test('truncates to maxLen', () => {
        const long = 'a'.repeat(300);
        expect(sanitizeText(long, 10)).toBe('a'.repeat(10));
    });

    test('returns empty for non-string', () => {
        expect(sanitizeText(null)).toBe('');
    });
});

describe('sanitizeRawText', () => {
    test('trims and truncates without escaping', () => {
        expect(sanitizeRawText('  <b>test</b>  ', 20)).toBe('<b>test</b>');
    });
});

describe('isStrongPassword', () => {
    test('rejects short password', () => {
        expect(isStrongPassword('Abc1!')).toBe(false);
    });

    test('rejects password without uppercase', () => {
        expect(isStrongPassword('abcdefghij1!')).toBe(false);
    });

    test('rejects password without digit', () => {
        expect(isStrongPassword('Abcdefghij!')).toBe(false);
    });

    test('rejects password without special char', () => {
        expect(isStrongPassword('Abcdefghij1')).toBe(false);
    });

    test('accepts strong password', () => {
        expect(isStrongPassword('Abcdefgh1j!')).toBe(true);
    });

    test('rejects non-string', () => {
        expect(isStrongPassword(null)).toBe(false);
    });
});

describe('isValidPhone', () => {
    test('accepts valid Cameroon phone', () => {
        expect(isValidPhone('+237651982878')).toBe(true);
    });

    test('accepts phone without +', () => {
        expect(isValidPhone('651982878')).toBe(true);
    });

    test('rejects too short', () => {
        expect(isValidPhone('123')).toBe(false);
    });

    test('rejects non-string', () => {
        expect(isValidPhone(null)).toBe(false);
    });
});

describe('normalizeEmail', () => {
    test('lowercases and trims', () => {
        expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    });

    test('returns empty for non-string', () => {
        expect(normalizeEmail(null)).toBe('');
    });
});

describe('parsePositiveInt', () => {
    test('parses valid positive integer', () => {
        expect(parsePositiveInt('42')).toBe(42);
    });

    test('returns null for zero', () => {
        expect(parsePositiveInt(0)).toBeNull();
    });

    test('returns null for negative', () => {
        expect(parsePositiveInt(-5)).toBeNull();
    });

    test('returns null for float', () => {
        expect(parsePositiveInt(3.5)).toBeNull();
    });
});

describe('generateTempPassword', () => {
    test('starts with TS-', () => {
        expect(generateTempPassword()).toMatch(/^TS-/);
    });

    test('is sufficiently long', () => {
        expect(generateTempPassword().length).toBeGreaterThan(10);
    });

    test('generates different values', () => {
        const p1 = generateTempPassword();
        const p2 = generateTempPassword();
        expect(p1).not.toBe(p2);
    });
});

describe('validateReservationPayload', () => {
    test('validates correct payload', () => {
        const result = validateReservationPayload({
            lot_type: 'standard',
            lot_price: 1300000,
            duration_months: 24
        });
        expect(result.ok).toBe(true);
        expect(result.data.lot_type).toBeDefined();
        expect(result.data.lot_price).toBe(1300000);
    });

    test('rejects missing lot_type', () => {
        const result = validateReservationPayload({
            lot_price: 1300000,
            duration_months: 24
        });
        expect(result.ok).toBe(false);
    });

    test('rejects invalid duration', () => {
        const result = validateReservationPayload({
            lot_type: 'standard',
            lot_price: 1300000,
            duration_months: 200
        });
        expect(result.ok).toBe(false);
    });
});
