// ============================================================
// ImmoElite — Frontend Script (Updated with all 8 changes)
// ============================================================

const WILAYAS = ["Adrar","Chlef","Laghouat","Oum El Bouaghi","Batna","Béjaïa","Biskra","Béchar","Blida","Bouira","Tamanrasset","Tébessa","Tlemcen","Tiaret","Tizi Ouzou","Alger","Djelfa","Jijel","Sétif","Saïda","Skikda","Sidi Bel Abbès","Annaba","Guelma","Constantine","Médéa","Mostaganem","M'sila","Mascara","Ouargla","Oran","El Bayadh","Illizi","Bordj Bou Arréridj","Boumerdès","El Tarf","Tindouf","Tissemsilt","El Oued","Khenchela","Souk Ahras","Tipaza","Mila","Aïn Defla","Naâma","Aïn Témouchent","Ghardaïa","Relizane","Timimoun","Bordj Badji Mokhtar","Ouled Djellal","Béni Abbès","In Salah","In Guezzam","Touggourt","Djanet","El M'Ghair","El Meniaa"];

let currentUser = null;
let currentLang = localStorage.getItem('immoelite_lang') || 'fr';
let settingsCache = {};
let formFieldsCache = [];

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadWilayas();
    loadProperties();
    loadPromotions();
    loadBanners();
    loadFormFields();
    loadSiteContent();
    loadLanguage(currentLang);
    checkAuth();
    setupLangButtons();
    setupMapClick();
    setupContactTypeChange();
});

// ============================================================
// LANGUAGE SYSTEM (i18n)
// ============================================================
function setupLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
        btn.addEventListener('click', () => {
            currentLang = btn.dataset.lang;
            localStorage.setItem('immoelite_lang', currentLang);
            loadLanguage(currentLang);
            document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === currentLang));
        });
    });
}

function loadLanguage(lang) {
    fetch('/api/i18n/' + lang)
        .then(r => r.json())
        .then(t => {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (t[key]) el.textContent = t[key];
            });
            document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
            document.documentElement.lang = lang;
        })
        .catch(() => {});
}

// ============================================================
// SETTINGS
// ============================================================
function loadSettings() {
    fetch('/api/settings')
        .then(r => r.json())
        .then(s => {
            settingsCache = s;
            applySettings(s);
        })
        .catch(() => {});
}

function applySettings(s) {
    // Hero
    if (s.hero_title) document.getElementById('heroTitle').textContent = s.hero_title;
    if (s.hero_subtitle) document.getElementById('heroSubtitle').textContent = s.hero_subtitle;
    // Footer
    if (s.footer_text) document.getElementById('footerText').textContent = s.footer_text;
    // Background image
    if (s.background_image) {
        document.body.style.backgroundImage = 'url(' + s.background_image + ')';
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundAttachment = 'fixed';
    }
    // Gestion text
    if (s.gestion_text) document.getElementById('gestionText').textContent = s.gestion_text;
    // Section visibility
    const sections = {
        'stepsSection': s.section_steps_visible !== '0',
        'gestion': s.section_gestion_visible !== '0',
        'estimation': s.section_estimation_visible !== '0',
        'testimonials': s.section_testimonials_visible !== '0',
        'contact': s.section_contact_visible !== '0',
        'promos': s.section_promos_visible !== '0'
    };
    Object.entries(sections).forEach(([id, visible]) => {
        const el = document.getElementById(id);
        if (el) el.style.display = visible ? '' : 'none';
    });
    // Maintenance mode
    if (s.maintenance_mode === '1') {
        document.querySelector('main, .hero, .steps-section, .properties-section, .estimation-section, .gestion-section, .promos-section, .testimonials-section, .contact-section').forEach(el => el.style.display = 'none');
        document.body.innerHTML = '<div style="text-align:center;padding:100px 20px"><h1 style="color:#d4a254">Site en maintenance</h1><p>Nous revenons bientôt !</p></div>';
    }
    // Colors
    if (s.primary_color) document.documentElement.style.setProperty('--primary', s.primary_color);
    if (s.accent_color) document.documentElement.style.setProperty('--accent', s.accent_color);
}

