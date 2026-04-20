// 動態獲取 API 基礎路徑
// 如果是手機訪問，使用相對路徑；如果是本地開發，使用完整路徑
// 使用相對路徑，由前端 server 代理到後端

const API_BASE = '/api';

// 登入狀態
function getAuth() {
  return {
    token: localStorage.getItem('auth_token'),
    role: localStorage.getItem('auth_role'),
    entityId: localStorage.getItem('auth_entityId'),
    linkedEntityId: localStorage.getItem('auth_linkedEntityId') || null,
    name: localStorage.getItem('auth_name'),
  };
}

function authFetch(url, options = {}) {
  const { token } = getAuth();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...headers } });
}

function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_role');
  localStorage.removeItem('auth_entityId');
  localStorage.removeItem('auth_linkedEntityId');
  localStorage.removeItem('auth_name');
  window.location.href = '/login.html';
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    const auth = getAuth();
    if (!auth.token) {
        window.location.href = '/';
        return;
    }

    document.getElementById('user-info').textContent = `${auth.name || auth.role} 已登入`;
    initTabs();
    loadInitialData();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => initPushNotifications())
            .catch(console.error);
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

// 標籤切換與角色權限
function initTabs() {
    const auth = getAuth();
    const role = auth.role;

    const tabVenue = document.getElementById('tab-venue');
    const tabMember = document.getElementById('tab-member');
    const tabBooker = document.getElementById('tab-booker');
    const tabPlayer = document.getElementById('tab-player');
    const venueView = document.getElementById('venue-view');
    const memberView = document.getElementById('member-view');
    const bookerView = document.getElementById('booker-view');
    const playerView = document.getElementById('player-view');

    // 先全部隱藏
    tabVenue.classList.add('hidden');
    tabMember.classList.add('hidden');
    tabBooker.classList.add('hidden');
    if (tabPlayer) tabPlayer.classList.add('hidden');

    if (role === 'venue') {
        tabVenue.classList.remove('hidden');
        venueView.classList.add('active');
    } else if (role === 'booker') {
        tabBooker.classList.remove('hidden');
        bookerView.classList.add('active');
    } else if (role === 'player') {
        if (tabPlayer) tabPlayer.classList.remove('hidden');
        if (playerView) playerView.classList.add('active');
    } else {
        tabMember.classList.remove('hidden');
        memberView.classList.add('active');
    }

    const tabButtons = document.querySelectorAll('.tab-btn');
    const visibleTabs = document.querySelectorAll('.tab-btn:not(.hidden)');
    const views = document.querySelectorAll('.view');

    tabButtons.forEach(b => b.classList.remove('active'));
    if (visibleTabs.length > 0) visibleTabs[0].classList.add('active');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const viewName = btn.dataset.view;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`${viewName}-view`).classList.add('active');
            if (viewName === 'venue') loadVenues().then(() => loadVenueData());
            if (viewName === 'member') loadMemberData();
            if (viewName === 'booker') loadBookerData();
            if (viewName === 'player') loadPlayerViewData();
        });
    });
}

