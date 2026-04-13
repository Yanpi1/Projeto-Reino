// ══════════════════════════════════════════
//   BOLO E DINDIN DO REINO — script.js
//   Conectado ao backend Node.js + SQLite
// ══════════════════════════════════════════

const API = '';  // mesmo dominio; ex: '' ou 'http://localhost:3000'

// ── State ──
let cart = [];
let pendingAddProduct = null;
let allProducts = [];

// ── Utilities ──
function fmtBRL(val) {
  return 'R$ ' + parseFloat(val).toFixed(2).replace('.', ',');
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.classList.remove('show'), 3200);
}

// ── API calls ──
async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  } catch (e) {
    showToast('Erro de conexao com o servidor.', 'error');
    throw e;
  }
}

// ── Pages ──
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav a, nav button').forEach(a => a.classList.remove('active'));

  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const nav = document.getElementById('nav-' + page);
  if (nav) nav.classList.add('active');

  if (page === 'home')     renderFeatured();
  if (page === 'products') renderProducts();
  if (page === 'cart')     renderCart();
}

// ── Terms ──
function checkTerms(callback) {
  const accepted = localStorage.getItem('reino_terms');
  if (accepted) { callback(); return; }
  openModal('modal-terms');
  window._termsCallback = callback;
}

function acceptTerms() {
  localStorage.setItem('reino_terms', '1');
  closeModal('modal-terms');
  if (window._termsCallback) { window._termsCallback(); window._termsCallback = null; }
}

// ── Products ──
async function loadProducts() {
  allProducts = await apiFetch('/api/products');
}

function renderProductCard(p) {
  const stock = parseInt(p.stock);
  const stockLabel = stock === 0 ? 'Esgotado' : stock <= 3 ? `Restam ${stock}` : `${stock} disponiveis`;
  const stockClass = stock === 0 ? 'out' : stock <= 3 ? 'low' : 'in';
  const imgHTML = p.img
    ? `<img src="${p.img}" alt="${p.name}" />`
    : `<div class="product-img-placeholder"><span style="font-size:0.75rem;margin-top:4px;color:var(--text-muted)">${p.category}</span></div>`;

  return `
    <div class="product-card ${stock === 0 ? 'out-of-stock' : ''}" id="card-${p.id}">
      <div class="product-img-wrap">
        ${imgHTML}
        <span class="badge-stock ${stockClass}">${stockLabel}</span>
        <span class="badge-category">${p.category}</span>
      </div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        ${p.desc ? `<div class="product-desc">${p.desc}</div>` : '<div class="product-desc" style="min-height:0"></div>'}
        <div class="product-footer">
          <div class="product-price">
            ${fmtBRL(p.price)}
            <small>por unidade</small>
          </div>
          <button class="btn-add" onclick="tryAddToCart('${p.id}')" ${stock === 0 ? 'disabled' : ''}>
            ${stock === 0 ? 'Esgotado' : '+ Pedir'}
          </button>
        </div>
      </div>
    </div>`;
}

async function renderFeatured() {
  await loadProducts();
  const prods = allProducts.slice(0, 4);
  const grid = document.getElementById('featured-grid');
  if (!grid) return;
  if (prods.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;grid-column:1/-1">Em breve novos produtos!</p>';
    return;
  }
  grid.innerHTML = prods.map(renderProductCard).join('');
}

let activeCategory = 'all';

async function renderProducts(filterCat = activeCategory) {
  await loadProducts();
  const prods = allProducts;
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const cats = [...new Set(prods.map(p => p.category))];
  const tabsEl = document.getElementById('category-tabs');
  tabsEl.innerHTML =
    `<button class="cat-tab ${filterCat === 'all' ? 'active' : ''}" onclick="filterCategory('all', this)">Todos</button>` +
    cats.map(c => `<button class="cat-tab ${filterCat === c ? 'active' : ''}" onclick="filterCategory('${c}', this)">${c}</button>`).join('');

  const filtered = filterCat === 'all' ? prods : prods.filter(p => p.category === filterCat);

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:60px;grid-column:1/-1">Nenhum produto disponivel no momento</p>';
    return;
  }
  grid.innerHTML = filtered.map(renderProductCard).join('');
}

function filterCategory(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(cat);
}

