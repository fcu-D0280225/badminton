import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const PULL_THRESHOLD = 64;

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [pull, setPull] = useState(0); // px pulled down (0 when not pulling)
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);

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
      // dampen so it feels like a rubber band
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
      {/* 下拉刷新指示器 */}
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

      {/* 詳情 modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md sm:mx-4 max-h-[80vh] overflow-y-auto p-6 shadow-xl"
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
            <div className="space-y-3 text-sm text-gray-700">
              <div><span className="font-semibold">場次：</span>{selected.title}</div>
              <div><span className="font-semibold">場館 / 地點：</span>{selected.location}</div>
              <div><span className="font-semibold">日期時間：</span>{formatDateTime(selected.date, selected.time)}</div>
              <div><span className="font-semibold">開團者：</span>{selected.organizer_name}</div>
              <div>
                <span className="font-semibold">名額：</span>
                {selected.current_participants} / {selected.max_participants}
                {selected.current_participants >= selected.max_participants
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
            <div className="mt-6 text-xs text-gray-500">
              提示：報名請至「我的預約」分頁。
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventList;