// 載入初始資料
async function loadInitialData() {
    const auth = getAuth();
    if (auth.role === 'venue') {
        const section = document.getElementById('venue-select-section');
        if (section) section.style.display = 'none';
        await loadVenueData();
    } else if (auth.role === 'booker') {
        await loadBookerData();
    } else if (auth.role === 'player') {
        await loadPlayerViewData();
    } else {
        await loadMemberData();
    }
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
            headers: { 'Content-Type': 'application/json' },
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

function getVenueId() {
    const auth = getAuth();
    if (auth.role === 'venue' && auth.entityId) return auth.entityId;
    const sel = document.getElementById('venue-select');
    return sel ? sel.value : null;
}

function getOrganizerId() {
    const auth = getAuth();
    if ((auth.role === 'organizer' || auth.role === 'member') && auth.entityId) return auth.entityId;
    const sel = document.getElementById('organizer-select');
    return sel ? sel.value : null;
}

function getPlayerId() {
    const auth = getAuth();
    if (auth.role === 'member' && auth.linkedEntityId) return auth.linkedEntityId;
    if (auth.role === 'player' && auth.entityId) return auth.entityId;
    const sel = document.getElementById('player-select');
    return sel ? sel.value : null;
}

async function loadVenueData() {
    const venueId = getVenueId();
    if (!venueId) {
        document.getElementById('venue-content').style.display = 'none';
        return;
    }
    
    const content = document.getElementById('venue-content');
    if (content) content.style.display = 'block';
    // 不自動搜尋，等待用戶點擊搜尋按鈕
    // await filterVenueBookings();
    await loadVenueCalendar();
    await loadVenueNotes();
}

function resetVenueBookingsFilter() {
    document.getElementById('venue-filter-date').value = '';
    document.getElementById('venue-filter-name').value = '';
    document.getElementById('venue-filter-timeslot').value = '';
    document.getElementById('venue-bookings-list').innerHTML = '';
}

async function filterVenueBookings() {
    const venueId = getVenueId();
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

// 載入日曆
async function loadVenueCalendar() {
    const venueId = getVenueId();
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

// 渲染日曆
function renderCalendar() {
    const container = document.getElementById('venue-calendar');
    if (!container) return;
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 更新月份標題
    const monthYearEl = document.getElementById('calendar-month-year');
    if (monthYearEl) {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', 
                          '七月', '八月', '九月', '十月', '十一月', '十二月'];
        monthYearEl.textContent = `${year}年 ${monthNames[month]}`;
    }
    
    // 獲取當月第一天和最後一天
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // 獲取上個月的天數
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    // 獲取今天的日期
    const today = new Date();
    const isToday = (day, checkMonth, checkYear) => {
        return day === today.getDate() && 
               checkMonth === today.getMonth() && 
               checkYear === today.getFullYear();
    };
    
    // 建立日曆 HTML
    let calendarHTML = `
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
    
    // 上個月的日期
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = prevMonthLastDay - i;
        calendarHTML += `
            <div class="calendar-day other-month">
                <div class="calendar-day-number">${day}</div>
            </div>
        `;
    }
    
    // 當月的日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bookings = venueBookingsData[dateStr] || [];
        const hasBooking = bookings.length > 0;
        
        let dayClass = 'calendar-day';
        if (isToday(day, month, year)) {
            dayClass += ' today';
        }
        if (hasBooking) {
            dayClass += ' has-booking';
        } else {
            dayClass += ' available';
        }
        
        calendarHTML += `
            <div class="${dayClass}" onclick="showDateBookings('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasBooking ? `<div class="calendar-day-badge">${bookings.length}筆</div>` : ''}
            </div>
        `;
    }
    
    // 下個月的日期（填滿最後一列）
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 42 - totalCells; // 6行 x 7天 = 42
    if (remainingCells > 0) {
        for (let day = 1; day <= remainingCells && day <= 14; day++) {
            calendarHTML += `
                <div class="calendar-day other-month">
                    <div class="calendar-day-number">${day}</div>
                </div>
            `;
        }
    }
    
    calendarHTML += '</div>';
    
    // 確保容器存在後再設置內容
    if (container) {
        container.innerHTML = calendarHTML;
    } else {
        console.error('無法設置日曆內容：容器不存在');
    }
}

// 上一個月
function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    loadVenueCalendar();
}

// 下一個月
function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    loadVenueCalendar();
}

// 顯示指定日期的預約詳情（館方完整管理介面）
async function showDateBookings(dateStr) {
    const venueId = getVenueId();
    if (!venueId) return;

    const modal = document.getElementById('date-booking-modal');
    const titleEl = document.getElementById('date-booking-title');
    const contentEl = document.getElementById('date-booking-content');

    const date = new Date(dateStr + 'T00:00:00');
    titleEl.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 預約管理`;

    contentEl.innerHTML = '<p style="text-align:center;padding:20px;">載入中...</p>';
    modal.style.display = 'block';

    try {
        const [slotsRes, organizersRes] = await Promise.all([
            authFetch(`${API_BASE}/venues/${venueId}/available-time-slots?date=${dateStr}`),
            authFetch(`${API_BASE}/organizers`),
        ]);
        const availableSlots = await slotsRes.json();
        const organizers = await organizersRes.json();

        const bookings = venueBookingsData[dateStr] || [];

        // ── 新增場次表單 ──
        const slotOptions = availableSlots.map(s => `<option value="${s}">${s}</option>`).join('');
        const organizerOptions = organizers.map(o => `<option value="${o.id}">${o.name}</option>`).join('');

        const createFormHtml = `
            <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:20px;">
                <h4 style="margin:0 0 12px;color:#0369a1;">＋ 新增場次</h4>
                <div style="display:grid;gap:8px;">
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <label style="font-size:13px;color:#555;min-width:60px;">時段</label>
                        <select id="new-booking-slot" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;min-width:140px;">
                            <option value="">選擇可用時段</option>
                            ${slotOptions || '<option disabled>當天已無可用時段</option>'}
                        </select>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <label style="font-size:13px;color:#555;min-width:60px;">預約者</label>
                        <select id="new-booking-organizer" style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;min-width:140px;">
                            <option value="">選擇成員（可空）</option>
                            ${organizerOptions}
                        </select>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <label style="font-size:13px;color:#555;min-width:60px;">金額</label>
                        <input type="number" id="new-booking-amount" value="0" min="0" step="50"
                            style="flex:1;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;min-width:100px;">
                    </div>
                    <button class="btn btn-primary" style="margin-top:4px;"
                        onclick="createVenueBooking('${dateStr}')">
                        確認新增
                    </button>
                </div>
            </div>
        `;

        // ── 已有預約清單 ──
        const bookingsHtml = bookings.length === 0
            ? `<p style="text-align:center;color:#999;padding:12px;">當天尚無預約</p>`
            : `<div style="max-height:420px;overflow-y:auto;">
                ${bookings.map(booking => {
                    const participant = booking.organizer?.name || booking.player?.name || '未指定';
                    const participantType = booking.organizer ? '成員' : booking.player ? '臨打' : '';
                    const paymentStatus = booking.payment?.status || 'unpaid';
                    const paymentAmount = booking.payment?.amount ?? 0;
                    const paymentMethod = booking.payment?.paymentMethod || '';
                    const paymentId = booking.payment?.id;
                    const paidAt = booking.payment?.paidAt ? new Date(booking.payment.paidAt).toLocaleString('zh-TW') : '';
                    const checkedIn = booking.checkedIn || false;
                    const notes = booking.notes || '';
                    const paymentMethodOptions = ['現金', '轉帳', 'LINE Pay', '街口', '信用卡']
                        .map(m => `<option value="${m}" ${paymentMethod === m ? 'selected' : ''}>${m}</option>`).join('');

                    return `
                        <div class="card" style="margin-bottom:16px;border-left:4px solid ${checkedIn ? '#22c55e' : '#f59e0b'};">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                                <h4 style="margin:0;">${booking.timeSlot}</h4>
                                <button class="btn btn-danger" style="padding:2px 10px;font-size:12px;"
                                    onclick="cancelBooking(${booking.id}, '${dateStr}')">取消場次</button>
                            </div>

                            <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin-bottom:12px;">
                                <span style="color:#666;">預約者</span>
                                <span><strong>${participant}</strong>${participantType ? ` <span class="badge badge-secondary" style="font-size:11px;">${participantType}</span>` : ''}</span>

                                <span style="color:#666;">報到</span>
                                <span>
                                    <span class="badge badge-${checkedIn ? 'success' : 'warning'}" style="margin-right:6px;">
                                        ${checkedIn ? '✓ 已報到' : '✗ 未報到'}
                                    </span>
                                    <button class="btn btn-secondary" style="padding:2px 10px;font-size:12px;"
                                        onclick="toggleCheckin(${booking.id}, '${dateStr}')">
                                        ${checkedIn ? '取消報到' : '標記報到'}
                                    </button>
                                </span>

                                <span style="color:#666;">付款</span>
                                <span>
                                    <span class="badge badge-${paymentStatus === 'paid' ? 'success' : 'warning'}">
                                        ${paymentStatus === 'paid' ? '已付款' : '未付款'}
                                    </span>
                                    ${paidAt ? `<small style="color:#666;margin-left:6px;">${paidAt}</small>` : ''}
                                </span>

                                <span style="color:#666;">金額</span>
                                <span>$${paymentAmount}</span>

                                <span style="color:#666;">付款方式</span>
                                <span>
                                    ${paymentStatus === 'paid'
                                        ? `<span>${paymentMethod || '未記錄'}</span>`
                                        : `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                                            <select id="payment-method-${booking.id}" style="padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;">
                                                <option value="">選擇付款方式</option>
                                                ${paymentMethodOptions}
                                            </select>
                                            <button class="btn btn-primary" style="padding:4px 12px;font-size:12px;"
                                                onclick="markPaymentAsPaid(${paymentId}, '${dateStr}', ${booking.id})">
                                                確認付款
                                            </button>
                                           </div>`
                                    }
                                </span>
                            </div>

                            <div style="padding-top:10px;border-top:1px solid #eee;">
                                <label style="font-size:13px;color:#666;display:block;margin-bottom:4px;">備註</label>
                                <textarea id="notes-${booking.id}" rows="2"
                                    style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;resize:vertical;box-sizing:border-box;"
                                    placeholder="輸入備註...">${notes}</textarea>
                                <button class="btn btn-secondary" style="margin-top:6px;padding:4px 12px;font-size:12px;"
                                    onclick="saveBookingNotes(${booking.id}, '${dateStr}')">
                                    儲存備註
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
               </div>`;

        contentEl.innerHTML = createFormHtml + bookingsHtml;
    } catch (error) {
        contentEl.innerHTML = '<p style="color:red;text-align:center;">載入失敗，請稍後重試</p>';
    }
}

// 關閉日期預約詳情彈窗
function closeDateBookingModal() {
    const modal = document.getElementById('date-booking-modal');
    modal.style.display = 'none';
}

// 舊的函數保留（向後相容）
async function loadAvailableTimeSlots() {
    // 這個函數現在由日曆功能取代
    await loadVenueCalendar();
}

async function loadVenueNotes() {
    const venueId = getVenueId();
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
    const venueId = getVenueId();
    const content = document.getElementById('venue-note-content').value;
    const visibility = document.getElementById('venue-note-visibility').value;
    
    if (!venueId || !content) {
        alert('請選擇館方並輸入備註內容');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/venues/${venueId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        await authFetch(`${API_BASE}/venues/notes/${noteId}`, {
            method: 'DELETE',
        });
        
        await loadVenueNotes();
    } catch (error) {
        alert('刪除失敗：' + error.message);
    }
}

async function createVenueBooking(dateStr) {
    const venueId = getVenueId();
    const timeSlot = document.getElementById('new-booking-slot')?.value;
    const organizerId = document.getElementById('new-booking-organizer')?.value;
    const amount = parseFloat(document.getElementById('new-booking-amount')?.value) || 0;

    if (!timeSlot) {
        alert('請選擇時段');
        return;
    }

    try {
        const body = { venueId: parseInt(venueId), date: dateStr, timeSlot, status: 'confirmed', amount };
        if (organizerId) body.organizerId = parseInt(organizerId);

        await authFetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        await loadVenueCalendar();
        await showDateBookings(dateStr);
    } catch (error) {
        console.error('新增場次失敗:', error);
        alert('新增失敗，請稍後重試');
    }
}

async function cancelBooking(bookingId, dateStr) {
    if (!confirm('確定要取消此場次？此操作無法復原。')) return;

    try {
        await authFetch(`${API_BASE}/bookings/${bookingId}`, { method: 'DELETE' });
        await loadVenueCalendar();
        await showDateBookings(dateStr);
    } catch (error) {
        console.error('取消場次失敗:', error);
        alert('取消失敗，請稍後重試');
    }
}

async function cancelMemberBooking(bookingId) {
    if (!confirm('確定要取消此預約？')) return;
    try {
        await authFetch(`${API_BASE}/bookings/${bookingId}`, { method: 'DELETE' });
        await loadMemberCalendar();
        await loadOrganizerBookings();
    } catch (error) {
        console.error('取消預約失敗:', error);
        alert('取消失敗，請稍後重試');
    }
}

async function markPaymentAsPaid(paymentId, dateStr, bookingId) {
    if (!paymentId) return;
    if (!confirm('確定要將此筆預約標記為「已付款」嗎？')) return;

    const paymentMethod = bookingId
        ? document.getElementById(`payment-method-${bookingId}`)?.value || ''
        : '';

    try {
        await authFetch(`${API_BASE}/payments/${paymentId}/mark-paid`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentMethod }),
        });

        await loadVenueCalendar();
        await showDateBookings(dateStr);
    } catch (error) {
        console.error('標記付款失敗:', error);
        alert('標記付款失敗，請稍後重試');
    }
}

async function toggleCheckin(bookingId, dateStr) {
    try {
        await authFetch(`${API_BASE}/bookings/${bookingId}/checkin`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
        });
        await loadVenueCalendar();
        await showDateBookings(dateStr);
    } catch (error) {
        console.error('更新報到狀態失敗:', error);
        alert('更新失敗，請稍後重試');
    }
}

async function saveBookingNotes(bookingId, dateStr) {
    const textarea = document.getElementById(`notes-${bookingId}`);
    if (!textarea) return;

    try {
        await authFetch(`${API_BASE}/bookings/${bookingId}/notes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: textarea.value }),
        });
        alert('備註已儲存');
        await loadVenueCalendar();
    } catch (error) {
        console.error('儲存備註失敗:', error);
        alert('儲存失敗，請稍後重試');
    }
}

// ========== 成員視圖（合併團主 + 臨打） ==========

async function loadMemberData() {
    await loadMemberVenueList();
    await loadMemberCalendar();
    await loadOrganizerBookings();
    await loadPlayerBookingHistory();
    await loadPlayerCreditScore();
    await loadOrganizerNotes();
}

async function loadMemberVenueList() {
    try {
        const res = await authFetch(`${API_BASE}/venues`);
        const venues = await res.json();
        const sel = document.getElementById('member-venue-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">選擇場地</option>';
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            sel.appendChild(opt);
        });
    } catch (error) {
        console.error('載入場地清單失敗:', error);
    }
}

const ALL_TIME_SLOTS = [
    '09:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00',
    '14:00-15:00','15:00-16:00','16:00-17:00','17:00-18:00','18:00-19:00',
    '19:00-20:00','20:00-21:00','21:00-22:00',
];

