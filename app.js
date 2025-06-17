// ==== CONFIGURATION ====
// Set your Google Apps Script web app URL here:
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwDMNCKFvXI1N-7TjC6uW4dC-DbYak4J9okHgc-10uR7gagk6ujF0AS0UbNeq1P39XOFw/exec";

// ==== LOGIN LOGIC ====
document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('login-panel');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const appContainer = document.getElementById('app');

  // If already logged in (session in localStorage), skip login
  const userSession = localStorage.getItem('pos_user');
  if (userSession) {
    showApp();
  }

  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    loginError.textContent = "";

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      loginError.textContent = "Please enter username and password.";
      return;
    }

    // Prepare POST data
    const formData = new FormData();
    formData.append('action', 'login');
    formData.append('username', username);
    formData.append('password', password);

    fetch(WEB_APP_URL, {method: 'POST', body: formData})
      .then(resp => resp.text())
      .then(txt => {
        // Apps Script returns JSON string
        let result;
        try {
          result = JSON.parse(txt);
        } catch {
          loginError.textContent = "Server error. Try again.";
          return;
        }
        if (result.success) {
          // Save session
          localStorage.setItem('pos_user', JSON.stringify({username, name: result.name}));
          showApp();
        } else {
          loginError.textContent = "Invalid username or password.";
        }
      })
      .catch(() => {
        loginError.textContent = "Network or server error.";
      });
  });

  function showApp() {
    loginPanel.style.display = "none";
    appContainer.style.display = "block";
    appContainer.innerHTML = `<h2>Welcome to Modern POS</h2>
      <button id="logout-btn" style="float:right; margin-top:-36px;">Logout</button>
      <div style="margin-top:40px; color:#777;">App content will load here after login.</div>
    `;
    document.getElementById('logout-btn').onclick = function() {
      localStorage.removeItem('pos_user');
      window.location.reload();
    };
  }
});