// ============================================================
// WILAYAS
// ============================================================
function loadWilayas() {
    const selects = ['searchWilaya', 'pubWilaya', 'estWilaya', 'estReqWilaya'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        WILAYAS.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w;
            opt.textContent = w;
            el.appendChild(opt);
        });
    });
}

// ============================================================
// FORM FIELDS (admin-customizable)
// ============================================================
function loadFormFields() {
    fetch('/api/form-fields')
        .then(r => r.json())
        .then(fields => {
            formFieldsCache = fields.filter(f => f.active);
            renderCustomFields();
        })
        .catch(() => {});
}

function renderCustomFields() {
    const step1Container = document.getElementById('pubCustomFields1');
    const step2Container = document.getElementById('pubCustomFields2');
    if (!step1Container || !step2Container) return;
    step1Container.innerHTML = '';
    step2Container.innerHTML = '';

    formFieldsCache.forEach(f => {
        // Skip built-in fields that already exist in the form
        const builtIn = ['title', 'description', 'price', 'surface', 'rooms', 'commune', 'address'];
        if (builtIn.includes(f.field_key)) return;

        const div = document.createElement('div');
        div.className = 'pub-custom-field';
        div.style.marginBottom = '10px';

        let input = '';
        if (f.field_type === 'text' || f.field_type === 'number') {
            input = '<input type="' + f.field_type + '" id="custom_' + f.field_key + '" placeholder="' + (f.placeholder || f.label) + '"' + (f.required ? ' required' : '') + '>';
        } else if (f.field_type === 'textarea') {
            input = '<textarea id="custom_' + f.field_key + '" placeholder="' + (f.placeholder || f.label) + '"' + (f.required ? ' required' : '') + '></textarea>';
        } else if (f.field_type === 'select') {
            let opts = '<option value="">' + f.label + '</option>';
            try {
                const options = JSON.parse(f.options || '[]');
                options.forEach(o => { opts += '<option value="' + o + '">' + o + '</option>'; });
            } catch(e) {}
            input = '<select id="custom_' + f.field_key + '"' + (f.required ? ' required' : '') + '>' + opts + '</select>';
        } else if (f.field_type === 'checkbox') {
            input = '<label class="checkbox-label"><input type="checkbox" id="custom_' + f.field_key + '"> ' + f.label + '</label>';
        }

        if (f.section === 'info') {
            div.innerHTML = '<label>' + f.label + '</label>' + input;
            step1Container.appendChild(div);
        } else if (f.section === 'location' || f.section === 'details' || f.section === 'custom') {
            div.innerHTML = '<label>' + f.label + '</label>' + input;
            step2Container.appendChild(div);
        }
    });
}

// ============================================================
// SITE CONTENT BLOCKS
// ============================================================
function loadSiteContent() {
    fetch('/api/site-content')
        .then(r => r.json())
        .then(blocks => {
            const activeBlocks = blocks.filter(b => b.active);
            if (activeBlocks.length === 0) return;
            const section = document.getElementById('siteContentBlocks');
            const grid = document.getElementById('contentBlocksGrid');
            if (!section || !grid) return;
            section.style.display = '';
            grid.innerHTML = '';
            activeBlocks.forEach(b => {
                const card = document.createElement('div');
                card.className = 'content-block-card';
                card.style.cssText = 'background:#fff; border-radius:12px; padding:25px; box-shadow:0 4px 15px rgba(0,0,0,0.06); border-left:4px solid #d4a254; margin-bottom:15px;';
                let img = b.image ? '<img src="' + b.image + '" style="max-width:100%; border-radius:8px; margin-bottom:10px;" alt="' + b.title + '">' : '';
                card.innerHTML = img + '<h3 style="color:#1a1a2e; margin-bottom:8px;">' + b.title + '</h3><p style="color:#555; line-height:1.6;">' + b.body + '</p>';
                grid.appendChild(card);
            });
        })
        .catch(() => {});
}

