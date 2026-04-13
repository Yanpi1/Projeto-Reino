// ══════════════════════════════════════════
//   BOLO E DINDIN DO REINO — admin.js
//   Painel administrativo — usa API REST
//   Senha: Elevive
// ══════════════════════════════════════════

const ADMIN_PASSWORD = 'Elevive';
const API = '';

let editingProductId = null;
let currentImgBase64 = null;

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

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const msg = await res.text();
    showToast('Erro: ' + msg, 'error');
    throw new Error(msg);
  }
  return res.json();
}

// ── Auth ──
function adminLogin() {
  const pw  = document.getElementById('admin-password').value;
  const err = document.getElementById('login-error');
  if (pw === ADMIN_PASSWORD) {
    err.classList.remove('show');
    document.getElementById('admin-password').value = '';
    document.getElementById('page-login').classList.remove('active');
    document.getElementById('admin-panel').style.display = 'block';
    renderDashboard();
    renderAdminProducts();
    renderAdminOrders();
    loadPixConfig();
  } else {
    err.classList.add('show');
  }
}

function adminLogout() {
  document.getElementById('admin-panel').style.display = 'none';
  document.getElementById('page-login').classList.add('active');
}

// ── Tabs ──
function showAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'dashboard')      renderDashboard();
  if (tab === 'products-admin') renderAdminProducts();
  if (tab === 'orders-admin')   renderAdminOrders();
  if (tab === 'pix-config')     loadPixConfig();
}

