
let currentUser = null;

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

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function showToast(msg, err) {
    const t = document.getElementById('toast'); document.getElementById('toastMsg').textContent = msg;
    t.style.background = err ? 'var(--red)' : 'var(--accent)'; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    loadProfile();
    loadMyProperties();
    loadMyPayments();
    loadMyEstimations();
    setupUploadArea();
    loadSettings();
});

async function loadProfile() {
    try {
        const user = await api('/api/profile');
        currentUser = user;
        document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
        document.getElementById('userName').textContent = user.name;
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('profileName').value = user.name;
        document.getElementById('profilePhone').value = user.phone;
        if (user.baridimob_rip) document.getElementById('profileRip').value = user.baridimob_rip;
    } catch (e) { window.location.href = '/'; }
}

async function loadMyProperties() {
    try {
        const props = await api('/api/properties?limit=100');
        // Filter client-side since API returns all active
        const grid = document.getElementById('myPropertiesGrid');
        if (!props.length) {
            grid.innerHTML = '<div class="admin-empty"><i class="fas fa-inbox"></i><p>Aucune annonce</p></div>';
            return;
        }
        grid.innerHTML = props.map(p => {
            const statusClass = p.status === 'active' ? 'status-active' : p.status === 'pending' ? 'status-pending' : 'status-rejected';
            return '<div class="my-prop-card"><h3>' + p.title + '</h3><div class="price">' + formatPrice(p.price) + '</div><div class="meta">' + p.wilaya + ' - ' + p.type + '</div><div class="status"><span class="status-badge ' + statusClass + '">' + p.status + '</span></div><div class="actions"><button class="btn-sm btn-delete" onclick="deleteMyProp(' + p.id + ')"><i class="fas fa-trash"></i> Supprimer</button></div></div>';
        }).join('');
    } catch (e) { document.getElementById('myPropertiesGrid').innerHTML = '<div class="admin-empty">Erreur de chargement</div>'; }
}

async function deleteMyProp(id) {
    if (!confirm('Supprimer cette annonce ?')) return;
    try {
        await api('/api/properties/' + id, { method: 'DELETE' });
        showToast('Annonce supprimée');
        loadMyProperties();
    } catch (e) { showToast('Erreur', true); }
}

async function loadMyPayments() {
    try {
        const payments = await api('/api/payments/my');
        const body = document.getElementById('myPaymentsBody');
        if (!payments.length) {
            body.innerHTML = '<tr><td colspan="5" class="admin-empty">Aucun paiement</td></tr>';
            return;
        }
        body.innerHTML = payments.map(p => {
            const sc = p.status === 'confirmed' ? 'status-confirmed' : p.status === 'pending' ? 'status-pending' : 'status-rejected';
            const typeLabel = p.type === 'publication' ? 'Publication' : p.type === 'commission_vente' ? 'Commission vente' : 'Commission location';
            return '<tr><td>' + new Date(p.created_at).toLocaleDateString('fr') + '</td><td>' + typeLabel + '</td><td>' + formatPrice(p.amount) + '</td><td>' + (p.property_title || '-') + '</td><td><span class="status-badge ' + sc + '">' + p.status + '</span></td></tr>';
        }).join('');
    } catch (e) { document.getElementById('myPaymentsBody').innerHTML = '<tr><td colspan="5" class="admin-empty">Erreur</td></tr>'; }
}

async function loadMyEstimations() {
    try {
        const ests = await api('/api/estimation/my');
        const body = document.getElementById('myEstimationsBody');
        if (!ests || !ests.length) {
            body.innerHTML = '<tr><td colspan="5" class="admin-empty">Aucune estimation</td></tr>';
            return;
        }
        body.innerHTML = ests.map(e =>
            '<tr><td>' + new Date(e.created_at).toLocaleDateString('fr') + '</td><td>' + e.wilaya + '</td><td>' + e.category + '</td><td>' + e.surface + ' m²</td><td>' + formatPrice(e.estimated_price) + '</td></tr>'
        ).join('');
    } catch (e) { document.getElementById('myEstimationsBody').innerHTML = '<tr><td colspan="5" class="admin-empty">Aucune estimation sauvegardée</td></tr>'; }
}

