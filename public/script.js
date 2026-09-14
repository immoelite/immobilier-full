// ========== CONFIG ==========
const API = '';
let currentUser = null;
let authToken = localStorage.getItem('immoelite_token');

// ========== API HELPER ==========
async function api(endpoint, options = {}) {
    const token = localStorage.getItem('immoelite_token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + endpoint, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
}

// ========== FORMAT HELPERS ==========
function formatPrice(n) {
    return new Intl.NumberFormat('fr-DZ').format(n) + ' DZ';
}
function calcVenteCommission(price) {
    return Math.round(price * 0.02);
}
function calcLocationCommission() {
    return 5000;
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadProperties();
    checkAuth();
    setupUploadArea();
    setupScrollAnimations();
    setupBackToTop();
});

// ========== AUTH ==========
function checkAuth() {
    if (authToken) {
        api('/api/profile').then(user => {
            currentUser = user;
            updateNavForAuth(user);
        }).catch(() => {
            localStorage.removeItem('immoelite_token');
            authToken = null;
        });
    }
}

function updateNavForAuth(user) {
    document.getElementById('btnLogin').style.display = 'none';
    document.getElementById('btnRegister').style.display = 'none';
    document.getElementById('btnDashboard').style.display = '';
    document.getElementById('btnLogout').style.display = '';
    document.getElementById('dashBtnText').textContent = user.role === 'admin' ? 'Admin' : 'Mon compte';
}

function updateNavForLogout() {
    document.getElementById('btnLogin').style.display = '';
    document.getElementById('btnRegister').style.display = '';
    document.getElementById('btnDashboard').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    try {
        const { token, user } = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            })
        });
        localStorage.setItem('immoelite_token', token);
        authToken = token;
        currentUser = user;
        updateNavForAuth(user);
        closeModal('loginModal');
        showToast('Connexion réussie !');
    } catch (e) { showToast(e.message, true); }
}

async function handleRegister(e) {
    e.preventDefault();
    const pw = document.getElementById('regPassword').value;
    const pw2 = document.getElementById('regPassword2').value;
    if (pw !== pw2) return showToast('Les mots de passe ne correspondent pas', true);
    try {
        await api('/api/register', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value,
                password: pw
            })
        });
        closeModal('registerModal');
        showToast('Compte créé ! Connectez-vous maintenant.');
        openModal('loginModal');
    } catch (e) { showToast(e.message, true); }
}

function logout() {
    localStorage.removeItem('immoelite_token');
    authToken = null;
    currentUser = null;
    updateNavForLogout();
    showToast('Déconnecté');
    if (window.location.pathname.includes('dashboard') || window.location.pathname.includes('admin')) {
        window.location.href = '/';
    }
}

function goToDashboard() {
    if (currentUser?.role === 'admin') window.location.href = '/admin.html';
    else window.location.href = '/dashboard.html';
}

// ========== LOAD STATS ==========
async function loadStats() {
    try {
        const props = await api('/api/properties?limit=1000');
        document.getElementById('statProperties').textContent = props.length;
    } catch (e) {}
}

// ========== LOAD PROPERTIES ==========
async function loadProperties() {
    try {
        const ventes = await api('/api/properties?type=vente&limit=20');
        renderPropertyGrid('venteGrid', ventes);
        const locations = await api('/api/properties?type=location&limit=20');
        renderPropertyGrid('locationGrid', locations);
    } catch (e) {
        document.getElementById('venteGrid').innerHTML = '<div class="loading-spinner">Impossible de charger les annonces</div>';
        document.getElementById('locationGrid').innerHTML = '<div class="loading-spinner">Impossible de charger les annonces</div>';
    }
}

