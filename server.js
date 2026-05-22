const express = require('express');
const cors = require('cors'); // 1. استدعاء الـ CORS
const app = express();
const PORT = process.env.PORT || 3000;

// 2. تفعيل الـ CORS باش يقبل الطلبات من أي بلاصة
app.use(cors());

app.use(express.json());

// قاعدة بيانات المستخدمين (بقات كيفما هي)
const users = [
  { role: "المدير", name: "مروان مبروك", institution: "الثانوية الإعدادية السلام - الدشيرة الجهادية", email: "marouanmabrouke@taalim.ma" },
  { role: "ممثل الأساتذة", name: "محمد الإدريسي", institution: "الثانوية الإعدادية السلام", email: "mohamedidrissi@taalim.ma" },
  { role: "رئيس جمعية الآباء", name: "ياسين مرابط", institution: "ثانوية السلام", email: "yassinemorabite@taalim.ma" },
  { role: "المتمدرس", name: "مريم مساعد", institution: "الثانوية الإعدادية السلام", email: "meriemmousaid@taalim.ma" },
  { role: "ولي الأمر", name: "براهيم مساعد", childName: "مريم مساعد", institution: "الثانوية الإعدادية السلام", email: "brahimemousaide@taalim.ma" },
  { role: "المفتش", name: "أيوب عليلو", institutionsCovered: ["الثانوية الإعدادية السلام"], email: "ayoubealilou@moufatiche.ma" }
];

// المصفوفات لتخزين البيانات المعلقة، المنشورات المعتمدة، والإشعارات
const pendingData = [];
const approvedData = [];
const notifications = [];

// دالة تنظيف وتدقيق البيانات للحماية من التهديدات وسد الثغرات (XSS / Injection)
function sanitizeAndValidate(data) {
  if (!data || typeof data !== 'object') return null;
  const sanitized = {};
  for (let key in data) {
    if (typeof data[key] === 'string') {
      // إزالة وسوم HTML والرموز الخطيرة لحماية السيرفر والتطبيق
      sanitized[key] = data[key].replace(/<\/?[^>]+(>|$)/g, "").trim();
    } else {
      sanitized[key] = data[key];
    }
  }
  return sanitized;
}

// دالة مساعدة للتحقق من تطابق أو تبعية المؤسسات بشكل مرن
function isSameInstitution(inst1, inst2) {
  if (!inst1 || !inst2) return false;
  const clean = (str) => str.replace(/[-\s]/g, '');
  return clean(inst1).includes(clean(inst2)) || clean(inst2).includes(clean(inst1));
}

app.get('/', (req, res) => {
  res.send('السيرفر شغال بنجاح على Vercel 🚀');
});

// البحث عن مستخدم بالإيميل
app.post('/api/search-user', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, message: "المرجو إرسال البريد الإلكتروني" });
  }
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (user) {
    // رجعنا الكلمة "user" باش تطابق مع الـ Frontend
    return res.status(200).json({
      success: true,
      message: "تم العثور على المستخدم",
      user: user
    });
  }
  
  // رديناها status 200 باش المتصفح يقرا الجواب بلا ما يوقع بلوك ف الـ Fetch
  return res.status(200).json({
    success: false,
    message: "عفوًا! هاد الإيميل ما لقيتووش ف السيرفر."
  });
});

app.get('/api/users', (req, res) => {
  res.status(200).json(users);
});

// 1. API لإدخال المعطيات وحفظها مؤقتاً في انتظار التأكيد
app.post('/api/submit-data', (req, res) => {
  const { email, payload } = req.body;
  
  if (!email || !payload) {
    return res.status(400).json({ success: false, message: "المعطيات غير متكاملة" });
  }
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(403).json({ success: false, message: "الحساب غير موجود" });
  }
  
  const allowedRoles = ["المدير", "ممثل الأساتذة", "رئيس جمعية الآباء"];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: "ليست لديك صلاحية إدخال المعطيات" });
  }
  
  // فحص المعطيات وتأكيد سلامتها وحمايتها من التهديدات
  const safePayload = sanitizeAndValidate(payload);
  if (!safePayload) {
    return res.status(400).json({ success: false, message: "المعطيات غير سليمة أو تحتوي على تهديد" });
  }
  
  const dataId = Date.now().toString();
  const newPending = {
    id: dataId,
    creatorEmail: user.email,
    creatorRole: user.role,
    creatorInstitution: user.institution,
    payload: safePayload,
    approvals: [user.role] // إضافة الطرف الأول الذي أنشأ المعطيات تلقائياً
  };
  
  pendingData.push(newPending);
  
  return res.status(200).json({
    success: true,
    message: "تم فحص المعطيات وتخزينها بنجاح في انتظار تأكيد الأطراف الأخرى",
    dataId: dataId
  });
});

