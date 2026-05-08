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
const THEME_KEY = 'theme';

function readInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {}
  return 'light';
}

function App() {
  const [tab, setTab] = useState('discover');
  const [legacyView, setLegacyView] = useState(null); // 'organizer' | 'player' | null
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-indigo-950">
      <header className="bg-white dark:bg-slate-800 shadow-sm sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-800 dark:text-slate-100">🏸 羽毛球预约</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-slate-400">{TABS.find(t => t.key === tab)?.label}</span>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="切換夜間模式"
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? '切換到日間模式' : '切換到夜間模式'}
              className="theme-toggle-btn"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
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
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-slate-400">
            <div className="text-5xl mb-3">🔔</div>
            <div className="text-base">通知功能即將推出</div>
            <div className="text-sm mt-2 text-gray-400 dark:text-slate-500">場次新報名／取消提醒、開放通知等將在此呈現</div>
          </div>
        </section>

        <section style={{ display: tab === 'profile' ? 'block' : 'none' }}>
          {legacyView === 'organizer' ? (
            <div>
              <button
                onClick={() => setLegacyView(null)}
                className="mb-3 text-sm text-blue-600 dark:text-blue-300 hover:underline"
              >← 返回「我」</button>
              <OrganizerView />
            </div>
          ) : legacyView === 'player' ? (
            <div>
              <button
                onClick={() => setLegacyView(null)}
                className="mb-3 text-sm text-blue-600 dark:text-blue-300 hover:underline"
              >← 返回「我」</button>
              <PlayerView />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-2xl">
                    {profileName ? profileName.slice(0, 1) : '👤'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 dark:text-slate-100">
                      {profileName || '尚未設定個人資料'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-slate-400">
                      {profileName ? '個人資料儲存在本機，可隨時登出' : '前往「我的預約」分頁輸入姓名後即可建立資料'}
                    </div>
                  </div>
                </div>

                {profileName ? (
                  <dl className="text-sm text-gray-700 dark:text-slate-200 border-t border-gray-100 dark:border-slate-700 pt-4 space-y-2">
                    <div className="flex">
                      <dt className="w-20 text-gray-500 dark:text-slate-400">姓名</dt>
                      <dd className="flex-1 text-gray-800 dark:text-slate-100">{profileName}</dd>
                    </div>
                    <div className="flex">
                      <dt className="w-20 text-gray-500 dark:text-slate-400">電話</dt>
                      <dd className="flex-1 text-gray-800 dark:text-slate-100">{profilePhone || '（未填）'}</dd>
                    </div>
                  </dl>
                ) : signedOut ? (
                  <div className="text-sm text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-2">
                    已登出，本機暫存的姓名與電話已清除
                  </div>
                ) : null}

                {profileName && (
                  <button
                    onClick={handleLogout}
                    className="mt-4 w-full px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm"
                  >
                    登出（清除本機資料）
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
                <div className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2 px-2">進階身份</div>
                <div className="space-y-2">
                  <button
                    onClick={() => setLegacyView('player')}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between dark:text-slate-200"
                  >
                    <span>臨打 / 揪團</span>
                    <span className="text-gray-400 dark:text-slate-500">›</span>
                  </button>
                  <button
                    onClick={() => setLegacyView('organizer')}
                    className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 flex items-center justify-between dark:text-slate-200"
                  >
                    <span>開團者後台</span>
                    <span className="text-gray-400 dark:text-slate-500">›</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 shadow-[0_-2px_6px_rgba(0,0,0,0.04)] dark:shadow-[0_-2px_6px_rgba(0,0,0,0.5)] z-40"
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
                  active ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
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