function renderPropertyGrid(gridId, properties) {
    const grid = document.getElementById(gridId);
    if (!properties.length) {
        grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-inbox"></i> Aucune annonce pour le moment</div>';
        return;
    }
    grid.innerHTML = properties.map(p => {
        const badgeClass = p.type === 'vente' ? 'badge-vente' : 'badge-location';
        const badgeText = p.type === 'vente' ? 'Vente' : 'Location';
        const commission = p.type === 'vente' ? formatPrice(calcVenteCommission(p.price)) : formatPrice(calcLocationCommission());
        const commissionLabel = p.type === 'vente' ? '2% commission' : '5 000 DZ commission';
        const imgHtml = p.images && p.images.length > 0
            ? '<img src="' + p.images[0] + '" alt="' + p.title + '">'
            : '<i class="fas fa-home"></i>';
        return '<div class="property-card" onclick="openPropertyDetail(' + p.id + ')">' +
            '<div class="property-img">' + imgHtml + '<span class="property-badge ' + badgeClass + '">' + badgeText + '</span></div>' +
            '<div class="property-info">' +
            '<h3>' + p.title + '</h3>' +
            '<div class="property-price">' + formatPrice(p.price) + '</div>' +
            '<div class="property-meta"><span><i class="fas fa-map-marker-alt"></i> ' + p.wilaya + '</span>' +
            (p.surface ? '<span><i class="fas fa-ruler-combined"></i> ' + p.surface + ' m²</span>' : '') +
            (p.rooms ? '<span><i class="fas fa-door-open"></i> ' + p.rooms + ' pièces</span>' : '') + '</div>' +
            '<div class="property-commission"><i class="fas fa-percentage"></i> ' + commissionLabel + ' : ' + commission + '</div>' +
            '<div class="property-actions">' +
            '<button class="btn-whatsapp" onclick="event.stopPropagation();openWhatsApp(\'' + (p.display_phone || p.owner_phone) + '\',\'' + p.title + '\')"><i class="fab fa-whatsapp"></i> WhatsApp</button>' +
            '<button class="btn-detail" onclick="event.stopPropagation();openPropertyDetail(' + p.id + ')"><i class="fas fa-eye"></i> Détails</button>' +
            '</div></div></div>';
    }).join('');
}

// ========== SEARCH ==========
async function searchProperties() {
    const type = document.getElementById('searchType').value;
    const wilaya = document.getElementById('searchWilaya').value;
    const category = document.getElementById('searchCategory').value;
    let params = [];
    if (type) params.push('type=' + type);
    if (wilaya) params.push('wilaya=' + encodeURIComponent(wilaya));
    if (category) params.push('category=' + category);
    try {
        const results = await api('/api/properties?' + params.join('&'));
        const gridId = type === 'location' ? 'locationGrid' : 'venteGrid';
        renderPropertyGrid(gridId, results);
        document.getElementById(type === 'location' ? 'location' : 'vente').scrollIntoView({ behavior: 'smooth' });
        showToast(results.length + ' résultat(s) trouvé(s)');
    } catch (e) { showToast('Erreur de recherche', true); }
}

