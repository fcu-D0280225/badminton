import { useState } from 'react';
import OrganizerView from './components/OrganizerView';
import ParticipantView from './components/ParticipantView';
import EventList from './components/EventList';
import PlayerView from './components/PlayerView';

function App() {
  const [view, setView] = useState('player'); // 'list', 'organizer', 'participant', 'player'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">🏸 羽毛球预约系统</h1>
          <p className="text-gray-600">开团者与预约者的预约管理平台</p>
        </header>

        {/* 导航标签 */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg shadow-md p-1 inline-flex flex-wrap gap-1">
            <button
              onClick={() => setView('player')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                view === 'player'
                  ? 'bg-green-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              臨打 / 揪團
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                view === 'list'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              活動列表
            </button>
            <button
              onClick={() => setView('organizer')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                view === 'organizer'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              開團者
            </button>
            <button
              onClick={() => setView('participant')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                view === 'participant'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              預約者
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="max-w-6xl mx-auto">
          {view === 'player' && <PlayerView />}
          {view === 'list' && <EventList />}
          {view === 'organizer' && <OrganizerView />}
          {view === 'participant' && <ParticipantView />}
        </div>
      </div>
    </div>
  );
}

export default App;