// ── Cart ──
function tryAddToCart(productId) {
  checkTerms(() => {
    const p = allProducts.find(x => x.id === productId);
    if (!p) return;
    pendingAddProduct = p;
    document.getElementById('modal-add-title').textContent = p.name;
    document.getElementById('modal-add-body').textContent =
      `${p.desc ? p.desc + '\n\n' : ''}Preco: ${fmtBRL(p.price)}\nEstoque: ${p.stock} unidade(s)`;
    openModal('modal-add');
  });
}

function confirmAddToCart() {
  if (!pendingAddProduct) return;
  const p = pendingAddProduct;
  const existing = cart.find(c => c.id === p.id);
  const inCart = existing ? existing.qty : 0;
  if (inCart >= parseInt(p.stock)) {
    showToast('Estoque insuficiente!', 'error');
    closeModal('modal-add');
    return;
  }
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: p.id, name: p.name, price: parseFloat(p.price), img: p.img || null, qty: 1 });
  }
  updateCartBadge();
  closeModal('modal-add');
  showToast(p.name + ' adicionado ao carrinho!');
  pendingAddProduct = null;
}

function updateCartBadge() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  document.getElementById('cart-count').textContent = total;
}

async function renderCart() {
  const el = document.getElementById('cart-content');
  if (cart.length === 0) {
    el.innerHTML = `
      <div class="cart-empty">
        <h3 style="font-family:'Playfair Display',serif;font-size:1.5rem;margin-bottom:8px">Seu carrinho esta vazio</h3>
        <p>Adicione produtos para fazer seu pedido!</p>
        <button class="btn-hero" style="margin-top:24px;font-size:0.95rem;padding:13px 32px" onclick="showPage('products')">Ver Produtos</button>
      </div>`;
    return;
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  let pix = {};
  try { pix = await apiFetch('/api/pix'); } catch { /* ok */ }

  el.innerHTML = `
    <div class="cart-items" id="cart-items-list">
      ${cart.map(item => `
        <div class="cart-item">
          <div class="cart-item-img">
            ${item.img ? `<img src="${item.img}" alt="${item.name}" />` : '[foto]'}
          </div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">${fmtBRL(item.price)} / un.</div>
          </div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="changeQty('${item.id}', -1)">&#8722;</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="changeQty('${item.id}', 1)">+</button>
            <button class="btn-remove" onclick="removeFromCart('${item.id}')" title="Remover">X</button>
          </div>
        </div>`).join('')}
    </div>

    <div class="cart-summary">
      ${cart.map(c => `
        <div class="cart-summary-row">
          <span>${c.name} × ${c.qty}</span>
          <span>${fmtBRL(c.price * c.qty)}</span>
        </div>`).join('')}
      <div class="cart-summary-row total">
        <span>Total</span>
        <span>${fmtBRL(subtotal)}</span>
      </div>
    </div>

    <div class="form-section">
      <h3>Agendamento da Entrega</h3>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Seu Nome *</label>
          <input type="text" id="c-name" placeholder="Nome completo" />
        </div>
        <div class="form-group">
          <label>Telefone / WhatsApp *</label>
          <input type="tel" id="c-phone" placeholder="(61) 9 0000-0000" />
        </div>
      </div>
      <div class="form-row cols-2">
        <div class="form-group">
          <label>Data de Retirada/Entrega *</label>
          <input type="date" id="c-date" min="${new Date().toISOString().split('T')[0]}" />
        </div>
        <div class="form-group">
          <label>Horario Preferido</label>
          <input type="time" id="c-time" />
        </div>
      </div>
      <div class="form-row cols-1">
        <div class="form-group">
          <label>Endereco de Entrega (opcional)</label>
          <input type="text" id="c-address" placeholder="Deixe em branco para retirada no local" />
        </div>
      </div>
      <div class="form-row cols-1">
        <div class="form-group">
          <label>Observacoes</label>
          <textarea id="c-obs" placeholder="Alguma observacao especial?" rows="2" style="resize:vertical"></textarea>
        </div>
      </div>
    </div>

    <div class="form-section">
      <h3>Forma de Pagamento</h3>
      <div class="payment-options">
        <div class="pay-opt selected" id="pay-pix" onclick="selectPayment('pix')">
          <div class="pay-name">PIX</div>
          <div class="pay-desc">Pagamento antecipado</div>
        </div>
        <div class="pay-opt" id="pay-entrega" onclick="selectPayment('entrega')">
          <div class="pay-name">Na Entrega</div>
          <div class="pay-desc">Pague na hora</div>
        </div>
      </div>
      <div class="pix-box show" id="pix-box">
        ${pix.key ? `
          <div style="font-weight:700;margin-bottom:6px">Chave PIX (${pix.type || 'PIX'})</div>
          <div class="pix-key">${pix.key}</div>
          <div style="font-size:0.85rem;color:#2e7d32;margin-bottom:10px">Beneficiario: <strong>${pix.name || 'Igreja do Reino'}</strong></div>
          <button class="btn-copy" onclick="copyPix('${pix.key}')">Copiar Chave</button>
          <div style="font-size:0.8rem;color:#555;margin-top:10px">Apos pagar, envie o comprovante no culto</div>
        ` : `<div style="font-size:0.9rem;color:#555">Chave PIX ainda nao configurada pelo admin.</div>`}
      </div>
    </div>

    <button class="btn-finalizar" onclick="finalizarPedido()">Finalizar Pedido</button>`;
}

function changeQty(id, delta) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  const p = allProducts.find(x => x.id === id);
  const maxStock = p ? parseInt(p.stock) : 99;
  item.qty += delta;
  if (item.qty <= 0) { cart = cart.filter(c => c.id !== id); }
  else if (item.qty > maxStock) { item.qty = maxStock; showToast('Limite de estoque atingido!', 'error'); }
  updateCartBadge();
  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(c => c.id !== id);
  updateCartBadge();
  renderCart();
}

