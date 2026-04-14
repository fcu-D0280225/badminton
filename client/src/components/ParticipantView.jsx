import { useState, useEffect } from 'react';
import { api } from '../api';

function ParticipantView() {
  const [participantName, setParticipantName] = useState('');
  const [phone, setPhone] = useState('');
  const [events, setEvents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBookings, setShowBookings] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const response = await api.getEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('加载活动失败:', error);
      alert('加载活动失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const loadMyBookings = async () => {
    if (!participantName.trim()) return;

    try {
      setLoading(true);
      const response = await api.getParticipantBookings(participantName);
      setBookings(response.data);
      setShowBookings(true);
    } catch (error) {
      console.error('加载预约记录失败:', error);
      alert('加载预约记录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (eventId) => {
    if (!participantName.trim()) {
      alert('请先输入您的姓名');
      return;
    }

    try {
      await api.createBooking({
        event_id: eventId,
        participant_name: participantName,
        phone: phone,
      });
      
      alert('预约成功！');
      loadEvents();
      if (showBookings) {
        loadMyBookings();
      }
    } catch (error) {
      alert(error.response?.data?.error || '预约失败，请稍后重试');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('确定要取消这个预约吗？')) {
      return;
    }

    try {
      await api.cancelBooking(bookingId);
      alert('预约已取消');
      loadEvents();
      loadMyBookings();
    } catch (error) {
      alert(error.response?.data?.error || '取消失败，请稍后重试');
    }
  };

  const formatDateTime = (date, time) => {
    return `${date} ${time}`;
  };

  const isBooked = (eventId) => {
    return bookings.some(booking => booking.event_id === eventId);
  };

  const getBookingId = (eventId) => {
    const booking = bookings.find(b => b.event_id === eventId);
    return booking?.id;
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">预约者</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              您的姓名 *
            </label>
            <input
              type="text"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              联系电话（选填）
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入联系电话"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadMyBookings}
              disabled={!participantName.trim() || loading}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '加载中...' : '查看我的预约'}
            </button>
            <button
              onClick={loadEvents}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              刷新活动
            </button>
          </div>
        </div>
      </div>

      {showBookings && bookings.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">我的预约记录</h3>
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="border border-gray-200 rounded-lg p-4 flex justify-between items-start"
              >
                <div>
                  <h4 className="font-bold text-gray-800 mb-1">{booking.title}</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>开团者：{booking.organizer_name}</p>
                    <p>地点：{booking.location}</p>
                    <p>时间：{formatDateTime(booking.date, booking.time)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelBooking(booking.id)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                >
                  取消预约
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showBookings && bookings.length === 0 && participantName && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center mb-6">
          <p className="text-gray-500">您还没有任何预约记录</p>
        </div>
      )}

      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">可预约活动</h3>
        
        {loading && events.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-500 text-lg">暂无活动</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const booked = participantName && isBooked(event.id);
              const isFull = event.current_participants >= event.max_participants;
              const canBook = !booked && !isFull && participantName.trim();

              return (
                <div
                  key={event.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-xl font-bold text-gray-800">{event.title}</h4>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isFull
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {event.current_participants}/{event.max_participants}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-gray-600 mb-3 line-clamp-2 text-sm">{event.description}</p>
                  )}

                  <div className="space-y-2 text-sm text-gray-600 mb-4">
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

                  {booked ? (
                    <button
                      onClick={() => handleCancelBooking(getBookingId(event.id))}
                      className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      取消预约
                    </button>
                  ) : (
                    <button
                      onClick={() => handleBooking(event.id)}
                      disabled={!canBook}
                      className={`w-full px-4 py-2 rounded-lg transition-colors ${
                        canBook
                          ? 'bg-blue-500 text-white hover:bg-blue-600'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isFull ? '已满员' : !participantName.trim() ? '请先输入姓名' : '立即预约'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ParticipantView;