// ========== PROPERTY DETAIL ==========
async function openPropertyDetail(id) {
    try {
        const p = await api('/api/properties/' + id);
        const commission = p.type === 'vente' ? formatPrice(calcVenteCommission(p.price)) : formatPrice(calcLocationCommission());
        const commLabel = p.type === 'vente' ? '2% du prix' : '5 000 DZ forfait';
        const imagesHtml = p.images && p.images.length
            ? p.images.map(img => '<img src="' + img + '" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:8px">').join('')
            : '<div style="height:200px;background:var(--bg);display:flex;align-items:center;justify-content:center;border-radius:8px"><i class="fas fa-home" style="font-size:3rem;color:var(--accent)"></i></div>';
        document.getElementById('propertyDetailContent').innerHTML =
            imagesHtml +
            '<h2 style="color:var(--white);font-size:1.3rem;margin:16px 0 8px">' + p.title + '</h2>' +
            '<div style="font-size:1.6rem;font-weight:800;color:var(--accent);margin-bottom:12px">' + formatPrice(p.price) + '</div>' +
            '<div style="color:var(--text);line-height:1.8;margin-bottom:16px">' + (p.description || '') + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">' +
            (p.wilaya ? '<div class="property-meta"><i class="fas fa-map-marker-alt"></i> ' + p.wilaya + (p.commune ? ' - ' + p.commune : '') + '</div>' : '') +
            (p.surface ? '<div class="property-meta"><i class="fas fa-ruler-combined"></i> ' + p.surface + ' m²</div>' : '') +
            (p.rooms ? '<div class="property-meta"><i class="fas fa-door-open"></i> ' + p.rooms + ' pièces</div>' : '') +
            (p.bathrooms ? '<div class="property-meta"><i class="fas fa-bath"></i> ' + p.bathrooms + ' SDB</div>' : '') +
            (p.parking === 'oui' ? '<div class="property-meta"><i class="fas fa-car"></i> Parking</div>' : '') +
            (p.condition ? '<div class="property-meta"><i class="fas fa-star"></i> ' + p.condition + '</div>' : '') +
            '</div>' +
            '<div class="property-commission" style="margin-bottom:16px"><i class="fas fa-percentage"></i> Commission ImmoElite (' + commLabel + ') : ' + commission + '</div>' +
            '<a href="https://wa.me/' + ((p.display_phone || p.owner_phone) || '').replace(/^0/, '213') + '?text=' + encodeURIComponent('Bonjour, je suis intéressé par : ' + p.title) + '" target="_blank" class="btn-whatsapp" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;padding:12px 24px;font-size:1rem"><i class="fab fa-whatsapp"></i> Contacter par WhatsApp</a>';
        openModal('propertyDetailModal');
    } catch (e) { showToast('Erreur', true); }
}

// ========== WHATSAPP ==========
function openWhatsApp(phone, title) {
    const clean = (phone || '').replace(/^0/, '213');
    window.open('https://wa.me/' + clean + '?text=' + encodeURIComponent('Bonjour, je suis intéressé par : ' + title), '_blank');
}

// ========== ESTIMATION ==========
async function runEstimation() {
    const wilaya = document.getElementById('estWilaya').value;
    const category = document.getElementById('estCategory').value;
    const surface = parseInt(document.getElementById('estSurface').value);
    const condition = document.getElementById('estCondition').value;
    const age = parseInt(document.getElementById('estAge').value) || 0;
    const parking = document.getElementById('estParking').value;
    if (!wilaya || !category || !surface) return showToast('Remplissez wilaya, type et surface', true);
    try {
        const result = await api('/api/estimation', {
            method: 'POST',
            body: JSON.stringify({ wilaya, category, surface, condition, age, parking })
        });
        document.getElementById('estResult').style.display = 'block';
        document.getElementById('estTotal').textContent = formatPrice(result.total);
        document.getElementById('estDetail').innerHTML =
            'Prix au m² estimé : <strong>' + formatPrice(result.pricePerM2) + '/m²</strong><br>' +
            'Surface : ' + surface + ' m²<br>' +
            'Wilaya : ' + wilaya + '<br>' +
            'Type : ' + category;
    } catch (e) { showToast('Erreur d\'estimation', true); }
}

// ========== PUBLISH ==========
let pubImages = [];
let currentPubStep = 1;

function goToPubStep(step) {
    if (step === 2 && currentPubStep === 1) {
        const req = ['pubType', 'pubCategory', 'pubTitle', 'pubPrice', 'pubWilaya', 'pubSurface'];
        for (const id of req) {
            if (!document.getElementById(id).value) return showToast('Remplissez tous les champs obligatoires', true);
        }
    }
    document.querySelectorAll('.pub-step-content').forEach(el => el.style.display = 'none');
    document.getElementById('pubContent' + step).style.display = 'block';
    document.querySelectorAll('.publish-steps .step').forEach((el, i) => {
        el.classList.toggle('active', i < step);
    });
    if (step === 3) buildPaymentSummary();
    currentPubStep = step;
}

