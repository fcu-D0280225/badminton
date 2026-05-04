import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const PULL_THRESHOLD = 64;
const NAME_KEY = 'badminton.participantName';
const PHONE_KEY = 'badminton.participantPhone';

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

  const [participantName, setParticipantName] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) || '' : ''
  );
  const [phone, setPhone] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(PHONE_KEY) || '' : ''
  );
  const [bookingState, setBookingState] = useState('idle'); // idle | submitting | success | error
  const [bookingError, setBookingError] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  // 開啟新詳情時重置報名狀態
  useEffect(() => {
    setBookingState('idle');
    setBookingError('');
  }, [selectedId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('加载活动失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await api.getEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('加载活动失败:', error);
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  };

  const handleTouchStart = (e) => {
    if (window.scrollY > 0) { startY.current = null; return; }
    startY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY === 0) {
      setPull(Math.min(delta * 0.5, PULL_THRESHOLD * 1.5));
    }
  };
  const handleTouchEnd = () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pull >= PULL_THRESHOLD) {
      triggerRefresh();
    } else {
      setPull(0);
    }
  };

  const formatDateTime = (date, time) => `${date} ${time}`;

  const selected = selectedId != null ? events.find(e => e.id === selectedId) : null;
  const selectedFull = selected
    ? selected.current_participants >= selected.max_participants
    : false;

  const handleNameChange = (val) => {
    setParticipantName(val);
    try { localStorage.setItem(NAME_KEY, val); } catch {}
  };
  const handlePhoneChange = (val) => {
    setPhone(val);
    try { localStorage.setItem(PHONE_KEY, val); } catch {}
  };

  const handleConfirmBooking = async () => {
    if (!selected || !participantName.trim() || selectedFull) return;
    setBookingState('submitting');
    setBookingError('');
    try {
      await api.createBooking({
        event_id: selected.id,
        participant_name: participantName.trim(),
        phone: phone.trim(),
      });
      setBookingState('success');
      // 背景刷新列表，名額同步
      loadEvents();
      // 1.5 秒後自動關閉 modal
      setTimeout(() => setSelectedId(null), 1500);
    } catch (error) {
      setBookingState('error');
      setBookingError(error.response?.data?.error || '預約失敗，請稍後重試');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="mt-4 text-gray-600">加载中...</p>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex items-center justify-center text-sm text-gray-500 overflow-hidden transition-[height] duration-150"
        style={{ height: refreshing ? PULL_THRESHOLD : pull }}
      >
        {refreshing
          ? <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
          : null}
        <span>
          {refreshing
            ? '刷新中⋯'
            : pull >= PULL_THRESHOLD ? '放開以刷新' : pull > 0 ? '下拉刷新' : ''}
        </span>
      </div>

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">所有活动</h2>
        <button
          onClick={loadEvents}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          刷新
        </button>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500 text-lg">暂无活动</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const isFull = event.current_participants >= event.max_participants;
            const remaining = Math.max(event.max_participants - event.current_participants, 0);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className="text-left bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-bold text-gray-800">{event.title}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                    title={`已 ${event.current_participants} / 上限 ${event.max_participants}`}
                  >
                    {isFull ? '已額滿' : `剩 ${remaining} 名`}
                  </span>
                </div>

                {event.description && (
                  <p className="text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center">
                    <span className="font-medium w-20">开团者：</span>
                    <span>{event.organizer_name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">地点：</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">时间：</span>
                    <span>{formatDateTime(event.date, event.time)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 max-h-[85vh] overflow-y-auto p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-800">{selected.title}</h3>
              <button
                onClick={() => setSelectedId(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="關閉"
              >×</button>
            </div>

            {/* 步驟一：場次資訊 */}
            <div className="space-y-3 text-sm text-gray-700 mb-5">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">步驟 1 · 確認場次資訊</div>
              <div><span className="font-semibold">場館 / 地點：</span>{selected.location}</div>
              <div><span className="font-semibold">日期時間：</span>{formatDateTime(selected.date, selected.time)}</div>
              <div><span className="font-semibold">開團者：</span>{selected.organizer_name}</div>
              <div>
                <span className="font-semibold">名額：</span>
                {selected.current_participants} / {selected.max_participants}
                {selectedFull
                  ? <span className="ml-2 px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs">已額滿</span>
                  : <span className="ml-2 px-2 py-0.5 rounded bg-green-100 text-green-700 text-xs">尚有名額</span>}
              </div>
              {selected.description && (
                <div>
                  <span className="font-semibold">說明：</span>
                  <p className="mt-1 whitespace-pre-wrap">{selected.description}</p>
                </div>
              )}
            </div>

            {/* 步驟二：報名表單 */}
            <div className="border-t border-gray-200 pt-4">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">步驟 2 · 送出報名</div>

              {bookingState === 'success' ? (
                <div
                  role="status"
                  className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm flex items-center"
                >
                  <span className="mr-2">✓</span>
                  <span>報名成功！</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">您的姓名 *</label>
                    <input
                      type="text"
                      value={participantName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="請輸入您的姓名"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">聯絡電話（選填）</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="請輸入聯絡電話"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {bookingError && (
                    <div className="text-sm text-red-600">{bookingError}</div>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={
                      selectedFull ||
                      !participantName.trim() ||
                      bookingState === 'submitting'
                    }
                    className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedFull
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : !participantName.trim() || bookingState === 'submitting'
                        ? 'bg-blue-300 text-white cursor-not-allowed'
                        : 'bg-blue-500 text-white hover:bg-blue-600'
                    }`}
                  >
                    {selectedFull
                      ? '已額滿'
                      : bookingState === 'submitting'
                      ? '送出中⋯'
                      : '確認報名'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventList;
