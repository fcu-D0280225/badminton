import { useState, useEffect } from 'react';
import { api } from '../api';

function PlayerView() {
  const [playerName, setPlayerName] = useState('');
  const [phone, setPhone] = useState('');
  const [events, setEvents] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'pickup' | 'my'
  const [showPickupForm, setShowPickupForm] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    time: '',
    max_participants: 4,
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      setEvents(response.data);
    } catch {
      alert('載入活動失敗，請稍後重試');
    } finally {
      setLoading(false);
    }
  };

  const loadMyBookings = async () => {
    if (!playerName.trim()) return;
    try {
      const response = await api.getParticipantBookings(playerName);
      setMyBookings(response.data);
    } catch {
      alert('載入我的預約失敗');
    }
  };

  const handleJoin = async (eventId) => {
    if (!playerName.trim()) {
      alert('請先輸入你的姓名');
      return;
    }
    try {
      await api.createBooking({ event_id: eventId, participant_name: playerName, phone });
      await loadEvents();
      await loadMyBookings();
    } catch (error) {
      alert(error.response?.data?.error || '加入失敗');
    }
  };

  const handleLeave = async (bookingId) => {
    if (!confirm('確定要退出這場活動嗎？')) return;
    try {
      await api.cancelBooking(bookingId);
      await loadEvents();
      await loadMyBookings();
    } catch (error) {
      alert(error.response?.data?.error || '退出失敗');
    }
  };

  const handleCreatePickup = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) {
      alert('請先輸入你的姓名');
      return;
    }
    try {
      await api.createEvent({
        ...pickupForm,
        organizer_name: playerName,
        event_type: 'pickup',
      });
      setPickupForm({ title: '', description: '', location: '', date: '', time: '', max_participants: 4 });
      setShowPickupForm(false);
      await loadEvents();
      setActiveTab('schedule');
    } catch (error) {
      alert(error.response?.data?.error || '揪團失敗，請稍後重試');
    }
  };

  const isJoined = (eventId) => myBookings.some((b) => b.event_id === eventId);
  const getBookingId = (eventId) => myBookings.find((b) => b.event_id === eventId)?.id;

  // 依日期分組，只顯示今天之後的活動
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events
    .filter((e) => e.date >= today)
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const grouped = upcoming.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent';
  const tabCls = (t) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === t ? 'bg-green-500 text-white shadow' : 'text-gray-600 hover:text-gray-800'}`;

  return (
    <div>
      {/* 身份欄 */}
      <div className="bg-white rounded-lg shadow-md p-5 mb-4">
        <h2 className="text-xl font-bold text-gray-800 mb-3">臨打 / 揪團</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={playerName}
            onChange={(e) => { setPlayerName(e.target.value); }}
            onBlur={loadMyBookings}
            placeholder="你的姓名（必填）"
            className={`flex-1 ${inputCls}`}
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="電話（選填）"
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Sub-tab */}
      <div className="flex gap-1 bg-white rounded-lg shadow-md p-1 mb-4 inline-flex">
        <button className={tabCls('schedule')} onClick={() => setActiveTab('schedule')}>排程</button>
        <button className={tabCls('pickup')} onClick={() => setActiveTab('pickup')}>揪團</button>
        <button className={tabCls('my')} onClick={() => { setActiveTab('my'); loadMyBookings(); }}>我的預約</button>
      </div>

      {/* 排程 */}
      {activeTab === 'schedule' && (
        <div>
          {loading ? (
            <div className="text-center py-10 text-gray-400">載入中...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">近期沒有活動</div>
          ) : (
            Object.entries(grouped).map(([date, dayEvents]) => (
              <div key={date} className="mb-4">
                <div className="text-sm font-semibold text-gray-500 mb-2 px-1">
                  {date}（{['日','一','二','三','四','五','六'][new Date(date + 'T00:00:00').getDay()]}）
                </div>
                <div className="space-y-3">
                  {dayEvents.map((event) => {
                    const joined = playerName && isJoined(event.id);
                    const full = event.current_participants >= event.max_participants;
                    const isPickup = event.event_type === 'pickup';
                    return (
                      <div key={event.id} className="bg-white rounded-lg shadow-sm p-4 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-800 text-sm truncate">{event.title}</span>
                            {isPickup && (
                              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">臨打揪團</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <div>{event.time} · {event.location}</div>
                            <div>揪團者：{event.organizer_name}</div>
                            {event.description && <div className="text-gray-400 truncate">{event.description}</div>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs font-semibold ${full && !joined ? 'text-red-500' : 'text-gray-500'}`}>
                            {event.current_participants}/{event.max_participants}
                          </span>
                          {joined ? (
                            <button
                              onClick={() => handleLeave(getBookingId(event.id))}
                              className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            >
                              退出
                            </button>
                          ) : (
                            <button
                              onClick={() => handleJoin(event.id)}
                              disabled={full || !playerName.trim()}
                              className="px-3 py-1 text-xs rounded-lg transition-colors disabled:bg-gray-100 disabled:text-gray-400 bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed"
                            >
                              {full ? '已滿' : '加入'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 揪團 */}
      {activeTab === 'pickup' && (
        <div>
          <div className="bg-white rounded-lg shadow-md p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-gray-800">我的揪團</h3>
              {playerName && (
                <button
                  onClick={() => setShowPickupForm(!showPickupForm)}
                  className="px-4 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                >
                  {showPickupForm ? '取消' : '+ 揪團'}
                </button>
              )}
            </div>
            {!playerName && <p className="text-sm text-gray-400">請先輸入姓名才能揪團</p>}
          </div>

          {showPickupForm && playerName && (
            <div className="bg-white rounded-lg shadow-md p-5 mb-4">
              <h3 className="text-base font-bold text-gray-800 mb-4">發起揪團</h3>
              <form onSubmit={handleCreatePickup} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="活動標題（例：週五下午羽球）"
                  value={pickupForm.title}
                  onChange={(e) => setPickupForm({ ...pickupForm, title: e.target.value })}
                  className={inputCls}
                />
                <textarea
                  placeholder="補充說明（選填）"
                  value={pickupForm.description}
                  onChange={(e) => setPickupForm({ ...pickupForm, description: e.target.value })}
                  rows="2"
                  className={inputCls}
                />
                <input
                  type="text"
                  required
                  placeholder="地點"
                  value={pickupForm.location}
                  onChange={(e) => setPickupForm({ ...pickupForm, location: e.target.value })}
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={pickupForm.date}
                    min={today}
                    onChange={(e) => setPickupForm({ ...pickupForm, date: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    type="time"
                    required
                    value={pickupForm.time}
                    onChange={(e) => setPickupForm({ ...pickupForm, time: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 whitespace-nowrap">人數上限</label>
                  <input
                    type="number"
                    required
                    min="2"
                    max="20"
                    value={pickupForm.max_participants}
                    onChange={(e) => setPickupForm({ ...pickupForm, max_participants: parseInt(e.target.value) })}
                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  發起揪團
                </button>
              </form>
            </div>
          )}

          {/* 顯示自己揪的團 */}
          {playerName && (
            <div className="space-y-3">
              {events
                .filter((e) => e.event_type === 'pickup' && e.organizer_name === playerName)
                .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
                .map((event) => (
                  <div key={event.id} className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-gray-800 text-sm">{event.title}</span>
                      <span className="text-xs text-gray-500">{event.current_participants}/{event.max_participants} 人</span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5 mb-2">
                      <div>{event.date} {event.time} · {event.location}</div>
                    </div>
                    {event.bookings?.length > 0 && (
                      <div className="border-t pt-2">
                        <p className="text-xs font-medium text-gray-600 mb-1">參加名單：</p>
                        <div className="flex flex-wrap gap-1">
                          {event.bookings.map((b) => (
                            <span key={b.id} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                              {b.participant_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              {events.filter((e) => e.event_type === 'pickup' && e.organizer_name === playerName).length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">你還沒有揪過團</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 我的預約 */}
      {activeTab === 'my' && (
        <div>
          {myBookings.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500 text-sm">
              {playerName ? '你還沒有任何預約' : '請先輸入姓名'}
            </div>
          ) : (
            <div className="space-y-3">
              {myBookings
                .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
                .map((booking) => (
                  <div key={booking.id} className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-800 truncate mb-1">{booking.title}</div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <div>{booking.date} {booking.time}</div>
                        <div>{booking.location} · 揪團者：{booking.organizer_name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleLeave(booking.id)}
                      className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors shrink-0"
                    >
                      退出
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayerView;
