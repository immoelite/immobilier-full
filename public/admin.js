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

const statusLabels = {
    pending: 'En attente', active: 'Active', sold: 'Vendue',
    rented: 'Louée', expired: 'Expirée', rejected: 'Rejetée'
};
const statusClasses = {
    pending: 'status-pending', active: 'status-active', sold: 'status-sold',
    rented: 'status-rented', expired: 'status-expired', rejected: 'status-rejected'
};

const typeLabels = {
    vente: 'Vente', location: 'Location'
};
const categoryLabels = {
    appartement: 'Appartement', villa: 'Villa', terrain: 'Terrain',
    commercial: 'Commercial', garage: 'Garage'
};

let currentPropData = null;

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

// ========== DASHBOARD ==========
async function loadAdminStats() {
    try {
        const stats = await api('/api/stats');
        document.getElementById('sTotalProps').textContent = stats.properties?.total || 0;
        document.getElementById('sActiveProps').textContent = stats.properties?.active || 0;
        document.getElementById('sPendingProps').textContent = stats.properties?.pending || 0;
        document.getElementById('sTotalUsers').textContent = stats.users?.total || 0;
        document.getElementById('sRevenue').textContent = formatPrice(stats.payments?.total_revenue || 0);
        document.getElementById('sCommVente').textContent = formatPrice(stats.payments?.commission_vente_total || 0);
        document.getElementById('sCommLoc').textContent = formatPrice(stats.payments?.commission_location_total || 0);
        document.getElementById('sTotalViews').textContent = stats.properties?.total_views || 0;
    } catch (e) { showToast('Erreur stats', true); }
}

// ========== PROPERTIES ==========
async function loadAdminProperties() {
    try {
        const props = await api('/api/admin/properties');
        const statusFilter = document.getElementById('filterPropStatus')?.value || '';
        let filtered = props;
        if (statusFilter) filtered = props.filter(p => p.status === statusFilter);
        
        const body = document.getElementById('adminPropsBody');
        if (!filtered.length) { body.innerHTML = '<tr><td colspan="11" class="admin-empty">Aucune annonce</td></tr>'; return; }
        body.innerHTML = filtered.map(p => {
            const sc = statusClasses[p.status] || 'status-pending';
            const sl = statusLabels[p.status] || p.status;
            const featIcon = p.featured ? '⭐ Oui' : '—';
            return '<tr>' +
                '<td>' + p.id + '</td>' +
                '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.title + '</td>' +
                '<td>' + (typeLabels[p.type] || p.type) + '</td>' +
                '<td>' + formatPrice(p.price) + '</td>' +
                '<td>' + p.wilaya + '</td>' +
                '<td>' + p.owner_name + '<br><small style="color:#aaa">' + (p.owner_phone || '') + '</small></td>' +
                '<td>' + ((p.contact_phone || p.display_phone || p.owner_phone || '') + (p.contact_phone && p.contact_phone !== p.owner_phone ? ' 🏢' : '')) + '</td>' +
                '<td>' + (p.views || 0) + '</td>' +
                '<td><span class="status-badge ' + sc + '">' + sl + '</span></td>' +
                '<td>' + featIcon + '</td>' +
                '<td>' +
                    '<button class="btn-sm btn-edit" onclick="openEditProperty(' + p.id + ')" title="Modifier"><i class="fas fa-edit"></i></button> ' +
                    '<button class="btn-sm btn-confirm" onclick="adminToggleProp(' + p.id + ',\'active\')" title="Activer"><i class="fas fa-check"></i></button> ' +
                    '<button class="btn-sm btn-reject" onclick="adminToggleProp(' + p.id + ',\'rejected\')" title="Rejeter"><i class="fas fa-ban"></i></button> ' +
                    '<button class="btn-sm btn-featured" onclick="adminToggleFeatured(' + p.id + ',' + (p.featured ? 0 : 1) + ')" title="Vedette"><i class="fas fa-star"></i></button> ' +
                    '<button class="btn-sm btn-delete" onclick="adminDeleteProp(' + p.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>' +
                '</td></tr>';
        }).join('');
    } catch (e) { showToast('Erreur chargement annonces', true); }
}

