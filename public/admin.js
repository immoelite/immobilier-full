
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('immoelite_token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur');
    return data;
}

function formatPrice(n) { return new Intl.NumberFormat('fr-DZ').format(n) + ' DZ'; }
function showToast(msg, err) {
    const t = document.getElementById('toast'); document.getElementById('toastMsg').textContent = msg;
    t.style.background = err ? 'var(--red)' : 'var(--accent)'; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    loadAdminStats();
});

async function checkAdminAuth() {
    try {
        const user = await api('/api/profile');
        if (user.role !== 'admin') { window.location.href = '/'; return; }
    } catch (e) { window.location.href = '/'; }
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(el => el.style.display = 'none');
    document.getElementById('tab-' + tab).style.display = 'block';
    document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
    event.target.closest('a').classList.add('active');
    if (tab === 'dashboard') loadAdminStats();
    if (tab === 'properties') loadAdminProperties();
    if (tab === 'payments') loadAdminPayments();
    if (tab === 'users') loadAdminUsers();
    if (tab === 'contacts') loadAdminContacts();
    if (tab === 'settings') loadAdminSettings();
}

async function loadAdminStats() {
    try {
        const stats = await api('/api/stats');
        document.getElementById('sTotalProps').textContent = stats.properties?.total || 0;
        document.getElementById('sActiveProps').textContent = stats.properties?.active || 0;
        document.getElementById('sTotalUsers').textContent = stats.users?.total || 0;
        document.getElementById('sRevenue').textContent = formatPrice(stats.payments?.total_revenue || 0);
        document.getElementById('sCommVente').textContent = formatPrice(stats.payments?.commission_vente_total || 0);
        document.getElementById('sCommLoc').textContent = formatPrice(stats.payments?.commission_location_total || 0);
    } catch (e) { showToast('Erreur stats', true); }
}

async function loadAdminProperties() {
    try {
        const props = await api('/api/admin/properties');
        const body = document.getElementById('adminPropsBody');
        if (!props.length) { body.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucune annonce</td></tr>'; return; }
        body.innerHTML = props.map(p => {
            const sc = p.status === 'active' ? 'status-active' : p.status === 'pending' ? 'status-pending' : 'status-rejected';
            return '<tr><td>' + p.id + '</td><td>' + p.title + '</td><td>' + p.type + '</td><td>' + formatPrice(p.price) + '</td><td>' + p.wilaya + '</td><td>' + p.owner_name + '</td><td><span class="status-badge ' + sc + '">' + p.status + '</span></td><td><button class="btn-sm btn-confirm" onclick="adminToggleProp(' + p.id + ',\'active\')"><i class="fas fa-check"></i></button> <button class="btn-sm btn-delete" onclick="adminDeleteProp(' + p.id + ')"><i class="fas fa-trash"></i></button></td></tr>';
        }).join('');
    } catch (e) { showToast('Erreur', true); }
}

async function adminToggleProp(id, status) {
    try {
        await api('/api/properties/' + id, { method: 'PUT', body: JSON.stringify({ status }) });
        showToast('Statut mis à jour');
        loadAdminProperties();
    } catch (e) { showToast('Erreur', true); }
}

async function adminDeleteProp(id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    try {
        await api('/api/properties/' + id, { method: 'DELETE' });
        showToast('Supprimé');
        loadAdminProperties();
    } catch (e) { showToast('Erreur', true); }
}

async function loadAdminPayments() {
    try {
        const payments = await api('/api/payments');
        const body = document.getElementById('adminPaysBody');
        if (!payments.length) { body.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun paiement</td></tr>'; return; }
        body.innerHTML = payments.map(p => {
            const sc = p.status === 'confirmed' ? 'status-confirmed' : p.status === 'pending' ? 'status-pending' : 'status-rejected';
            const typeLabel = p.type === 'publication' ? 'Publication' : p.type === 'commission_vente' ? 'Comm. vente' : 'Comm. location';
            const actions = p.status === 'pending' ?
                '<button class="btn-sm btn-confirm" onclick="confirmPay(' + p.id + ',\'confirmed\')"><i class="fas fa-check"></i></button> <button class="btn-sm btn-reject" onclick="confirmPay(' + p.id + ',\'rejected\')"><i class="fas fa-times"></i></button>' :
                '<span class="status-badge ' + sc + '">' + p.status + '</span>';
            return '<tr><td>' + p.id + '</td><td>' + p.user_name + '</td><td>' + typeLabel + '</td><td>' + formatPrice(p.amount) + '</td><td>' + (p.property_title || '-') + '</td><td>' + (p.reference || '-') + '</td><td>' + actions + '</td></tr>';
        }).join('');
    } catch (e) { showToast('Erreur', true); }
}

async function confirmPay(id, status) {
    try {
        await api('/api/payments/' + id + '/confirm', { method: 'POST', body: JSON.stringify({ status }) });
        showToast(status === 'confirmed' ? 'Paiement confirmé !' : 'Paiement rejeté');
        loadAdminPayments();
        loadAdminStats();
    } catch (e) { showToast('Erreur', true); }
}

async function loadAdminUsers() {
    try {
        // Reuse stats and properties data
        const body = document.getElementById('adminUsersBody');
        body.innerHTML = '<tr><td colspan="7" class="admin-empty">Gestion utilisateurs via la base de données SQLite</td></tr>';
    } catch (e) { showToast('Erreur', true); }
}

async function loadAdminContacts() {
    try {
        const contacts = await api('/api/admin/contacts');
        const body = document.getElementById('adminContactsBody');
        if (!contacts.length) { body.innerHTML = '<tr><td colspan="5" class="admin-empty">Aucun message</td></tr>'; return; }
        body.innerHTML = contacts.map(c =>
            '<tr><td>' + new Date(c.created_at).toLocaleDateString('fr') + '</td><td>' + c.name + '</td><td>' + c.email + '</td><td>' + (c.subject || '-') + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">' + c.message + '</td></tr>'
        ).join('');
    } catch (e) { showToast('Erreur', true); }
}

async function loadAdminSettings() {
    try {
        const s = await api('/api/settings');
        document.getElementById('setCommVente').value = s.commission_vente || 2;
        document.getElementById('setCommLocation').value = s.commission_location || 5000;
        document.getElementById('setFraisPub').value = s.frais_publication || 1000;
        document.getElementById('setRip').value = s.baridimob_rip || '';
        document.getElementById('setWhatsapp').value = s.admin_whatsapp || '';
    } catch (e) { showToast('Erreur', true); }
}

async function saveSettings() {
    try {
        await api('/api/settings', {
            method: 'PUT',
            body: JSON.stringify({
                commission_vente: document.getElementById('setCommVente').value,
                commission_location: document.getElementById('setCommLocation').value,
                frais_publication: document.getElementById('setFraisPub').value,
                baridimob_rip: document.getElementById('setRip').value,
                admin_whatsapp: document.getElementById('setWhatsapp').value
            })
        });
        showToast('Paramètres sauvegardés !');
    } catch (e) { showToast('Erreur', true); }
}

function logout() {
    localStorage.removeItem('immoelite_token');
    window.location.href = '/';
}