function buildPaymentSummary() {
    const title = document.getElementById('pubTitle').value;
    const price = document.getElementById('pubPrice').value;
    const type = document.getElementById('pubType').value;
    const wilaya = document.getElementById('pubWilaya').value;
    document.getElementById('paymentSummaryContent').innerHTML =
        '<div><strong>' + title + '</strong></div>' +
        '<div>Prix : ' + formatPrice(parseInt(price)) + ' - ' + type + '</div>' +
        '<div>Wilaya : ' + wilaya + '</div>';
}

function setupUploadArea() {
    const area = document.getElementById('uploadArea');
    if (!area) return;
    area.addEventListener('click', () => document.getElementById('pubImages').click());
    area.addEventListener('dragover', e => { e.preventDefault(); area.style.borderColor = 'var(--accent)'; });
    area.addEventListener('dragleave', () => { area.style.borderColor = 'rgba(212,162,84,.3)'; });
    area.addEventListener('drop', e => {
        e.preventDefault();
        area.style.borderColor = 'rgba(212,162,84,.3)';
        const input = document.getElementById('pubImages');
        input.files = e.dataTransfer.files;
        previewImages(input);
    });
}

function previewImages(input) {
    const grid = document.getElementById('previewGrid');
    grid.innerHTML = '';
    pubImages = [];
    Array.from(input.files).slice(0, 5).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            grid.innerHTML += '<img src="' + e.target.result + '">';
            pubImages.push(file);
        };
        reader.readAsDataURL(file);
    });
}

async function submitProperty() {
    if (!authToken) return showToast('Connectez-vous d\'abord', true);
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
    const contactChoice = document.querySelector('input[name="pubContactChoice"]:checked');
    formData.append('contact_phone', contactChoice ? contactChoice.value : 'mine');
    pubImages.forEach(f => formData.append('images', f));
    try {
        const token = localStorage.getItem('immoelite_token');
        const res = await fetch(API + '/api/properties', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        closeModal('publishModal');
        showToast('Annonce soumise ! Payez 1 000 DZ via BaridiMob pour la publier.');
        loadProperties();
    } catch (e) { showToast(e.message, true); }
}

function copyRip() {
    const rip = document.getElementById('publishRip').textContent;
    navigator.clipboard.writeText(rip).then(() => showToast('RIP copié !'));
}

// ========== CONTACT ==========
async function sendContact(e) {
    e.preventDefault();
    try {
        await api('/api/contact', {
            method: 'POST',
            body: JSON.stringify({
                name: document.getElementById('contactName').value,
                email: document.getElementById('contactEmail').value,
                phone: document.getElementById('contactPhone').value,
                subject: document.getElementById('contactSubject').value,
                message: document.getElementById('contactMessage').value
            })
        });
        showToast('Message envoyé !');
        e.target.reset();
    } catch (e) { showToast('Erreur d\'envoi', true); }
}

// ========== MODAL HELPERS ==========
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) e.target.classList.remove('active');
});

// ========== TOAST ==========
function showToast(msg, isError) {
    const t = document.getElementById('toast');
    const m = document.getElementById('toastMsg');
    m.textContent = msg;
    t.style.background = isError ? 'var(--red)' : 'var(--accent)';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ========== MENU ==========
function toggleMenu() {
    document.getElementById('navLinks').classList.toggle('open');
}

// ========== SCROLL ANIMATIONS ==========
function setupScrollAnimations() {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('animate');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.step-card,.commission-card,.property-card,.feature-card,.pricing-card,.testimonial-card').forEach(el => observer.observe(el));
}

function setupBackToTop() {
    window.addEventListener('scroll', () => {
        document.getElementById('backToTop').classList.toggle('visible', window.scrollY > 400);
    });
}

// ========== LOAD SETTINGS FOR RIP ==========
async function loadSettings() {
    try {
        const s = await api('/api/settings');
        if (s.baridimob_rip) {
            document.getElementById('displayRip').textContent = s.baridimob_rip;
            document.getElementById('publishRip').textContent = s.baridimob_rip;
        }
        if (s.admin_whatsapp) {
            document.querySelector('.info-item:first-child span').textContent = '+' + s.admin_whatsapp;
        }
    } catch (e) {}
}
loadSettings();
