const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(cors());
app.use(express.json());

/* =========================
   SOCKET.IO
========================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
});

/* =========================
   STORAGE (LOCAL - TEMP)
========================= */
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/* =========================
   TEMP DATABASE
========================= */
const users = [];
const posts = [];
const approvals = [];
const notifications = [];

/* =========================
   HELPERS
========================= */
function sanitize(data) {
  if (!data) return null;
  const clean = {};

  for (let k in data) {
    clean[k] =
      typeof data[k] === "string"
        ? data[k].replace(/<\/?[^>]+(>|$)/g, "").trim()
        : data[k];
  }

  return clean;
}

function sameInstitution(a, b) {
  if (!a || !b) return false;
  const c = (s) => s.toLowerCase().replace(/[-\s]/g, '');
  return c(a).includes(c(b)) || c(b).includes(c(a));
}

/* =========================
   SOCKET NOTIFY
========================= */
function emitNewPost(post) {
  io.emit("new_post", post);
}

/* =========================
   ROUTES
========================= */

/* HOME */
app.get('/', (req, res) => {
  res.send('Server Running 🚀');
});

/* USERS */
app.get('/api/users', (req, res) => {
  res.json(users);
});

/* SEARCH USER */
app.post('/api/search-user', (req, res) => {
  const { email } = req.body;

  const user = users.find(u =>
    u.email?.toLowerCase() === email?.toLowerCase()
  );

  res.json({ success: !!user, user: user || null });
});

/* =========================
   CREATE POST
========================= */
app.post('/api/submit-data', upload.array('images', 10), async (req, res) => {
  try {
    const { email, content } = req.body;

    if (!email || !content) {
      return res.status(400).json({ success: false });
    }

    const user = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    if (!user) return res.status(403).json({ success: false });

    const allowedRoles = ["المدير", "ممثل الأساتذة", "رئيس جمعية الآباء"];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ success: false });
    }

    const safe = sanitize({ content });

    const images = [];

    if (req.files?.length) {
      for (const file of req.files) {
        const name = Date.now() + "-" + Math.random() + ".jpg";
        const filePath = path.join(uploadDir, name);

        await sharp(file.buffer)
          .resize(1200)
          .jpeg({ quality: 70 })
          .toFile(filePath);

        images.push(`${req.protocol}://${req.get('host')}/uploads/${name}`);
      }
    }

    const post = {
      id: Date.now().toString(),
      sender_id: user.user_id,
      school_name: user.school_name,
      content: safe.content,
      images,
      status: "Pending"
    };

    posts.push(post);

    approvals.push({
      post_id: post.id,
      director: user.role === "المدير",
      teacher: user.role === "ممثل الأساتذة",
      parents: user.role === "رئيس جمعية الآباء"
    });

    /* REAL-TIME UPDATE */
    emitNewPost(post);

    res.json({ success: true, post });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* =========================
   APPROVAL SYSTEM
========================= */
app.post('/api/confirm-data', (req, res) => {
  const { email, post_id, action } = req.body;

  const user = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
  const post = posts.find(p => p.id === post_id);
  const approval = approvals.find(a => a.post_id === post_id);

  if (!user || !post || !approval) {
    return res.status(404).json({ success: false });
  }

  if (action === "reject") {
    post.status = "Rejected";
    return res.json({ success: true, post });
  }

  if (user.role === "المدير") approval.director = true;
  if (user.role === "ممثل الأساتذة") approval.teacher = true;
  if (user.role === "رئيس جمعية الآباء") approval.parents = true;

  if (approval.director && approval.teacher && approval.parents) {
    post.status = "Approved";

    const targets = users.filter(u =>
      ["التلميذ", "ولي الأمر", "المفتش"].includes(u.role) &&
      sameInstitution(u.school_name, post.school_name)
    );

    return res.json({
      success: true,
      message: "Approved",
      post,
      targets
    });
  }

  post.status = "Pending";

  res.json({ success: true, post });
});

/* =========================
   POSTS
========================= */
app.get('/api/get-published-data', (req, res) => {
  res.json(posts.filter(p => p.status === "Approved"));
});

app.get('/api/get-pending-data', (req, res) => {
  res.json(posts.filter(p => p.status === "Pending"));
});

/* =========================
   NOTIFICATIONS (TEMP)
========================= */
app.post('/api/my-notifications', (req, res) => {
  const { email } = req.body;

  const data = notifications.filter(n =>
    n.email?.toLowerCase() === email?.toLowerCase()
  );

  res.json({ success: true, data });
});

/* =========================
   SERVER START
========================= */
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
