const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// إنشاء مجلد uploads إذا لم يكن موجود
const uploadDir = path.join(__dirname, 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// إعداد Multer
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// قاعدة بيانات المستخدمين
const users = [
  {
    user_id: "1",
    role: "المدير",
    name: "مروان مبروك",
    school_name: "الثانوية الإعدادية السلام - الدشيرة الجهادية",
    email: "marouanmabrouke@taalim.ma"
  },
  {
    user_id: "2",
    role: "ممثل الأساتذة",
    name: "محمد الإدريسي",
    school_name: "الثانوية الإعدادية السلام",
    email: "mohamedidrissi@taalim.ma"
  },
  {
    user_id: "3",
    role: "رئيس جمعية الآباء",
    name: "ياسين مرابط",
    school_name: "ثانوية السلام",
    email: "yassinemorabite@taalim.ma"
  },
  {
    user_id: "4",
    role: "التلميذ",
    name: "مريم مساعد",
    school_name: "الثانوية الإعدادية السلام",
    email: "meriemmousaid@taalim.ma"
  },
  {
    user_id: "5",
    role: "ولي الأمر",
    name: "براهيم مساعد",
    school_name: "الثانوية الإعدادية السلام",
    email: "brahimemousaide@taalim.ma"
  },
  {
    user_id: "6",
    role: "المفتش",
    name: "أيوب عليلو",
    school_name: "الثانوية الإعدادية السلام",
    email: "ayoubealilou@moufatiche.ma"
  }
];

// جدول المنشورات
const posts = [];

// جدول الموافقات
const approvals = [];

// جدول الإشعارات
const notifications = [];

// دالة الحماية وتنظيف البيانات
function sanitizeAndValidate(data) {
  if (!data || typeof data !== 'object') return null;

  const sanitized = {};

  for (let key in data) {
    if (typeof data[key] === 'string') {
      sanitized[key] = data[key]
        .replace(/<\/?[^>]+(>|$)/g, "")
        .trim();
    } else {
      sanitized[key] = data[key];
    }
  }

  return sanitized;
}

// التحقق من المؤسسة
function isSameInstitution(inst1, inst2) {
  if (!inst1 || !inst2) return false;

  const clean = (str) =>
    str.toLowerCase().replace(/[-\s]/g, '');

  return (
    clean(inst1).includes(clean(inst2)) ||
    clean(inst2).includes(clean(inst1))
  );
}

// محاكاة Push Notification
function sendPushNotification(targetUsers, post) {
  targetUsers.forEach(user => {
    notifications.push({
      user_id: user.user_id,
      email: user.email,
      school_name: user.school_name,
      post_id: post.id,
      message: `تم نشر منشور جديد خاص بمؤسستكم`,
      timestamp: new Date()
    });

    console.log(`Push Notification Sent To: ${user.email}`);
  });
}

app.get('/', (req, res) => {
  res.send('السيرفر شغال بنجاح على Vercel 🚀');
});

// البحث عن مستخدم
app.post('/api/search-user', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "المرجو إرسال البريد الإلكتروني"
    });
  }

  const user = users.find(
    u => u.email.trim().toLowerCase() === email.trim().toLowerCase()
  );

  if (user) {
    return res.status(200).json({
      success: true,
      message: "تم العثور على المستخدم",
      user
    });
  }

  return res.status(200).json({
    success: false,
    message: "عفوًا! هاد الإيميل ما لقيتووش ف السيرفر."
  });
});

// جلب المستخدمين
app.get('/api/users', (req, res) => {
  return res.status(200).json(users);
});

// إنشاء منشور جديد مع الصور
app.post(
  '/api/submit-data',
  upload.array('images', 10),
  async (req, res) => {
    try {
      const { email, content } = req.body;

      if (!email || !content) {
        return res.status(400).json({
          success: false,
          message: "المعطيات غير متكاملة"
        });
      }

      const user = users.find(
        u => u.email.trim().toLowerCase() === email.trim().toLowerCase()
      );

      if (!user) {
        return res.status(403).json({
          success: false,
          message: "الحساب غير موجود"
        });
      }

      const allowedRoles = [
        "المدير",
        "ممثل الأساتذة",
        "رئيس جمعية الآباء"
      ];

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "ليست لديك صلاحية إدخال المعطيات"
        });
      }

      const safeContent = sanitizeAndValidate({ content });

      if (!safeContent) {
        return res.status(400).json({
          success: false,
          message: "المعطيات غير سليمة"
        });
      }

      const imageUrls = [];

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const fileName =
            Date.now() + '-' + Math.round(Math.random() * 1E9) + '.jpg';

          const filePath = path.join(uploadDir, fileName);

          await sharp(file.buffer)
            .resize({ width: 1200 })
            .jpeg({ quality: 70 })
            .toFile(filePath);

          const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;

          imageUrls.push(imageUrl);
        }
      }

      const postId = Date.now().toString();

      const newPost = {
        id: postId,
        sender_id: user.user_id,
        school_name: user.school_name,
        content: safeContent.content,
        images: imageUrls,
        status: "Pending"
      };

      posts.push(newPost);

      approvals.push({
        post_id: postId,
        director_approved: user.role === "المدير",
        teachers_rep_approved: user.role === "ممثل الأساتذة",
        parents_assoc_approved: user.role === "رئيس جمعية الآباء"
      });

      return res.status(200).json({
        success: true,
        message: "تم حفظ المنشور مؤقتاً في انتظار الموافقات",
        post: newPost
      });

    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "وقع خطأ أثناء معالجة الصور أو حفظ المنشور"
      });
    }
  }
);