async function searchAvailableSlots() {
    const venueId = document.getElementById('member-venue-select')?.value;
    const date = document.getElementById('member-book-date')?.value;
    const container = document.getElementById('member-available-slots');

    if (!venueId || !date) {
        alert('請選擇場地和日期');
        return;
    }

    container.innerHTML = '<p style="color:#666;">查詢中...</p>';

    try {
        const res = await authFetch(`${API_BASE}/venues/${venueId}/available-time-slots?date=${date}`);
        const available = await res.json();
        const full = ALL_TIME_SLOTS.filter(s => !available.includes(s));

        if (available.length === 0 && full.length === 0) {
            container.innerHTML = '<p style="color:#999;">當天無時段資料</p>';
            return;
        }

        const availHtml = available.length > 0 ? `
            <p style="font-size:13px;font-weight:600;color:#333;margin:0 0 6px;">可預約時段</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
                ${available.map(slot => `
                    <button class="btn btn-primary" style="font-size:13px;"
                        onclick="memberBookWithOptions('${venueId}','${date}','${slot}')">
                        ${slot}
                    </button>
                `).join('')}
            </div>` : '';

        const fullHtml = full.length > 0 ? `
            <p style="font-size:13px;font-weight:600;color:#999;margin:0 0 6px;">已滿（可加入候補）</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${full.map(slot => `
                    <button class="btn btn-secondary" style="font-size:13px;opacity:0.7;"
                        onclick="joinWaitlist('${venueId}','${date}','${slot}')">
                        ${slot} 候補
                    </button>
                `).join('')}
            </div>` : '';

        container.innerHTML = availHtml + fullHtml;
    } catch (error) {
        container.innerHTML = '<p style="color:red;">查詢失敗，請稍後重試</p>';
    }
}

async function memberBook(venueId, date, timeSlot) {
    const organizerId = getOrganizerId();
    if (!organizerId) {
        alert('無法取得成員資料，請重新登入');
        return;
    }
    if (!confirm(`確定要預約 ${date} ${timeSlot}？`)) return;

    try {
        await authFetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                venueId: parseInt(venueId),
                organizerId: parseInt(organizerId),
                date,
                timeSlot,
                status: 'confirmed',
                amount: 0,
            }),
        });

        alert('預約成功！');
        document.getElementById('member-available-slots').innerHTML = '';
        await loadMemberCalendar();
        await loadOrganizerBookings();
    } catch (error) {
        console.error('預約失敗:', error);
        alert('預約失敗，請稍後重試');
    }
}

// 成員日曆：合併 organizer bookings + player booking-history
let currentMemberCalendarDate = new Date();
let memberBookingsData = {}; // { dateStr: [{ ...booking, _type: 'organizer'|'player' }] }

async function loadMemberCalendar() {
    const organizerId = getOrganizerId();
    const playerId = getPlayerId();
    const container = document.getElementById('member-calendar');

    if (!organizerId && !playerId) {
        if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">無法取得成員資料</p>';
        return;
    }

    if (container) container.innerHTML = '<p style="text-align: center; padding: 20px;">載入中...</p>';

    try {
        memberBookingsData = {};

        const addToData = (bookings, type) => {
            if (!bookings || !Array.isArray(bookings)) return;
            bookings.forEach(booking => {
                const date = booking.date;
                if (date) {
                    if (!memberBookingsData[date]) memberBookingsData[date] = [];
                    memberBookingsData[date].push({ ...booking, _type: type });
                }
            });
        };

        if (organizerId) {
            const res = await authFetch(`${API_BASE}/organizers/${organizerId}/bookings`);
            addToData(await res.json(), 'organizer');
        }

        if (playerId) {
            const res = await authFetch(`${API_BASE}/players/${playerId}/booking-history`);
            addToData(await res.json(), 'player');
        }

        renderMemberCalendar();
    } catch (error) {
        console.error('載入成員日曆失敗:', error);
        if (container) container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">載入日曆失敗，請稍後重試</p>';
    }
}

function renderMemberCalendar() {
    const container = document.getElementById('member-calendar');
    if (!container) return;

    const year = currentMemberCalendarDate.getFullYear();
    const month = currentMemberCalendarDate.getMonth();

    const monthYearEl = document.getElementById('member-calendar-month-year');
    if (monthYearEl) {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                            '七月', '八月', '九月', '十月', '十一月', '十二月'];
        monthYearEl.textContent = `${year}年 ${monthNames[month]}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const today = new Date();
    const isToday = (d, m, y) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

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
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bookings = memberBookingsData[dateStr] || [];
        const hasBooking = bookings.length > 0;
        let dayClass = 'calendar-day' + (isToday(day, month, year) ? ' today' : '') + (hasBooking ? ' has-booking' : ' available');

        html += `
            <div class="${dayClass}" onclick="showMemberDateBookings('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasBooking ? `<div class="calendar-day-badge">${bookings.length}筆</div>` : ''}
            </div>
        `;
    }

    const remainingCells = 42 - (startingDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells && day <= 14; day++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function previousMemberMonth() {
    currentMemberCalendarDate.setMonth(currentMemberCalendarDate.getMonth() - 1);
    loadMemberCalendar();
}

function nextMemberMonth() {
    currentMemberCalendarDate.setMonth(currentMemberCalendarDate.getMonth() + 1);
    loadMemberCalendar();
}

function showMemberDateBookings(dateStr) {
    const modal = document.getElementById('date-booking-modal');
    const titleEl = document.getElementById('date-booking-title');
    const contentEl = document.getElementById('date-booking-content');

    const date = new Date(dateStr + 'T00:00:00');
    titleEl.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 預約詳情`;

    const bookings = memberBookingsData[dateStr] || [];

    if (bookings.length === 0) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color: #28a745; font-size: 18px;">✓ 當天無預約</p></div>';
    } else {
        contentEl.innerHTML = `
            <div style="margin-bottom: 15px;"><p><strong>共有 ${bookings.length} 筆</strong></p></div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${bookings.map(booking => {
                    const typeLabel = booking._type === 'organizer' ? '我預約的場地' : '我參與的場次';
                    const venueName = booking.venue?.name || '未知';
                    const paymentStatus = booking.payment?.status || 'unpaid';
                    return `
                        <div class="card" style="margin-bottom: 15px; border-left: 4px solid ${booking._type === 'organizer' ? '#3b82f6' : '#10b981'};">
                            <small style="color: #666;">${typeLabel}</small>
                            <h4 style="margin: 4px 0;">${booking.timeSlot}</h4>
                            <p><strong>場地：</strong>${venueName}</p>
                            <p><strong>付款：</strong>
                                <span class="badge badge-${paymentStatus === 'paid' ? 'success' : 'warning'}">
                                    ${paymentStatus === 'paid' ? '已付款' : '未付款'}
                                </span>
                            </p>
                            <p><strong>狀態：</strong>${booking.status}</p>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    modal.style.display = 'block';
}

// ========== 團主日曆 ==========

let currentOrganizerCalendarDate = new Date();
let organizerBookingsData = {};

async function loadOrganizerCalendar() {
    const organizerId = getOrganizerId();
    const container = document.getElementById('organizer-calendar');

    if (!organizerId) {
        if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">請先選擇團主</p>';
        return;
    }

    if (container) container.innerHTML = '<p style="text-align: center; padding: 20px;">載入中...</p>';

    try {
        const res = await authFetch(`${API_BASE}/organizers/${organizerId}/bookings`);
        const bookings = await res.json();

        organizerBookingsData = {};
        if (bookings && Array.isArray(bookings)) {
            bookings.forEach(booking => {
                const date = booking.date;
                if (date) {
                    if (!organizerBookingsData[date]) organizerBookingsData[date] = [];
                    organizerBookingsData[date].push(booking);
                }
            });
        }

        renderOrganizerCalendar();
    } catch (error) {
        console.error('載入團主日曆失敗:', error);
        if (container) container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">載入日曆失敗，請稍後重試</p>';
    }
}

function renderOrganizerCalendar() {
    const container = document.getElementById('organizer-calendar');
    if (!container) return;

    const year = currentOrganizerCalendarDate.getFullYear();
    const month = currentOrganizerCalendarDate.getMonth();

    const monthYearEl = document.getElementById('organizer-calendar-month-year');
    if (monthYearEl) {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                            '七月', '八月', '九月', '十月', '十一月', '十二月'];
        monthYearEl.textContent = `${year}年 ${monthNames[month]}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const today = new Date();
    const isToday = (d, m, y) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

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
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bookings = organizerBookingsData[dateStr] || [];
        const hasBooking = bookings.length > 0;
        let dayClass = 'calendar-day' + (isToday(day, month, year) ? ' today' : '') + (hasBooking ? ' has-booking' : ' available');

        html += `
            <div class="${dayClass}" onclick="showOrganizerDateBookings('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasBooking ? `<div class="calendar-day-badge">${bookings.length}筆</div>` : ''}
            </div>
        `;
    }

    const remainingCells = 42 - (startingDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells && day <= 14; day++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function previousOrganizerMonth() {
    currentOrganizerCalendarDate.setMonth(currentOrganizerCalendarDate.getMonth() - 1);
    loadOrganizerCalendar();
}

function nextOrganizerMonth() {
    currentOrganizerCalendarDate.setMonth(currentOrganizerCalendarDate.getMonth() + 1);
    loadOrganizerCalendar();
}

function showOrganizerDateBookings(dateStr) {
    const modal = document.getElementById('date-booking-modal');
    const titleEl = document.getElementById('date-booking-title');
    const contentEl = document.getElementById('date-booking-content');

    const date = new Date(dateStr + 'T00:00:00');
    titleEl.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 預約詳情`;

    const bookings = organizerBookingsData[dateStr] || [];

    if (bookings.length === 0) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color: #28a745; font-size: 18px;">✓ 當天無預約</p></div>';
    } else {
        contentEl.innerHTML = `
            <div style="margin-bottom: 15px;"><p><strong>共有 ${bookings.length} 筆預約</strong></p></div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${bookings.map(booking => `
                    <div class="card" style="margin-bottom: 15px;">
                        <h4>${booking.timeSlot}</h4>
                        <p><strong>館方：</strong>${booking.venue?.name || '未知'}</p>
                        <p><strong>聯絡方式：</strong>${booking.venue?.contact || '未知'}</p>
                        <p><strong>狀態：</strong><span class="badge badge-${booking.status === 'confirmed' ? 'success' : 'warning'}">${booking.status}</span></p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    modal.style.display = 'block';
}