async function openEditProperty(id) {
    try {
        const prop = await api('/api/properties/' + id);
        if (!prop) { showToast('Annonce introuvable', true); return; }
        currentPropData = prop;
        document.getElementById('editPropId').value = prop.id;
        document.getElementById('editTitle').value = prop.title;
        document.getElementById('editPrice').value = prop.price;
        document.getElementById('editType').value = prop.type;
        document.getElementById('editCategory').value = prop.category;
        // Set wilaya select
        const wilayaSelect = document.getElementById('editWilaya');
        const options = wilayaSelect.options;
        let found = false;
        for (let i = 0; i < options.length; i++) {
            if (options[i].text === prop.wilaya || options[i].value === prop.wilaya) {
                wilayaSelect.selectedIndex = i; found = true; break;
            }
        }
        if (!found) wilayaSelect.selectedIndex = 0;
        document.getElementById('editCommune').value = prop.commune || '';
        document.getElementById('editAddress').value = prop.address || '';
        document.getElementById('editSurface').value = prop.surface;
        document.getElementById('editRooms').value = prop.rooms || 0;
        document.getElementById('editBathrooms').value = prop.bathrooms || 0;
        document.getElementById('editParking').value = prop.parking || 'non';
        document.getElementById('editCondition').value = prop.condition || 'bon';
        document.getElementById('editAge').value = prop.age || 0;
        document.getElementById('editOwnerPhone').value = prop.owner_phone || '';
        document.getElementById('editContactPhone').value = prop.contact_phone || '';
        document.getElementById('editDescription').value = prop.description || '';
        document.getElementById('editStatus').value = prop.status;
        document.getElementById('editFeatured').value = prop.featured ? '1' : '0';
        document.getElementById('editPropModal').style.display = 'block';
    } catch (e) { showToast('Erreur chargement annonce', true); }
}

function closeEditModal() {
    document.getElementById('editPropModal').style.display = 'none';
}

async function loadPlatformPhone() {
    try {
        const s = await api('/api/settings');
        if (s.admin_whatsapp) {
            document.getElementById('editContactPhone').value = '0' + s.admin_whatsapp.replace(/^213/, '');
        }
    } catch (e) { showToast('Erreur chargement numéro plateforme', true); }
}

async function saveEditProperty() {
    const id = document.getElementById('editPropId').value;
    try {
        const body = {
            title: document.getElementById('editTitle').value,
            price: parseInt(document.getElementById('editPrice').value),
            type: document.getElementById('editType').value,
            category: document.getElementById('editCategory').value,
            wilaya: document.getElementById('editWilaya').selectedOptions[0]?.text || '',
            commune: document.getElementById('editCommune').value,
            address: document.getElementById('editAddress').value,
            surface: parseInt(document.getElementById('editSurface').value),
            rooms: parseInt(document.getElementById('editRooms').value),
            bathrooms: parseInt(document.getElementById('editBathrooms').value),
            parking: document.getElementById('editParking').value,
            condition: document.getElementById('editCondition').value,
            age: parseInt(document.getElementById('editAge').value),
            owner_phone: document.getElementById('editOwnerPhone').value,
            contact_phone: document.getElementById('editContactPhone').value,
            description: document.getElementById('editDescription').value,
            status: document.getElementById('editStatus').value,
            featured: parseInt(document.getElementById('editFeatured').value),
            images: currentPropData?.images || []
        };
        await api('/api/properties/' + id, { method: 'PUT', body: JSON.stringify(body) });
        showToast('Annonce modifiée avec succès !');
        closeEditModal();
        loadAdminProperties();
    } catch (e) { showToast('Erreur modification', true); }
}

async function adminToggleProp(id, status) {
    try {
        await api('/api/properties/' + id, { method: 'PUT', body: JSON.stringify({ status, images: [] }) });
        showToast('Statut changé : ' + statusLabels[status]);
        loadAdminProperties();
    } catch (e) { showToast('Erreur', true); }
}