// ============================================================
// BANNERS
// ============================================================
function loadBanners() {
    fetch('/api/banners/public')
        .then(r => r.json())
        .then(banners => {
            const heroBanners = banners.filter(b => b.position === 'hero' && b.image);
            const container = document.getElementById('heroBanners');
            if (!container || heroBanners.length === 0) return;
            container.innerHTML = '';
            const banner = heroBanners[0];
            container.innerHTML = '<div class="hero-banner" style="position:absolute;top:0;left:0;width:100%;height:100%;background:url(' + banner.image + ') center/cover;opacity:0.15;"></div>';
            if (banner.text) {
                container.innerHTML += '<div class="hero-banner-text" style="position:absolute;bottom:20px;left:20px;background:rgba(26,26,46,0.8);color:#fff;padding:10px 20px;border-radius:8px;font-size:0.9rem;">' + banner.text + '</div>';
            }
        })
        .catch(() => {});
}

// ============================================================
// PROPERTIES
// ============================================================
let propertyOffset = 0;
const PROPERTY_LIMIT = 12;

function loadProperties() {
    propertyOffset = 0;
    fetch('/api/properties?limit=' + PROPERTY_LIMIT)
        .then(r => r.json())
        .then(props => {
            renderProperties(props);
            propertyOffset = props.length;
            document.getElementById('loadMore').style.display = props.length >= PROPERTY_LIMIT ? '' : 'none';
        })
        .catch(() => {});
}

function searchProperties() {
    const type = document.getElementById('searchType').value;
    const wilaya = document.getElementById('searchWilaya').value;
    const category = document.getElementById('searchCategory').value;
    const min = document.getElementById('searchMin').value;
    const max = document.getElementById('searchMax').value;
    let url = '/api/properties?limit=50';
    if (type) url += '&type=' + type;
    if (wilaya) url += '&wilaya=' + encodeURIComponent(wilaya);
    if (category) url += '&category=' + category;
    if (min) url += '&min_price=' + min;
    if (max) url += '&max_price=' + max;
    fetch(url)
        .then(r => r.json())
        .then(props => {
            renderProperties(props);
            document.getElementById('loadMore').style.display = 'none';
        })
        .catch(() => {});
}

function loadMoreProperties() {
    fetch('/api/properties?limit=' + PROPERTY_LIMIT + '&offset=' + propertyOffset)
        .then(r => r.json())
        .then(props => {
            const grid = document.getElementById('propertiesGrid');
            props.forEach(p => grid.appendChild(createPropertyCard(p)));
            propertyOffset += props.length;
            document.getElementById('loadMore').style.display = props.length >= PROPERTY_LIMIT ? '' : 'none';
        })
        .catch(() => {});
}

function renderProperties(props) {
    const grid = document.getElementById('propertiesGrid');
    grid.innerHTML = '';
    if (props.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#888;grid-column:1/-1;">Aucune annonce trouvée</p>';
        return;
    }
    props.forEach(p => grid.appendChild(createPropertyCard(p)));
}

function createPropertyCard(p) {
    const card = document.createElement('div');
    card.className = 'property-card' + (p.featured ? ' featured' : '');
    const img = p.images && p.images.length ? p.images[0] : 'https://placehold.co/400x300/1a1a2e/d4a254?text=ImmoElite';
    const catLabels = {appartement:'Appartement',villa:'Villa',terrain:'Terrain',commercial:'Local commercial',garage:'Garage',bureautique:'Bureautique'};
    const typeLabel = p.type === 'vente' ? 'Vente' : 'Location';
    card.innerHTML = 
        '<div class="property-img" style="background-image:url(' + img + ')">' +
            (p.featured ? '<span class="featured-badge"><i class="fas fa-star"></i> Vedette</span>' : '') +
            '<span class="property-type-badge">' + typeLabel + '</span>' +
        '</div>' +
        '<div class="property-info">' +
            '<div class="property-price">' + p.price.toLocaleString('fr') + ' DZ</div>' +
            '<h3 class="property-title">' + p.title + '</h3>' +
            '<p class="property-location"><i class="fas fa-map-marker-alt"></i> ' + p.wilaya + (p.commune ? ', ' + p.commune : '') + '</p>' +
            '<div class="property-meta">' +
                '<span><i class="fas fa-expand"></i> ' + p.surface + ' m²</span>' +
                (p.rooms ? '<span><i class="fas fa-door-open"></i> ' + p.rooms + '</span>' : '') +
                '<span class="property-cat">' + (catLabels[p.category] || p.category) + '</span>' +
            '</div>' +
            '<div class="property-actions">' +
                '<button class="btn-details" onclick="showProperty(' + p.id + ')"><i class="fas fa-eye"></i> Détails</button>' +
                (p.display_phone ? '<a class="btn-whatsapp-sm" href="https://wa.me/213' + p.display_phone.replace(/^0/, '') + '" target="_blank"><i class="fab fa-whatsapp"></i></a>' : '') +
            '</div>' +
        '</div>';
    return card;
}

