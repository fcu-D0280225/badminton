// 動態獲取 API 基礎路徑
const getApiBase = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3010/api';
  }
  return `http://${hostname}:3010/api`;
};

const API_BASE = getApiBase();

// ========== Auth helpers ==========

function getToken() { return localStorage.getItem('jwt_token'); }
function setToken(t) { localStorage.setItem('jwt_token', t); }
function removeToken() { localStorage.removeItem('jwt_token'); }

// 登入後從 JWT 自動取得 venueId（不需要手動選館方 dropdown）
let _currentVenueId = null;

async function fetchAndSetVenueId() {
    try {
        const res = await authFetch(`${API_BASE}/auth/me`);
        if (!res.ok) return;
        const me = await res.json();
        if (me.role === 'venue' && me.entityId) {
            _currentVenueId = me.entityId;
            // 同步到 venue-select（保持舊功能相容）
            const sel = document.getElementById('venue-select');
            if (sel) sel.value = _currentVenueId;
        }
    } catch (e) {
        // 非阻塞：取不到就繼續，loadBillingRecords 會顯示提示
    }
}

async function authFetch(url, opts = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
        removeToken();
        showLoginScreen();
        throw new Error('請重新登入');
    }
    return res;
}

async function doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    if (!username || !password) {
        errEl.textContent = '請輸入帳號和密碼';
        errEl.style.display = 'block';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            errEl.textContent = body.message || '帳號或密碼錯誤';
            errEl.style.display = 'block';
            return;
        }
        const data = await res.json();
        setToken(data.access_token);
        hideLoginScreen(username);
        await fetchAndSetVenueId();
        await loadInitialData();
    } catch (e) {
        errEl.textContent = '連線失敗，請確認伺服器是否啟動';
        errEl.style.display = 'block';
    }
}

function doLogout() {
    removeToken();
    showLoginScreen();
}

function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}

function hideLoginScreen(username) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('header-username').textContent = username || '';
    document.getElementById('logout-btn').style.display = 'inline-block';
}

// ========== Tab 切換 ==========

function showTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    const idx = ['tab-bookings', 'tab-billing', 'tab-analytics'].indexOf(tabId);
    document.querySelectorAll('.tab-btn')[idx].classList.add('active');

    const venueId = document.getElementById('venue-select').value;
    if (!venueId) return;
    if (tabId === 'tab-billing') loadBillingRecords();
    if (tabId === 'tab-analytics') {
        const m = document.getElementById('analytics-month');
        if (!m.value) m.value = new Date().toISOString().slice(0, 7);
        loadAnalytics();
    }
}

// ========== 初始化 ==========

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 若有 token，直接顯示主畫面；否則顯示登入
    if (getToken()) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        document.getElementById('logout-btn').style.display = 'inline-block';
        fetchAndSetVenueId().then(() => loadInitialData());
    } else {
        showLoginScreen();
    }

    // 預設顯示收費管理 tab（場館主每日主任務）
    showTab('tab-billing');

    // 設定 billing 日期預設值為今天
    const today = new Date().toISOString().slice(0, 10);
    const billingDateEl = document.getElementById('billing-date');
    if (billingDateEl) billingDateEl.value = today;

    // 設定 billing month filter 預設為本月
    const billingMonthEl = document.getElementById('billing-filter-month');
    if (billingMonthEl) billingMonthEl.value = today.slice(0, 7);

    // 註冊 Service Worker（PWA）
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.error);
    }

    initQRCode();
});

// QR Code 相關功能
let qrCodeInstance = null;

function initQRCode() {
    // QR Code 會在顯示時生成
}

