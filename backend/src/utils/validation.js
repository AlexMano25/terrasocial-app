function normalizeEmail(value) {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
}

function sanitizeText(value, maxLen = 255) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLen);
}

function sanitizeOptionalText(value, maxLen = 255) {
    const text = sanitizeText(value, maxLen);
    return text.length ? text : null;
}

function parsePositiveInt(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
        return null;
    }
    return num;
}

function isValidPhone(phone) {
    if (typeof phone !== 'string') return false;
    const trimmed = phone.trim();
    return /^[+0-9\s()-]{8,20}$/.test(trimmed);
}

function isStrongPassword(password) {
    if (typeof password !== 'string') return false;
    if (password.length < 10 || password.length > 128) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    return hasUpper && hasLower && hasDigit && hasSpecial;
}

function validateReservationPayload(payload) {
    const lotType = sanitizeText(payload.lot_type, 50);
    const lotPrice = parsePositiveInt(payload.lot_price);
    const duration = parsePositiveInt(payload.duration_months);

    if (!lotType || !lotPrice || !duration) {
        return { ok: false, error: 'Données de réservation invalides' };
    }

    if (![12, 24, 36].includes(duration)) {
        return { ok: false, error: 'Durée non autorisée (12, 24, 36 mois)' };
    }

    return {
        ok: true,
        data: {
            lot_type: lotType,
            lot_price: lotPrice,
            duration_months: duration,
            source: sanitizeOptionalText(payload.source, 80)
        }
    };
}

module.exports = {
    normalizeEmail,
    sanitizeText,
    sanitizeOptionalText,
    parsePositiveInt,
    isValidPhone,
    isStrongPassword,
    validateReservationPayload
};
