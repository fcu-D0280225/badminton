import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 初始化数据库
const db = new Database(join(__dirname, 'database.db'));

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizer_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    max_participants INTEGER NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'organizer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    participant_name TEXT NOT NULL,
    phone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
  );
`);

// API 路由

// 获取所有活动
app.get('/api/events', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events ORDER BY date, time').all();
    const eventsWithBookings = events.map(event => {
      const bookings = db.prepare('SELECT * FROM bookings WHERE event_id = ?').all(event.id);
      return {
        ...event,
        current_participants: bookings.length,
        bookings: bookings
      };
    });
    res.json(eventsWithBookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个活动详情
app.get('/api/events/:id', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
    if (!event) {
      return res.status(404).json({ error: '活动不存在' });
    }
    const bookings = db.prepare('SELECT * FROM bookings WHERE event_id = ?').all(event.id);
    res.json({
      ...event,
      current_participants: bookings.length,
      bookings: bookings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建活动（开团者）
app.post('/api/events', (req, res) => {
  try {
    const { organizer_name, title, description, location, date, time, max_participants, event_type } = req.body;

    if (!organizer_name || !title || !location || !date || !time || !max_participants) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    const type = event_type === 'pickup' ? 'pickup' : 'organizer';
    const result = db.prepare(`
      INSERT INTO events (organizer_name, title, description, location, date, time, max_participants, event_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(organizer_name, title, description || '', location, date, time, max_participants, type);

    res.json({ id: result.lastInsertRowid, message: '活动创建成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 预约活动（预约者）
app.post('/api/bookings', (req, res) => {
  try {
    const { event_id, participant_name, phone } = req.body;
    
    if (!event_id || !participant_name) {
      return res.status(400).json({ error: '请填写所有必填字段' });
    }

    // 检查活动是否存在
    const event = db.prepare('SELECT * FROM events WHERE id = ?').get(event_id);
    if (!event) {
      return res.status(404).json({ error: '活动不存在' });
    }

    // 检查是否已满
    const bookings = db.prepare('SELECT * FROM bookings WHERE event_id = ?').all(event_id);
    if (bookings.length >= event.max_participants) {
      return res.status(400).json({ error: '活动已满员' });
    }

    // 检查是否已预约
    const existing = db.prepare('SELECT * FROM bookings WHERE event_id = ? AND participant_name = ?')
      .get(event_id, participant_name);
    if (existing) {
      return res.status(400).json({ error: '您已经预约过此活动' });
    }

    const result = db.prepare(`
      INSERT INTO bookings (event_id, participant_name, phone)
      VALUES (?, ?, ?)
    `).run(event_id, participant_name, phone || '');

    res.json({ id: result.lastInsertRowid, message: '预约成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取消预约
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '预约不存在' });
    }
    res.json({ message: '预约已取消' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除活动（开团者）
app.delete('/api/events/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '活动不存在' });
    }
    res.json({ message: '活动已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取预约者的预约记录
app.get('/api/bookings/participant/:name', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, e.title, e.location, e.date, e.time, e.organizer_name
      FROM bookings b
      JOIN events e ON b.event_id = e.id
      WHERE b.participant_name = ?
      ORDER BY e.date, e.time
    `).all(req.params.name);
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取开团者的活动
app.get('/api/events/organizer/:name', (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM events WHERE organizer_name = ? ORDER BY date, time').all(req.params.name);
    const eventsWithBookings = events.map(event => {
      const bookings = db.prepare('SELECT * FROM bookings WHERE event_id = ?').all(event.id);
      return {
        ...event,
        current_participants: bookings.length,
        bookings: bookings
      };
    });
    res.json(eventsWithBookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