// ========== 團主功能 ==========

async function loadOrganizers() {
    try {
        const res = await authFetch(`${API_BASE}/organizers`);
        const organizers = await res.json();
        
        const select = document.getElementById('organizer-select');
        select.innerHTML = '<option value="">請選擇團主</option>';
        
        organizers.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('載入團主失敗:', error);
    }
}

async function createOrganizer() {
    const name = document.getElementById('organizer-name').value;
    const contact = document.getElementById('organizer-contact').value;
    
    if (!name || !contact) {
        alert('請填寫所有必填欄位');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/organizers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact }),
        });
        
        alert('團主建立成功！');
        document.getElementById('organizer-name').value = '';
        document.getElementById('organizer-contact').value = '';
        await loadOrganizers();
    } catch (error) {
        alert('建立失敗：' + error.message);
    }
}

async function loadOrganizerData() {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    await loadOrganizerCalendar();
    await loadOrganizerBookings();
    await loadOrganizerPlayers();
    await loadOrganizerNotes();
}

async function loadOrganizerBookings() {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/organizers/${organizerId}/bookings`);
        const bookings = await res.json();
        
        const list = document.getElementById('organizer-bookings-list');
        list.innerHTML = '';
        
        if (bookings.length === 0) {
            list.innerHTML = '<p>沒有預約紀錄</p>';
            return;
        }
        
        bookings.forEach(booking => {
            const paymentStatus = booking.payment?.status || 'unpaid';
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h4 style="margin:0 0 8px;">${booking.date} ${booking.timeSlot}</h4>
                        <p style="margin:2px 0;"><strong>場地：</strong>${booking.venue?.name || '未知'}</p>
                        <p style="margin:2px 0;"><strong>聯絡：</strong>${booking.venue?.contact || '未知'}</p>
                        <p style="margin:2px 0;"><strong>付款：</strong>
                            <span class="badge badge-${paymentStatus === 'paid' ? 'success' : 'warning'}">
                                ${paymentStatus === 'paid' ? '已付款' : '未付款'}
                            </span>
                        </p>
                        <p style="margin:2px 0;"><strong>報到：</strong>
                            <span class="badge badge-${booking.checkedIn ? 'success' : 'warning'}">
                                ${booking.checkedIn ? '已報到' : '未報到'}
                            </span>
                        </p>
                    </div>
                    <button class="btn btn-danger" style="padding:4px 10px;font-size:12px;flex-shrink:0;"
                        onclick="cancelMemberBooking(${booking.id})">取消</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('載入預約紀錄失敗:', error);
        const list = document.getElementById('venue-bookings-list');
        list.innerHTML = '<p style="color: red;">載入失敗，請稍後重試</p>';
    }
}

function resetVenueFilters() {
    document.getElementById('venue-filter-date').value = '';
    document.getElementById('venue-filter-name').value = '';
    document.getElementById('venue-filter-timeslot').value = '';
    // 重新載入所有預約紀錄
    filterVenueBookings();
}

async function loadOrganizerPlayers() {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/organizers/${organizerId}/player-bookings`);
        const bookings = await res.json();
        
        const list = document.getElementById('organizer-players-list');
        list.innerHTML = '';
        
        if (bookings.length === 0) {
            list.innerHTML = '<p>沒有臨打預約</p>';
            return;
        }
        
        const playersMap = new Map();
        bookings.forEach(booking => {
            if (booking.player) {
                if (!playersMap.has(booking.player.id)) {
                    playersMap.set(booking.player.id, {
                        player: booking.player,
                        bookings: [],
                    });
                }
                playersMap.get(booking.player.id).bookings.push(booking);
            }
        });
        
        playersMap.forEach((data, playerId) => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const bookingList = data.bookings.map(b => 
                `${b.date} ${b.timeSlot}`
            ).join(', ');
            
            card.innerHTML = `
                <h4>${data.player.name}</h4>
                <p><strong>聯絡方式：</strong>${data.player.contact}</p>
                <p><strong>預約時段：</strong>${bookingList}</p>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('載入臨打資訊失敗:', error);
    }
}

async function loadOrganizerNotes() {
    const organizerId = getOrganizerId();
    if (!organizerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/organizers/${organizerId}/notes`);
        const notes = await res.json();
        
        const list = document.getElementById('organizer-notes-list');
        list.innerHTML = '';
        
        notes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <p>${note.content}</p>
                <small>可見性：${note.visibility === 'public' ? '公開' : '只給臨打看'}</small>
                <button class="btn btn-danger" style="margin-top: 10px;" onclick="deleteOrganizerNote(${note.id})">刪除</button>
            `;
            list.appendChild(card);
        });
    } catch (error) {
        console.error('載入備註失敗:', error);
    }
}

async function createOrganizerNote() {
    const organizerId = getOrganizerId();
    const content = document.getElementById('organizer-note-content').value;
    const visibility = document.getElementById('organizer-note-visibility').value;
    
    if (!organizerId || !content) {
        alert('請選擇團主並輸入備註內容');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/organizers/${organizerId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, visibility }),
        });
        
        alert('備註新增成功！');
        document.getElementById('organizer-note-content').value = '';
        await loadOrganizerNotes();
    } catch (error) {
        alert('新增失敗：' + error.message);
    }
}

async function deleteOrganizerNote(noteId) {
    if (!confirm('確定要刪除此備註嗎？')) return;
    
    try {
        await authFetch(`${API_BASE}/organizers/notes/${noteId}`, {
            method: 'DELETE',
        });
        
        await loadOrganizerNotes();
    } catch (error) {
        alert('刪除失敗：' + error.message);
    }
}

// ========== 臨打日曆 ==========

let currentPlayerCalendarDate = new Date();
let playerBookingsData = {};

async function loadPlayerCalendar() {
    const playerId = getPlayerId();
    const container = document.getElementById('player-calendar');

    if (!playerId) {
        if (container) container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">請先選擇臨打</p>';
        return;
    }

    if (container) container.innerHTML = '<p style="text-align: center; padding: 20px;">載入中...</p>';

    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/booking-history`);
        const bookings = await res.json();

        playerBookingsData = {};
        if (bookings && Array.isArray(bookings)) {
            bookings.forEach(booking => {
                const date = booking.date;
                if (date) {
                    if (!playerBookingsData[date]) playerBookingsData[date] = [];
                    playerBookingsData[date].push(booking);
                }
            });
        }

        renderPlayerCalendar();
    } catch (error) {
        console.error('載入臨打日曆失敗:', error);
        if (container) container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">載入日曆失敗，請稍後重試</p>';
    }
}

function renderPlayerCalendar() {
    const container = document.getElementById('player-calendar');
    if (!container) return;

    const year = currentPlayerCalendarDate.getFullYear();
    const month = currentPlayerCalendarDate.getMonth();

    const monthYearEl = document.getElementById('player-calendar-month-year');
    if (monthYearEl) {
        const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                            '七月', '八月', '九月', '十月', '十一月', '十二月'];
        monthYearEl.textContent = `${year}年 ${monthNames[month]}`;
    }

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const today = new Date();
    const isToday = (d, m, y) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();

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
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const bookings = playerBookingsData[dateStr] || [];
        const hasBooking = bookings.length > 0;
        let dayClass = 'calendar-day' + (isToday(day, month, year) ? ' today' : '') + (hasBooking ? ' has-booking' : ' available');

        html += `
            <div class="${dayClass}" onclick="showPlayerDateBookings('${dateStr}')">
                <div class="calendar-day-number">${day}</div>
                ${hasBooking ? `<div class="calendar-day-badge">${bookings.length}筆</div>` : ''}
            </div>
        `;
    }

    const remainingCells = 42 - (startingDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingCells && day <= 14; day++) {
        html += `<div class="calendar-day other-month"><div class="calendar-day-number">${day}</div></div>`;
    }

    html += '</div>';
    container.innerHTML = html;
}

function previousPlayerMonth() {
    currentPlayerCalendarDate.setMonth(currentPlayerCalendarDate.getMonth() - 1);
    loadPlayerCalendar();
}

function nextPlayerMonth() {
    currentPlayerCalendarDate.setMonth(currentPlayerCalendarDate.getMonth() + 1);
    loadPlayerCalendar();
}

function showPlayerDateBookings(dateStr) {
    const modal = document.getElementById('date-booking-modal');
    const titleEl = document.getElementById('date-booking-title');
    const contentEl = document.getElementById('date-booking-content');

    const date = new Date(dateStr + 'T00:00:00');
    titleEl.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 預約詳情`;

    const bookings = playerBookingsData[dateStr] || [];

    if (bookings.length === 0) {
        contentEl.innerHTML = '<div style="text-align: center; padding: 20px;"><p style="color: #28a745; font-size: 18px;">✓ 當天無預約</p></div>';
    } else {
        contentEl.innerHTML = `
            <div style="margin-bottom: 15px;"><p><strong>共有 ${bookings.length} 筆預約</strong></p></div>
            <div style="max-height: 400px; overflow-y: auto;">
                ${bookings.map(booking => `
                    <div class="card" style="margin-bottom: 15px;">
                        <h4>${booking.timeSlot}</h4>
                        <p><strong>館方：</strong>${booking.venue?.name || '未知'}</p>
                        <p><strong>團主：</strong>${booking.organizer?.name || '無'}</p>
                        <p><strong>狀態：</strong><span class="badge badge-${booking.status === 'confirmed' ? 'success' : 'warning'}">${booking.status}</span></p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    modal.style.display = 'block';
}

// ========== 臨打功能 ==========

async function loadPlayers() {
    try {
        const res = await authFetch(`${API_BASE}/players`);
        const players = await res.json();
        
        const select = document.getElementById('player-select');
        select.innerHTML = '<option value="">請選擇臨打</option>';
        
        players.forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('載入臨打失敗:', error);
    }
}

async function createPlayer() {
    const name = document.getElementById('player-name').value;
    const contact = document.getElementById('player-contact').value;
    
    if (!name || !contact) {
        alert('請填寫所有必填欄位');
        return;
    }
    
    try {
        await authFetch(`${API_BASE}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, contact }),
        });
        
        alert('臨打建立成功！');
        document.getElementById('player-name').value = '';
        document.getElementById('player-contact').value = '';
        await loadPlayers();
    } catch (error) {
        alert('建立失敗：' + error.message);
    }
}

