const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل قراءة البيانات بصيغة JSON
app.use(express.json());

// قاعدة بيانات المستخدمين
const users = [
    {
        role: "المدير",
        name: "مروان مبروك",
        institution: "الثانوية الإعدادية السلام - الدشيرة الجهادية",
        email: "marouanmabrouke@taalim.ma"
    },
    {
        role: "ممثل الأساتذة",
        name: "محمد الإدريسي",
        institution: "الثانوية الإعدادية السلام",
        email: "mohamedidrissi@taalim.ma"
    },
    {
        role: "رئيس جمعية الآباء",
        name: "ياسين مرابط",
        institution: "ثانوية السلام",
        email: "yassinemorabite@taalim.ma"
    },
    {
        role: "المتمدرس",
        name: "مريم مساعد",
        institution: "الثانوية الإعدادية السلام",
        email: "meriemmousaid@taalim.ma"
    },
    {
        role: "ولي الأمر",
        name: "براهيم مساعد",
        childName: "مريم مساعد",
        institution: "الثانوية الإعدادية السلام",
        email: "brahimemousaide@taalim.ma"
    },
    {
        role: "المفتش",
        name: "أيوب عليلو",
        institutionsCovered: ["الثانوية الإعدادية السلام"],
        email: "ayoubealilou@moufatiche.ma"
    }
];

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.send('السيرفر شغال بنجاح على Vercel 🚀');
});

// البحث عن مستخدم بالإيميل
app.post('/api/search-user', (req, res) => {

    const { email } = req.body;

    // التحقق من وجود الإيميل
    if (!email) {
        return res.status(400).json({
            error: "المرجو إرسال البريد الإلكتروني"
        });
    }

    // البحث عن المستخدم
    const user = users.find(
        u => u.email.toLowerCase() === email.toLowerCase()
    );

    // إذا وجد المستخدم
    if (user) {
        return res.status(200).json({
            success: true,
            message: "تم العثور على المستخدم",
            data: user
        });
    }

    // إذا لم يوجد
    return res.status(404).json({
        success: false,
        message: "هذا المستخدم غير موجود"
    });
});

// Route إضافي لعرض جميع المستخدمين
app.get('/api/users', (req, res) => {
    res.status(200).json(users);
});

// معالجة الأخطاء العامة
app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(500).json({
        success: false,
        error: "وقع خطأ داخل السيرفر"
    });
});

// تشغيل السيرفر محلياً فقط
if (process.env.NODE_ENV !== 'production') {

    app.listen(PORT, () => {
        console.log(`السيرفر شغال على http://localhost:${PORT}`);
    });

}

// تصدير التطبيق لـ Vercel
module.exports = app;
