// ============================================================
// ImmoElite — Admin Script (Updated with all 8 changes)
// ============================================================

let token = localStorage.getItem('immoelite_token');
let settingsCache = {};
let contactsCache = [];
let editingId = null;
let editingUserId = null;
let editingFormFieldId = null;
let editingContentBlockId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!token) { window.location.href = '/'; return; }
    loadDashboard();
    loadSettings();
});

// ============================================================
// TAB NAVIGATION
// ============================================================
function showTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const tabId = 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const el = document.getElementById(tabId);
    if (el) el.style.display = '';
    const navId = 'nav' + tab.charAt(0).toUpperCase() + tab.slice(1);
    const nav = document.getElementById(navId);
    if (nav) nav.classList.add('active');
    const titles = {
        dashboard: 'Tableau de bord', properties: 'Annonces', payments: 'Paiements',
        estimations: 'Demandes estimation', users: 'Utilisateurs', admins: 'Administrateurs',
        contacts: 'Messages', promotions: 'Promotions', banners: 'Bannieres',
        formfields: 'Champs formulaire', content: 'Blocs contenu', settings: 'Parametres'
    };
    const icons = {
        dashboard: 'tachometer-alt', properties: 'home', payments: 'credit-card',
        estimations: 'calculator', users: 'users', admins: 'user-shield',
        contacts: 'envelope', promotions: 'briefcase', banners: 'ad',
        formfields: 'wpforms', content: 'newspaper', settings: 'cog'
    };
    document.getElementById('pageTitle').innerHTML = '<i class="fas fa-' + (icons[tab]||'cog') + '"></i> ' + (titles[tab]||tab);
    document.getElementById('breadcrumb').textContent = 'Accueil / ' + (titles[tab]||tab);
    // Load data for tab
    if (tab === 'properties') loadAdminProperties();
    if (tab === 'payments') loadAdminPayments();
    if (tab === 'estimations') loadAdminEstimations();
    if (tab === 'users') loadAdminUsers();
    if (tab === 'admins') loadAdminAdmins();
    if (tab === 'contacts') loadAdminContacts();
    if (tab === 'promotions') loadAdminPromotions();
    if (tab === 'banners') loadAdminBanners();
    if (tab === 'formfields') loadFormFields();
    if (tab === 'content') loadContentBlocks();
}

function toggleSidebar() {
    document.getElementById('adminSidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettings() {
    fetch('/api/settings', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(s => {
            settingsCache = s;
            applySettings(s);
        })
        .catch(() => {});
}

function applySettings(s) {
    if (s.primary_color) document.getElementById('setColorPrimary').value = s.primary_color;
    if (s.primary_color) document.getElementById('setColorPrimaryHex').value = s.primary_color;
    if (s.secondary_color) document.getElementById('setColorSecondary').value = s.secondary_color;
    if (s.secondary_color) document.getElementById('setColorSecondaryHex').value = s.secondary_color;
    if (s.accent_color) document.getElementById('setColorAccent').value = s.accent_color;
    if (s.accent_color) document.getElementById('setColorAccentHex').value = s.accent_color;
    if (s.red_color) document.getElementById('setColorRed').value = s.red_color;
    if (s.red_color) document.getElementById('setColorRedHex').value = s.red_color;
    if (s.hero_title) document.getElementById('setHeroTitle').value = s.hero_title;
    if (s.hero_subtitle) document.getElementById('setHeroSubtitle').value = s.hero_subtitle;
    if (s.steps_soft_text) document.getElementById('setStepsText').value = s.steps_soft_text || '';
    if (s.gestion_text) document.getElementById('setGestionText').value = s.gestion_text || '';
    if (s.estimation_auto_reply) document.getElementById('setEstAutoReply').value = s.estimation_auto_reply || '';
    if (s.default_language) document.getElementById('setDefaultLang').value = s.default_language || 'fr';
    if (s.baridimob_rip) { document.getElementById('setRip').value = s.baridimob_rip; document.getElementById('ripDisplay').textContent = s.baridimob_rip; }
    if (s.frais_publication) document.getElementById('setFraisPublication').value = s.frais_publication;
    if (s.commission_vente) document.getElementById('setCommissionVente').value = s.commission_vente;
    if (s.commission_location) document.getElementById('setCommissionLocation').value = s.commission_location;
    if (s.whatsapp_number) document.getElementById('setWhatsapp').value = s.whatsapp_number;
    // Toggles
    const toggles = {
        toggleSteps: s.section_steps_visible,
        toggleCommissions: s.section_commissions_visible,
        toggleEstimation: s.section_estimation_visible,
        toggleGestion: s.section_gestion_visible,
        toggleTestimonials: s.section_testimonials_visible,
        toggleContact: s.section_contact_visible,
        togglePromos: s.section_promos_visible,
        toggleTarifs: s.section_tarifs_visible,
        toggleMaintenance: s.maintenance_mode
    };
    Object.entries(toggles).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', val === '1' || val === true);
    });
}