async function loadPlayerData() {
    const playerId = getPlayerId();
    if (!playerId) return;
    await loadPlayerCalendar();
    await loadPlayerBookingHistory();
    await loadPlayerVenueBookings();
    await loadPlayerOrganizerBookings();
    await loadPlayerRatings();
}

async function loadPlayerBookingHistory() {
    const playerId = getPlayerId();
    if (!playerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/booking-history`);
        const bookings = await res.json();
        
        const container = document.getElementById('player-booking-history');
        container.innerHTML = '';
        
        if (bookings.length === 0) {
            container.innerHTML = '<p>沒有預約歷程</p>';
            return;
        }
        
        bookings.forEach(booking => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const venueName = booking.venue?.name || '未知';
            const organizerName = booking.organizer?.name || '無';
            
            card.innerHTML = `
                <h4>${booking.date} ${booking.timeSlot}</h4>
                <p><strong>館方：</strong>${venueName}</p>
                <p><strong>團主：</strong>${organizerName}</p>
                <p><strong>狀態：</strong><span class="badge badge-${booking.status === 'confirmed' ? 'success' : 'warning'}">${booking.status}</span></p>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('載入預約歷程失敗:', error);
    }
}

async function loadPlayerVenueBookings() {
    const playerId = getPlayerId();
    if (!playerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/venue-bookings-notes`);
        const data = await res.json();
        
        const container = document.getElementById('player-venue-bookings');
        container.innerHTML = '';
        
        if (data.length === 0) {
            container.innerHTML = '<p>沒有館方預約紀錄</p>';
            return;
        }
        
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const notesHtml = item.notes.length > 0 
                ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <strong>館方備註：</strong>
                    ${item.notes.map(n => `<p style="margin: 5px 0;">${n.content}</p>`).join('')}
                   </div>`
                : '<p style="color: #999;">無備註</p>';
            
            card.innerHTML = `
                <h4>${item.booking.date} ${item.booking.timeSlot}</h4>
                <p><strong>館方：</strong>${item.booking.venue?.name || '未知'}</p>
                ${notesHtml}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('載入館方預約失敗:', error);
    }
}

async function loadPlayerOrganizerBookings() {
    const playerId = getPlayerId();
    if (!playerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/organizer-bookings-notes`);
        const data = await res.json();
        
        const container = document.getElementById('player-organizer-bookings');
        container.innerHTML = '';
        
        if (data.length === 0) {
            container.innerHTML = '<p>沒有團主預約紀錄</p>';
            return;
        }
        
        data.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card';
            
            const notesHtml = item.notes.length > 0 
                ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                    <strong>團主備註：</strong>
                    ${item.notes.map(n => `<p style="margin: 5px 0;">${n.content}</p>`).join('')}
                   </div>`
                : '<p style="color: #999;">無備註</p>';
            
            card.innerHTML = `
                <h4>${item.booking.date} ${item.booking.timeSlot}</h4>
                <p><strong>團主：</strong>${item.booking.organizer?.name || '未知'}</p>
                ${notesHtml}
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('載入團主預約失敗:', error);
    }
}

async function loadPlayerRatings() {
    const playerId = getPlayerId();
    if (!playerId) return;
    
    try {
        const res = await authFetch(`${API_BASE}/ratings/player/${playerId}`);
        const ratings = await res.json();
        
        const container = document.getElementById('player-ratings');
        container.innerHTML = '<h4>我的評分紀錄</h4>';
        
        if (ratings.length === 0) {
            container.innerHTML += '<p>還沒有評分紀錄</p>';
        } else {
            ratings.forEach(rating => {
                const card = document.createElement('div');
                card.className = 'card';
                
                const target = rating.venue ? `館方：${rating.venue.name}` : `團主：${rating.organizer?.name || '未知'}`;
                const stars = '★'.repeat(rating.score) + '☆'.repeat(5 - rating.score);
                
                card.innerHTML = `
                    <h4>${target}</h4>
                    <p><strong>評分：</strong><span style="color: #ffc107; font-size: 20px;">${stars}</span> (${rating.score}/5)</p>
                    ${rating.comment ? `<p><strong>評論：</strong>${rating.comment}</p>` : ''}
                    <button class="btn btn-danger" style="margin-top: 10px;" onclick="deleteRating(${rating.id})">刪除評分</button>
                `;
                container.appendChild(card);
            });
        }
        
        // 新增評分表單
        container.innerHTML += `
            <div class="card" style="margin-top: 20px;">
                <h4>新增評分</h4>
                <div class="form-group">
                    <label>評分對象類型：</label>
                    <select id="rating-type">
                        <option value="venue">館方</option>
                        <option value="organizer">團主</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>選擇對象：</label>
                    <select id="rating-target-id"></select>
                </div>
                <div class="form-group">
                    <label>評分（1-5分）：</label>
                    <div class="rating-stars" id="rating-stars">
                        ${[1,2,3,4,5].map(i => `<span class="star" data-score="${i}">☆</span>`).join('')}
                    </div>
                    <input type="hidden" id="rating-score" value="0">
                </div>
                <div class="form-group">
                    <label>評論（選填）：</label>
                    <textarea id="rating-comment"></textarea>
                </div>
                <button class="btn btn-primary" onclick="createRating()">提交評分</button>
            </div>
        `;
        
        // 初始化評分星星
        initRatingStars();
        loadRatingTargets();
    } catch (error) {
        console.error('載入評分失敗:', error);
    }
}

function initRatingStars() {
    const stars = document.querySelectorAll('#rating-stars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const score = parseInt(star.dataset.score);
            document.getElementById('rating-score').value = score;
            
            stars.forEach((s, i) => {
                if (i < score) {
                    s.textContent = '★';
                    s.classList.add('active');
                } else {
                    s.textContent = '☆';
                    s.classList.remove('active');
                }
            });
        });
    });
}

async function loadRatingTargets() {
    const type = document.getElementById('rating-type').value;
    const select = document.getElementById('rating-target-id');
    
    try {
        let url = type === 'venue' ? `${API_BASE}/venues` : `${API_BASE}/organizers`;
        const res = await authFetch(url);
        const data = await res.json();
        
        select.innerHTML = '<option value="">請選擇</option>';
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('載入評分對象失敗:', error);
    }
}