function showProperty(id) {
    fetch('/api/properties/' + id)
        .then(r => r.json())
        .then(p => {
            const modal = document.getElementById('propertyModal');
            document.getElementById('propDetailTitle').textContent = p.title;
            const catLabels = {appartement:'Appartement',villa:'Villa',terrain:'Terrain',commercial:'Local commercial',garage:'Garage',bureautique:'Bureautique'};
            let html = '<div class="prop-detail">';
            // Images
            html += '<div class="prop-images">';
            if (p.images && p.images.length) {
                html += '<div class="prop-main-img"><img src="' + p.images[0] + '" alt=""></div>';
                if (p.images.length > 1) {
                    html += '<div class="prop-thumbs">';
                    p.images.forEach(img => { html += '<img src="' + img + '" onclick="this.parentElement.previousElementSibling.querySelector(\'img\').src=this.src" class="prop-thumb">'; });
                    html += '</div>';
                }
            }
            html += '</div>';
            // Info
            html += '<div class="prop-info-grid">';
            html += '<div class="prop-price-big">' + p.price.toLocaleString('fr') + ' DZ</div>';
            html += '<p><strong>Type:</strong> ' + (p.type === 'vente' ? 'Vente' : 'Location') + '</p>';
            html += '<p><strong>Catégorie:</strong> ' + (catLabels[p.category] || p.category) + '</p>';
            html += '<p><strong>Wilaya:</strong> ' + p.wilaya + '</p>';
            if (p.commune) html += '<p><strong>Commune:</strong> ' + p.commune + '</p>';
            if (p.address) html += '<p><strong>Adresse:</strong> ' + p.address + '</p>';
            html += '<p><strong>Surface:</strong> ' + p.surface + ' m²</p>';
            if (p.rooms) html += '<p><strong>Pièces:</strong> ' + p.rooms + '</p>';
            if (p.bathrooms) html += '<p><strong>Salles de bain:</strong> ' + p.bathrooms + '</p>';
            if (p.parking && p.parking !== 'non') html += '<p><strong>Parking:</strong> ' + p.parking + '</p>';
            html += '<p><strong>État:</strong> ' + p.condition + '</p>';
            html += '<p><strong>Âge:</strong> ' + p.age + ' ans</p>';
            if (p.lat && p.lng) html += '<p><a href="https://maps.google.com/?q=' + p.lat + ',' + p.lng + '" target="_blank"><i class="fas fa-map-marker-alt"></i> Voir sur la carte</a></p>';
            html += '</div>';
            // Description
            html += '<div class="prop-description"><h4>Description</h4><p>' + p.description + '</p></div>';
            // Contact
            html += '<div class="prop-contact">';
            if (p.display_phone) {
                html += '<a class="btn-whatsapp" href="https://wa.me/213' + p.display_phone.replace(/^0/, '') + '" target="_blank"><i class="fab fa-whatsapp"></i> WhatsApp</a>';
                html += '<a class="btn-call" href="tel:+213' + p.display_phone.replace(/^0/, '') + '"><i class="fas fa-phone"></i> Appeler</a>';
            }
            html += '</div>';
            html += '</div>';
            document.getElementById('propertyDetailContent').innerHTML = html;
            modal.style.display = 'flex';
        })
        .catch(() => alert('Erreur lors du chargement'));
}

function closePropertyModal() {
    document.getElementById('propertyModal').style.display = 'none';
}