async function adminToggleFeatured(id, val) {
    try {
        await api('/api/properties/' + id, { method: 'PUT', body: JSON.stringify({ featured: val, images: [] }) });
        showToast(val ? 'Annonce mise en vedette ⭐' : 'Vedette retirée');
        loadAdminProperties();
    } catch (e) { showToast('Erreur', true); }
}

async function adminDeleteProp(id) {
    if (!confirm('⚠️ Supprimer définitivement cette annonce ?')) return;
    try {
        await api('/api/properties/' + id, { method: 'DELETE' });
        showToast('Annonce supprimée');
        loadAdminProperties();
        loadAdminStats();
    } catch (e) { showToast('Erreur suppression', true); }
}

// ========== ADMIN ADD PROPERTY ==========
function openAddPropertyModal() {
    document.getElementById('addPropModal').style.display = 'block';
}
function closeAddPropertyModal() {
    document.getElementById('addPropModal').style.display = 'none';
}

async function submitAdminProperty() {
    const title = document.getElementById('addTitle').value.trim();
    const price = parseInt(document.getElementById('addPrice').value);
    const surface = parseInt(document.getElementById('addSurface').value);
    const description = document.getElementById('addDescription').value.trim();
    const wilaya = document.getElementById('addWilaya').selectedOptions[0]?.text || '';
    if (!title || !price || !surface || !description || !wilaya) {
        showToast('Remplissez les champs obligatoires (titre, prix, surface, description, wilaya)', true);
        return;
    }
    try {
        const formData = new FormData();
        formData.append('type', document.getElementById('addType').value);
        formData.append('category', document.getElementById('addCategory').value);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('price', price);
        formData.append('wilaya', wilaya);
        formData.append('commune', document.getElementById('addCommune').value);
        formData.append('address', document.getElementById('addAddress').value);
        formData.append('surface', surface);
        formData.append('rooms', document.getElementById('addRooms').value || '0');
        formData.append('bathrooms', document.getElementById('addBathrooms').value || '0');
        formData.append('condition', document.getElementById('addCondition').value);
        formData.append('age', document.getElementById('addAge').value || '0');
        formData.append('parking', document.getElementById('addParking').value);
        formData.append('contact_phone', document.getElementById('addContactPhone').value);
        formData.append('status', document.getElementById('addStatus').value);
        formData.append('featured', document.getElementById('addFeatured').value);
        const files = document.getElementById('addImages').files;
        for (let i = 0; i < files.length; i++) formData.append('images', files[i]);
        const token = localStorage.getItem('immoelite_token');
        const res = await fetch('/api/admin/properties', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        showToast('Annonce créée avec succès !');
        closeAddPropertyModal();
        loadAdminProperties();
        loadAdminStats();
        // Reset form
        document.getElementById('addTitle').value = '';
        document.getElementById('addDescription').value = '';
        document.getElementById('addPrice').value = '';
        document.getElementById('addSurface').value = '';
    } catch (e) { showToast(e.message, true); }
}

// ========== PAYMENTS ==========
async function loadAdminPayments() {
    try {
        const payments = await api('/api/payments');
        const body = document.getElementById('adminPaysBody');
        if (!payments.length) { body.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun paiement</td></tr>'; return; }
        body.innerHTML = payments.map(p => {
            const sc = p.status === 'confirmed' ? 'status-active' : p.status === 'pending' ? 'status-pending' : 'status-rejected';
            const sl = p.status === 'confirmed' ? 'Confirmé' : p.status === 'pending' ? 'En attente' : 'Rejeté';
            const typeLabel = p.type === 'publication' ? 'Publication' : p.type === 'commission_vente' ? 'Comm. vente' : 'Comm. location';
            const actions = p.status === 'pending' ?
                '<button class="btn-sm btn-confirm" onclick="confirmPay(' + p.id + ',\'confirmed\')" title="Confirmer"><i class="fas fa-check"></i></button> ' +
                '<button class="btn-sm btn-reject" onclick="confirmPay(' + p.id + ',\'rejected\')" title="Rejeter"><i class="fas fa-times"></i></button>' :
                '<span class="status-badge ' + sc + '">' + sl + '</span>';
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

// ========== USERS ==========
async function loadAdminUsers() {
    try {
        const users = await api('/api/admin/users');
        const body = document.getElementById('adminUsersBody');
        if (!users.length) { body.innerHTML = '<tr><td colspan="8" class="admin-empty">Aucun utilisateur</td></tr>'; return; }
        body.innerHTML = users.map(u => {
            const roleBadge = u.role === 'admin' ? '<span class="status-badge status-active">Admin</span>' : '<span class="status-badge status-pending">Utilisateur</span>';
            return '<tr>' +
                '<td>' + u.id + '</td>' +
                '<td>' + u.name + '</td>' +
                '<td>' + u.email + '</td>' +
                '<td>' + u.phone + '</td>' +
                '<td>' + (u.baridimob_rip || '—') + '</td>' +
                '<td>' + roleBadge + '</td>' +
                '<td>' + new Date(u.created_at).toLocaleDateString('fr') + '</td>' +
                '<td>' +
                    (u.role !== 'admin' ?
                        '<button class="btn-sm btn-edit" onclick="toggleUserRole(' + u.id + ',\'admin\')" title="Rendre admin"><i class="fas fa-user-shield"></i></button> ' +
                        '<button class="btn-sm btn-delete" onclick="deleteUser(' + u.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button>'
                        : '<small style="color:#aaa">—</small>') +
                '</td></tr>';
        }).join('');
    } catch (e) { showToast('Erreur chargement utilisateurs', true); }
}

async function toggleUserRole(id, role) {
    if (!confirm('Changer le rôle de cet utilisateur ?')) return;
    try {
        await api('/api/admin/users/' + id + '/role', { method: 'PUT', body: JSON.stringify({ role }) });
        showToast('Rôle modifié !');
        loadAdminUsers();
    } catch (e) { showToast('Erreur', true); }
}

async function deleteUser(id) {
    if (!confirm('⚠️ Supprimer cet utilisateur et toutes ses annonces ?')) return;
    try {
        await api('/api/admin/users/' + id, { method: 'DELETE' });
        showToast('Utilisateur supprimé');
        loadAdminUsers();
        loadAdminStats();
    } catch (e) { showToast('Erreur suppression', true); }
}

// ========== CONTACTS ==========
async function loadAdminContacts() {
    try {
        const contacts = await api('/api/admin/contacts');
        const body = document.getElementById('adminContactsBody');
        if (!contacts.length) { body.innerHTML = '<tr><td colspan="7" class="admin-empty">Aucun message</td></tr>'; return; }
        body.innerHTML = contacts.map(c =>
            '<tr><td>' + new Date(c.created_at).toLocaleDateString('fr') + '</td><td>' + c.name + '</td><td>' + c.email + '</td><td>' + (c.phone || '—') + '</td><td>' + (c.subject || '—') + '</td><td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">' + c.message + '</td><td><button class="btn-sm btn-delete" onclick="deleteContact(' + c.id + ')" title="Supprimer"><i class="fas fa-trash"></i></button></td></tr>'
        ).join('');
    } catch (e) { showToast('Erreur', true); }
}

async function deleteContact(id) {
    if (!confirm('Supprimer ce message ?')) return;
    try {
        await api('/api/admin/contacts/' + id, { method: 'DELETE' });
        showToast('Message supprimé');
        loadAdminContacts();
    } catch (e) { showToast('Erreur', true); }
}

// ========== SETTINGS ==========
async function loadAdminSettings() {
    try {
        const s = await api('/api/settings');
        document.getElementById('setCommVente').value = s.commission_vente || 2;
        document.getElementById('setCommLocation').value = s.commission_location || 5000;
        document.getElementById('setFraisPub').value = s.frais_publication || 1000;
        document.getElementById('setRip').value = s.baridimob_rip || '';
        document.getElementById('setWhatsapp').value = s.admin_whatsapp || '';
        document.getElementById('setSiteName').value = s.site_name || 'ImmoElite';
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
                admin_whatsapp: document.getElementById('setWhatsapp').value,
                site_name: document.getElementById('setSiteName').value
            })
        });
        showToast('Paramètres sauvegardés !');
    } catch (e) { showToast('Erreur', true); }
}

function logout() {
    localStorage.removeItem('immoelite_token');
    window.location.href = '/';
}