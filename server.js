require('dotenv').config(); // قراءة ملف .env إذا كان موجوداً
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

const io = socketIo(server, {
  cors: { origin: "*" }
});

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

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

/* =========================
   STORAGE
========================= */
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // الحد الأقصى 5 ميغابايت
  }
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
  const clean = {};
  for (let k in data) {
    clean[k] = typeof data[k] === "string"
      ? data[k].replace(/<\/?[^>]+(>|$)/g, "").trim()
      : data[k];
  }
  return clean;
}

function sameInstitution(a, b) {
  if (!a || !b) return false;
  const clean = (s) => s.toLowerCase().replace(/[-\s]/g, '');
  return clean(a).includes(clean(b)) || clean(b).includes(clean(a));
}

function createNotification(userId, message, data = {}) {
  const notif = {
    id: Date.now().toString() + Math.random(),
    userId,
    message,
    data,
    read: false,
    createdAt: new Date()
  };

  notifications.push(notif);
  io.to(userId).emit("notification", notif);
  return notif;
}

/* =========================
   HOME
========================= */
app.get('/', (req, res) => {
  res.send('Server Running 🚀');
});

/* =========================
   USERS
========================= */
app.get('/api/users', (req, res) => {
  res.json(users);
});

app.post('/api/search-user', (req, res) => {
  const { email } = req.body;
  const user = users.find(
    u => u.email?.toLowerCase() === email?.toLowerCase()
  );
  res.json({
    success: !!user,
    user: user || null
  });
});

/* =========================
   CREATE POST
========================= */
app.post('/api/submit-data', upload.array('images', 10), async (req, res) => {
  try {
    const { email, content } = req.body;

    const user = users.find(
      u => u.email?.toLowerCase() === email?.toLowerCase()
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "User not found"
      });
    }

    const safe = sanitize({ content });
    const images = [];

    if (req.files?.length) {
      for (const file of req.files) {
        const fileName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ".jpg";
        const filePath = path.join(uploadDir, fileName);

        await sharp(file.buffer)
          .resize({ width: 1200, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toFile(filePath);

        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
        images.push(imageUrl);
      }
    }

    const post = {
      id: Date.now().toString(),
      sender_id: user.user_id,
      sender_role: user.role,
      school_name: user.school_name,
      content: safe.content,
      images,
      status: "Pending",
      createdAt: new Date()
    };

    posts.push(post);

    const approval = {
      post_id: post.id,
      director: user.role === "المدير",
      teacher: user.role === "ممثل الأساتذة",
      parents: user.role === "رئيس جمعية الآباء",
      rejected: false,
      rejectedBy: null,
      approvedAt: null
    };

    approvals.push(approval);

    const targets = users.filter(u =>
      ["المدير", "ممثل الأساتذة", "رئيس جمعية الآباء"].includes(u.role) &&
      u.user_id !== user.user_id &&
      sameInstitution(u.school_name, post.school_name)
    );

    targets.forEach(target => {
      createNotification(
        target.user_id,
        "هناك منشور جديد يحتاج إلى التأكيد أو الرفض",
        { post_id: post.id, type: "approval_request" }
      );
      io.to(target.user_id).emit("approval_request", { post });
    });

    io.emit("new_post_pending", post);

    res.json({
      success: true,
      post,
      approval
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

/* =========================
   CONFIRM OR REJECT POST
========================= */
app.post('/api/confirm-data', (req, res) => {
  try {
    const { email, post_id, action } = req.body;

    const user = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());
    const post = posts.find(p => p.id === post_id);
    const approval = approvals.find(a => a.post_id === post_id);

    if (!user || !post || !approval) {
      return res.status(404).json({ success: false, message: "Data not found" });
    }

    if (!["المدير", "ممثل الأساتذة", "رئيس جمعية الآباء"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (action === "reject") {
      approval.rejected = true;
      approval.rejectedBy = user.role;
      post.status = "Rejected";

      createNotification(
        post.sender_id,
        `تم رفض المنشور من طرف ${user.role}`,
        { post_id, type: "rejected" }
      );

      io.to(post.sender_id).emit("post_rejected", { post_id, rejectedBy: user.role });

      return res.json({ success: true, status: "Rejected", post });
    }

    if (action === "confirm") {
      if (user.role === "المدير") approval.director = true;
      if (user.role === "ممثل الأساتذة") approval.teacher = true;
      if (user.role === "رئيس جمعية الآباء") approval.parents = true;

      createNotification(
        post.sender_id,
        `قام ${user.role} بتأكيد المنشور`,
        { post_id, type: "confirmed" }
      );

      const confirmedCount = [
        approval.director,
        approval.teacher,
        approval.parents
      ].filter(v => v === true).length;

      if (confirmedCount >= 2) {
        post.status = "Approved";
        approval.approvedAt = new Date();

        const publishTargets = users.filter(u =>
          ["التلميذ", "ولي الأمر", "المفتش"].includes(u.role) &&
          sameInstitution(u.school_name, post.school_name)
        );

        publishTargets.forEach(target => {
          createNotification(
            target.user_id,
            "تم نشر معطيات جديدة",
            { post_id, type: "published" }
          );
          io.to(target.user_id).emit("published_post", { post });
        });

        io.emit("post_approved", post);

        return res.json({
          success: true,
          message: "Post approved successfully",
          post,
          publishTargets
        });
      }

      post.status = "Waiting Second Approval";

      return res.json({
        success: true,
        message: "First approval completed",
        post,
        approval
      });
    }

    res.status(400).json({ success: false, message: "Invalid action" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
});

/* =========================
   GET POSTS & NOTIFICATIONS
========================= */
app.get('/api/get-published-data', (req, res) => {
  res.json({ success: true, data: posts.filter(p => p.status === "Approved") });
});

app.get('/api/get-pending-data', (req, res) => {
  res.json({ success: true, data: posts.filter(p => p.status === "Pending" || p.status === "Waiting Second Approval") });
});

app.get('/api/get-rejected-data', (req, res) => {
  res.json({ success: true, data: posts.filter(p => p.status === "Rejected") });
});

app.get('/api/notifications/:userId', (req, res) => {
  res.json({ success: true, data: notifications.filter(n => n.userId === req.params.userId) });
});

app.post('/api/notifications/read', (req, res) => {
  const { notificationId } = req.body;
  const notif = notifications.find(n => n.id === notificationId);
  if (notif) notif.read = true;
  res.json({ success: true });
});

/* =========================
   SERVER START
========================= */
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