function showInstallQR() {
    const modal = document.getElementById('qr-modal');
    const qrContainer = document.getElementById('qrcode');
    const urlText = document.getElementById('qr-url-text');
    
    // 獲取當前網址
    const currentUrl = window.location.href;
    
    // 顯示網址
    urlText.value = currentUrl;
    
    // 清除舊的 QR Code
    qrContainer.innerHTML = '';
    
    // 生成新的 QR Code
    if (typeof QRCode !== 'undefined') {
        try {
            qrCodeInstance = new QRCode(qrContainer, {
                text: currentUrl,
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error('QR Code 生成失敗:', error);
            qrContainer.innerHTML = '<p style="color: red;">QR Code 生成失敗，請刷新頁面重試</p>';
        }
    } else {
        // 如果 QRCode 庫未載入，顯示錯誤
        qrContainer.innerHTML = '<p style="color: red;">QR Code 庫載入失敗，請刷新頁面重試</p>';
    }
    
    // 顯示彈窗
    modal.style.display = 'block';
}

function closeQRModal() {
    const modal = document.getElementById('qr-modal');
    modal.style.display = 'none';
    
    // 清除 QR Code
    if (qrCodeInstance) {
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = '';
        qrCodeInstance = null;
    }
}

function copyUrl() {
    const urlText = document.getElementById('qr-url-text');
    urlText.select();
    urlText.setSelectionRange(0, 99999); // 對於移動設備
    
    try {
        document.execCommand('copy');
        alert('網址已複製到剪貼板！');
    } catch (err) {
        // 使用現代 API
        navigator.clipboard.writeText(urlText.value).then(() => {
            alert('網址已複製到剪貼板！');
        }).catch(() => {
            alert('複製失敗，請手動選擇並複製');
        });
    }
}

// 點擊彈窗外部關閉
window.onclick = function(event) {
    const qrModal = document.getElementById('qr-modal');
    const dateModal = document.getElementById('date-booking-modal');
    
    if (event.target === qrModal) {
        closeQRModal();
    }
    if (event.target === dateModal) {
        closeDateBookingModal();
    }
}

// 載入初始資料
async function loadInitialData() {
    await loadVenues();
}

// ========== 館方功能 ==========

async function loadVenues() {
    try {
        const res = await authFetch(`${API_BASE}/venues`);
        const venues = await res.json();
        
        const select = document.getElementById('venue-select');
        select.innerHTML = '<option value="">請選擇館方</option>';
        
        venues.forEach(venue => {
            const option = document.createElement('option');
            option.value = venue.id;
            option.textContent = venue.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('載入館方失敗:', error);
    }
}

async function createVenue() {
    const name = document.getElementById('venue-name').value;
    const contact = document.getElementById('venue-contact').value;
    
    if (!name || !contact) {
        alert('請填寫所有必填欄位');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/venues`, {
            method: 'POST',
            body: JSON.stringify({ name, contact }),
        });
        
        alert('館方建立成功！');
        document.getElementById('venue-name').value = '';
        document.getElementById('venue-contact').value = '';
        await loadVenues();
    } catch (error) {
        alert('建立失敗：' + error.message);
    }
}

async function loadVenueData() {
    const venueId = document.getElementById('venue-select').value;
    if (!venueId) {
        document.getElementById('venue-content').style.display = 'none';
        return;
    }
    
    document.getElementById('venue-content').style.display = 'block';
    // 不自動搜尋，等待用戶點擊搜尋按鈕
    // await filterVenueBookings();
    await loadVenueCalendar();
    await loadVenueNotes();
}

async function filterVenueBookings() {
    const venueId = document.getElementById('venue-select').value;
    if (!venueId) {
        alert('請先選擇館方');
        return;
    }
    
    const date = document.getElementById('venue-filter-date').value;
    const playerName = document.getElementById('venue-filter-name').value.trim();
    const timeSlot = document.getElementById('venue-filter-timeslot').value.trim();
    
    // 建立查詢參數
    let url = `${API_BASE}/venues/${venueId}/bookings?`;
    if (date) url += `date=${date}&`;
    if (playerName) url += `playerName=${encodeURIComponent(playerName)}&`;
    if (timeSlot) url += `timeSlot=${encodeURIComponent(timeSlot)}&`;
    
    try {
        const list = document.getElementById('venue-bookings-list');
        list.innerHTML = '<p>搜尋中...</p>';
        
        const res = await authFetch(url);
        const bookings = await res.json();

        list.innerHTML = '';
        
        if (bookings.length === 0) {
            list.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">沒有找到符合條件的預約紀錄</p>';
            return;
        }
        
        bookings.forEach(booking => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const participant = booking.organizer?.name || booking.player?.name || '未知';
            const paymentStatus = booking.payment?.status || 'unpaid';
            const paymentAmount = booking.payment?.amount || 0;
            
            card.innerHTML = `
                <h4>${booking.date} ${booking.timeSlot}</h4>
                <p><strong>預約者：</strong>${participant}</p>
                <p><strong>狀態：</strong><span class="badge badge-${paymentStatus === 'paid' ? 'success' : 'warning'}">${paymentStatus === 'paid' ? '已付款' : '未付款'}</span></p>
                <p><strong>金額：</strong>$${paymentAmount}</p>
                ${booking.notes ? `<p><strong>備註：</strong>${booking.notes}</p>` : ''}
            `;
            
            list.appendChild(card);
        });
    } catch (error) {
        console.error('載入預約紀錄失敗:', error);
        const list = document.getElementById('venue-bookings-list');
        list.innerHTML = '<p style="color: red;">載入失敗，請稍後重試</p>';
    }
}

// 日曆相關變數
let currentCalendarDate = new Date();
let venueBookingsData = {}; // 儲存所有預約資料
let calendarViewMode = 'month'; // 'month' | 'week'
let calendarSelectedDate = null;

// 時段密度分析：4 段（早/午/晚/夜）
const CAL_PERIODS = [
    { start: 6,  end: 12 },
    { start: 12, end: 15 },
    { start: 15, end: 18 },
    { start: 18, end: 23 }
];
function parseBookingStartHour(timeSlot) {
    if (!timeSlot) return null;
    const m = timeSlot.match(/^(\d+):/);
    return m ? parseInt(m[1]) : null;
}
function getDensityBars(bookings) {
    return CAL_PERIODS.map(p => {
        const cnt = bookings.filter(b => {
            const h = parseBookingStartHour(b.timeSlot);
            return h !== null && h >= p.start && h < p.end;
        }).length;
        if (cnt === 0) return 'empty';
        if (cnt === 1) return 'light';
        if (cnt === 2) return 'busy';
        return 'full';
    });
}

// 載入日曆
async function loadVenueCalendar() {
    const venueId = document.getElementById('venue-select').value;
    const container = document.getElementById('venue-calendar');
    
    if (!venueId) {
        // 如果沒有選擇館方，清空日曆容器
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">請先選擇館方</p>';
        }
        return;
    }
    
    // 先顯示載入中
    if (container) {
        container.innerHTML = '<p style="text-align: center; padding: 20px;">載入中...</p>';
    }
    
    try {
        // 獲取所有預約紀錄
        const res = await authFetch(`${API_BASE}/venues/${venueId}/bookings`);
        const bookings = await res.json();
        
        // 整理預約資料，按日期分組
        venueBookingsData = {};
        if (bookings && Array.isArray(bookings)) {
            bookings.forEach(booking => {
                const date = booking.date;
                if (date) {
                    if (!venueBookingsData[date]) {
                        venueBookingsData[date] = [];
                    }
                    venueBookingsData[date].push(booking);
                }
            });
        }
        
        // 渲染日曆
        renderCalendar();
    } catch (error) {
        console.error('載入日曆資料失敗:', error);
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">載入日曆失敗，請稍後重試</p>';
        }
    }
}

// 渲染日曆（依視圖模式分派）
function renderCalendar() {
    if (calendarViewMode === 'week') {
        renderWeekView();
    } else {
        renderMonthView();
    }
}

// 月視圖：密度時段條
function renderMonthView() {
    const container = document.getElementById('venue-calendar');
    if (!container) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) {
        const monthNames = ['一月','二月','三月','四月','五月','六月',
                            '七月','八月','九月','十月','十一月','十二月'];
        monthYearEl.textContent = `${year}年 ${monthNames[month]}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const today = new Date();
    const isToday = (d, m, y) =>
        d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

    let html = `
        <div class="calendar-header">
            <div class="calendar-header-day">日</div>
            <div class="calendar-header-day">一</div>
            <div class="calendar-header-day">二</div>
            <div class="calendar-header-day">三</div>
            <div class="calendar-header-day">四</div>
            <div class="calendar-header-day">五</div>
            <div class="calendar-header-day">六</div>
        </div>
        <div class="calendar-days">
    `;

    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${prevMonthLastDay - i}</div></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const bookings = venueBookingsData[dateStr] || [];
        const hasBooking = bookings.length > 0;

        let cls = 'calendar-day' + (isToday(day, month, year) ? ' today' : '') +
                  (hasBooking ? ' has-booking' : ' available');

        let barsHtml = '';
        if (hasBooking) {
            const bars = getDensityBars(bookings);
            barsHtml = `<div class="cal-slot-bars">${bars.map(b =>
                `<div class="cal-slot-bar s-${b}"></div>`).join('')}</div>`;
        }

        html += `<div class="${cls}" onclick="showWeekView('${dateStr}')">
            <div class="calendar-day-number">${day}</div>
            ${barsHtml}
        </div>`;
    }

    const totalCells = startingDayOfWeek + daysInMonth;
    const remaining = 42 - totalCells;
    for (let day = 1; day <= remaining && day <= 14; day++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

// 切換到週視圖
function showWeekView(dateStr) {
    calendarSelectedDate = dateStr;
    calendarViewMode = 'week';
    renderWeekView();
}

// 切回月視圖
function showMonthView() {
    calendarViewMode = 'month';
    renderMonthView();
}

// 週視圖：08:00-20:00 時段格
function renderWeekView() {
    const container = document.getElementById('venue-calendar');
    if (!container) return;

    const selDate = new Date((calendarSelectedDate || new Date().toISOString().slice(0,10)) + 'T00:00:00');
    const dayOfWeek = selDate.getDay();
    const weekStart = new Date(selDate);
    weekStart.setDate(selDate.getDate() - dayOfWeek);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        days.push({ d, dStr });
    }

    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) {
        const d0 = days[0].d, d6 = days[6].d;
        monthYearEl.textContent = `${d0.getMonth()+1}/${d0.getDate()} — ${d6.getMonth()+1}/${d6.getDate()}`;
    }

    const HOUR_START = 8, HOUR_END = 20, ROW_H = 36;
    const dayNames = ['日','一','二','三','四','五','六'];

    // header
    let headerHtml = `<div class="cal-week-time-col"></div>`;
    days.forEach(({ d, dStr }) => {
        const cls = (dStr === todayStr ? ' today' : '') + (dStr === calendarSelectedDate ? ' selected' : '');
        headerHtml += `<div class="cal-week-header-day${cls}">
            <span class="cal-week-day-name">${dayNames[d.getDay()]}</span>
            <span class="cal-week-day-num">${d.getDate()}</span>
        </div>`;
    });

    // time labels
    let timeColHtml = '';
    for (let h = HOUR_START; h <= HOUR_END; h++) {
        timeColHtml += `<div class="cal-week-time-label" style="height:${ROW_H}px">${String(h).padStart(2,'0')}</div>`;
    }

    // day columns
    const colHeight = (HOUR_END - HOUR_START) * ROW_H;
    const dayColsHtml = days.map(({ dStr }) => {
        const bookings = venueBookingsData[dStr] || [];
        let blocks = '';
        bookings.forEach(b => {
            if (!b.timeSlot) return;
            const parts = b.timeSlot.split('-');
            if (parts.length < 2) return;
            const [sh, sm = 0] = parts[0].trim().split(':').map(Number);
            const [eh, em = 0] = parts[1].trim().split(':').map(Number);
            const startMin = sh * 60 + sm - HOUR_START * 60;
            const endMin   = eh * 60 + em - HOUR_START * 60;
            if (endMin <= 0 || startMin >= (HOUR_END - HOUR_START) * 60) return;
            const top    = Math.max(0, startMin / 60 * ROW_H);
            const height = Math.max(14, (endMin - startMin) / 60 * ROW_H - 2);
            const payStatus = b.payment?.status || 'unpaid';
            const sCls = payStatus === 'paid' ? 'status-paid' : payStatus === 'transfer' ? 'status-transfer' : 'status-unpaid';
            const name = b.organizer?.name || b.player?.name || '預約';
            blocks += `<div class="cal-week-booking ${sCls}" style="top:${top}px;height:${height}px"
                onclick="showDateBookings('${dStr}')" title="${name} ${b.timeSlot}">${name}</div>`;
        });
        return `<div class="cal-week-day-col" style="height:${colHeight}px">${blocks}</div>`;
    }).join('');

    container.innerHTML = `
        <div class="cal-week-back-row">
            <button class="cal-week-back-btn" onclick="showMonthView()">← 月視圖</button>
            <button class="cal-week-nav-btn" onclick="shiftWeek(-1)">‹</button>
            <button class="cal-week-nav-btn" onclick="shiftWeek(1)">›</button>
        </div>
        <div class="cal-week-view">
            <div class="cal-week-header">${headerHtml}</div>
            <div class="cal-week-body">
                <div class="cal-week-time-col">${timeColHtml}</div>
                <div class="cal-week-days-area">${dayColsHtml}</div>
            </div>
        </div>
    `;
}

// 週視圖：前/後一週
function shiftWeek(dir) {
    const d = new Date(calendarSelectedDate + 'T00:00:00');
    d.setDate(d.getDate() + dir * 7);
    calendarSelectedDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    renderWeekView();
}

// 上一個月
function previousMonth() {
    calendarViewMode = 'month';
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    loadVenueCalendar();
}

// 下一個月
function nextMonth() {
    calendarViewMode = 'month';
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    loadVenueCalendar();
}

// 顯示指定日期的預約詳情
async function showDateBookings(dateStr) {
    const venueId = document.getElementById('venue-select').value;
    if (!venueId) return;
    
    const modal = document.getElementById('date-booking-modal');
    const titleEl = document.getElementById('date-booking-title');
    const contentEl = document.getElementById('date-booking-content');
    
    // 格式化日期顯示
    const date = new Date(dateStr + 'T00:00:00');
    const dateFormatted = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    titleEl.textContent = `${dateFormatted} 預約詳情`;
    
    // 獲取該日期的預約紀錄
    const bookings = venueBookingsData[dateStr] || [];
    
    if (bookings.length === 0) {
        // 如果沒有預約，顯示可用時段
        try {
            const res = await authFetch(`${API_BASE}/venues/${venueId}/available-time-slots?date=${dateStr}`);
            const slots = await res.json();
            
            contentEl.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p style="color: #28a745; font-size: 18px; margin-bottom: 15px;">✓ 當天無預約</p>
                    <h4>可用時段：</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 15px;">
                        ${slots.length > 0 
                            ? slots.map(slot => `<span class="badge badge-success" style="font-size: 14px; padding: 8px 12px;">${slot}</span>`).join('')
                            : '<p style="color: #999;">當天沒有可用時段</p>'
                        }
                    </div>
                </div>
            `;
        } catch (error) {
            contentEl.innerHTML = '<p style="color: red;">載入失敗，請稍後重試</p>';
        }
    } else {
        // 顯示預約紀錄
        contentEl.innerHTML = `
            <div style="margin-bottom: 15px;">
                <p><strong>共有 ${bookings.length} 筆預約</strong></p>
            </div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${bookings.map(booking => {
                    const participant = booking.organizer?.name || booking.player?.name || '未知';
                    const paymentStatus = booking.payment?.status || 'unpaid';
                    const paymentAmount = booking.payment?.amount || 0;
                    const paymentId = booking.payment?.id;
                    const canMarkPaid = paymentId && paymentStatus !== 'paid';
                    
                    return `
                        <div class="card" style="margin-bottom: 15px;">
                            <h4>${booking.timeSlot}</h4>
                            <p><strong>預約者：</strong>${participant}</p>
                            <p>
                                <strong>狀態：</strong>
                                <span class="badge badge-${paymentStatus === 'paid' ? 'success' : 'warning'}">
                                    ${paymentStatus === 'paid' ? '已付款' : '未付款'}
                                </span>
                            </p>
                            <p><strong>金額：</strong>$${paymentAmount}</p>
                            ${booking.notes ? `<p><strong>備註：</strong>${booking.notes}</p>` : ''}
                            ${canMarkPaid ? `
                                <button 
                                    class="btn btn-primary" 
                                    style="margin-top: 10px;"
                                    onclick="markPaymentAsPaid(${paymentId}, '${dateStr}')"
                                >
                                    標記為已付款
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    modal.style.display = 'block';
}

// 關閉日期預約詳情彈窗
function closeDateBookingModal() {
    const modal = document.getElementById('date-booking-modal');
    modal.style.display = 'none';
}

async function loadVenueNotes() {
    const venueId = document.getElementById('venue-select').value;
    if (!venueId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/venues/${venueId}/notes`);
        const notes = await res.json();
        
        const list = document.getElementById('venue-notes-list');
        list.innerHTML = '';
        
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <p>${note.content}</p>
                <small>可見性：${note.visibility === 'public' ? '公開' : note.visibility === 'organizer' ? '只給團主看' : '只給臨打看'}</small>
                <button class="btn btn-danger" style="margin-top: 10px;" onclick="deleteVenueNote(${note.id})">刪除</button>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('載入備註失敗:', error);
    }
}

async function createVenueNote() {
    const venueId = document.getElementById('venue-select').value;
    const content = document.getElementById('venue-note-content').value;
    const visibility = document.getElementById('venue-note-visibility').value;
    
    if (!venueId || !content) {
        alert('請選擇館方並輸入備註內容');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/venues/${venueId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ content, visibility }),
        });
        
        alert('備註新增成功！');
        document.getElementById('venue-note-content').value = '';
        await loadVenueNotes();
    } catch (error) {
        alert('新增失敗：' + error.message);
    }
}

async function deleteVenueNote(noteId) {
    if (!confirm('確定要刪除此備註嗎？')) return;
    
    try {
        await authFetch(`${API_BASE}/venues/notes/${noteId}`, { method: 'DELETE' });
        
        await loadVenueNotes();
    } catch (error) {
        alert('刪除失敗：' + error.message);
    }
}

async function markPaymentAsPaid(paymentId, dateStr) {
    if (!paymentId) return;
    if (!confirm('確定要將此筆預約標記為「已付款」嗎？')) return;

    try {
        await authFetch(`${API_BASE}/payments/${paymentId}/mark-paid`, {
            method: 'PUT',
            body: JSON.stringify({}),
        });

        alert('已標記為已付款');
        await showDateBookings(dateStr);
        await loadVenueCalendar();
    } catch (error) {
        console.error('標記付款失敗:', error);
        alert('標記付款失敗，請稍後重試');
    }
}

function resetVenueFilters() {
    document.getElementById('venue-filter-date').value = '';
    document.getElementById('venue-filter-name').value = '';
    document.getElementById('venue-filter-timeslot').value = '';
    // 重新載入所有預約紀錄
    filterVenueBookings();
}

// ========== 收費管理 ==========

function getBillingVenueId() {
    return _currentVenueId || document.getElementById('venue-select').value || null;
}

async function loadBillingRecords() {
    const venueId = getBillingVenueId();
    const list = document.getElementById('billing-list');

    if (!venueId) {
        list.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#666;">
                <p style="font-size:15px;margin-bottom:8px;">尚未選擇館方</p>
                <p style="font-size:13px;color:#999;">請至「預約管理」頁面選擇館方後回來</p>
            </div>`;
        return;
    }

    const month = document.getElementById('billing-filter-month').value;
    const unpaidOnly = document.getElementById('billing-filter-unpaid').checked;

    let url = `${API_BASE}/billing/records?`;
    if (month) url += `month=${month}&`;

    list.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">載入中...</div>`;

    try {
        const res = await authFetch(url);
        const allRecords = await res.json();
        renderBillingHero(allRecords);
        const displayRecords = unpaidOnly
            ? allRecords.filter(r => r.paymentStatus === 'unpaid')
            : allRecords;
        renderBillingList(displayRecords);
    } catch (e) {
        list.innerHTML = `
            <div style="text-align:center;padding:30px;color:#dc2626;">
                <p style="font-weight:600;margin-bottom:4px;">載入失敗</p>
                <p style="font-size:13px;">請稍後重試</p>
                <button class="btn btn-secondary" style="margin-top:12px;" onclick="loadBillingRecords()">重試</button>
            </div>`;
    }
}

// Split Hero Chips (Variant A) — 未收款 chip + 收款進度 chip 並排
function renderBillingHero(allRecords) {
    const banner = document.getElementById('billing-summary-banner');
    if (!banner) return;

    const fmt = (n) => `NT$${Number(n).toLocaleString()}`;
    const unpaid = allRecords.filter(r => r.paymentStatus === 'unpaid');
    const unpaidTotal = unpaid.reduce((s, r) => s + Number(r.amount), 0);
    const totalRevenue = allRecords.reduce((s, r) => s + Number(r.amount), 0);
    const paidTotal = totalRevenue - unpaidTotal;
    const pct = totalRevenue > 0 ? Math.round((paidTotal / totalRevenue) * 100) : 0;

    banner.style.display = 'block';

    if (unpaid.length === 0) {
        banner.innerHTML = `
            <div class="billing-chips all-paid">
                <div class="billing-chip">
                    <div class="billing-chip-label">本月收款</div>
                    <div class="billing-chip-value primary">全部完成 ✓</div>
                    <div class="billing-chip-sub">${allRecords.length} 筆，共 ${fmt(totalRevenue)}</div>
                </div>
            </div>`;
    } else {
        banner.innerHTML = `
            <div class="billing-chips">
                <div class="billing-chip">
                    <div class="billing-chip-label">未收款</div>
                    <div class="billing-chip-value danger">${fmt(unpaidTotal)}</div>
                    <div class="billing-chip-sub">${unpaid.length} 筆待收</div>
                </div>
                <div class="billing-chip">
                    <div class="billing-chip-label">收款進度</div>
                    <div class="billing-chip-value primary">${pct}%</div>
                    <div class="billing-chip-progress">
                        <div class="billing-chip-progress-fill" style="width:${pct}%"></div>
                    </div>
                </div>
            </div>`;
    }
}

// R2: 卡片左邊框狀態色條 — 快速滾動時眼角就能辨識付款狀態
function renderBillingList(records) {
    const list = document.getElementById('billing-list');
    if (!records.length) {
        list.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#666;">
                <p style="font-size:15px;font-weight:500;margin-bottom:6px;">這個月還沒有收費記錄</p>
                <p style="font-size:13px;color:#999;margin-bottom:16px;">新增第一筆場費，開始追蹤收款狀況</p>
                <button class="btn btn-primary" onclick="document.getElementById('billing-team-name').focus(); window.scrollTo(0,0)">＋ 新增第一筆</button>
            </div>`;
        return;
    }

    const statusClass = { unpaid: 'status-unpaid', cash: 'status-paid', transfer: 'status-transfer' };
    const statusLabel = { unpaid: '未付款', cash: '現金 ✓', transfer: '轉帳' };
    const badgeClass  = { unpaid: 'badge-unpaid', cash: 'badge-paid', transfer: 'badge-transfer' };

    const renderCard = (r) => {
        const sClass = statusClass[r.paymentStatus] || 'status-unpaid';
        const sLabel = statusLabel[r.paymentStatus] || r.paymentStatus;
        const bClass = badgeClass[r.paymentStatus] || 'badge-unpaid';
        const meta = [
            r.date,
            r.startTime && r.endTime ? `${r.startTime}–${r.endTime}` : '',
            r.courtNumber || '',
        ].filter(Boolean).join(' · ');
        const paidNote = r.paidByNote ? ` · ${r.paidByNote}` : '';
        const recurring = r.recurringGroupId ? '<span style="font-size:11px;color:#9ca3af;margin-left:4px;">↻</span>' : '';
        const actionBtns = r.paymentStatus === 'unpaid' ? `
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;min-height:32px;" onclick="event.stopPropagation();quickMarkPaid(${r.id},'cash')">現金</button>
            <button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;min-height:32px;" onclick="event.stopPropagation();quickMarkPaid(${r.id},'transfer')">轉帳</button>
        ` : '';
        return `
        <div class="billing-card ${sClass}" onclick="openBillingEditModal(${r.id},'${r.paymentStatus}','${(r.paidByNote||'').replace(/'/g,"\\'")}',${r.amount})">
            <div class="card-status-bar"></div>
            <div class="card-body">
                <div class="card-left">
                    <div class="card-team">${r.teamName}${recurring}</div>
                    <div class="card-meta">${meta}${paidNote}</div>
                    ${actionBtns ? `<div class="card-actions">${actionBtns}</div>` : ''}
                </div>
                <div class="card-right">
                    <div class="card-amount">NT$${Number(r.amount).toLocaleString()}</div>
                    <span class="status-badge ${bClass}">${sLabel}</span>
                </div>
            </div>
        </div>`;
    };

    const groups = [
        { key: 'unpaid',   label: '未付款',    items: records.filter(r => r.paymentStatus === 'unpaid') },
        { key: 'transfer', label: '待確認匯款', items: records.filter(r => r.paymentStatus === 'transfer') },
        { key: 'cash',     label: '已付款',    items: records.filter(r => r.paymentStatus === 'cash') },
    ].filter(g => g.items.length > 0);

    list.innerHTML = groups.map(g => `
        <div class="billing-group-label">${g.label} · ${g.items.length} 筆</div>
        ${g.items.map(renderCard).join('')}
    `).join('');
}

async function quickMarkPaid(id, status) {
    try {
        await authFetch(`${API_BASE}/billing/records/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ paymentStatus: status }),
        });
        await loadBillingRecords();
    } catch (e) {
        alert('更新失敗：' + e.message);
    }
}

async function createBillingRecord() {
    const venueId = getBillingVenueId();
    if (!venueId) { alert('請先選擇館方'); return; }

    const teamName = document.getElementById('billing-team-name').value.trim();
    const courtNumber = document.getElementById('billing-court').value.trim();
    const date = document.getElementById('billing-date').value;
    const startTime = document.getElementById('billing-start-time').value;
    const endTime = document.getElementById('billing-end-time').value;
    const amount = parseFloat(document.getElementById('billing-amount').value);
    const paymentStatus = document.getElementById('billing-status').value;
    const recurring = document.getElementById('billing-recurring').checked;

    if (!teamName || !date || !startTime || !endTime || isNaN(amount)) {
        alert('請填寫球隊名稱、日期、時段和金額');
        return;
    }

    const dto = { teamName, date, startTime, endTime, amount, paymentStatus };
    if (courtNumber) dto.courtNumber = courtNumber;

    try {
        const endpoint = recurring
            ? `${API_BASE}/billing/records/recurring`
            : `${API_BASE}/billing/records`;
        const res = await authFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(dto),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            alert('新增失敗：' + (body.message || res.status));
            return;
        }
        const created = await res.json();
        const count = Array.isArray(created) ? created.length : 1;
        alert(`已新增 ${count} 筆收費記錄`);
        // 清空表單
        document.getElementById('billing-team-name').value = '';
        document.getElementById('billing-court').value = '';
        document.getElementById('billing-amount').value = '';
        document.getElementById('billing-recurring').checked = false;
        await loadBillingRecords();
    } catch (e) {
        alert('新增失敗：' + e.message);
    }
}

function openBillingEditModal(id, status, note, amount) {
    document.getElementById('edit-billing-id').value = id;
    document.getElementById('edit-billing-status').value = status;
    document.getElementById('edit-billing-note').value = note;
    document.getElementById('edit-billing-amount').value = amount;
    document.getElementById('billing-edit-modal').style.display = 'block';
}

function closeBillingEditModal() {
    document.getElementById('billing-edit-modal').style.display = 'none';
}

async function saveBillingEdit() {
    const id = document.getElementById('edit-billing-id').value;
    const paymentStatus = document.getElementById('edit-billing-status').value;
    const paidByNote = document.getElementById('edit-billing-note').value.trim();
    const amount = parseFloat(document.getElementById('edit-billing-amount').value);

    try {
        const res = await authFetch(`${API_BASE}/billing/records/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ paymentStatus, paidByNote, amount }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            alert('儲存失敗：' + (body.message || res.status));
            return;
        }
        closeBillingEditModal();
        await loadBillingRecords();
    } catch (e) {
        alert('儲存失敗：' + e.message);
    }
}

async function confirmDeleteBillingRecord() {
    const id = document.getElementById('edit-billing-id').value;
    if (!confirm('確定要刪除此筆記錄嗎？')) return;
    try {
        await authFetch(`${API_BASE}/billing/records/${id}`, { method: 'DELETE' });
        closeBillingEditModal();
        await loadBillingRecords();
    } catch (e) {
        alert('刪除失敗：' + e.message);
    }
}

async function exportBillingCsv() {
    const venueId = getBillingVenueId();
    if (!venueId) { alert('請先選擇館方'); return; }
    const month = document.getElementById('billing-filter-month').value;
    let url = `${API_BASE}/billing/records/export/csv`;
    if (month) url += `?month=${month}`;

    try {
        const token = getToken();
        const res = await fetch(url, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        if (!res.ok) { alert('匯出失敗'); return; }
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `billing${month ? '-' + month : ''}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (e) {
        alert('匯出失敗：' + e.message);
    }
}

// ========== 分析報表 ==========

async function loadAnalytics() {
    const venueId = getBillingVenueId();
    const content = document.getElementById('analytics-content');

    if (!venueId) {
        content.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:#666;">
                <p style="font-size:15px;margin-bottom:6px;">尚未選擇館方</p>
                <p style="font-size:13px;color:#999;">請至「預約管理」頁面選擇館方</p>
            </div>`;
        return;
    }

    const month = document.getElementById('analytics-month').value;
    let url = `${API_BASE}/billing/analytics`;
    if (month) url += `?month=${month}`;

    content.innerHTML = `<div style="text-align:center;padding:30px;color:#999;">載入中...</div>`;

    try {
        const res = await authFetch(url);
        const data = await res.json();
        renderAnalytics(data, month);
    } catch (e) {
        content.innerHTML = `
            <div style="text-align:center;padding:30px;color:#dc2626;">
                <p style="font-weight:600;margin-bottom:4px;">載入失敗</p>
                <p style="font-size:13px;">請稍後重試</p>
                <button class="btn btn-secondary" style="margin-top:12px;" onclick="loadAnalytics()">重試</button>
            </div>`;
    }
}

function renderAnalytics(data, month) {
    const { totalRevenue, totalCount, unpaidAmount, unpaidCount, teamStats, timeSlotStats } = data;
    const paidAmount = (totalRevenue || 0) - (unpaidAmount || 0);
    const paidCount = (totalCount || 0) - (unpaidCount || 0);
    const content = document.getElementById('analytics-content');

    const fmt = (n) => `NT$${Number(n || 0).toLocaleString()}`;

    content.innerHTML = `
        <div class="card" style="margin-bottom:16px;">
            <h4>${month || '全部'} 總覽</h4>
            <p>總場次：<strong>${totalCount || 0} 場</strong></p>
            <p>總金額：<strong>${fmt(totalRevenue)}</strong></p>
            <p>已收款：<strong style="color:var(--status-paid-text);">${fmt(paidAmount)}</strong>（${paidCount} 場）</p>
            <p>未收款：<strong style="color:var(--color-danger);">${fmt(unpaidAmount)}</strong>（${unpaidCount || 0} 場）</p>
        </div>

        <div class="card" style="margin-bottom:16px;">
            <h4>各球隊統計</h4>
            ${teamStats && teamStats.length ? teamStats.map(t => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--color-border);">
                    <span>${t.teamName}</span>
                    <span>${t.count} 場 / ${fmt(t.total)}</span>
                </div>
            `).join('') : '<p style="color:var(--color-text-secondary);">無資料</p>'}
        </div>

        <div class="card">
            <h4>熱門時段</h4>
            ${timeSlotStats && timeSlotStats.length ? timeSlotStats.map(s => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--color-border);">
                    <span>${s.startTime}</span>
                    <span>${s.count} 場</span>
                </div>
            `).join('') : '<p style="color:var(--color-text-secondary);">無資料</p>'}
        </div>
    `;
}

// 讓函數在全局可用
window.fetchAndSetVenueId = fetchAndSetVenueId;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.showTab = showTab;
window.createVenue = createVenue;
window.loadVenueData = loadVenueData;
window.filterVenueBookings = filterVenueBookings;
window.resetVenueFilters = resetVenueFilters;
window.loadVenueCalendar = loadVenueCalendar;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.showDateBookings = showDateBookings;
window.closeDateBookingModal = closeDateBookingModal;
window.showWeekView = showWeekView;
window.showMonthView = showMonthView;
window.shiftWeek = shiftWeek;
window.createVenueNote = createVenueNote;
window.deleteVenueNote = deleteVenueNote;
window.markPaymentAsPaid = markPaymentAsPaid;
window.showInstallQR = showInstallQR;
window.closeQRModal = closeQRModal;
window.createBillingRecord = createBillingRecord;
window.loadBillingRecords = loadBillingRecords;
window.quickMarkPaid = quickMarkPaid;
window.openBillingEditModal = openBillingEditModal;
window.closeBillingEditModal = closeBillingEditModal;
window.saveBillingEdit = saveBillingEdit;
window.confirmDeleteBillingRecord = confirmDeleteBillingRecord;
window.exportBillingCsv = exportBillingCsv;
window.loadAnalytics = loadAnalytics;
window.copyUrl = copyUrl;
