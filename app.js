// ====== CONFIGURATION ======
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwLijn27ps5idCrvKGNCBSz9NFbXV1_gQwFTmh-4Xc6B15d6EV-iQwviNH-ELWc1tinaA/exec"; // <-- set your Apps Script web app URL

// ====== UTILS ======
function apiPost(params) {
  const formData = new FormData();
  Object.entries(params).forEach(([k, v]) => formData.append(k, v));
  return fetch(WEB_APP_URL, { method: "POST", body: formData }).then(r => r.json());
}
function apiGet(params) {
  const q = new URLSearchParams(params).toString();
  return fetch(WEB_APP_URL + "?" + q).then(r => r.json());
}
function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString();
}
function formatTime(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleTimeString();
}
function showError(msg, selector = "#tab-content") {
  document.querySelector(selector).innerHTML = `<div class="error">${msg}</div>`;
}

// ====== AUTH & APP LOADER ======
document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('login-panel');
  const appContainer = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const tabContent = document.getElementById('tab-content');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const logoutBtn = document.getElementById('logout-btn');
  let session = JSON.parse(localStorage.getItem('pos_user') || "null");

  function showApp() {
    loginPanel.style.display = "none";
    appContainer.style.display = "block";
    loadTab('orders');
  }

  function logout() {
    localStorage.removeItem('pos_user');
    session = null;
    window.location.reload();
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.textContent = "";
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!username || !password) {
      loginError.textContent = "Please enter username and password.";
      return;
    }
    apiPost({ action: "login", username, password }).then(result => {
      if (result.success) {
        session = { username, name: result.name };
        localStorage.setItem('pos_user', JSON.stringify(session));
        showApp();
      } else {
        loginError.textContent = "Invalid username or password.";
      }
    }).catch(() => {
      loginError.textContent = "Network or server error.";
    });
  });

  // Tab navigation
  tabBtns.forEach(btn => {
    btn.onclick = () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadTab(btn.dataset.tab);
    };
  });
  logoutBtn.onclick = logout;

  // Auto-login if session exists
  if (session) showApp();

  // ===== TABS =====

  // Main loader
  function loadTab(tab) {
    switch (tab) {
      case 'orders':     return loadOrdersTab();
      case 'charging':   return loadChargingTab();
      case 'products':   return loadProductsTab();
      case 'dashboard':  return loadDashboardTab();
    }
  }

  // ----- ORDERS TAB -----
  function loadOrdersTab() {
    tabContent.innerHTML = `<h2>Orders</h2>
    <div id="order-products"></div>
    <div style="margin-top:8px;"><strong>Open Orders</strong></div>
    <div class="open-orders-list" id="open-orders-list"></div>`;
    apiGet({ action: "getProducts" }).then(products => {
      renderProductButtons(products);
    });
    loadOpenOrders();
  }
  function renderProductButtons(products) {
    const el = document.getElementById('order-products');
    el.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:9px;">
    ${products.map(p => `<button class="product-btn" data-name="${p.name}" data-rate="${p.rate}">${p.name}<br><span style="font-size:.8em;">Rs ${p.rate}</span></button>`).join('')}
    </div>
    <div id="order-entry-panel"></div>`;
    el.querySelectorAll('.product-btn').forEach(btn => {
      btn.onclick = () => showOrderEntry(btn.dataset.name, btn.dataset.rate);
    });
  }
  function showOrderEntry(name, rate) {
    const panel = document.getElementById('order-entry-panel');
    panel.innerHTML = `
      <form id="order-form" style="margin-top:7px;display:flex;align-items:center;gap:8px;">
      <input type="hidden" name="name" value="${name}" />
      <span><strong>${name}</strong></span>
      <input type="number" name="qty" min="1" value="1" required style="width:65px;" />
      <span style="color:#888;">x Rs ${rate}</span>
      <button type="submit" style="background:#5cb85c;color:#fff;">Add</button>
      </form>
      <div id="order-form-msg"></div>
    `;
    panel.querySelector('#order-form').onsubmit = function (e) {
      e.preventDefault();
      const qty = this.qty.value;
      const total = qty * rate;
      apiPost({
        action: "addOrder",
        items: name,
        qty,
        rate,
        total
      }).then(() => {
        panel.innerHTML = `<div style="color:#28a745;">Order added!</div>`;
        loadOpenOrders();
        setTimeout(() => panel.innerHTML = '', 1200);
      }).catch(() => {
        panel.querySelector('#order-form-msg').textContent = "Error. Try again.";
      });
    };
  }
  function loadOpenOrders() {
    const el = document.getElementById('open-orders-list');
    el.innerHTML = "Loading...";
    apiGet({ action: "getOpenOrders" }).then(orders => {
      if (!orders.length) {
        el.innerHTML = `<div style="color:#888;">No open orders.</div>`;
        return;
      }
      el.innerHTML = orders.map(order => `
        <div class="order">
          <div>
            <strong>${order.items}</strong> <span style="color:#444;">Qty: ${order.qty || '-'}</span><br>
            <span style="font-size:0.98em;color:#888;">${formatDate(order.date)} ${formatTime(order.date)}</span>
          </div>
          <div>
            <span style="color:#007bff;font-weight:600;">Rs ${order.total}</span>
            <button class="btn-green" data-sn="${order.sn}">&#10003;</button>
            <button class="btn-red" data-sn="${order.sn}">&#10005;</button>
          </div>
        </div>
      `).join('');
      // Tick = Close to Restaurant, Cross = Cancel
      el.querySelectorAll('.btn-green').forEach(btn => {
        btn.onclick = () => closeOrderToRestaurant(btn.dataset.sn);
      });
      el.querySelectorAll('.btn-red').forEach(btn => {
        btn.onclick = () => updateOrderStatus(btn.dataset.sn, "cancelled");
      });
    });
  }
  function closeOrderToRestaurant(sn) {
    apiPost({ action: "closeOrderToRestaurant", sn }).then(() => {
      loadOpenOrders();
    });
  }
  function updateOrderStatus(sn, status) {
    apiPost({ action: "updateOrderStatus", sn, status }).then(() => {
      loadOpenOrders();
    });
  }

  // ----- CHARGING TAB -----
  function loadChargingTab() {
    tabContent.innerHTML = `<h2>Charging</h2>
    <form id="charging-form" style="margin-bottom:14px;">
      <label><input type="radio" name="calc" value="percent" checked> By %</label>
      <label><input type="radio" name="calc" value="unit"> By Unit</label><br>
      <input type="number" name="chargeStartPercent" placeholder="Charge Start %" min="0" max="100" required />
      <input type="number" name="perPercent" placeholder="Per %" step="0.01" min="0" />
      <input type="number" name="chargingKcal" placeholder="Kcal" min="0" />
      <input type="number" name="perUnit" placeholder="Per Unit Rate" step="0.01" min="0" />
      <select name="paymentMode">
        <option value="cash">Cash</option>
        <option value="card">Card</option>
      </select>
      <button type="submit" style="background:#007bff;color:#fff;">Start</button>
    </form>
    <div id="charging-form-msg"></div>
    <div class="charging-list" id="charging-list"></div>`;
    document.getElementById('charging-form').onsubmit = function (e) {
      e.preventDefault();
      const form = e.target;
      apiPost({
        action: "addCharging",
        chargeStartPercent: form.chargeStartPercent.value,
        perPercent: form.perPercent.value,
        chargingKcal: form.chargingKcal.value,
        perUnit: form.perUnit.value,
        paymentMode: form.paymentMode.value
      }).then(() => {
        document.getElementById('charging-form-msg').innerHTML = `<span style="color:#28a745;">Charging started.</span>`;
        loadChargingList();
        setTimeout(() => document.getElementById('charging-form-msg').innerHTML = '', 1200);
      });
    };
    loadChargingList();
  }
  function loadChargingList() {
    const el = document.getElementById('charging-list');
    // You may want to filter only open charging records
    apiGet({ action: "getOpenCharging" }).then(records => {
      if (!records || !records.length) {
        el.innerHTML = `<div style="color:#888;">No open charging records.</div>`;
        return;
      }
      el.innerHTML = records.map(chg => `
        <div class="charging">
          <div>
            <strong>Start %: ${chg.chargeStartPercent}</strong>
            <span style="color:#444;">Kcal: ${chg.chargingKcal || '-'}</span><br>
            <span style="font-size:0.98em;color:#888;">${formatDate(chg.date)} ${formatTime(chg.date)}</span>
          </div>
          <div>
            <input type="number" placeholder="End %" style="width:70px;" id="endp-${chg.sn}" min="0" max="100"/>
            <button class="btn-calc" data-sn="${chg.sn}">&#10003;</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.btn-calc').forEach(btn => {
        btn.onclick = () => {
          const sn = btn.dataset.sn;
          const endPercent = document.getElementById('endp-' + sn).value;
          apiPost({ action: "completeCharging", sn, chargeEndPercent: endPercent, calcMethod: "percent" }).then(() => {
            loadChargingList();
          });
        };
      });
    });
  }

  // ----- PRODUCTS TAB -----
  function loadProductsTab() {
    tabContent.innerHTML = `<h2>Products</h2>
    <form id="product-form" style="margin-bottom:15px;">
      <input type="text" name="productName" placeholder="Product Name" required />
      <input type="number" name="rate" placeholder="Rate" required min="0" />
      <button type="submit" style="background:#007bff;color:#fff;">Add Product</button>
    </form>
    <div id="product-form-msg"></div>
    <div class="product-list" id="product-list"></div>`;
    document.getElementById('product-form').onsubmit = function (e) {
      e.preventDefault();
      const form = e.target;
      apiPost({
        action: "addProduct",
        productName: form.productName.value,
        rate: form.rate.value
      }).then(() => {
        document.getElementById('product-form-msg').innerHTML = `<span style="color:#28a745;">Product added.</span>`;
        loadProductList();
        setTimeout(() => document.getElementById('product-form-msg').innerHTML = '', 1200);
      });
    };
    loadProductList();
  }
  function loadProductList() {
    const el = document.getElementById('product-list');
    apiGet({ action: "getProducts" }).then(products => {
      if (!products.length) {
        el.innerHTML = `<div style="color:#888;">No products.</div>`;
        return;
      }
      el.innerHTML = products.map(p =>
        `<div class="product"><span><strong>${p.name}</strong> (Rs ${p.rate})</span></div>`
      ).join('');
    });
  }

  // ----- DASHBOARD TAB -----
  function loadDashboardTab() {
    tabContent.innerHTML = `<h2>Today's Dashboard</h2>
      <div class="dashboard-cards" id="dashboard-today"></div>
      <h3 style="margin-top:28px;">Datewise Dashboard</h3>
      <form id="datewise-form" style="margin-bottom:7px;">
        <input type="date" name="from" required />
        <input type="date" name="to" required />
        <button type="submit" style="background:#007bff;color:#fff;">View</button>
      </form>
      <div class="dashboard-cards" id="dashboard-datewise"></div>
      <div id="datewise-results"></div>
    `;
    // Today's
    apiGet({ action: "getTodaysDashboard" }).then(data => {
      document.getElementById('dashboard-today').innerHTML = `
        <div class="dashboard-card">Restaurant<br>Rs ${data.restaurantTotal || 0}</div>
        <div class="dashboard-card">Charging<br>Rs ${data.chargingTotal || 0}</div>
        <div class="dashboard-card">Expenses<br>Rs ${data.expensesTotal || 0}</div>
      `;
    });
    // Datewise
    document.getElementById('datewise-form').onsubmit = function (e) {
      e.preventDefault();
      const form = e.target;
      apiGet({ action: "getDatewiseDashboard", from: form.from.value, to: form.to.value }).then(res => {
        if (res.error) {
          showError(res.error, "#datewise-results");
          return;
        }
        document.getElementById('datewise-results').innerHTML =
          "<ul>" +
          res.map(r =>
            `<li>${formatDate(r.date)}: <strong>${r.type}</strong> - Rs ${r.total}</li>`
          ).join('') +
          "</ul>";
      });
    };
  }
});
