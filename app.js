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
function showModal(html, onClose) {
  const modalBg = document.createElement("div");
  modalBg.className = "modal-bg";
  modalBg.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(modalBg);
  modalBg.onclick = function(e) {
    if(e.target === modalBg && onClose) { onClose(); document.body.removeChild(modalBg);}
  };
  return modalBg;
}
function closeModal() {
  const modalBg = document.querySelector('.modal-bg');
  if(modalBg) document.body.removeChild(modalBg);
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
      case 'expenses':   return loadExpensesTab();
      case 'dashboard':  return loadDashboardTab();
    }
  }

  // ----- ORDERS TAB -----
  function loadOrdersTab() {
    tabContent.innerHTML = `<h2>New Order</h2>
    <div id="order-panel"></div>
    <div style="margin-top:8px;"><strong>Open Orders</strong></div>
    <div class="open-orders-list" id="open-orders-list"></div>`;
    apiGet({ action: "getProducts" }).then(products => {
      renderOrderPanel(products);
    });
    loadOpenOrders();
  }
  // Order Cart State
  let cart = [];
  function renderOrderPanel(products) {
    cart = [];
    const el = document.getElementById('order-panel');
    el.innerHTML = `
      <form id="order-add-item-form" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <select id="order-product-select" required>
          <option value="">Select Product</option>
          ${products.map(p => `<option value="${p.name}" data-rate="${p.rate}">${p.name} (Rs ${p.rate})</option>`).join('')}
        </select>
        <input type="number" id="order-qty" min="1" value="1" style="width:60px;" required />
        <button type="submit" style="background:#5cb85c;color:#fff;">Add</button>
      </form>
      <div style="margin-top:9px;">
        <table id="cart-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3faff;"><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th><th></th></tr>
          </thead>
          <tbody id="cart-body"></tbody>
        </table>
      </div>
      <div style="margin-top:6px;text-align:right;font-size:1.13em;"><strong id="cart-total">Total: Rs 0</strong></div>
      <button id="order-submit-btn" style="margin-top:12px;background:#007bff;color:#fff;" disabled>Place Order</button>
      <div id="order-form-msg"></div>
    `;
    updateCartTable();
    // Add item to cart
    el.querySelector('#order-add-item-form').onsubmit = function(e) {
      e.preventDefault();
      const prodSel = el.querySelector('#order-product-select');
      const name = prodSel.value;
      const rate = Number(prodSel.selectedOptions[0]?.getAttribute('data-rate') || 0);
      const qty = Number(el.querySelector('#order-qty').value);
      if (!name || !rate || !qty) return;
      const idx = cart.findIndex(item => item.name === name);
      if (idx >= 0) {
        cart[idx].qty += qty;
        cart[idx].total = cart[idx].qty * cart[idx].rate;
      } else {
        cart.push({ name, qty, rate, total: qty * rate });
      }
      updateCartTable();
      this.reset();
    };

    function updateCartTable() {
      const tbody = el.querySelector("#cart-body");
      tbody.innerHTML = cart.map((item, i) =>
        `<tr>
          <td>${item.name}</td>
          <td>${item.qty}</td>
          <td>Rs ${item.rate}</td>
          <td>Rs ${item.total}</td>
          <td><button data-i="${i}" style="color:#f33;background:transparent;border:none;">✕</button></td>
        </tr>`
      ).join('');
      el.querySelector("#cart-total").textContent = "Total: Rs " + cart.reduce((a, b) => a + b.total, 0);
      el.querySelector("#order-submit-btn").disabled = cart.length === 0;
      tbody.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => { cart.splice(btn.dataset.i, 1); updateCartTable(); }
      });
    }

    el.querySelector("#order-submit-btn").onclick = () => {
      if(cart.length === 0) return;
      el.querySelector("#order-form-msg").textContent = "Placing order...";
      apiPost({ action: "addOrder", items: JSON.stringify(cart) }).then(() => {
        cart = [];
        updateCartTable();
        el.querySelector("#order-form-msg").innerHTML = `<span style="color:#28a745;">Order placed!</span>`;
        loadOpenOrders();
        setTimeout(() => el.querySelector("#order-form-msg").innerHTML = '', 1200);
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
            <strong>${order.items.map(i=>`${i.name} x${i.qty}`).join(', ')}</strong>
            <br><span style="font-size:0.98em;color:#888;">${formatDate(order.date)} ${formatTime(order.date)}</span>
            <br><span style="color:#007bff;font-weight:600;">Rs ${order.total || order.items.reduce((a,b)=>a+(+b.total||0),0)}</span>
          </div>
          <div>
            <button class="btn-green" data-sn="${order.sn}" title="Close">&#10003;</button>
            <button class="btn-red" data-sn="${order.sn}" title="Cancel">&#10005;</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.btn-green').forEach(btn => {
        btn.onclick = () => showPaymentModeModal(btn.dataset.sn);
      });
      el.querySelectorAll('.btn-red').forEach(btn => {
        btn.onclick = () => {
          apiPost({ action: "cancelOrder", sn: btn.dataset.sn }).then(() => loadOpenOrders());
        };
      });
    });
  }
  function showPaymentModeModal(sn) {
    const modal = showModal(`
      <form id="paymode-form">
        <label>Payment Mode:</label>
        <select name="paymentMode" required>
          <option value="Cash">Cash</option>
          <option value="Esewa">Esewa</option>
          <option value="Fonepay">Fonepay</option>
        </select>
        <button type="submit" style="margin-top:10px;background:#28a745;color:#fff;">Confirm Payment</button>
      </form>
    `, closeModal);
    modal.querySelector('#paymode-form').onsubmit = function(e){
      e.preventDefault();
      const paymentMode = this.paymentMode.value;
      apiPost({ action: "closeOrder", sn, paymentMode }).then(() => {
        closeModal();
        loadOpenOrders();
      });
    };
  }

  // ----- CHARGING TAB -----
  function loadChargingTab() {
    tabContent.innerHTML = `<h2>Charging Orders</h2>
      <form id="charging-form" style="margin-bottom:14px;">
        <input type="number" name="chargeStartPercent" placeholder="Charge Start %" min="0" max="100" required style="width:100px;"/>
        <input type="number" name="perPercent" placeholder="Per %" step="0.01" min="0" style="width:100px;"/>
        <input type="number" name="chargingKcal" placeholder="Kcal" min="0" style="width:100px;"/>
        <input type="number" name="perUnit" placeholder="Per Unit Rate" step="0.01" min="0" style="width:120px;"/>
        <button type="submit" style="background:#007bff;color:#fff;">Charging Started</button>
      </form>
      <div id="charging-form-msg"></div>
      <div class="charging-list" id="charging-list"></div>`;
    document.getElementById('charging-form').onsubmit = function (e) {
      e.preventDefault();
      const form = e.target;
      apiPost({
        action: "startChargingOrder",
        chargeStartPercent: form.chargeStartPercent.value,
        perPercent: form.perPercent.value,
        chargingKcal: form.chargingKcal.value,
        perUnit: form.perUnit.value
      }).then(() => {
        document.getElementById('charging-form-msg').innerHTML = `<span style="color:#28a745;">Charging order started.</span>`;
        loadChargingList();
        setTimeout(() => document.getElementById('charging-form-msg').innerHTML = '', 1200);
      });
    };
    loadChargingList();
  }
  function loadChargingList() {
    const el = document.getElementById('charging-list');
    apiGet({ action: "getOpenChargingOrders" }).then(records => {
      if (!records || !records.length) {
        el.innerHTML = `<div style="color:#888;">No open charging orders.</div>`;
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
            <button class="btn-red" data-sn="${chg.sn}" title="Cancel">&#10005;</button>
          </div>
        </div>
      `).join('');
      el.querySelectorAll('.btn-calc').forEach(btn => {
        btn.onclick = () => showChargingPaymentModeModal(btn.dataset.sn);
      });
      el.querySelectorAll('.btn-red').forEach(btn => {
        btn.onclick = () => {
          apiPost({ action: "cancelChargingOrder", sn: btn.dataset.sn }).then(() => loadChargingList());
        };
      });
    });
  }
  function showChargingPaymentModeModal(sn) {
    const modal = showModal(`
      <form id="chpay-form">
        <label>Charge End %:</label>
        <input type="number" name="chargeEndPercent" min="0" max="100" required style="width:100px;">
        <label>Calculation Method:</label>
        <select name="calcMethod" required>
          <option value="percent">By %</option>
          <option value="unit">By Unit</option>
        </select>
        <label>Payment Mode:</label>
        <select name="paymentMode" required>
          <option value="Cash">Cash</option>
          <option value="Esewa">Esewa</option>
          <option value="Fonepay">Fonepay</option>
        </select>
        <button type="submit" style="margin-top:10px;background:#28a745;color:#fff;">Charging Completed</button>
      </form>
    `, closeModal);
    modal.querySelector('#chpay-form').onsubmit = function(e){
      e.preventDefault();
      const chargeEndPercent = this.chargeEndPercent.value;
      const calcMethod = this.calcMethod.value;
      const paymentMode = this.paymentMode.value;
      apiPost({ action: "closeChargingOrder", sn, chargeEndPercent, calcMethod, paymentMode }).then(() => {
        closeModal();
        loadChargingList();
      });
    };
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

  // ----- EXPENSES TAB -----
  function loadExpensesTab() {
    tabContent.innerHTML = `<h2>Expenses</h2>
      <form id="expense-form" style="margin-bottom:15px;">
        <input type="text" name="expenseDescription" placeholder="Description" required />
        <select name="expenseCategory" required>
          <option value="">Category</option>
          <option>Electricity</option>
          <option>Rent</option>
          <option>Restaurant</option>
          <option>Charging Electricity</option>
          <option>Salary</option>
          <option>Travel/Fuel</option>
          <option>Savings</option>
          <option>Other</option>
        </select>
        <input type="number" name="amount" placeholder="Amount" required min="0" step="0.01" />
        <select name="paymentMode" required>
          <option value="Cash">Cash</option>
          <option value="Esewa">Esewa</option>
          <option value="Fonepay">Fonepay</option>
        </select>
        <input type="text" name="remarks" placeholder="Remarks" />
        <button type="submit" style="background:#007bff;color:#fff;">Add Expense</button>
      </form>
      <div id="expense-form-msg"></div>
      <div class="expenses-list" id="expenses-list"></div>`;
    document.getElementById('expense-form').onsubmit = function (e) {
      e.preventDefault();
      const form = e.target;
      apiPost({
        action: "addExpense",
        expenseDescription: form.expenseDescription.value,
        expense_category: form.expenseCategory.value,
        amount: form.amount.value,
        paymentMode: form.paymentMode.value,
        remarks: form.remarks.value
      }).then(() => {
        document.getElementById('expense-form-msg').innerHTML = `<span style="color:#28a745;">Expense added.</span>`;
        loadExpensesList();
        setTimeout(() => document.getElementById('expense-form-msg').innerHTML = '', 1200);
      });
    };
    loadExpensesList();
  }
  function loadExpensesList() {
    const el = document.getElementById('expenses-list');
    apiGet({ action: "getRecentExpenses" }).then(expenses => {
      if (!expenses || !expenses.length) {
        el.innerHTML = `<div style="color:#888;">No expenses recorded.</div>`;
        return;
      }
      el.innerHTML = expenses.map(exp =>
        `<div class="expense">
           <span>
             <strong>${exp.expense_description || exp.expenseDescription}</strong>
             <span style="color:#888;font-size:.94em;"> (${exp.expense_category || exp.category})</span>
             <br><span style="color:#bbb;font-size:.92em;">${formatDate(exp.date)}</span>
           </span>
           <span>
             Rs ${exp.total_expenses_amount || exp.amount}
             <span style="color:#007bff; font-size:.92em;">${exp.payment_mode || exp.paymentMode}</span>
           </span>
         </div>`
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
    // You can adapt this based on your backend
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
