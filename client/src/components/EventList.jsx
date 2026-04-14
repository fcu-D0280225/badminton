import { useState, useEffect } from 'react';
import { api } from '../api';

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const formatDateTime = (date, time) => {
    return `${date} ${time}`;
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
    <div>
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
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold text-gray-800">{event.title}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    event.current_participants >= event.max_participants
                      ? 'bg-red-100 text-red-700'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {event.current_participants}/{event.max_participants}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;
