import { useState, useEffect } from 'react';
import { api } from '../api';

const NAME_KEY = 'badminton.participantName';

function ParticipantView() {
  const [participantName, setParticipantName] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem(NAME_KEY) || '' : ''
  );
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null); // {type: 'info'|'error', text}

  // 自動載入：若 localStorage 已有名字則進來就直接撈紀錄
  useEffect(() => {
    if (participantName.trim()) {
      loadMyBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameChange = (val) => {
    setParticipantName(val);
    try { localStorage.setItem(NAME_KEY, val); } catch {}
  };

  const loadMyBookings = async () => {
    if (!participantName.trim()) return;
    try {
      setLoading(true);
      setStatusMsg(null);
      const response = await api.getParticipantBookings(participantName.trim());
      setBookings(response.data);
      setShowBookings(true);
    } catch (error) {
      console.error('加载预约记录失败:', error);
      setStatusMsg({ type: 'error', text: '載入預約記錄失敗，請稍後重試' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    // 兩段式 cancel：第一次點擊只切換為「確定取消？」，第二次才實際送出
    if (confirmCancelId !== bookingId) {
      setConfirmCancelId(bookingId);
      return;
    }
    try {
      await api.cancelBooking(bookingId);
      setConfirmCancelId(null);
      setStatusMsg({ type: 'info', text: '預約已取消' });
      loadMyBookings();
    } catch (error) {
      setStatusMsg({
        type: 'error',
        text: error.response?.data?.error || '取消失敗，請稍後重試',
      });
    }
  };

  const formatDateTime = (date, time) => `${date} ${time}`;

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">我的預約</h2>
        <p className="text-sm text-gray-500 mb-4">
          要報名新場次請至「探索」分頁，點選場次卡片即可兩步完成報名。
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              您的姓名 *
            </label>
            <input
              type="text"
              value={participantName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="請輸入您的姓名"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={loadMyBookings}
            disabled={!participantName.trim() || loading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '載入中...' : '查詢我的預約'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            statusMsg.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-blue-50 border border-blue-200 text-blue-700'
          }`}
          role="status"
        >
          {statusMsg.text}
        </div>
      )}

      {showBookings && bookings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">預約記錄</h3>
          <div className="space-y-4">
            {bookings.map((booking) => {
              const confirming = confirmCancelId === booking.id;
              return (
                <div
                  key={booking.id}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-start"
                >
                  <div>
                    <h4 className="font-bold text-gray-800 mb-1">{booking.title}</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>開團者：{booking.organizer_name}</p>
                      <p>地點：{booking.location}</p>
                      <p>時間：{formatDateTime(booking.date, booking.time)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                        confirming
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-red-500 text-white hover:bg-red-600'
                      }`}
                    >
                      {confirming ? '再點一次確認取消' : '取消預約'}
                    </button>
                    {confirming && (
                      <button
                        onClick={() => setConfirmCancelId(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        放棄
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showBookings && bookings.length === 0 && participantName && !loading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">您還沒有任何預約記錄</p>
          <p className="text-sm text-gray-400 mt-2">前往「探索」分頁挑選想報名的場次</p>
        </div>
      )}
    </div>
  );
}

export default ParticipantView;