function showSettingsSection(section) {
    document.querySelectorAll('.settings-panel').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('spanel' + section.charAt(0).toUpperCase() + section.slice(1)).style.display = 'block';
    document.getElementById('snav' + section.charAt(0).toUpperCase() + section.slice(1)).classList.add('active');
}

function toggleSwitch(el, key) {
    el.classList.toggle('active');
    settingsCache[key] = el.classList.contains('active') ? '1' : '0';
}

function livePreviewColor(varName, value) {
    document.documentElement.style.setProperty('--' + varName, value);
    const hexInput = document.getElementById('setColor' + varName.charAt(0).toUpperCase() + varName.slice(1) + 'Hex');
    if (hexInput) hexInput.value = value;
}

function syncColor(varName, value) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
        document.documentElement.style.setProperty('--' + varName, value);
        const colorInput = document.getElementById('setColor' + varName.charAt(0).toUpperCase() + varName.slice(1));
        if (colorInput) colorInput.value = value;
    }
}

function saveAppearance() {
    const data = {
        primary_color: document.getElementById('setColorPrimary').value,
        secondary_color: document.getElementById('setColorSecondary').value,
        accent_color: document.getElementById('setColorAccent').value,
        red_color: document.getElementById('setColorRed').value
    };
    fetch('/api/settings', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(() => {
            const bgFile = document.getElementById('setBackgroundImage').files[0];
            if (bgFile) {
                const fd = new FormData();
                fd.append('image', bgFile);
                return fetch('/api/admin/upload-bg', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: fd }).then(r => r.json());
            }
        })
        .then(() => { showToast('Apparence enregistree !'); loadSettings(); })
        .catch(() => showToast('Erreur', 'error'));
}

function saveContent() {
    const data = {
        hero_title: document.getElementById('setHeroTitle').value,
        hero_subtitle: document.getElementById('setHeroSubtitle').value,
        steps_soft_text: document.getElementById('setStepsText').value,
        gestion_text: document.getElementById('setGestionText').value,
        estimation_auto_reply: document.getElementById('setEstAutoReply').value,
        default_language: document.getElementById('setDefaultLang').value,
        section_tarifs_visible: settingsCache.section_tarifs_visible || '0'
    };
    fetch('/api/settings', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => showToast('Contenu enregistre !'))
        .catch(() => showToast('Erreur', 'error'));
}

function savePayment() {
    const data = {
        baridimob_rip: document.getElementById('setRip').value,
        frais_publication: document.getElementById('setFraisPublication').value,
        commission_vente: document.getElementById('setCommissionVente').value,
        commission_location: document.getElementById('setCommissionLocation').value,
        whatsapp_number: document.getElementById('setWhatsapp').value
    };
    fetch('/api/settings', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { showToast('Paiement enregistre !'); document.getElementById('ripDisplay').textContent = data.baridimob_rip; })
        .catch(() => showToast('Erreur', 'error'));
}

function saveToggles() {
    const data = {
        section_steps_visible: settingsCache.section_steps_visible || '1',
        section_commissions_visible: settingsCache.section_commissions_visible || '1',
        section_estimation_visible: settingsCache.section_estimation_visible || '1',
        section_gestion_visible: settingsCache.section_gestion_visible || '1',
        section_testimonials_visible: settingsCache.section_testimonials_visible || '1',
        section_contact_visible: settingsCache.section_contact_visible || '1',
        section_promos_visible: settingsCache.section_promos_visible || '1'
    };
    fetch('/api/settings', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => showToast('Sections enregistrees !'))
        .catch(() => showToast('Erreur', 'error'));
}

