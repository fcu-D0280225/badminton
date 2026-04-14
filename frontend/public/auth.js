// 使用相對路徑，由前端 server 代理到後端
const API_BASE = '/api';

function showLogin() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  if (!username || !password) {
    alert('請輸入帳號和密碼');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '登入失敗');
    }

    const data = await res.json();
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_role', data.role);
    localStorage.setItem('auth_entityId', String(data.entityId));
    localStorage.setItem('auth_linkedEntityId', data.linkedEntityId != null ? String(data.linkedEntityId) : '');
    localStorage.setItem('auth_name', data.name || '');

    window.location.href = '/app';
  } catch (error) {
    alert(error.message || '登入失敗，請檢查帳號密碼');
  }
}

async function doRegister() {
  const role = document.getElementById('register-role').value;
  const name = document.getElementById('register-name').value.trim();
  const contact = document.getElementById('register-contact').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;

  if (!name || !contact || !username || !password) {
    alert('請填寫所有欄位');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, name, contact, username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || '註冊失敗');
    }

    const data = await res.json();
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('auth_role', data.role);
    localStorage.setItem('auth_entityId', String(data.entityId));
    localStorage.setItem('auth_linkedEntityId', data.linkedEntityId != null ? String(data.linkedEntityId) : '');
    localStorage.setItem('auth_name', data.name || '');

    window.location.href = '/app';
  } catch (error) {
    alert(error.message || '註冊失敗');
  }
}
