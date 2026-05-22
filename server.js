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