function saveMaintenance() {
    const data = { maintenance_mode: settingsCache.maintenance_mode || '0' };
    fetch('/api/settings', { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => showToast('Maintenance enregistree !'))
        .catch(() => showToast('Erreur', 'error'));
}

function changeAdminEmail() {
    const data = { new_email: document.getElementById('setNewEmail').value, current_password: document.getElementById('setCurPwdEmail').value };
    fetch('/api/admin/change-email', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { if (d.error) alert(d.error); else showToast('Email change !'); })
        .catch(() => showToast('Erreur', 'error'));
}

function changeAdminPassword() {
    const data = { new_password: document.getElementById('setNewPwd').value, current_password: document.getElementById('setCurPwdPass').value };
    fetch('/api/admin/change-password', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { if (d.error) alert(d.error); else showToast('Mot de passe change !'); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// DASHBOARD
// ============================================================
function loadDashboard() {
    fetch('/api/admin/dashboard', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(s => {
            const cards = document.querySelectorAll('.stat-value');
            cards[0].textContent = (s.properties && s.properties.total) || 0;
            cards[1].textContent = (s.users && s.users.total) || 0;
            cards[2].textContent = ((s.payments && s.payments.total_revenue) || 0).toLocaleString('fr') + ' DZ';
            cards[3].textContent = (s.contacts && s.contacts.total) || 0;
            cards[4].textContent = (s.promotions && s.promotions.total) || 0;
            cards[5].textContent = (s.estimationRequests && s.estimationRequests.total) || 0;
        })
        .catch(err => { console.error('Dashboard error:', err); });
    loadRecentPayments();
    loadRecentProperties();
}

function loadRecentPayments() {
    fetch('/api/payments', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(pays => {
            const tbody = document.getElementById('recentPaymentsBody');
            if (!pays || !pays.length) { tbody.innerHTML = '<tr><td colspan="5" class="admin-empty">Aucun paiement</td></tr>'; return; }
            const recent = pays.slice(0, 5);
            tbody.innerHTML = recent.map(p => '<tr><td>' + new Date(p.created_at).toLocaleDateString('fr') + '</td><td>' + (p.user_name||'--') + '</td><td>' + p.amount + ' DZ</td><td><span class="badge badge-' + p.status + '">' + p.status + '</span></td><td><button class="btn-sm" onclick="confirmPayment(' + p.id + ')">Confirmer</button></td></tr>').join('');
        })
        .catch(err => { console.error('Recent payments error:', err); });
}

function loadRecentProperties() {
    fetch('/api/admin/properties', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(props => {
            const body = document.getElementById('recentPropsBody');
            const recent = props.slice(0, 5);
            body.innerHTML = recent.map(p => '<div class="recent-item"><span class="ri-title">' + p.title + '</span><span class="ri-price">' + (p.price||0).toLocaleString('fr') + ' DZ</span><span class="ri-status">' + p.status + '</span></div>').join('') || '<div class="admin-empty">Aucune annonce</div>';
        })
        .catch(() => {});
}

// ============================================================
// PROPERTIES
// ============================================================
function loadAdminProperties() {
    fetch('/api/admin/properties', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(props => {
            const tbody = document.getElementById('adminPropsBody');
            document.getElementById('badgeProps').textContent = props.length;
            tbody.innerHTML = props.map(p => {
                const catLabels = {appartement:'Appart.',villa:'Villa',terrain:'Terrain',commercial:'Commercial',garage:'Garage',bureautique:'Bureautique'};
                return '<tr><td>' + (p.featured ? '<i class="fas fa-star" style="color:#d4a254"></i>' : '') + '</td><td>' + p.title.substring(0,30) + '</td><td>' + p.type + '</td><td>' + (catLabels[p.category]||p.category) + '</td><td>' + p.wilaya + '</td><td>' + p.price.toLocaleString('fr') + '</td><td><span class="badge badge-' + p.status + '">' + p.status + '</span></td><td>' + (p.views||0) + '</td><td><button class="btn-sm" onclick="editProperty(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteProperty(' + p.id + ')"><i class="fas fa-trash"></i></button></td></tr>';
            }).join('') || '<tr><td colspan="9" class="admin-empty">Aucune annonce</td></tr>';
        })
        .catch(() => {});
}

function filterAdminProps() {
    const search = document.getElementById('propSearch').value.toLowerCase();
    const status = document.getElementById('propFilterStatus').value;
    document.querySelectorAll('#adminPropsBody tr').forEach(tr => {
        const text = tr.textContent.toLowerCase();
        const matchSearch = !search || text.includes(search);
        const matchStatus = !status || text.includes(status);
        tr.style.display = (matchSearch && matchStatus) ? '' : 'none';
    });
}

function openPropModal() {
    editingId = null;
    document.getElementById('editTitle').value = '';
    document.getElementById('editPrice').value = '';
    document.getElementById('editDescription').value = '';
    openModal('propEditModal');
}

function editProperty(id) {
    editingId = id;
    fetch('/api/properties/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(p => {
            document.getElementById('editTitle').value = p.title;
            document.getElementById('editType').value = p.type;
            document.getElementById('editCategory').value = p.category;
            document.getElementById('editWilaya').value = p.wilaya;
            document.getElementById('editCommune').value = p.commune || '';
            document.getElementById('editAddress').value = p.address || '';
            document.getElementById('editPrice').value = p.price;
            document.getElementById('editSurface').value = p.surface;
            document.getElementById('editRooms').value = p.rooms || '';
            document.getElementById('editLat').value = p.lat || '';
            document.getElementById('editLng').value = p.lng || '';
            document.getElementById('editDescription').value = p.description;
            document.getElementById('editStatus').value = p.status;
            document.getElementById('editContactPhone').value = p.contact_phone || p.display_phone || '';
            document.getElementById('editFeatured').value = p.featured ? '1' : '0';
            openModal('propEditModal');
        })
        .catch(() => alert('Erreur chargement'));
}

function savePropertyEdit() {
    const data = {
        type: document.getElementById('editType').value,
        category: document.getElementById('editCategory').value,
        title: document.getElementById('editTitle').value,
        description: document.getElementById('editDescription').value,
        price: document.getElementById('editPrice').value,
        wilaya: document.getElementById('editWilaya').value,
        commune: document.getElementById('editCommune').value,
        address: document.getElementById('editAddress').value,
        lat: document.getElementById('editLat').value,
        lng: document.getElementById('editLng').value,
        surface: document.getElementById('editSurface').value,
        rooms: document.getElementById('editRooms').value,
        status: document.getElementById('editStatus').value,
        contact_phone: document.getElementById('editContactPhone').value,
        featured: document.getElementById('editFeatured').value
    };
    const url = editingId ? '/api/properties/' + editingId : '/api/properties';
    const method = editingId ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { if (d.error) { alert(d.error); return; } showToast('Annonce enregistree !'); closeModal('propEditModal'); loadAdminProperties(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteProperty(id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    fetch('/api/properties/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Annonce supprimee !'); loadAdminProperties(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// PAYMENTS
// ============================================================
function loadAdminPayments() {
    fetch('/api/payments', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(pays => {
            document.getElementById('badgePayments').textContent = pays.filter(p => p.status === 'pending').length;
            const tbody = document.getElementById('adminPaymentsBody');
            tbody.innerHTML = pays.map(p => '<tr><td>' + new Date(p.created_at).toLocaleDateString('fr') + '</td><td>' + (p.user_name||'--') + '</td><td>' + (p.type||'publication') + '</td><td>' + p.amount + ' DZ</td><td>' + (p.client_rip||'--') + '</td><td>' + (p.property_title||'--') + '</td><td><span class="badge badge-' + p.status + '">' + p.status + '</span></td><td><button class="btn-sm" onclick="confirmPayment(' + p.id + ')">Confirmer</button> <button class="btn-sm btn-sm-danger" onclick="rejectPayment(' + p.id + ')">Rejeter</button></td></tr>').join('') || '<tr><td colspan="8" class="admin-empty">Aucun paiement</td></tr>';
        })
        .catch(() => {});
}

function filterAdminPayments() {
    const status = document.getElementById('payFilterStatus').value;
    document.querySelectorAll('#adminPaymentsBody tr').forEach(tr => {
        tr.style.display = !status || tr.textContent.includes(status) ? '' : 'none';
    });
}

function confirmPayment(id) {
    fetch('/api/payments/' + id + '/confirm', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'confirmed' }) })
        .then(() => { showToast('Paiement confirme !'); loadAdminPayments(); loadDashboard(); })
        .catch(() => showToast('Erreur', 'error'));
}

function rejectPayment(id) {
    if (!confirm('Rejeter ce paiement ?')) return;
    fetch('/api/payments/' + id + '/reject', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Paiement rejete !'); loadAdminPayments(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// ESTIMATIONS
// ============================================================
function loadAdminEstimations() {
    fetch('/api/admin/estimation-requests', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(ests => {
            const tbody = document.getElementById('adminEstimationsBody');
            tbody.innerHTML = ests.map(e => '<tr><td>' + new Date(e.created_at).toLocaleDateString('fr') + '</td><td>' + e.name + '</td><td>' + e.email + '</td><td>' + (e.phone||'--') + '</td><td>' + (e.category||'--') + '</td><td>' + (e.wilaya||'--') + '</td><td>' + (e.surface||'--') + ' m2</td><td><button class="btn-sm btn-sm-danger" onclick="deleteEstimation(' + e.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="8" class="admin-empty">Aucune demande</td></tr>';
        })
        .catch(() => {});
}

function deleteEstimation(id) {
    if (!confirm('Supprimer ?')) return;
    fetch('/api/admin/estimation-requests/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Demande supprimee !'); loadAdminEstimations(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// USERS
// ============================================================
function loadAdminUsers() {
    fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(users => {
            const tbody = document.getElementById('adminUsersBody');
            tbody.innerHTML = users.map(u => '<tr><td>' + u.name + '</td><td>' + u.email + '</td><td>' + (u.phone||'--') + '</td><td>' + (u.baridimob_rip||'--') + '</td><td><span class="badge">' + u.role + '</span></td><td>' + new Date(u.created_at).toLocaleDateString('fr') + '</td><td><button class="btn-sm" onclick="editUser(' + u.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm" onclick="messageUser(' + u.id + ', \'' + (u.name||'').replace(/'/g,"\\'") + '\')"><i class="fas fa-envelope"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteUser(' + u.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="7" class="admin-empty">Aucun utilisateur</td></tr>';
        })
        .catch(() => {});
}

function editUser(id) {
    editingUserId = id;
    fetch('/api/admin/users/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(u => {
            document.getElementById('editUserName').value = u.name;
            document.getElementById('editUserEmail').value = u.email;
            document.getElementById('editUserPhone').value = u.phone || '';
            document.getElementById('editUserRip').value = u.baridimob_rip || '';
            document.getElementById('editUserRole').value = u.role;
            openModal('userEditModal');
        })
        .catch(() => alert('Erreur'));
}

function saveUserEdit() {
    const data = {
        name: document.getElementById('editUserName').value,
        email: document.getElementById('editUserEmail').value,
        phone: document.getElementById('editUserPhone').value,
        baridimob_rip: document.getElementById('editUserRip').value,
        role: document.getElementById('editUserRole').value
    };
    fetch('/api/admin/users/' + editingUserId, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { showToast('Utilisateur modifie !'); closeModal('userEditModal'); loadAdminUsers(); })
        .catch(() => showToast('Erreur', 'error'));
}

function messageUser(id, name) {
    editingUserId = id;
    document.getElementById('msgUserName').value = name;
    document.getElementById('msgSubject').value = '';
    document.getElementById('msgBody').value = '';
    openModal('userMessageModal');
}

function sendUserMessage() {
    const data = {
        user_id: editingUserId,
        subject: document.getElementById('msgSubject').value,
        body: document.getElementById('msgBody').value
    };
    fetch('/api/admin/messages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { showToast('Message envoye !'); closeModal('userMessageModal'); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteUser(id) {
    if (!confirm('Supprimer cet utilisateur ?')) return;
    fetch('/api/admin/users/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Utilisateur supprime !'); loadAdminUsers(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// ADMINS
// ============================================================
function loadAdminAdmins() {
    fetch('/api/admin/admins', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(admins => {
            const tbody = document.getElementById('adminAdminsBody');
            tbody.innerHTML = admins.map(a => '<tr><td>' + a.name + '</td><td>' + a.email + '</td><td>' + new Date(a.created_at).toLocaleDateString('fr') + '</td><td><button class="btn-sm btn-sm-danger" onclick="deleteAdmin(' + a.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="4" class="admin-empty">Aucun admin</td></tr>';
        })
        .catch(() => {});
}

function openAdminModal() {
    document.getElementById('adminName').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
    openModal('adminModal');
}

function saveAdmin() {
    const data = {
        name: document.getElementById('adminName').value,
        email: document.getElementById('adminEmail').value,
        password: document.getElementById('adminPassword').value
    };
    fetch('/api/admin/admins', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { if (d.error) { alert(d.error); return; } showToast('Admin cree !'); closeModal('adminModal'); loadAdminAdmins(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteAdmin(id) {
    if (!confirm('Supprimer cet admin ?')) return;
    fetch('/api/admin/admins/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Admin supprime !'); loadAdminAdmins(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// CONTACTS
// ============================================================
function loadAdminContacts() {
    fetch('/api/admin/contacts', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(msgs => {
            contactsCache = msgs;
            document.getElementById('badgeContacts').textContent = msgs.length;
            const tbody = document.getElementById('adminContactsBody');
            tbody.innerHTML = msgs.map(m => '<tr><td>' + new Date(m.created_at).toLocaleDateString('fr') + '</td><td>' + m.name + '</td><td>' + m.email + '</td><td>' + (m.subject||'--') + '</td><td>' + (m.message||'').substring(0,60) + '</td><td><button class="btn-sm" onclick="replyContact(' + m.id + ')" title="Repondre"><i class="fas fa-reply"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteContact(' + m.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="6" class="admin-empty">Aucun message</td></tr>';
        })
        .catch(() => {});
}

function replyContact(id) {
    const m = (contactsCache || []).find(c => c.id === id);
    if (!m) return;
    const subject = 'Re: ' + (m.subject || 'Votre message');
    window.location.href = 'mailto:' + m.email + '?subject=' + encodeURIComponent(subject);
}

function deleteContact(id) {
    if (!confirm('Supprimer ?')) return;
    fetch('/api/admin/contacts/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Message supprime !'); loadAdminContacts(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// PROMOTIONS
// ============================================================
function loadAdminPromotions() {
    fetch('/api/promotions', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(promos => {
            const tbody = document.getElementById('adminPromosBody');
            tbody.innerHTML = promos.map(p => '<tr><td>' + (p.logo ? '<img src="' + p.logo + '" style="width:32px;height:32px;border-radius:50%">' : '--') + '</td><td>' + p.company_name + '</td><td>' + p.type + '</td><td>' + (p.wilaya||'--') + '</td><td>' + (p.phone||'--') + '</td><td><span class="badge">' + p.status + '</span></td><td>' + (p.featured ? '<i class="fas fa-star" style="color:#d4a254"></i>' : '') + '</td><td><button class="btn-sm" onclick="editPromo(' + p.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm btn-sm-danger" onclick="deletePromo(' + p.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="8" class="admin-empty">Aucune promotion</td></tr>';
        })
        .catch(() => {});
}

function openPromoModal() {
    editingId = null;
    ['promoCompanyName','promoWilaya','promoPhone','promoEmail','promoWebsite','promoDescription','promoText','promoCustom1','promoCustom2','promoCustom3','promoCustom4','promoCustom5'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('promoType').value = 'agence';
    document.getElementById('promoStart').value = '';
    document.getElementById('promoEnd').value = '';
    document.getElementById('promoIsProgram').value = '0';
    document.getElementById('promoStatus').value = 'active';
    document.getElementById('promoFeatured').value = '0';
    openModal('promoModal');
}

function editPromo(id) {
    editingId = id;
    fetch('/api/promotions/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(p => {
            document.getElementById('promoCompanyName').value = p.company_name;
            document.getElementById('promoType').value = p.type;
            document.getElementById('promoWilaya').value = p.wilaya || '';
            document.getElementById('promoPhone').value = p.phone || '';
            document.getElementById('promoEmail').value = p.email || '';
            document.getElementById('promoWebsite').value = p.website || '';
            document.getElementById('promoStart').value = p.start_date || '';
            document.getElementById('promoEnd').value = p.end_date || '';
            document.getElementById('promoDescription').value = p.description || '';
            document.getElementById('promoText').value = p.promo_text || '';
            document.getElementById('promoCustom1').value = p.custom_field1 || '';
            document.getElementById('promoCustom2').value = p.custom_field2 || '';
            document.getElementById('promoCustom3').value = p.custom_field3 || '';
            document.getElementById('promoCustom4').value = p.custom_field4 || '';
            document.getElementById('promoCustom5').value = p.custom_field5 || '';
            document.getElementById('promoIsProgram').value = p.is_program ? '1' : '0';
            document.getElementById('promoStatus').value = p.status;
            document.getElementById('promoFeatured').value = p.featured ? '1' : '0';
            openModal('promoModal');
        })
        .catch(() => alert('Erreur'));
}

function savePromo() {
    const fd = new FormData();
    fd.append('company_name', document.getElementById('promoCompanyName').value);
    fd.append('type', document.getElementById('promoType').value);
    fd.append('wilaya', document.getElementById('promoWilaya').value);
    fd.append('phone', document.getElementById('promoPhone').value);
    fd.append('email', document.getElementById('promoEmail').value);
    fd.append('website', document.getElementById('promoWebsite').value);
    fd.append('start_date', document.getElementById('promoStart').value);
    fd.append('end_date', document.getElementById('promoEnd').value);
    fd.append('description', document.getElementById('promoDescription').value);
    fd.append('promo_text', document.getElementById('promoText').value);
    fd.append('custom_field1', document.getElementById('promoCustom1').value);
    fd.append('custom_field2', document.getElementById('promoCustom2').value);
    fd.append('custom_field3', document.getElementById('promoCustom3').value);
    fd.append('custom_field4', document.getElementById('promoCustom4').value);
    fd.append('custom_field5', document.getElementById('promoCustom5').value);
    fd.append('is_program', document.getElementById('promoIsProgram').value);
    fd.append('status', document.getElementById('promoStatus').value);
    fd.append('featured', document.getElementById('promoFeatured').value);
    const logo = document.getElementById('promoLogo').files[0];
    if (logo) fd.append('logo', logo);
    const photos = document.getElementById('promoPhotos').files;
    for (let i = 0; i < photos.length; i++) fd.append('photos', photos[i]);
    const url = editingId ? '/api/promotions/' + editingId : '/api/promotions';
    const method = editingId ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token }, body: fd })
        .then(r => r.json())
        .then(d => { if (d.error) { alert(d.error); return; } showToast('Promotion enregistree !'); closeModal('promoModal'); loadAdminPromotions(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deletePromo(id) {
    if (!confirm('Supprimer cette promotion ?')) return;
    fetch('/api/promotions/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Promotion supprimee !'); loadAdminPromotions(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// BANNERS
// ============================================================
function loadAdminBanners() {
    fetch('/api/banners', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(banners => {
            const tbody = document.getElementById('adminBannersBody');
            tbody.innerHTML = banners.map(b => '<tr><td>' + b.title + '</td><td>' + b.position + '</td><td>' + (b.link||'--') + '</td><td>' + (b.custom_field1||'--') + '</td><td>' + (b.custom_field2||'--') + '</td><td>' + (b.custom_field3||'--') + '</td><td>' + (b.image ? '<i class="fas fa-image" style="color:#d4a254"></i>' : '--') + '</td><td>' + (b.active ? 'Oui' : 'Non') + '</td><td><button class="btn-sm" onclick="editBanner(' + b.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteBanner(' + b.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="9" class="admin-empty">Aucune banniere</td></tr>';
        })
        .catch(() => {});
}

function openBannerModal() {
    editingId = null;
    ['bannerTitle','bannerText','bannerLink','bannerCustom1','bannerCustom2','bannerCustom3'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('bannerPosition').value = 'top';
    document.getElementById('bannerActive').value = '1';
    openModal('bannerModal');
}

function editBanner(id) {
    editingId = id;
    fetch('/api/banners/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(b => {
            document.getElementById('bannerTitle').value = b.title;
            document.getElementById('bannerText').value = b.text || '';
            document.getElementById('bannerLink').value = b.link || '';
            document.getElementById('bannerPosition').value = b.position;
            document.getElementById('bannerActive').value = b.active ? '1' : '0';
            document.getElementById('bannerCustom1').value = b.custom_field1 || '';
            document.getElementById('bannerCustom2').value = b.custom_field2 || '';
            document.getElementById('bannerCustom3').value = b.custom_field3 || '';
            openModal('bannerModal');
        })
        .catch(() => alert('Erreur'));
}

function saveBanner() {
    const fd = new FormData();
    fd.append('title', document.getElementById('bannerTitle').value);
    fd.append('text', document.getElementById('bannerText').value);
    fd.append('link', document.getElementById('bannerLink').value);
    fd.append('position', document.getElementById('bannerPosition').value);
    fd.append('active', document.getElementById('bannerActive').value);
    fd.append('custom_field1', document.getElementById('bannerCustom1').value);
    fd.append('custom_field2', document.getElementById('bannerCustom2').value);
    fd.append('custom_field3', document.getElementById('bannerCustom3').value);
    const img = document.getElementById('bannerImage').files[0];
    if (img) fd.append('image', img);
    const url = editingId ? '/api/banners/' + editingId : '/api/banners';
    const method = editingId ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token }, body: fd })
        .then(r => r.json())
        .then(d => { if (d.error) { alert(d.error); return; } showToast('Banniere enregistree !'); closeModal('bannerModal'); loadAdminBanners(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteBanner(id) {
    if (!confirm('Supprimer ?')) return;
    fetch('/api/banners/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Banniere supprimee !'); loadAdminBanners(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// FORM FIELDS
// ============================================================
function loadFormFields() {
    fetch('/api/form-fields', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(fields => {
            const tbody = document.getElementById('adminFormFieldsBody');
            tbody.innerHTML = fields.map(f => '<tr><td>' + f.label + '</td><td>' + f.field_key + '</td><td>' + f.field_type + '</td><td>' + f.section + '</td><td>' + (f.required ? 'Oui' : 'Non') + '</td><td>' + (f.active ? 'Oui' : 'Non') + '</td><td><button class="btn-sm" onclick="editFormField(' + f.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteFormField(' + f.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="7" class="admin-empty">Aucun champ</td></tr>';
        })
        .catch(() => {});
}

function openFormFieldModal() {
    editingFormFieldId = null;
    ['ffLabel','ffKey','ffPlaceholder','ffOptions'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('ffType').value = 'text';
    document.getElementById('ffSection').value = 'info';
    document.getElementById('ffRequired').value = '0';
    document.getElementById('ffActive').value = '1';
    openModal('formFieldModal');
}

function editFormField(id) {
    editingFormFieldId = id;
    fetch('/api/form-fields/' + id, { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(f => {
            document.getElementById('ffLabel').value = f.label;
            document.getElementById('ffKey').value = f.field_key;
            document.getElementById('ffType').value = f.field_type;
            document.getElementById('ffSection').value = f.section;
            document.getElementById('ffPlaceholder').value = f.placeholder || '';
            document.getElementById('ffOptions').value = f.options || '';
            document.getElementById('ffRequired').value = f.required ? '1' : '0';
            document.getElementById('ffActive').value = f.active ? '1' : '0';
            openModal('formFieldModal');
        })
        .catch(() => alert('Erreur'));
}

function saveFormField() {
    const data = {
        label: document.getElementById('ffLabel').value,
        field_key: document.getElementById('ffKey').value,
        field_type: document.getElementById('ffType').value,
        section: document.getElementById('ffSection').value,
        placeholder: document.getElementById('ffPlaceholder').value,
        options: document.getElementById('ffOptions').value,
        required: document.getElementById('ffRequired').value === '1',
        active: document.getElementById('ffActive').value === '1'
    };
    const url = editingFormFieldId ? '/api/form-fields/' + editingFormFieldId : '/api/form-fields';
    const method = editingFormFieldId ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json())
        .then(d => { if (d.error) { alert(d.error); return; } showToast('Champ enregistre !'); closeModal('formFieldModal'); loadFormFields(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteFormField(id) {
    if (!confirm('Supprimer ?')) return;
    fetch('/api/form-fields/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Champ supprime !'); loadFormFields(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// CONTENT BLOCKS
// ============================================================
function loadContentBlocks() {
    fetch('/api/site-content', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(blocks => {
            const tbody = document.getElementById('adminContentBody');
            tbody.innerHTML = blocks.map(b => '<tr><td>' + b.title + '</td><td>' + (b.content_key||'--') + '</td><td>' + (b.image ? '<i class="fas fa-image" style="color:#d4a254"></i>' : '--') + '</td><td>' + (b.active ? 'Oui' : 'Non') + '</td><td><button class="btn-sm" onclick="editContentBlock(' + b.id + ')"><i class="fas fa-edit"></i></button> <button class="btn-sm btn-sm-danger" onclick="deleteContentBlock(' + b.id + ')"><i class="fas fa-trash"></i></button></td></tr>').join('') || '<tr><td colspan="5" class="admin-empty">Aucun bloc</td></tr>';
        })
        .catch(() => {});
}

function openContentBlockModal() {
    editingContentBlockId = null;
    ['cbTitle','cbSlug','cbBody'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('cbActive').value = '1';
    openModal('contentBlockModal');
}

function editContentBlock(id) {
    editingContentBlockId = id;
    fetch('/api/site-content', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(blocks => {
            const b = blocks.find(bl => bl.id === id);
            if (!b) { alert('Bloc non trouve'); return; }
            document.getElementById('cbTitle').value = b.title;
            document.getElementById('cbSlug').value = b.content_key || '';
            document.getElementById('cbBody').value = b.body || '';
            document.getElementById('cbActive').value = b.active ? '1' : '0';
            openModal('contentBlockModal');
        })
        .catch(() => alert('Erreur'));
}

function saveContentBlock() {
    const fd = new FormData();
    fd.append('title', document.getElementById('cbTitle').value);
    fd.append('content_key', document.getElementById('cbSlug').value);
    fd.append('body', document.getElementById('cbBody').value);
    fd.append('active', document.getElementById('cbActive').value);
    const img = document.getElementById('cbImage').files[0];
    if (img) fd.append('image', img);
    const url = editingContentBlockId ? '/api/admin/site-content/' + editingContentBlockId : '/api/admin/site-content';
    const method = editingContentBlockId ? 'PUT' : 'POST';
    fetch(url, { method, headers: { 'Authorization': 'Bearer ' + token }, body: fd })
        .then(r => r.json())
        .then(d => { showToast('Bloc enregistre !'); closeModal('contentBlockModal'); loadContentBlocks(); })
        .catch(() => showToast('Erreur', 'error'));
}

function deleteContentBlock(id) {
    if (!confirm('Supprimer ?')) return;
    fetch('/api/admin/site-content/' + id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } })
        .then(() => { showToast('Bloc supprime !'); loadContentBlocks(); })
        .catch(() => showToast('Erreur', 'error'));
}

// ============================================================
// UTILITY
// ============================================================
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function logout() {
    localStorage.removeItem('immoelite_token');
    window.location.href = '/';
}

function refreshAllData() {
    loadDashboard();
    showToast('Donnees rafraichies !');
}

function showToast(msg, type) {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msgEl = document.getElementById('toastMsg');
    msgEl.textContent = msg;
    icon.className = type === 'error' ? 'fas fa-times-circle' : 'fas fa-check-circle';
    toast.style.background = type === 'error' ? '#e94560' : '#d4a254';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}