// ============================================================
// PROMOTIONS
// ============================================================
function loadPromotions() {
    fetch('/api/promotions/public')
        .then(r => r.json())
        .then(promos => {
            const grid = document.getElementById('promosGrid');
            if (!grid) return;
            grid.innerHTML = '';
            if (promos.length === 0) {
                grid.innerHTML = '<p style="text-align:center;color:#888;">Aucun partenaire pour le moment</p>';
                return;
            }
            promos.forEach(p => {
                const card = document.createElement('div');
                card.className = 'promo-card';
                const logo = p.logo ? '<img src="' + p.logo + '" class="promo-logo" alt="">' : '<div class="promo-logo-placeholder"><i class="fas fa-building"></i></div>';
                const typeLabels = {agence:'Agence',promoteur:'Promoteur',entreprise:'Entreprise',partenaire:'Partenaire'};
                let photosHtml = '';
                if (p.photos && p.photos.length) {
                    photosHtml = '<div class="promo-photos">';
                    p.photos.forEach(ph => { photosHtml += '<img src="' + ph + '" class="promo-photo" alt="">'; });
                    photosHtml += '</div>';
                }
                let customHtml = '';
                [p.custom_field1, p.custom_field2, p.custom_field3, p.custom_field4, p.custom_field5].forEach(v => {
                    if (v) customHtml += '<p class="promo-custom">' + v + '</p>';
                });
                card.innerHTML = 
                    logo +
                    '<h3>' + p.company_name + '</h3>' +
                    '<span class="promo-type">' + (typeLabels[p.type] || p.type) + '</span>' +
                    (p.wilaya ? '<p class="promo-wilaya"><i class="fas fa-map-marker-alt"></i> ' + p.wilaya + '</p>' : '') +
                    (p.description ? '<p class="promo-desc">' + p.description + '</p>' : '') +
                    photosHtml +
                    (p.promo_text ? '<div class="promo-text">' + p.promo_text + '</div>' : '') +
                    customHtml +
                    '<div class="promo-contact">' +
                        (p.phone ? '<a href="tel:' + p.phone + '"><i class="fas fa-phone"></i> ' + p.phone + '</a>' : '') +
                        (p.email ? '<a href="mailto:' + p.email + '"><i class="fas fa-envelope"></i></a>' : '') +
                        (p.website ? '<a href="' + p.website + '" target="_blank"><i class="fas fa-globe"></i></a>' : '') +
                    '</div>';
                grid.appendChild(card);
            });
        })
        .catch(() => {});
}

// ============================================================
// QUICK ESTIMATION
// ============================================================
function quickEstimate() {
    const wilaya = document.getElementById('estWilaya').value;
    const category = document.getElementById('estCategory').value;
    const surface = document.getElementById('estSurface').value;
    const condition = document.getElementById('estCondition').value;
    const age = document.getElementById('estAge').value;
    const parking = document.getElementById('estParking').value;
    if (!wilaya || !category || !surface) { alert('Remplissez wilaya, catégorie et surface'); return; }
    fetch('/api/estimation', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ wilaya, category, surface, condition_val: condition, age, parking })
    })
    .then(r => r.json())
    .then(data => {
        const result = document.getElementById('estResult');
        result.style.display = '';
        result.innerHTML = '<div class="est-result-value"><i class="fas fa-calculator"></i> Estimation: <strong>' + data.estimated_price.toLocaleString('fr') + ' DZ</strong></div>';
    })
    .catch(() => alert('Erreur d\'estimation'));
}

// ============================================================
// DETAILED ESTIMATION REQUEST
// ============================================================
function openEstimationRequestModal() {
    document.getElementById('estimationRequestModal').style.display = 'flex';
}
function closeEstimationRequestModal() {
    document.getElementById('estimationRequestModal').style.display = 'none';
}

function submitEstimationRequest(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('estReqName').value,
        email: document.getElementById('estReqEmail').value,
        phone: document.getElementById('estReqPhone').value,
        whatsapp: document.getElementById('estReqWhatsapp').value,
        wilaya: document.getElementById('estReqWilaya').value,
        commune: document.getElementById('estReqCommune').value,
        category: document.getElementById('estReqCategory').value,
        type: document.getElementById('estReqType').value,
        surface: document.getElementById('estReqSurface').value,
        rooms: document.getElementById('estReqRooms').value,
        bathrooms: document.getElementById('estReqBathrooms').value,
        parking: document.getElementById('estReqParking').value,
        condition: document.getElementById('estReqCondition').value,
        age: document.getElementById('estReqAge').value,
        description: document.getElementById('estReqDescription').value
    };
    fetch('/api/estimation-request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(result => {
        const el = document.getElementById('estReqResult');
        el.style.display = '';
        el.innerHTML = '<i class="fas fa-check-circle" style="color:#25D366;font-size:1.5rem;"></i> <strong>Demande envoyée !</strong><p style="margin-top:10px;">' + (result.auto_reply || 'Nous reviendrons vers vous sous 24-48h.') + '</p>';
        document.getElementById('estReqForm').reset();
    })
    .catch(() => alert('Erreur lors de l\'envoi'));
}