// الموافقة أو الرفض على المنشور
app.post('/api/confirm-data', (req, res) => {
  const { email, post_id, action } = req.body;

  if (!email || !post_id || !action) {
    return res.status(400).json({
      success: false,
      message: "المعطيات ناقصة"
    });
  }

  const user = users.find(
    u => u.email.trim().toLowerCase() === email.trim().toLowerCase()
  );

  if (!user) {
    return res.status(403).json({
      success: false,
      message: "الحساب غير موجود"
    });
  }

  const allowedRoles = [
    "المدير",
    "ممثل الأساتذة",
    "رئيس جمعية الآباء"
  ];

  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({
      success: false,
      message: "ليست لديك صلاحية التأكيد"
    });
  }

  const post = posts.find(p => p.id === post_id);

  if (!post) {
    return res.status(404).json({
      success: false,
      message: "المنشور غير موجود"
    });
  }

  if (!isSameInstitution(post.school_name, user.school_name)) {
    return res.status(403).json({
      success: false,
      message: "لا يمكنك معالجة منشور تابع لمؤسسة أخرى"
    });
  }

  const approval = approvals.find(a => a.post_id === post_id);

  if (!approval) {
    return res.status(404).json({
      success: false,
      message: "بيانات الموافقة غير موجودة"
    });
  }

  if (action === "reject") {
    post.status = "Rejected";

    return res.status(200).json({
      success: true,
      message: "تم رفض المنشور",
      post
    });
  }

  if (user.role === "المدير") {
    approval.director_approved = true;
  }

  if (user.role === "ممثل الأساتذة") {
    approval.teachers_rep_approved = true;
  }

  if (user.role === "رئيس جمعية الآباء") {
    approval.parents_assoc_approved = true;
  }

  // التحقق من اكتمال الموافقات الثلاث
  if (
    approval.director_approved &&
    approval.teachers_rep_approved &&
    approval.parents_assoc_approved
  ) {
    post.status = "Approved";

    // البحث عن الحسابات المرتبطة بنفس المؤسسة
    const targetUsers = users.filter(u => {
      const allowedTargets = [
        "التلميذ",
        "ولي الأمر",
        "المفتش"
      ];

      return (
        allowedTargets.includes(u.role) &&
        isSameInstitution(u.school_name, post.school_name)
      );
    });

    // إرسال الإشعارات
    sendPushNotification(targetUsers, post);

    return res.status(200).json({
      success: true,
      message: "تمت الموافقة النهائية ونشر المنشور وإرسال الإشعارات",
      post,
      targetUsers
    });
  }

  post.status = "Pending";

  return res.status(200).json({
    success: true,
    message: "تم تسجيل الموافقة، المنشور مازال في انتظار باقي الموافقات",
    approvals: approval,
    post
  });
});

// جلب المنشورات المنشورة
app.get('/api/get-published-data', (req, res) => {
  const approvedPosts = posts.filter(
    post => post.status === "Approved"
  );

  return res.status(200).json({
    success: true,
    data: approvedPosts
  });
});

// جلب المنشورات المعلقة
app.get('/api/get-pending-data', (req, res) => {
  const pendingPosts = posts.filter(
    post => post.status === "Pending"
  );

  return res.status(200).json({
    success: true,
    data: pendingPosts
  });
});

// جلب الإشعارات
app.post('/api/my-notifications', (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "البريد الإلكتروني مطلوب"
    });
  }

  const userNotifications = notifications.filter(
    n => n.email.trim().toLowerCase() === email.trim().toLowerCase()
  );

  return res.status(200).json({
    success: true,
    notifications: userNotifications
  });
});

// جلب الموافقات
app.get('/api/approvals', (req, res) => {
  return res.status(200).json({
    success: true,
    approvals
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error(err.stack);

  res.status(500).json({
    success: false,
    error: "وقع خطأ داخل السيرفر"
  });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`السيرفر شغال على http://localhost:${PORT}`);
  });
}

module.exports = app;
