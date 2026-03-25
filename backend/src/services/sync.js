const { get, run, all } = require('../db/connection');

// Get the default (or only) active law firm
async function getDefaultLawFirm() {
    return get("SELECT id FROM law_firms WHERE is_active = TRUE LIMIT 1", []);
}

// Get the default (or only) active insurer
async function getDefaultInsurer() {
    return get("SELECT id FROM insurers WHERE is_active = TRUE LIMIT 1", []);
}

// Create a legal review for a reservation (if not exists)
async function ensureLegalReview(userId, reservationId) {
    const firm = await getDefaultLawFirm();
    if (!firm) return null;

    const existing = await get(
        'SELECT id FROM legal_reviews WHERE reservation_id = ? AND firm_id = ?',
        [reservationId, firm.id]
    );
    if (existing) return existing;

    const result = await run(
        `INSERT INTO legal_reviews(firm_id, reservation_id, user_id, review_type, status)
         VALUES (?, ?, ?, 'inscription', 'pending')`,
        [firm.id, reservationId, userId]
    );
    return { id: result.id };
}

// Set insurer_id on a reservation if not already set
async function ensureInsurerLink(reservationId) {
    const res = await get('SELECT insurer_id FROM reservations WHERE id = ?', [reservationId]);
    if (res && res.insurer_id) return res.insurer_id;

    const insurer = await getDefaultInsurer();
    if (!insurer) return null;

    await run('UPDATE reservations SET insurer_id = ? WHERE id = ?', [insurer.id, reservationId]);
    return insurer.id;
}

// Get the correct insurer_id for a reservation
async function getReservationInsurerId(reservationId) {
    const res = await get('SELECT insurer_id FROM reservations WHERE id = ?', [reservationId]);
    if (res && res.insurer_id) return res.insurer_id;
    return await ensureInsurerLink(reservationId);
}

// Sync insured persons: ensure insurer_id is correct on all records for a reservation
async function syncInsuredPersonsInsurerId(reservationId) {
    const insurerId = await getReservationInsurerId(reservationId);
    if (!insurerId) return;

    await run(
        'UPDATE insured_persons_details SET insurer_id = ? WHERE reservation_id = ? AND is_active = TRUE',
        [insurerId, reservationId]
    );
}

// After payment confirmation: update legal invoice tracking
async function onPaymentConfirmed(paymentId, reservationId, userId) {
    // Ensure legal review exists
    await ensureLegalReview(userId, reservationId);

    // Ensure insurer link exists
    await ensureInsurerLink(reservationId);
}

// After reservation creation: create legal review + link insurer
async function onReservationCreated(userId, reservationId) {
    await ensureLegalReview(userId, reservationId);
    await ensureInsurerLink(reservationId);
}

// After insured persons update: sync insurer_id + count
async function onInsuredPersonsUpdated(reservationId) {
    await syncInsuredPersonsInsurerId(reservationId);

    // Update insurance_persons count on reservation
    const count = await get(
        'SELECT COUNT(*) as cnt FROM insured_persons_details WHERE reservation_id = ? AND is_active = TRUE',
        [reservationId]
    );
    if (count) {
        await run('UPDATE reservations SET insurance_persons = ? WHERE id = ?', [Number(count.cnt), reservationId]);
    }
}

module.exports = {
    ensureLegalReview,
    ensureInsurerLink,
    getReservationInsurerId,
    syncInsuredPersonsInsurerId,
    onPaymentConfirmed,
    onReservationCreated,
    onInsuredPersonsUpdated,
    getDefaultLawFirm,
    getDefaultInsurer
};