// ============================================================
// AUTH
// ============================================================
function checkAuth() {
    const token = localStorage.getItem('immoelite_token');
    if (!token) return;
    fetch('/api/profile', { headers: {'Authorization': 'Bearer ' + token} })
        .then(r => r.ok ? r.json() : null)
        .then(user => {
            if (user) {
                currentUser = user;
                updateAuthUI();
            } else {
                localStorage.removeItem('immoelite_token');
            }
        })
        .catch(() => {});
}

function updateAuthUI() {
    const area = document.getElementById('authArea');
    if (!area) return;
    if (currentUser) {
        let html = '<span class="user-name">' + currentUser.name + '</span>';
        if (currentUser.role === 'admin') {
            html += ' <a href="admin.html" class="btn-admin" style="background:#e94560;color:#fff;padding:6px 14px;border-radius:20px;font-size:0.85rem;text-decoration:none;margin-left:8px;"><i class="fas fa-cog"></i> Admin</a>';
        }
        html += ' <button class="btn-logout" onclick="logout()" style="background:none;border:1px solid #666;color:#666;padding:6px 14px;border-radius:20px;font-size:0.85rem;cursor:pointer;margin-left:8px;">Déconnexion</button>';
        area.innerHTML = html;
    }
}

function openLoginModal() { document.getElementById('loginModal').style.display = 'flex'; }
function closeLoginModal() { document.getElementById('loginModal').style.display = 'none'; }

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
        document.getElementById('loginForm').style.display = '';
        document.getElementById('registerForm').style.display = 'none';
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = '';
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
    }
}

function login(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    fetch('/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ email, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { alert(data.error); return; }
        localStorage.setItem('immoelite_token', data.token);
        currentUser = data.user;
        updateAuthUI();
        closeLoginModal();
    })
    .catch(() => alert('Erreur de connexion'));
}

function register(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const phone = document.getElementById('regPhone').value;
    const password = document.getElementById('regPassword').value;
    fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, email, phone, password })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { alert(data.error); return; }
        alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
        switchAuthTab('login');
    })
    .catch(() => alert('Erreur d\'inscription'));
}

function logout() {
    localStorage.removeItem('immoelite_token');
    currentUser = null;
    location.reload();
}

// ============================================================
// PUBLISH MODAL (3-step) — NO required field validation blocking steps
// ============================================================
function openPublishModal() {
    if (!currentUser) { openLoginModal(); return; }
    document.getElementById('publishModal').style.display = 'flex';
    goToPubStep(1);
    updatePubPrice();
}
function closePublishModal() { document.getElementById('publishModal').style.display = 'none'; }

function goToPubStep(step) {
    // NO validation blocking — user can proceed freely
    document.querySelectorAll('.pub-step').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.pub-step-ind').forEach(el => el.classList.remove('active'));
    document.getElementById('pubStep' + step).style.display = '';
    document.querySelector('.pub-step-ind[data-step="' + step + '"]').classList.add('active');
    // Load RIP if step 3
    if (step === 3) {
        if (settingsCache.baridimob_rip) document.getElementById('pubRip').textContent = settingsCache.baridimob_rip;
        const frais = settingsCache.frais_publication || '1000';
        document.getElementById('pubAmount').textContent = parseInt(frais).toLocaleString('fr') + ' DZ';
    }
}

function updatePubPrice() {
    const type = document.getElementById('pubType').value;
    // Just visual feedback, no blocking
}

function previewPhotos(event) {
    const preview = document.getElementById('pubPhotosPreview');
    preview.innerHTML = '';
    const files = event.target.files;
    for (let i = 0; i < Math.min(files.length, 5); i++) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.cssText = 'width:80px;height:60px;object-fit:cover;border-radius:6px;margin:4px;';
            preview.appendChild(img);
        };
        reader.readAsDataURL(files[i]);
    }
}