async function createRating() {
    const playerId = getPlayerId();
    const type = document.getElementById('rating-type').value;
    const targetId = document.getElementById('rating-target-id').value;
    const score = parseInt(document.getElementById('rating-score').value);
    const comment = document.getElementById('rating-comment').value;
    
    if (!playerId || !targetId || !score) {
        alert('請填寫所有必填欄位');
        return;
    }
    
    const ratingData = {
        playerId: parseInt(playerId),
        score,
        comment: comment || null,
    };
    
    if (type === 'venue') {
        ratingData.venueId = parseInt(targetId);
    } else {
        ratingData.organizerId = parseInt(targetId);
    }
    
    try {
        await authFetch(`${API_BASE}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData),
        });
        
        alert('評分提交成功！');
        document.getElementById('rating-comment').value = '';
        document.getElementById('rating-score').value = '0';
        await loadPlayerRatings();
    } catch (error) {
        alert('提交失敗：' + error.message);
    }
}

async function deleteRating(ratingId) {
    if (!confirm('確定要刪除此評分嗎？')) return;
    
    try {
        await authFetch(`${API_BASE}/ratings/${ratingId}`, {
            method: 'DELETE',
        });
        
        await loadPlayerRatings();
    } catch (error) {
        alert('刪除失敗：' + error.message);
    }
}

// 讓函數在全局可用
window.createVenue = createVenue;
window.createOrganizer = createOrganizer;
window.createPlayer = createPlayer;
window.loadVenueData = loadVenueData;
window.filterVenueBookings = filterVenueBookings;
window.resetVenueFilters = resetVenueFilters;
window.loadAvailableTimeSlots = loadAvailableTimeSlots;
window.loadVenueCalendar = loadVenueCalendar;
window.previousMonth = previousMonth;
window.nextMonth = nextMonth;
window.showDateBookings = showDateBookings;
window.closeDateBookingModal = closeDateBookingModal;
window.createVenueNote = createVenueNote;
window.deleteVenueNote = deleteVenueNote;
window.markPaymentAsPaid = markPaymentAsPaid;
window.loadOrganizerData = loadOrganizerData;
window.createOrganizerNote = createOrganizerNote;
window.deleteOrganizerNote = deleteOrganizerNote;
window.loadPlayerData = loadPlayerData;
window.createRating = createRating;
window.deleteRating = deleteRating;
window.showInstallQR = showInstallQR;
window.closeQRModal = closeQRModal;
window.copyUrl = copyUrl;
window.logout = logout;

// ═══════════════════════════════════════════════════════════════
// 候補名單
// ═══════════════════════════════════════════════════════════════

async function joinWaitlist(venueId, date, timeSlot) {
    const organizerId = getOrganizerId();
    const playerId = getPlayerId();

    if (!confirm(`加入 ${date} ${timeSlot} 的候補名單？\n有人取消時會即時推播通知你。`)) return;

    try {
        const body = { venueId: parseInt(venueId), date, timeSlot };
        if (organizerId) body.organizerId = parseInt(organizerId);
        if (playerId)    body.playerId    = parseInt(playerId);

        await authFetch(`${API_BASE}/waitlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        alert('✅ 已加入候補名單！有空位時會通知你。');
    } catch (error) {
        alert('加入候補失敗：' + error.message);
    }
}
window.joinWaitlist = joinWaitlist;

// ═══════════════════════════════════════════════════════════════
// 重複預約
// ═══════════════════════════════════════════════════════════════

async function memberBookWithOptions(venueId, date, timeSlot) {
    const organizerId = getOrganizerId();
    if (!organizerId) { alert('無法取得成員資料，請重新登入'); return; }

    const recurring = confirm(
        `預約 ${date} ${timeSlot}\n\n` +
        '要設定為重複預約嗎？\n確定 = 設定重複，取消 = 單次預約'
    );

    if (recurring) {
        const weeksInput = prompt('重複幾週？（最多 52 週）', '8');
        if (!weeksInput || isNaN(+weeksInput) || +weeksInput < 1) return;
        const recurringWeeks = Math.min(Math.round(+weeksInput), 52);
        const biweekly = confirm('重複方式：確定 = 每兩週，取消 = 每週');
        const recurringType = biweekly ? 'biweekly' : 'weekly';

        try {
            const res = await authFetch(`${API_BASE}/bookings/recurring`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venueId: parseInt(venueId),
                    organizerId: parseInt(organizerId),
                    date, timeSlot,
                    status: 'confirmed',
                    amount: 0,
                    recurringWeeks,
                    recurringType,
                }),
            });
            if (!res.ok) throw new Error('伺服器錯誤');
            const bookings = await res.json();
            alert(`✅ 已建立 ${bookings.length} 筆重複預約！`);
        } catch (error) {
            alert('重複預約失敗：' + error.message);
            return;
        }
    } else {
        if (!confirm(`確定要預約 ${date} ${timeSlot}？`)) return;
        try {
            await authFetch(`${API_BASE}/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    venueId: parseInt(venueId),
                    organizerId: parseInt(organizerId),
                    date, timeSlot,
                    status: 'confirmed',
                    amount: 0,
                }),
            });
            alert('✅ 預約成功！');
        } catch (error) {
            alert('預約失敗：' + error.message);
            return;
        }
    }

    document.getElementById('member-available-slots').innerHTML = '';
    await loadMemberCalendar();
    await loadOrganizerBookings();
}
window.memberBookWithOptions = memberBookWithOptions;

// ═══════════════════════════════════════════════════════════════
// 臨打信用分數
// ═══════════════════════════════════════════════════════════════

async function loadPlayerCreditScore() {
    const playerId = getPlayerId();
    if (!playerId) return;

    const container = document.getElementById('player-credit-score');
    if (!container) return;

    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/credit-score`);
        if (!res.ok) return;
        const { score, grade, totalBookings, noShowCount, cancelCount, checkinRate, detail } = await res.json();

        const gradeColor = { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' }[grade] || '#555';
        const gradeEmoji = { A: '🌟', B: '👍', C: '⚠️', D: '🚨' }[grade] || '';

        container.innerHTML = `
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                <div style="text-align:center;min-width:64px;">
                    <div style="font-size:2rem;font-weight:800;color:${gradeColor};">${gradeEmoji} ${grade}</div>
                    <div style="font-size:1.1rem;font-weight:700;color:${gradeColor};">${score} 分</div>
                </div>
                <div style="flex:1;min-width:180px;">
                    <div style="background:#f3f4f6;border-radius:8px;height:8px;margin-bottom:6px;overflow:hidden;">
                        <div style="width:${score}%;height:100%;background:${gradeColor};border-radius:8px;transition:width .4s;"></div>
                    </div>
                    <p style="font-size:13px;color:#555;margin:0 0 2px;">${detail}</p>
                    <p style="font-size:12px;color:#9ca3af;margin:0;">
                        共 ${totalBookings} 次預約・報到率 ${checkinRate}%
                    </p>
                </div>
            </div>
        `;
    } catch { /* 靜默失敗 */ }
}

// ═══════════════════════════════════════════════════════════════
// Web Push 訂閱
// ═══════════════════════════════════════════════════════════════

async function initPushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // 已訂閱

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const keyRes = await fetch(`${API_BASE}/push/vapid-public-key`);
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();

        const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const { token } = getAuth();
        await fetch(`${API_BASE}/push/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ subscription }),
        });
    } catch { /* push 不影響主功能 */ }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ========== 團主（Booker）功能 ==========

let currentRosterBookingId = null;

async function loadBookerData() {
    await loadBookerVenueList();
    await loadBookerBookings();
}

async function loadBookerVenueList() {
    try {
        const res = await authFetch(`${API_BASE}/venues`);
        const venues = await res.json();
        const sel = document.getElementById('booker-venue-select');
        if (!sel) return;
        sel.innerHTML = '<option value="">選擇場地</option>';
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            sel.appendChild(opt);
        });
    } catch (e) { console.error('載入場地失敗:', e); }
}

async function searchBookerSlots() {
    const venueId = document.getElementById('booker-venue-select')?.value;
    const date = document.getElementById('booker-book-date')?.value;
    const container = document.getElementById('booker-available-slots');

    if (!venueId || !date) {
        alert('請選擇場地和日期');
        return;
    }

    container.innerHTML = '<p style="color:#666;">查詢中...</p>';

    try {
        const res = await authFetch(`${API_BASE}/venues/${venueId}/available-time-slots?date=${date}`);
        const available = await res.json();
        const full = ALL_TIME_SLOTS.filter(s => !available.includes(s));

        if (available.length === 0 && full.length === 0) {
            container.innerHTML = '<p style="color:#999;">當天無時段資料</p>';
            return;
        }

        const availHtml = available.length > 0 ? `
            <p style="font-size:13px;font-weight:600;color:#333;margin:0 0 6px;">可預約時段</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
                ${available.map(slot => `
                    <button class="btn btn-primary" style="font-size:13px;"
                        onclick="bookerBook('${venueId}','${date}','${slot}')">
                        ${slot}
                    </button>
                `).join('')}
            </div>` : '';

        const fullHtml = full.length > 0 ? `
            <p style="font-size:13px;font-weight:600;color:#999;margin:0 0 6px;">已滿</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${full.map(slot => `
                    <button class="btn btn-secondary" style="font-size:13px;opacity:0.5;" disabled>
                        ${slot}
                    </button>
                `).join('')}
            </div>` : '';

        container.innerHTML = availHtml + fullHtml;
    } catch (error) {
        container.innerHTML = '<p style="color:red;">查詢失敗，請稍後重試</p>';
    }
}

async function bookerBook(venueId, date, timeSlot) {
    const auth = getAuth();
    if (!auth.entityId) {
        alert('無法取得團主資料，請重新登入');
        return;
    }

    const recurring = confirm(
        `預約 ${date} ${timeSlot}\n\n` +
        '要設定為重複預約嗎？\n確定 = 設定重複，取消 = 單次預約'
    );

    if (recurring) {
        const weeksInput = prompt('重複幾週？（最多 52 週）', '8');
        if (!weeksInput || isNaN(+weeksInput) || +weeksInput < 1) return;
        const recurringWeeks = Math.min(Math.round(+weeksInput), 52);
        const biweekly = confirm('重複方式：確定 = 每兩週，取消 = 每週');
        const recurringType = biweekly ? 'biweekly' : 'weekly';

        try {
            const res = await authFetch(`${API_BASE}/bookings/recurring`, {
                method: 'POST',
                body: JSON.stringify({
                    venueId: parseInt(venueId),
                    bookerId: parseInt(auth.entityId),
                    date, timeSlot,
                    status: 'confirmed',
                    amount: 0,
                    recurringWeeks,
                    recurringType,
                }),
            });
            if (!res.ok) throw new Error('伺服器錯誤');
            const bookings = await res.json();
            alert(`✅ 已建立 ${bookings.length} 筆重複預約！`);
        } catch (error) {
            alert('重複預約失敗：' + error.message);
            return;
        }
    } else {
        if (!confirm(`確定要預約 ${date} ${timeSlot}？`)) return;
        try {
            const res = await authFetch(`${API_BASE}/bookings`, {
                method: 'POST',
                body: JSON.stringify({
                    venueId: parseInt(venueId),
                    bookerId: parseInt(auth.entityId),
                    date, timeSlot,
                    status: 'confirmed',
                    amount: 0,
                }),
            });
            if (!res.ok) throw new Error('伺服器錯誤');
            alert('✅ 預約成功！');
        } catch (error) {
            alert('預約失敗：' + error.message);
            return;
        }
    }

    document.getElementById('booker-available-slots').innerHTML = '';
    await loadBookerBookings();
}

async function loadBookerBookings() {
    const auth = getAuth();
    const container = document.getElementById('booker-bookings-list');
    if (!container) return;

    try {
        const res = await authFetch(`${API_BASE}/bookers/${auth.entityId}/bookings`);
        if (!res.ok) throw new Error('載入失敗');
        const bookings = await res.json();

        if (bookings.length === 0) {
            container.innerHTML = '<p style="color:#999;">尚無預約紀錄</p>';
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        container.innerHTML = bookings.map(b => {
            const isPast = b.date < today;
            const isCancelled = b.status === 'cancelled';
            const participantCount = (b.participants || []).length;
            const checkedInCount = (b.participants || []).filter(p => p.checkedIn).length;

            let statusBadge = '';
            if (isCancelled) {
                statusBadge = '<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">已取消</span>';
            } else if (isPast) {
                statusBadge = '<span style="background:#e5e7eb;color:#6b7280;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">已結束</span>';
            } else {
                statusBadge = '<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">進行中</span>';
            }

            const borderColor = isCancelled ? '#dc2626' : (isPast ? '#e5e7eb' : '#10b981');

            return `
                <div style="background:#fff;border-radius:10px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,0.08);display:flex;overflow:hidden;">
                    <div style="width:4px;flex-shrink:0;background:${borderColor};"></div>
                    <div style="flex:1;padding:10px 12px;">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                            <div>
                                <div style="font-size:14px;font-weight:600;">${b.venue?.name || '場地'}</div>
                                <div style="font-size:12px;color:#6b7280;margin-top:2px;">${b.date} ${b.timeSlot}</div>
                                <div style="font-size:12px;color:#6b7280;margin-top:2px;">
                                    人員：${participantCount} 人${checkedInCount > 0 ? `（${checkedInCount} 已報到）` : ''}
                                </div>
                            </div>
                            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
                                ${statusBadge}
                                ${!isCancelled ? `
                                    <button class="btn btn-primary" style="font-size:12px;padding:4px 10px;"
                                        onclick="openRosterModal(${b.id}, '${b.venue?.name || '場地'}', '${b.date}', '${b.timeSlot}')">
                                        管理名單
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p style="color:red;">載入失敗，請稍後重試</p>';
    }
}

// ── 名單管理 Modal ────────────────────────────────────────────

function openRosterModal(bookingId, venueName, date, timeSlot) {
    currentRosterBookingId = bookingId;
    document.getElementById('roster-modal-title').textContent = `${venueName} — ${date} ${timeSlot}`;
    document.getElementById('participant-name').value = '';
    document.getElementById('participant-phone').value = '';
    document.getElementById('roster-modal').style.display = 'block';
    loadRosterList();
}

function closeRosterModal() {
    document.getElementById('roster-modal').style.display = 'none';
    currentRosterBookingId = null;
    loadBookerBookings();
}

async function loadRosterList() {
    const container = document.getElementById('roster-list');
    if (!currentRosterBookingId) return;

    try {
        const res = await authFetch(`${API_BASE}/bookings/${currentRosterBookingId}/participants`);
        if (!res.ok) throw new Error('載入失敗');
        const participants = await res.json();

        if (participants.length === 0) {
            container.innerHTML = '<p style="color:#999;font-size:13px;">尚未加入任何人</p>';
            return;
        }

        container.innerHTML = `
            <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">共 ${participants.length} 人</div>
            ${participants.map(p => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#f9fafb;border-radius:8px;margin-bottom:6px;">
                    <div style="flex:1;">
                        <span style="font-size:14px;font-weight:500;">${escapeHtml(p.name)}</span>
                        ${p.phone ? `<span style="font-size:12px;color:#6b7280;margin-left:6px;">${escapeHtml(p.phone)}</span>` : ''}
                    </div>
                    <button style="border:none;background:${p.checkedIn ? '#d1fae5' : '#f3f4f6'};color:${p.checkedIn ? '#065f46' : '#6b7280'};padding:4px 8px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;"
                        onclick="toggleCheckin(${currentRosterBookingId}, ${p.id})">
                        ${p.checkedIn ? '✓ 已報到' : '未報到'}
                    </button>
                    <button style="border:none;background:#fee2e2;color:#991b1b;padding:4px 8px;border-radius:6px;font-size:12px;cursor:pointer;"
                        onclick="removeParticipant(${currentRosterBookingId}, ${p.id}, '${escapeHtml(p.name)}')">
                        移除
                    </button>
                </div>
            `).join('')}
        `;
    } catch (error) {
        container.innerHTML = '<p style="color:red;font-size:13px;">載入名單失敗</p>';
    }
}

async function addParticipant() {
    const name = document.getElementById('participant-name').value.trim();
    const phone = document.getElementById('participant-phone').value.trim();

    if (!name) {
        alert('請輸入姓名');
        return;
    }

    try {
        const res = await authFetch(`${API_BASE}/bookings/${currentRosterBookingId}/participants`, {
            method: 'POST',
            body: JSON.stringify({ name, phone: phone || undefined }),
        });
        if (!res.ok) throw new Error('新增失敗');
        document.getElementById('participant-name').value = '';
        document.getElementById('participant-phone').value = '';
        await loadRosterList();
    } catch (error) {
        alert('新增失敗：' + error.message);
    }
}

async function removeParticipant(bookingId, participantId, name) {
    if (!confirm(`確定要移除 ${name}？`)) return;
    try {
        const res = await authFetch(`${API_BASE}/bookings/${bookingId}/participants/${participantId}`, {
            method: 'DELETE',
        });
        if (!res.ok) throw new Error('移除失敗');
        await loadRosterList();
    } catch (error) {
        alert('移除失敗：' + error.message);
    }
}

async function toggleCheckin(bookingId, participantId) {
    try {
        const res = await authFetch(`${API_BASE}/bookings/${bookingId}/participants/${participantId}/checkin`, {
            method: 'PUT',
        });
        if (!res.ok) throw new Error('操作失敗');
        await loadRosterList();
    } catch (error) {
        alert('報到操作失敗：' + error.message);
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== 臨打視圖（player-view）==========

async function loadPlayerViewData() {
    await loadPlayerVenueOptions();
    await loadPlayerCreditScoreCard();
    await loadPlayerBookingHistoryList();
    await loadPlayerVenueNotes();
    await loadPlayerOrganizerNotes();
    await loadPlayerRatingHistory();
}
window.loadPlayerViewData = loadPlayerViewData;

async function loadPlayerVenueOptions() {
    const select = document.getElementById('plv-venue-select');
    if (!select) return;
    try {
        const res = await authFetch(`${API_BASE}/venues`);
        if (!res.ok) throw new Error('載入場地失敗');
        const venues = await res.json();
        select.innerHTML = '<option value="">選擇場地</option>';
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('載入場地選單失敗:', err);
    }
}

async function searchPlayerOpenSlots() {
    const venueId = document.getElementById('plv-venue-select').value;
    const date = document.getElementById('plv-date').value;
    const container = document.getElementById('plv-open-slots');
    if (!venueId || !date) {
        alert('請選擇場地與日期');
        return;
    }
    container.innerHTML = '<p>查詢中…</p>';
    try {
        const res = await authFetch(`${API_BASE}/venues/${venueId}/bookings?date=${encodeURIComponent(date)}`);
        if (!res.ok) throw new Error('查詢失敗');
        const bookings = await res.json();
        if (!bookings.length) {
            container.innerHTML = '<p>當日沒有預約場次。</p>';
            return;
        }
        container.innerHTML = '';
        bookings.forEach(b => {
            const card = document.createElement('div');
            card.className = 'card';
            const organizerName = b.organizer?.name || '未知';
            const current = b.participants?.length || 0;
            card.innerHTML = `
                <h4>${escapeHtml(b.date)} ${escapeHtml(b.timeSlot)}</h4>
                <p><strong>團主：</strong>${escapeHtml(organizerName)}</p>
                <p><strong>目前人數：</strong>${current}</p>
                <button class="btn btn-primary" onclick="signUpAsPlayer(${b.id})">我要報名</button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('查詢場次失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">查詢失敗</p>';
    }
}
window.searchPlayerOpenSlots = searchPlayerOpenSlots;

async function signUpAsPlayer(bookingId) {
    const auth = getAuth();
    const name = auth.name || '臨打';
    try {
        const res = await authFetch(`${API_BASE}/bookings/${bookingId}/participants`, {
            method: 'POST',
            body: JSON.stringify({ name, type: 'player' }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '報名失敗');
        }
        alert('報名成功');
        await loadPlayerBookingHistoryList();
    } catch (err) {
        alert('報名失敗：' + err.message);
    }
}
window.signUpAsPlayer = signUpAsPlayer;

async function loadPlayerCreditScoreCard() {
    const container = document.getElementById('plv-credit-score');
    if (!container) return;
    const playerId = getPlayerId();
    if (!playerId) {
        container.innerHTML = '<p>無法取得臨打身份</p>';
        return;
    }
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/credit-score`);
        if (!res.ok) throw new Error('載入失敗');
        const data = await res.json();
        const score = data?.score ?? data?.creditScore ?? 0;
        const total = data?.totalBookings ?? data?.total ?? 0;
        const attended = data?.attendedBookings ?? data?.attended ?? 0;
        container.innerHTML = `
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
                <div><strong>分數：</strong><span style="font-size:20px;color:#2563eb;">${score}</span></div>
                <div><strong>總預約：</strong>${total}</div>
                <div><strong>已報到：</strong>${attended}</div>
            </div>
        `;
    } catch (err) {
        console.error('載入信用分數失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">載入信用分數失敗</p>';
    }
}

async function loadPlayerBookingHistoryList() {
    const container = document.getElementById('plv-booking-history');
    if (!container) return;
    const playerId = getPlayerId();
    if (!playerId) {
        container.innerHTML = '<p>無法取得臨打身份</p>';
        return;
    }
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/booking-history`);
        if (!res.ok) throw new Error('載入失敗');
        const bookings = await res.json();
        if (!bookings.length) {
            container.innerHTML = '<p>沒有報名紀錄</p>';
            return;
        }
        container.innerHTML = '';
        bookings.forEach(b => {
            const card = document.createElement('div');
            card.className = 'card';
            const venueId = b.venue?.id;
            const organizerId = b.organizer?.id;
            const rateVenueBtn = venueId
                ? `<button class="btn btn-secondary" style="margin-right:6px;" onclick="openPlayerRatingForm('venue', ${venueId}, '${escapeHtml(b.venue?.name || '')}', this)">評分館方</button>`
                : '';
            const rateOrganizerBtn = organizerId
                ? `<button class="btn btn-secondary" onclick="openPlayerRatingForm('organizer', ${organizerId}, '${escapeHtml(b.organizer?.name || '')}', this)">評分團主</button>`
                : '';
            card.innerHTML = `
                <h4>${escapeHtml(b.date)} ${escapeHtml(b.timeSlot)}</h4>
                <p><strong>館方：</strong>${escapeHtml(b.venue?.name || '未知')}</p>
                <p><strong>團主：</strong>${escapeHtml(b.organizer?.name || '無')}</p>
                <p><strong>狀態：</strong><span class="badge badge-${b.status === 'confirmed' ? 'success' : 'warning'}">${escapeHtml(b.status || '')}</span></p>
                <div class="plv-rating-actions" style="margin-top:8px;">${rateVenueBtn}${rateOrganizerBtn}</div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('載入報名紀錄失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">載入報名紀錄失敗</p>';
    }
}

function openPlayerRatingForm(type, targetId, targetName, btn) {
    const card = btn.closest('.card');
    if (!card) return;
    // Remove any existing form for this card first
    const existing = card.querySelector('.plv-rating-form');
    if (existing) { existing.remove(); return; }
    const form = document.createElement('div');
    form.className = 'plv-rating-form';
    form.style.cssText = 'margin-top:10px;padding:10px;border-top:1px solid #e5e7eb;';
    const stars = [1,2,3,4,5].map(n => `<label style="margin-right:6px;cursor:pointer;"><input type="radio" name="plv-rating-score-${type}-${targetId}" value="${n}" ${n === 5 ? 'checked' : ''}/> ${n}星</label>`).join('');
    form.innerHTML = `
        <div style="margin-bottom:6px;"><strong>評分 ${type === 'venue' ? '館方' : '團主'}：</strong>${escapeHtml(targetName)}</div>
        <div style="margin-bottom:6px;">${stars}</div>
        <textarea placeholder="留言（選填）" style="width:100%;min-height:60px;margin-bottom:6px;" data-plv-comment></textarea>
        <button class="btn btn-primary" onclick="submitPlayerRating('${type}', ${targetId}, this)">送出評分</button>
        <button class="btn btn-secondary" onclick="this.closest('.plv-rating-form').remove()">取消</button>
    `;
    card.appendChild(form);
}
window.openPlayerRatingForm = openPlayerRatingForm;

async function submitPlayerRating(type, targetId, btn) {
    const playerId = getPlayerId();
    if (!playerId) { alert('無法取得臨打身份'); return; }
    const form = btn.closest('.plv-rating-form');
    if (!form) return;
    const checked = form.querySelector(`input[name="plv-rating-score-${type}-${targetId}"]:checked`);
    const score = checked ? parseInt(checked.value, 10) : 5;
    const comment = form.querySelector('[data-plv-comment]').value.trim();
    const payload = { playerId: parseInt(playerId, 10), score, comment: comment || null };
    if (type === 'venue') payload.venueId = targetId;
    else payload.organizerId = targetId;
    try {
        const res = await authFetch(`${API_BASE}/ratings`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || '送出失敗');
        }
        alert('評分已送出');
        form.remove();
        await loadPlayerRatingHistory();
        await loadPlayerVenueNotes();
        await loadPlayerOrganizerNotes();
    } catch (err) {
        alert('送出評分失敗：' + err.message);
    }
}
window.submitPlayerRating = submitPlayerRating;

async function fetchAverageRating(type, targetId) {
    try {
        const res = await authFetch(`${API_BASE}/ratings/average/${type}/${targetId}`);
        if (!res.ok) return null;
        const raw = await res.json();
        const avg = typeof raw === 'number' ? raw : (raw?.average ?? raw?.avg ?? null);
        return avg;
    } catch {
        return null;
    }
}

function formatAverageRating(avg) {
    if (avg == null || Number.isNaN(Number(avg))) return '<span style="color:#94a3b8;">尚無評分</span>';
    const num = Number(avg);
    const stars = '★'.repeat(Math.round(num)) + '☆'.repeat(Math.max(0, 5 - Math.round(num)));
    return `<span style="color:#f59e0b;">${stars}</span> ${num.toFixed(2)}/5`;
}

async function loadPlayerVenueNotes() {
    const container = document.getElementById('plv-venue-bookings');
    if (!container) return;
    const playerId = getPlayerId();
    if (!playerId) return;
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/venue-bookings-notes`);
        if (!res.ok) throw new Error('載入失敗');
        const data = await res.json();
        if (!data.length) {
            container.innerHTML = '<p>沒有館方備註</p>';
            return;
        }
        container.innerHTML = '';
        const seenVenues = new Set();
        for (const item of data) {
            const card = document.createElement('div');
            card.className = 'card';
            const notesHtml = item.notes && item.notes.length
                ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;">
                     ${item.notes.map(n => `<p style="margin:4px 0;">${escapeHtml(n.content)}</p>`).join('')}
                   </div>`
                : '<p style="color:#94a3b8;">無備註</p>';
            const venueId = item.booking?.venue?.id;
            card.innerHTML = `
                <h4>${escapeHtml(item.booking?.date || '')} ${escapeHtml(item.booking?.timeSlot || '')}</h4>
                <p><strong>館方：</strong>${escapeHtml(item.booking?.venue?.name || '未知')}</p>
                ${venueId ? `<p><strong>平均評分：</strong><span data-plv-venue-avg="${venueId}">載入中…</span></p>` : ''}
                ${notesHtml}
            `;
            container.appendChild(card);
            if (venueId && !seenVenues.has(venueId)) {
                seenVenues.add(venueId);
                fetchAverageRating('venue', venueId).then(avg => {
                    document.querySelectorAll(`[data-plv-venue-avg="${venueId}"]`).forEach(el => {
                        el.innerHTML = formatAverageRating(avg);
                    });
                });
            }
        }
    } catch (err) {
        console.error('載入館方備註失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">載入館方備註失敗</p>';
    }
}

async function loadPlayerOrganizerNotes() {
    const container = document.getElementById('plv-organizer-bookings');
    if (!container) return;
    const playerId = getPlayerId();
    if (!playerId) return;
    try {
        const res = await authFetch(`${API_BASE}/players/${playerId}/organizer-bookings-notes`);
        if (!res.ok) throw new Error('載入失敗');
        const data = await res.json();
        if (!data.length) {
            container.innerHTML = '<p>沒有團主備註</p>';
            return;
        }
        container.innerHTML = '';
        const seenOrganizers = new Set();
        for (const item of data) {
            const card = document.createElement('div');
            card.className = 'card';
            const notesHtml = item.notes && item.notes.length
                ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;">
                     ${item.notes.map(n => `<p style="margin:4px 0;">${escapeHtml(n.content)}</p>`).join('')}
                   </div>`
                : '<p style="color:#94a3b8;">無備註</p>';
            const organizerId = item.booking?.organizer?.id;
            card.innerHTML = `
                <h4>${escapeHtml(item.booking?.date || '')} ${escapeHtml(item.booking?.timeSlot || '')}</h4>
                <p><strong>團主：</strong>${escapeHtml(item.booking?.organizer?.name || '未知')}</p>
                ${organizerId ? `<p><strong>平均評分：</strong><span data-plv-organizer-avg="${organizerId}">載入中…</span></p>` : ''}
                ${notesHtml}
            `;
            container.appendChild(card);
            if (organizerId && !seenOrganizers.has(organizerId)) {
                seenOrganizers.add(organizerId);
                fetchAverageRating('organizer', organizerId).then(avg => {
                    document.querySelectorAll(`[data-plv-organizer-avg="${organizerId}"]`).forEach(el => {
                        el.innerHTML = formatAverageRating(avg);
                    });
                });
            }
        }
    } catch (err) {
        console.error('載入團主備註失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">載入團主備註失敗</p>';
    }
}

async function loadPlayerRatingHistory() {
    const container = document.getElementById('plv-ratings');
    if (!container) return;
    const playerId = getPlayerId();
    if (!playerId) return;
    try {
        const res = await authFetch(`${API_BASE}/ratings/player/${playerId}`);
        if (!res.ok) throw new Error('載入失敗');
        const ratings = await res.json();
        if (!ratings.length) {
            container.innerHTML = '<p>還沒有評分紀錄</p>';
            return;
        }
        container.innerHTML = '';
        ratings.forEach(r => {
            const card = document.createElement('div');
            card.className = 'card';
            const target = r.venue ? `館方：${r.venue.name}` : `團主：${r.organizer?.name || '未知'}`;
            const stars = '★'.repeat(r.score || 0) + '☆'.repeat(Math.max(0, 5 - (r.score || 0)));
            card.innerHTML = `
                <h4>${escapeHtml(target)}</h4>
                <p><strong>評分：</strong><span style="color:#f59e0b;font-size:18px;">${stars}</span> (${r.score || 0}/5)</p>
                ${r.comment ? `<p><strong>留言：</strong>${escapeHtml(r.comment)}</p>` : ''}
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error('載入評分失敗:', err);
        container.innerHTML = '<p style="color:#b91c1c;">載入評分失敗</p>';
    }
}