// ── Dashboard ──
async function renderDashboard() {
  let prods = [], orders = [];
  try {
    [prods, orders] = await Promise.all([
      apiFetch('/api/products'),
      apiFetch('/api/orders')
    ]);
  } catch { return; }

  const revenue = orders.reduce((s, o) => s + (o.total || 0), 0);
  const pending = orders.filter(o => o.status === 'pendente').length;

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon">P</div>
      <div class="stat-info">
        <div class="stat-val">${prods.length}</div>
        <div class="stat-label">Produtos Cadastrados</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">O</div>
      <div class="stat-info">
        <div class="stat-val">${orders.length}</div>
        <div class="stat-label">Total de Pedidos</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">!</div>
      <div class="stat-info">
        <div class="stat-val">${pending}</div>
        <div class="stat-label">Pedidos Pendentes</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">R$</div>
      <div class="stat-info">
        <div class="stat-val" style="font-size:1.4rem">${fmtBRL(revenue)}</div>
        <div class="stat-label">Receita Total</div>
      </div>
    </div>`;

  const recent    = orders.slice(0, 5);
  const recentEl  = document.getElementById('recent-orders-admin');
  if (recent.length === 0) { recentEl.innerHTML = ''; return; }
  recentEl.innerHTML = `
    <div class="admin-form-card">
      <h3>Pedidos Recentes</h3>
      <div class="orders-list">
        ${recent.map(o => orderCardHTML(o)).join('')}
      </div>
    </div>`;
}

// ── Products Admin ──
async function renderAdminProducts() {
  let prods = [];
  try { prods = await apiFetch('/api/products'); } catch { return; }

  const el = document.getElementById('admin-products-list');
  if (prods.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Nenhum produto ainda. Adicione acima!</p>';
    return;
  }
  el.innerHTML = `<div class="admin-products-list">
    ${prods.map(p => `
      <div class="admin-product-row">
        ${p.img
          ? `<img src="${p.img}" alt="${p.name}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0" />`
          : `<div class="no-img" style="width:64px;height:64px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:0.85rem;font-weight:700;background:var(--bg2);flex-shrink:0;color:var(--text-muted)">sem foto</div>`}
        <div class="admin-product-info">
          <div class="ap-name">${p.name}</div>
          <div class="ap-meta">
            ${p.category} · ${fmtBRL(p.price)} ·
            <span style="color:${parseInt(p.stock)===0?'var(--danger)':parseInt(p.stock)<=3?'#f57f17':'var(--success)'}">
              ${parseInt(p.stock)===0 ? 'Esgotado' : parseInt(p.stock)<=3 ? `${p.stock} restantes` : `${p.stock} em estoque`}
            </span>
          </div>
        </div>
        <div class="admin-product-actions">
          <button class="btn-edit" onclick="editProduct('${p.id}')">Editar</button>
          <button class="btn-delete" onclick="deleteProduct('${p.id}')">Excluir</button>
        </div>
      </div>`).join('')}
  </div>`;
}

function previewImg(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentImgBase64 = e.target.result;
    const prev = document.getElementById('img-preview');
    prev.src = e.target.result;
    prev.classList.add('show');
    document.getElementById('upload-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

async function saveProduct() {
  const name     = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value.trim();
  const price    = parseFloat(document.getElementById('p-price').value);
  const stock    = parseInt(document.getElementById('p-stock').value);
  const desc     = document.getElementById('p-desc').value.trim();

  if (!name)     { showToast('Informe o nome do produto!', 'error'); return; }
  if (!category) { showToast('Informe a categoria!', 'error'); return; }
  if (isNaN(price) || price < 0) { showToast('Informe um preco valido!', 'error'); return; }
  if (isNaN(stock) || stock < 0) { showToast('Informe o estoque!', 'error'); return; }

  const body = { name, category, price, stock, desc };
  if (currentImgBase64 !== null) body.img = currentImgBase64;

  try {
    if (editingProductId) {
      await apiFetch('/api/products/' + editingProductId, {
        method: 'PUT',
        body: JSON.stringify(body)
      });
      showToast('Produto atualizado!');
      cancelEdit();
    } else {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      showToast('Produto adicionado!');
      resetProductForm();
    }
    renderAdminProducts();
  } catch { /* toast shown */ }
}

function resetProductForm() {
  document.getElementById('p-name').value     = '';
  document.getElementById('p-category').value = '';
  document.getElementById('p-price').value    = '';
  document.getElementById('p-stock').value    = '';
  document.getElementById('p-desc').value     = '';
  document.getElementById('p-img').value      = '';
  const prev = document.getElementById('img-preview');
  prev.src = '';
  prev.classList.remove('show');
  document.getElementById('upload-placeholder').style.display = '';
  currentImgBase64 = null;
}

async function editProduct(id) {
  let prods = [];
  try { prods = await apiFetch('/api/products'); } catch { return; }

  const p = prods.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  document.getElementById('p-name').value     = p.name;
  document.getElementById('p-category').value = p.category;
  document.getElementById('p-price').value    = p.price;
  document.getElementById('p-stock').value    = p.stock;
  document.getElementById('p-desc').value     = p.desc || '';
  currentImgBase64 = null;

  if (p.img) {
    const prev = document.getElementById('img-preview');
    prev.src = p.img;
    prev.classList.add('show');
    document.getElementById('upload-placeholder').style.display = 'none';
  }

  document.getElementById('product-form-title').textContent = 'Editando: ' + p.name;
  document.getElementById('btn-cancel-edit').classList.add('show');
  document.getElementById('tab-products-admin').scrollIntoView({ behavior: 'smooth' });
}

function cancelEdit() {
  editingProductId = null;
  resetProductForm();
  document.getElementById('product-form-title').textContent = 'Adicionar Novo Produto';
  document.getElementById('btn-cancel-edit').classList.remove('show');
}

async function deleteProduct(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;
  try {
    await apiFetch('/api/products/' + id, { method: 'DELETE' });
    showToast('Produto removido!');
    renderAdminProducts();
  } catch { /* toast shown */ }
}

// ── Orders Admin ──
async function renderAdminOrders() {
  let orders = [];
  try { orders = await apiFetch('/api/orders'); } catch { return; }

  const el = document.getElementById('admin-orders-list');
  if (!el) return;
  if (orders.length === 0) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">Nenhum pedido ainda.</p>';
    return;
  }
  el.innerHTML = `<div class="orders-list">${orders.map(o => orderCardHTML(o, true)).join('')}</div>`;
}

function orderCardHTML(o, showControls = false) {
  const statusLabels = {
    pendente:   'Pendente',
    confirmado: 'Confirmado',
    entregue:   'Entregue',
    cancelado:  'Cancelado'
  };
  const customer = o.customer || {
    name:    o.customer_name,
    phone:   o.customer_phone,
    address: o.customer_address,
    obs:     o.customer_obs
  };
  return `
    <div class="order-card status-${o.status}" id="order-${o.id}">
      <div class="order-header">
        <span class="order-code-badge">#${o.id}</span>
        <span class="order-status-badge ${o.status}">${statusLabels[o.status] || o.status}</span>
      </div>
      <div class="order-info">
        <div class="order-info-item">
          <div class="oi-label">Cliente</div>
          <div class="oi-val">${customer.name}</div>
        </div>
        <div class="order-info-item">
          <div class="oi-label">Telefone</div>
          <div class="oi-val">${customer.phone}</div>
        </div>
        <div class="order-info-item">
          <div class="oi-label">Entrega</div>
          <div class="oi-val">${formatDate(o.delivery_date || o.deliveryDate)} ${o.delivery_time && o.delivery_time !== '—' ? '· ' + o.delivery_time : ''}</div>
        </div>
        <div class="order-info-item">
          <div class="oi-label">Pagamento</div>
          <div class="oi-val">${o.payment === 'pix' ? 'PIX' : 'Na entrega'}</div>
        </div>
        <div class="order-info-item">
          <div class="oi-label">Total</div>
          <div class="oi-val" style="color:var(--primary-dark);font-size:1.05rem">${fmtBRL(o.total)}</div>
        </div>
        <div class="order-info-item">
          <div class="oi-label">Data do Pedido</div>
          <div class="oi-val">${new Date(o.created_at || o.createdAt).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>
      <div class="order-items-list">
        ${(o.items || []).map(i => `<div class="oi-row"><span>${i.name} x ${i.qty}</span><span>${fmtBRL(i.price * i.qty)}</span></div>`).join('')}
      </div>
      ${customer.address ? `<div style="font-size:0.84rem;color:var(--text-muted);margin-bottom:10px">Endereco: ${customer.address}</div>` : ''}
      ${customer.obs     ? `<div style="font-size:0.84rem;color:var(--text-muted);margin-bottom:10px">Obs: ${customer.obs}</div>` : ''}
      ${showControls ? `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="font-size:0.83rem;font-weight:700;color:var(--text-muted)">Status:</label>
          <select class="order-status-select" onchange="updateOrderStatus('${o.id}', this.value)">
            <option value="pendente"   ${o.status==='pendente'  ?'selected':''}>Pendente</option>
            <option value="confirmado" ${o.status==='confirmado'?'selected':''}>Confirmado</option>
            <option value="entregue"   ${o.status==='entregue'  ?'selected':''}>Entregue</option>
            <option value="cancelado"  ${o.status==='cancelado' ?'selected':''}>Cancelado</option>
          </select>
        </div>` : ''}
    </div>`;
}

async function updateOrderStatus(id, status) {
  try {
    await apiFetch('/api/orders/' + id + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast('Status atualizado!');
    renderAdminOrders();
    renderDashboard();
  } catch { /* toast shown */ }
}

// ── PIX Config ──
async function loadPixConfig() {
  try {
    const pix = await apiFetch('/api/pix');
    if (pix.key)  document.getElementById('pix-key-input').value = pix.key;
    if (pix.type) document.getElementById('pix-type').value      = pix.type;
    if (pix.name) document.getElementById('pix-name').value      = pix.name;
  } catch { /* ok */ }
}

async function savePix() {
  const key  = document.getElementById('pix-key-input').value.trim();
  const type = document.getElementById('pix-type').value;
  const name = document.getElementById('pix-name').value.trim();
  if (!key) { showToast('Informe a chave PIX!', 'error'); return; }
  try {
    await apiFetch('/api/pix', {
      method: 'PUT',
      body: JSON.stringify({ key, type, name })
    });
    showToast('PIX configurado com sucesso!');
  } catch { /* toast shown */ }
}
