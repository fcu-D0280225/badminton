import { useState, useEffect } from 'react';
import OrganizerView from './components/OrganizerView';
import ParticipantView from './components/ParticipantView';
import EventList from './components/EventList';
import PlayerView from './components/PlayerView';

const TABS = [
  { key: 'discover',     label: '探索',   icon: '🔍' },
  { key: 'reservations', label: '我的預約', icon: '📅' },
  { key: 'notifications', label: '通知',   icon: '🔔' },
  { key: 'profile',      label: '我',     icon: '👤' },
];

const NAME_KEY = 'badminton.participantName';
const PHONE_KEY = 'badminton.participantPhone';

function App() {
  const [tab, setTab] = useState('discover');
  const [legacyView, setLegacyView] = useState(null); // 'organizer' | 'player' | null
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [signedOut, setSignedOut] = useState(false);

  // 切到「我」分頁時讀取最新的 localStorage 值
  useEffect(() => {
    if (tab === 'profile') {
      setProfileName(localStorage.getItem(NAME_KEY) || '');
      setProfilePhone(localStorage.getItem(PHONE_KEY) || '');
      setSignedOut(false);
    }
  }, [tab]);

  const handleLogout = () => {
    try {
      localStorage.removeItem(NAME_KEY);
      localStorage.removeItem(PHONE_KEY);
    } catch {}
    setProfileName('');
    setProfilePhone('');
    setSignedOut(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">🏸 羽毛球预约</h1>
          <span className="text-xs text-gray-500">{TABS.find(t => t.key === tab)?.label}</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-24">
        {/* 各頁始終 mount，用 display 切換以保留各頁捲動位置 */}
        <section style={{ display: tab === 'discover' ? 'block' : 'none' }}>
          <EventList />
        </section>

        <section style={{ display: tab === 'reservations' ? 'block' : 'none' }}>
          <ParticipantView />
        </section>

        <section style={{ display: tab === 'notifications' ? 'block' : 'none' }}>
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <div className="text-5xl mb-3">🔔</div>
            <div className="text-base">通知功能即將推出</div>
            <div className="text-sm mt-2 text-gray-400">場次新報名／取消提醒、開放通知等將在此呈現</div>
          </div>
        </section>

        <section style={{ display: tab === 'profile' ? 'block' : 'none' }}>
          {legacyView === 'organizer' ? (
            <div>
              <button
                onClick={() => setLegacyView(null)}
                className="mb-3 text-sm text-blue-600 hover:underline"
              >← 返回「我」</button>
              <OrganizerView />
            </div>
          ) : legacyView === 'player' ? (
            <div>
              <button
                onClick={() => setLegacyView(null)}
                className="mb-3 text-sm text-blue-600 hover:underline"
              >← 返回「我」</button>
              <PlayerView />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">
                    {profileName ? profileName.slice(0, 1) : '👤'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      {profileName || '尚未設定個人資料'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {profileName ? '個人資料儲存在本機，可隨時登出' : '前往「我的預約」分頁輸入姓名後即可建立資料'}
                    </div>
                  </div>
                </div>

                {profileName ? (
                  <dl className="text-sm text-gray-700 border-t border-gray-100 pt-4 space-y-2">
                    <div className="flex">
                      <dt className="w-20 text-gray-500">姓名</dt>
                      <dd className="flex-1 text-gray-800">{profileName}</dd>
                    </div>
                    <div className="flex">
                      <dt className="w-20 text-gray-500">電話</dt>
                      <dd className="flex-1 text-gray-800">{profilePhone || '（未填）'}</dd>
                    </div>
                  </dl>
                ) : signedOut ? (
                  <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    已登出，本機暫存的姓名與電話已清除
                  </div>
                ) : null}

                {profileName && (
                  <button
                    onClick={handleLogout}
                    className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    登出（清除本機資料）
                  </button>
                )}
              </div>

              <div className="bg-white rounded-lg shadow p-4">
                <div className="text-xs font-medium text-gray-500 mb-2 px-2">進階身份</div>
                <div className="space-y-2">
                  <button
                    onClick={() => setLegacyView('player')}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>臨打 / 揪團</span>
                    <span className="text-gray-400">›</span>
                  </button>
                  <button
                    onClick={() => setLegacyView('organizer')}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span>開團者後台</span>
                    <span className="text-gray-400">›</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-[0_-2px_6px_rgba(0,0,0,0.04)] z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={`flex flex-col items-center justify-center py-2 text-xs transition-colors ${
                  active ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-xl leading-none mb-0.5">{t.icon}</span>
                <span className={active ? 'font-semibold' : ''}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
