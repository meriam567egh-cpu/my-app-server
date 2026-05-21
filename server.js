// 1. استدعاء مكتبة Express وتجهيز السيرفر
const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

// ==========================================
// 2. قاعدة البيانات التجريبية (الخزنات المخزنة في السيرفر)
// ==========================================

// 👥 خزنة بيانات الأشخاص (المستخدمين) اللي عطيتيني دبا
const users = [
    {
        id: 1,
        fullName: "مريم مساعد الإدريسي",
        role: "student", // صفتها: تلميذة
        grade: "الثالثة إعدادي",
        schoolName: "الثانوية الإعدادية السلام",
        region: "جهة سوس ماسة",
        direction: "مديرية إنزكان أيت ملول"
    },
    {
        id: 2,
        fullName: "مروان مبروك",
        role: "director", // صفته: مدير مدرسة
        schoolName: "الثانوية الإعدادية السلام",
        region: "جهة سوس ماسة",
        direction: "مديرية إنزكان أيت ملول"
    }
];

// 🏛️ خزنة الأسعار المرجعية العادلة في السوق
const marketPrices = {
    "طاولات مدرسية": 400,
    "صباغة القاعات": 3000,
    "حواسيب للإدارة": 5000
};

// 📂 خزنة الميزانيات والمشاريع
let schoolBudgets = [
    {
        id: 1,
        schoolName: "الثانوية الإعدادية السلام",
        projectName: "تجديد قاعة الحسابيات",
        items: [
            { name: "حواسيب للإدارة", quantity: 2, price: 5200 }
        ],
        status: "approved" // منشورة ومقبولة، يعني التلميذة مريم تقدر تشوفها دبا
    }
];

// ==========================================
// 3. واجهات استقبال ساعي البريد (API Endpoints)
// ==========================================

// 🔐 عنوان لتسجيل الدخول والتعرف على الشخص (Login Endpoint)
app.post('/api/login', (req, res) => {
    const { name } = req.body; // ساعي البريد كيجيب الاسم لي كتبو المستخدم
    
    // السيرفر كيقلب فخزنة الأشخاص واش هاد الاسم كاين
    const user = users.find(u => u.fullName === name);

    if (!user) {
        return res.status(404).json({
            status: "error",
            message: "❌ هاد الاسم غير مسجل في قواعد بيانات المؤسسة!"
        });
    }

    // يلا لقى الاسم، السيرفر كيتعرف على الصلاحيات ديالو ويرد على ساعي البريد
    res.status(200).json({
        status: "success",
        message: `👋 أهلاً بك يا ${user.fullName}`,
        userData: user // السيرفر يصيفط كاع معلوماتو (واش تلميذ ولا مدير) باش التطبيق يفتح ليه الواجهة المناسبة
    });
});

// 📋 عنوان دراسة ومقارنة الميزانيات اللي كيرسلها المدير مروان
app.post('/api/verify-budget', (req, res) => {
    const incomingBudget = req.body;
    let flaggedItems = [];
    let isFraudDetected = false;

    incomingBudget.items.forEach(item => {
        const fairPrice = marketPrices[item.name];
        if (fairPrice) {
            const maxAllowedPrice = fairPrice * 1.15; 
            if (item.price > maxAllowedPrice) {
                isFraudDetected = true;
                flaggedItems.push({
                    material: item.name,
                    enteredPrice: item.price,
                    marketPrice: fairPrice
                });
            }
        }
    });

    if (isFraudDetected) {
        return res.status(400).json({
            status: "rejected",
            message: "⚠️ تم رفض حفظ الميزانية! النظام رصد نفخاً غير مبرر في الأسعار.",
            details: flaggedItems
        });
    }

    incomingBudget.id = schoolBudgets.length + 1;
    incomingBudget.status = "pending_approvals";
    schoolBudgets.push(incomingBudget);

    res.status(201).json({
        status: "pending_approvals",
        message: "✅ تم تسجيل الميزانية بنجاح. المشروع في انتظار مصادقة بقية الأعضاء."
    });
});

// ==========================================
// 4. تشغيل المستمع
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال دبا بالبيانات الجديدة على: http://localhost:${PORT}`);
});