function copyRip() {
    const rip = document.getElementById('pubRip').textContent;
    navigator.clipboard.writeText(rip).then(() => alert('RIP copié !'));
}

function setupContactTypeChange() {
    const sel = document.getElementById('pubContactType');
    const input = document.getElementById('pubCustomPhone');
    if (sel && input) {
        sel.addEventListener('change', () => {
            input.style.display = sel.value === 'custom' ? '' : 'none';
        });
    }
}

function setupMapClick() {
    const frame = document.getElementById('pubMapFrame');
    if (!frame) return;
    // Listen for messages from iframe (Google Maps doesn't support this, so we use a workaround)
    // We'll add manual lat/lng input
    const latInput = document.getElementById('pubLat');
    const lngInput = document.getElementById('pubLng');
    if (latInput && lngInput) {
        latInput.removeAttribute('readonly');
        lngInput.removeAttribute('readonly');
        latInput.placeholder = 'Latitude (optionnel)';
        lngInput.placeholder = 'Longitude (optionnel)';
    }
}

function submitProperty() {
    if (!currentUser) { openLoginModal(); return; }
    if (!document.getElementById('pubTitle').value) { alert('Le titre est requis'); return; }
    if (!document.getElementById('pubPrice').value) { alert('Le prix est requis'); return; }
    if (!document.getElementById('pubConfirmed').checked) { alert('Veuillez confirmer le paiement'); return; }

    const formData = new FormData();
    formData.append('type', document.getElementById('pubType').value);
    formData.append('category', document.getElementById('pubCategory').value);
    formData.append('title', document.getElementById('pubTitle').value);
    formData.append('description', document.getElementById('pubDescription').value);
    formData.append('price', document.getElementById('pubPrice').value);
    formData.append('wilaya', document.getElementById('pubWilaya').value);
    formData.append('commune', document.getElementById('pubCommune').value);
    formData.append('address', document.getElementById('pubAddress').value);
    formData.append('lat', document.getElementById('pubLat').value);
    formData.append('lng', document.getElementById('pubLng').value);
    formData.append('surface', document.getElementById('pubSurface').value || '0');
    formData.append('rooms', document.getElementById('pubRooms').value || '0');
    formData.append('bathrooms', document.getElementById('pubBathrooms').value || '0');
    formData.append('parking', document.getElementById('pubParking').value);
    formData.append('condition', document.getElementById('pubCondition').value);
    formData.append('age', document.getElementById('pubAge').value || '0');
    formData.append('contact_phone', document.getElementById('pubContactType').value);
    if (document.getElementById('pubContactType').value === 'custom') {
        formData.append('contact_phone', document.getElementById('pubCustomPhone').value);
    }
    formData.append('client_rip', document.getElementById('pubClientRip').value);

    const photos = document.getElementById('pubPhotos').files;
    for (let i = 0; i < photos.length; i++) {
        formData.append('images', photos[i]);
    }

    // Add custom fields
    formFieldsCache.forEach(f => {
        const el = document.getElementById('custom_' + f.field_key);
        if (el) {
            formData.append('custom_' + f.field_key, el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value);
        }
    });

    const token = localStorage.getItem('immoelite_token');
    fetch('/api/properties', {
        method: 'POST',
        headers: {'Authorization': 'Bearer ' + token},
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { alert(data.error); return; }
        alert('Annonce publiée avec succès ! En attente de confirmation du paiement.');
        closePublishModal();
        loadProperties();
        // Reset form
        document.getElementById('pubTitle').value = '';
        document.getElementById('pubDescription').value = '';
        document.getElementById('pubPrice').value = '';
        document.getElementById('pubPhotosPreview').innerHTML = '';
    })
    .catch(() => alert('Erreur lors de la publication'));
}

// ============================================================
// CONTACT
// ============================================================
function submitContact(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('contactName').value,
        email: document.getElementById('contactEmail').value,
        phone: document.getElementById('contactPhone').value,
        subject: document.getElementById('contactSubject').value,
        message: document.getElementById('contactMessage').value
    };
    fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) { alert(data.error); return; }
        alert('Message envoyé avec succès !');
        document.getElementById('contactForm').reset();
    })
    .catch(() => alert('Erreur d\'envoi'));
}
