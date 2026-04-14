import { useState, useEffect } from 'react';
import { api } from '../api';

function OrganizerView() {
  const [organizerName, setOrganizerName] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    time: '',
    max_participants: 4,
  });

  const loadEvents = async () => {
    if (!organizerName.trim()) return;
    
    try {
      setLoading(true);
      const response = await api.getOrganizerEvents(organizerName);
      setEvents(response.data);
    } catch (error) {
      console.error('加载活动失败:', error);
      alert('加载活动失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!organizerName.trim()) {
      alert('请先输入开团者姓名');
      return;
    }

    try {
      await api.createEvent({
        ...formData,
        organizer_name: organizerName,
      });
      
      alert('活动创建成功！');
      setFormData({
        title: '',
        description: '',
        location: '',
        date: '',
        time: '',
        max_participants: 4,
      });
      setShowForm(false);
      loadEvents();
    } catch (error) {
      alert(error.response?.data?.error || '创建活动失败，请稍后重试');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定要删除这个活动吗？所有预约将被取消。')) {
      return;
    }

    try {
      await api.deleteEvent(id);
      alert('活动已删除');
      loadEvents();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败，请稍后重试');
    }
  };

  const formatDateTime = (date, time) => {
    return `${date} ${time}`;
  };

  return (
    <div>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">开团者管理</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            开团者姓名
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              placeholder="请输入您的姓名"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={loadEvents}
              disabled={!organizerName.trim() || loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '加载中...' : '查看我的活动'}
            </button>
          </div>
        </div>

        {organizerName && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            {showForm ? '取消创建' : '+ 创建新活动'}
          </button>
        )}
      </div>

      {showForm && organizerName && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">创建活动</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                活动标题 *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                活动描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  地点 *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  最大人数 *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日期 *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  时间 *
                </label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              创建活动
            </button>
          </form>
        </div>
      )}

      {organizerName && events.length > 0 && (
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-4">我的活动</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-md p-6"
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-lg font-bold text-gray-800">{event.title}</h4>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                  >
                    删除
                  </button>
                </div>

                {event.description && (
                  <p className="text-gray-600 mb-3 text-sm">{event.description}</p>
                )}

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center">
                    <span className="font-medium w-20">地点：</span>
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">时间：</span>
                    <span>{formatDateTime(event.date, event.time)}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium w-20">人数：</span>
                    <span className={event.current_participants >= event.max_participants ? 'text-red-600 font-bold' : ''}>
                      {event.current_participants}/{event.max_participants}
                    </span>
                  </div>
                </div>

                {event.bookings && event.bookings.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">预约名单：</p>
                    <ul className="space-y-1">
                      {event.bookings.map((booking) => (
                        <li key={booking.id} className="text-sm text-gray-600">
                          • {booking.participant_name}
                          {booking.phone && <span className="text-gray-400 ml-2">({booking.phone})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {organizerName && events.length === 0 && !loading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">您还没有创建任何活动</p>
        </div>
      )}
    </div>
  );
}

export default OrganizerView;