async function saveProfile() {
    try {
        const data = {
            name: document.getElementById('profileName').value,
            phone: document.getElementById('profilePhone').value,
            baridimob_rip: document.getElementById('profileRip').value
        };
        const pw = document.getElementById('profilePassword').value;
        if (pw) data.password = pw;
        await api('/api/profile', { method: 'PUT', body: JSON.stringify(data) });
        showToast('Profil mis à jour !');
        loadProfile();
    } catch (e) { showToast('Erreur', true); }
}

// Publish helpers (reuse from main script.js)
let pubImages = [];
let currentPubStep = 1;

function goToPubStep(step) {
    if (step === 2 && currentPubStep === 1) {
        const req = ['pubType', 'pubCategory', 'pubTitle', 'pubPrice', 'pubWilaya', 'pubSurface'];
        for (const id of req) { if (!document.getElementById(id).value) { showToast('Remplissez les champs', true); return; } }
    }
    document.querySelectorAll('.pub-step-content').forEach(el => el.style.display = 'none');
    document.getElementById('pubContent' + step).style.display = 'block';
    document.querySelectorAll('.publish-steps .step').forEach((el, i) => el.classList.toggle('active', i < step));
    if (step === 3) buildPaymentSummary();
    currentPubStep = step;
}

function buildPaymentSummary() {
    document.getElementById('paymentSummaryContent').innerHTML =
        '<div><strong>' + document.getElementById('pubTitle').value + '</strong></div>' +
        '<div>Prix : ' + formatPrice(parseInt(document.getElementById('pubPrice').value)) + '</div>';
}

function setupUploadArea() {
    const area = document.getElementById('uploadArea');
    if (!area) return;
    area.addEventListener('click', () => document.getElementById('pubImages').click());
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = 'var(--accent)'; });
    area.addEventListener('dragleave', () => { area.style.borderColor = 'rgba(212,162,84,.3)'; });
    area.addEventListener('drop', e => {
        e.preventDefault(); area.style.borderColor = 'rgba(212,162,84,.3)';
        document.getElementById('pubImages').files = e.dataTransfer.files;
        previewImages(document.getElementById('pubImages'));
    });
}

function previewImages(input) {
    const grid = document.getElementById('previewGrid');
    grid.innerHTML = ''; pubImages = [];
    Array.from(input.files).slice(0, 5).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => { grid.innerHTML += '<img src="' + e.target.result + '">'; pubImages.push(file); };
        reader.readAsDataURL(file);
    });
}

async function submitProperty() {
    const formData = new FormData();
    formData.append('type', document.getElementById('pubType').value);
    formData.append('category', document.getElementById('pubCategory').value);
    formData.append('title', document.getElementById('pubTitle').value);
    formData.append('description', document.getElementById('pubDescription').value);
    formData.append('price', document.getElementById('pubPrice').value);
    formData.append('wilaya', document.getElementById('pubWilaya').value);
    formData.append('commune', document.getElementById('pubCommune').value);
    formData.append('address', document.getElementById('pubAddress').value);
    formData.append('surface', document.getElementById('pubSurface').value);
    formData.append('rooms', document.getElementById('pubRooms').value || '0');
    formData.append('bathrooms', document.getElementById('pubBathrooms').value || '0');
    formData.append('condition', document.getElementById('pubCondition').value);
    formData.append('age', document.getElementById('pubAge').value || '0');
    formData.append('parking', document.getElementById('pubParking').value);
    pubImages.forEach(f => formData.append('images', f));
    try {
        const token = localStorage.getItem('immoelite_token');
        const res = await fetch('/api/properties', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        closeModal('publishModal');
        showToast('Annonce soumise ! Payez 1 000 DZ via BaridiMob.');
        loadMyProperties();
        loadMyPayments();
    } catch (e) { showToast(e.message, true); }
}

function copyRip() {
    navigator.clipboard.writeText(document.getElementById('publishRip').textContent).then(() => showToast('RIP copié !'));
}

async function loadSettings() {
    try {
        const s = await api('/api/settings');
        if (s.baridimob_rip) document.getElementById('publishRip').textContent = s.baridimob_rip;
    } catch (e) {}
}

function logout() {
    localStorage.removeItem('immoelite_token');
    window.location.href = '/';
}