// 2. API لتأكيد النشر من طرف الحسابات الأخرى وإرسال الإشعارات
app.post('/api/confirm-data', (req, res) => {
  const { email, dataId } = req.body;
  
  if (!email || !dataId) {
    return res.status(400).json({ success: false, message: "المعطيات ناقصة" });
  }
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(403).json({ success: false, message: "الحساب غير موجود" });
  }
  
  const allowedRoles = ["المدير", "ممثل الأساتذة", "رئيس جمعية الآباء"];
  if (!allowedRoles.includes(user.role)) {
    return res.status(403).json({ success: false, message: "ليست لديك صلاحية تأكيد النشر" });
  }
  
  const pendingIndex = pendingData.findIndex(d => d.id === dataId);
  if (pendingIndex === -1) {
    return res.status(404).json({ success: false, message: "المعطيات غير موجودة أو تم تفعيلها مسبقاً" });
  }
  
  const item = pendingData[pendingIndex];
  
  if (!isSameInstitution(item.creatorInstitution, user.institution)) {
    return res.status(403).json({ success: false, message: "لا يمكنك تأكيد معطيات تابعة لمؤسسة أخرى" });
  }
  
  if (item.approvals.includes(user.role)) {
    return res.status(400).json({ success: false, message: "لقد قمت بالتأكيد مسبقاً" });
  }
  
  item.approvals.push(user.role);
  
  // إذا تم التأكيد من طرف آخر (أي أطراف مختلفة من نفس المؤسسة)، يتم النشر وإرسال الإشعارات وتحديد الحسابات المستهدفة
  if (item.approvals.length >= 2) {
    // تحديد الحسابات التابعة لنفس المؤسسة والتي سيظهر لها المنشور
    const targetAccounts = users.filter(u => isSameInstitution(u.institution, item.creatorInstitution));
    
    const finalData = {
      id: item.id,
      payload: item.payload,
      creator: { name: users.find(u => u.email === item.creatorEmail).name, role: item.creatorRole },
      targetAccounts: targetAccounts.map(u => ({ name: u.name, role: u.role, email: u.email, institution: u.institution }))
    };
    
    approvedData.push(finalData);
    
    // إرسال إشعارات لجميع الحسابات المستهدفة التابعة للمؤسسة
    targetAccounts.forEach(acc => {
      notifications.push({
        email: acc.email,
        message: `تم نشر معطيات جديدة خاصة بمؤسستكم: ${item.creatorInstitution}`,
        dataId: item.id,
        timestamp: new Date()
      });
    });
    
    pendingData.splice(pendingIndex, 1);
    
    return res.status(200).json({
      success: true,
      message: "تم تأكيد النشر بنجاح، وتحديد الحسابات المستهدفة وإرسال الإشعارات لها",
      data: finalData
    });
  }
  
  return res.status(200).json({
    success: true,
    message: "تم تسجيل تأكيدك، في انتظار تأكيد بقية الأطراف المخرطة",
    approvals: item.approvals
  });
});

// 3. API لجلب المعطيات المنشورة رفقة معلومات الحسابات التي ستظهر لها
app.get('/api/get-published-data', (req, res) => {
  return res.status(200).json({
    success: true,
    data: approvedData
  });
});

// 4. API إضافي اختياري لجلب إشعارات حساب معين لتسهيل عرضها في التطبيق
app.post('/api/my-notifications', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "البريد الإلكتروني مطلوب" });
  const userNotifications = notifications.filter(n => n.email.toLowerCase() === email.toLowerCase());
  return res.status(200).json({ success: true, notifications: userNotifications });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "وقع خطأ داخل السيرفر" });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`السيرفر شغال على http://localhost:${PORT}`);
  });
}

module.exports = app;