let selectedPayment = 'pix';

function selectPayment(type) {
  selectedPayment = type;
  document.querySelectorAll('.pay-opt').forEach(o => o.classList.remove('selected'));
  document.getElementById('pay-' + type).classList.add('selected');
  const pixBox = document.getElementById('pix-box');
  if (pixBox) pixBox.classList.toggle('show', type === 'pix');
}

function copyPix(key) {
  navigator.clipboard.writeText(key)
    .then(() => showToast('Chave PIX copiada!'))
    .catch(() => {
      const el = document.createElement('textarea');
      el.value = key;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      showToast('Chave PIX copiada!');
    });
}

async function finalizarPedido() {
  const name    = document.getElementById('c-name')?.value.trim();
  const phone   = document.getElementById('c-phone')?.value.trim();
  const date    = document.getElementById('c-date')?.value;
  const time    = document.getElementById('c-time')?.value;
  const address = document.getElementById('c-address')?.value.trim();
  const obs     = document.getElementById('c-obs')?.value.trim();

  if (!name)  { showToast('Informe seu nome!', 'error'); return; }
  if (!phone) { showToast('Informe seu telefone!', 'error'); return; }
  if (!date)  { showToast('Informe a data de entrega!', 'error'); return; }

  const orderData = {
    customer: { name, phone, address, obs },
    items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
    total: cart.reduce((s, c) => s + c.price * c.qty, 0),
    payment: selectedPayment,
    deliveryDate: date,
    deliveryTime: time || null,
    status: 'pendente'
  };

  try {
    const result = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });

    const orderId = result.id;
    cart = [];
    updateCartBadge();

    const el = document.getElementById('cart-content');
    el.innerHTML = `
      <div class="success-screen">
        <h2>Pedido Realizado!</h2>
        <p>Obrigado, <strong>${name}</strong>! Seu pedido foi registrado com sucesso.</p>
        <div class="order-code">#${orderId}</div>
        <p>
          Entrega/Retirada: <strong>${formatDate(date)}</strong>${time ? ' as ' + time : ''}<br>
          Pagamento: <strong>${selectedPayment === 'pix' ? 'PIX (antecipado)' : 'Na entrega'}</strong><br>
          Total: <strong>${fmtBRL(orderData.total)}</strong>
        </p>
        ${selectedPayment === 'pix' ? '<p style="margin-top:12px;font-size:0.9rem;color:#2e7d32">Nao esqueca de enviar o comprovante PIX no culto!</p>' : ''}
        <button class="btn-hero" style="margin-top:28px;font-size:0.95rem;padding:13px 32px" onclick="showPage(\'home\')">Voltar ao Inicio</button>
      </div>`;
  } catch (e) {
    // toast already shown
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Modals ──
function openModal(id)  { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('show');
  });
});

// ── Init ──
updateCartBadge();
showPage('home');
