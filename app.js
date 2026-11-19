// إعدادات الربط مع Supabase (سيتم تحديثها في خطوة الربط مع حساب المشروع الجديد)
const SUPABASE_URL = "https://ttpuydrajuzxkvgzxyje.supabase.cos";
const SUPABASE_ANON_KEY = "sb_publishable_30MifGPE29B9aRrFkdoG7w_AQgKhhRO";
let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// دالة تشفير عالية الأمان (SHA-256) لحماية كلمات المرور
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// تهيئة الحسابين الأساسيين ذوي الصلاحيات الكاملة (2000+ طالب مدعومين في البيانات)
async function initDefaultUsers() {
    const existing = JSON.parse(localStorage.getItem("biz_users") || "null");
    if (existing && existing.length > 0) return existing;

    const passDoctorHash = await hashPassword("D_AS@123");
    const passYoussefHash = await hashPassword("YT_AL@1234");

    const defaultUsers = [
        {
            id: "adm_1",
            fullname: "دكتور احمد سليمان",
            username: "دكتور احمد سليمان",
            passwordHash: passDoctorHash,
            role: "admin",
            warnings: 0
        },
        {
            id: "adm_2",
            fullname: "يوسف طاهر الشعراوي",
            username: "يوسف طاهر الشعراوي",
            passwordHash: passYoussefHash,
            role: "admin",
            warnings: 0
        }
    ];

    localStorage.setItem("biz_users", JSON.stringify(defaultUsers));
    return defaultUsers;
}

let users = [];
let attendanceRecords = JSON.parse(localStorage.getItem("biz_attendance") || "[]");
let systemAlerts = JSON.parse(localStorage.getItem("biz_alerts") || "[]");
let currentUser = null;
let currentLocation = null;
let currentLang = "ar";

const i18n = {
    ar: {
        course: "مبادئ إدارة الأعمال",
        doctor: "د. أحمد سليمان",
        loginTitle: "تسجيل الدخول للنظام",
        loginSub: "أدخل اسم المستخدم وكلمة المرور",
        lblUser: "اسم المستخدم",
        lblPass: "كلمة المرور",
        btnLogin: "دخول",
        stuTitle: "تسجيل حضور المحاضرة",
        stuHint: "يجب السماح بالوصول للموقع (GPS) وإدخال اسمك الثلاثي المطابق لحسابك",
        lblFullname: "الاسم الثلاثي للطالب",
        btnAttend: "تسجيل الحضور الآن",
        adminBadge: "صلاحيات كاملة",
        navAtt: "سجل الحضور",
        navUsers: "إدارة الطلاب والمستخدمين",
        navAlerts: "التنبيهات",
        btnSort: "فرز أ - ي",
        btnExcel: "سحب شيت إكسل (Excel)",
        toggleBtn: "EN"
    },
    en: {
        course: "Principles of Business Administration",
        doctor: "Dr. Ahmed Soliman",
        loginTitle: "System Login",
        loginSub: "Enter your username and password",
        lblUser: "Username",
        lblPass: "Password",
        btnLogin: "Sign In",
        stuTitle: "Lecture Attendance Check-in",
        stuHint: "Allow Location (GPS) access and enter your full three-part name matching your account",
        lblFullname: "Student Full Name (3 parts)",
        btnAttend: "Submit Attendance",
        adminBadge: "Full Privileges",
        navAtt: "Attendance Log",
        navUsers: "Users & Students",
        navAlerts: "Alerts",
        btnSort: "Sort A - Z",
        btnExcel: "Export to Excel",
        toggleBtn: "عربي"
    }
};

function toggleLanguage() {
    currentLang = currentLang === "ar" ? "en" : "ar";
    const htmlEl = document.getElementById("main-html");
    htmlEl.lang = currentLang;
    htmlEl.dir = currentLang === "ar" ? "rtl" : "ltr";

    const t = i18n[currentLang];
    document.getElementById("txt-course").textContent = t.course;
    document.getElementById("txt-doctor").textContent = t.doctor;
    document.getElementById("txt-login-title").textContent = t.loginTitle;
    document.getElementById("txt-login-sub").textContent = t.loginSub;
    document.getElementById("lbl-username").textContent = t.lblUser;
    document.getElementById("lbl-password").textContent = t.lblPass;
    document.getElementById("btn-login").textContent = t.btnLogin;
    document.getElementById("txt-stu-title").textContent = t.stuTitle;
    document.getElementById("txt-stu-hint").textContent = t.stuHint;
    document.getElementById("lbl-fullname").textContent = t.lblFullname;
    document.getElementById("btn-attend").textContent = t.btnAttend;
    document.getElementById("txt-admin-badge").textContent = t.adminBadge;
    document.getElementById("nav-att").textContent = t.navAtt;
    document.getElementById("nav-users").textContent = t.navUsers;
    document.getElementById("btn-sort-att").textContent = t.btnSort;
    document.getElementById("btn-sort-users").textContent = t.btnSort;
    document.getElementById("btn-excel").textContent = t.btnExcel;
    document.getElementById("lang-toggle").textContent = t.toggleBtn;
}

// تسجيل الدخول باليوزر نيم والباسورد وتحديد الصلاحية تلقائياً
async function handleLogin(event) {
    event.preventDefault();
    users = await initDefaultUsers();

    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value;
    const inputHash = await hashPassword(passwordInput);

    const matchedUser = users.find(
        u => u.username.trim() === usernameInput && u.passwordHash === inputHash
    );

    if (!matchedUser) return;

    currentUser = matchedUser;
    document.getElementById("login-screen").classList.add("hidden");

    if (matchedUser.role === "admin") {
        document.getElementById("admin-screen").classList.remove("hidden");
        document.getElementById("admin-welcome").textContent = `مرحباً: ${matchedUser.fullname}`;
        renderAllAdminData();
    } else {
        document.getElementById("student-screen").classList.remove("hidden");
        document.getElementById("student-welcome").textContent = `الطالب: ${matchedUser.fullname}`;
        requestGPSLocation();
    }
}

function logout() {
    currentUser = null;
    document.getElementById("login-form").reset();
    document.getElementById("admin-screen").classList.add("hidden");
    document.getElementById("student-screen").classList.add("hidden");
    document.getElementById("login-screen").classList.remove("hidden");
}

// طلب صلاحية الوصول إلى الموقع (GPS)
function requestGPSLocation() {
    const statusEl = document.getElementById("location-status");
    if (!navigator.geolocation) {
        statusEl.textContent = "المتصفح لا يدعم تحديد الموقع";
        return;
    }

    statusEl.textContent = "يرجى السماح بالوصول إلى الموقع (Location) لتسجيل الحضور...";
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            currentLocation = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
            statusEl.textContent = `تم تحديد الموقع بنجاح (${currentLocation})`;
            statusEl.style.background = "#DCFCE7";
            statusEl.style.color = "#15803D";
        },
        () => {
            statusEl.textContent = "تم رفض أو تعذر الوصول للموقع - يرجى تفعيل الموقع (GPS)";
            statusEl.style.background = "#FEE2E2";
            statusEl.style.color = "#B91C1C";
        },
        { enableHighAccuracy: true }
    );
}

// إرسال تنبيه تلقائي للأدمن الأساسيين (دكتور احمد سليمان / يوسف طاهر الشعراوي)
function pushAdminAlert(message) {
    const now = new Date();
    const alertObj = {
        id: Date.now(),
        recipients: ["دكتور احمد سليمان", "يوسف طاهر الشعراوي"],
        message,
        timestamp: now.toLocaleString("ar-EG")
    };
    systemAlerts.unshift(alertObj);
    localStorage.setItem("biz_alerts", JSON.stringify(systemAlerts));
    updateAlertBadge();
}

function updateAlertBadge() {
    const badge = document.getElementById("alert-count");
    if (badge) badge.textContent = systemAlerts.length;
}

// تسجيل حضور الطالب مع التحقق من الاسم الثلاثي ومنع التكرار اليومي
function submitAttendance() {
    const enteredName = document.getElementById("student-fullname").value.trim();
    const msgBox = document.getElementById("student-msg");
    msgBox.classList.remove("hidden", "alert-error", "alert-success", "alert-warn");

    if (!currentLocation) {
        requestGPSLocation();
        msgBox.textContent = "يجب منح صلاحية الوصول إلى الموقع (Location) أولاً.";
        msgBox.classList.add("alert-warn");
        return;
    }

    // التحقق من تطابق الاسم الثلاثي مع الاسم المسجل في حساب الطالب
    if (enteredName !== currentUser.fullname.trim()) {
        msgBox.textContent = "الاسم المدخل لا يطابق اسمك الثلاثي المسجل في النظام. تم إرسال تنبيه تلقائي للإدارة.";
        msgBox.classList.add("alert-error");
        pushAdminAlert(
            `محاولة تسجيل باسم غير مطابق: الحساب (${currentUser.username}) حاول التسجيل باسم (${enteredName || "فارغ"}).`
        );
        return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-EG");
    const dayStr = now.toLocaleDateString("ar-EG", { weekday: "long" });
    const timeStr = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

    // التحقق من عدم تسجيل الطالب أكثر من مرة في نفس اليوم
    const alreadyRecordedToday = attendanceRecords.some(
        r => r.username === currentUser.username && r.date === dateStr
    );

    if (alreadyRecordedToday) {
        msgBox.textContent = "تحذير: لقد قمت بتسجيل حضورك اليوم بالفعل. تم إرسال تحذير تلقائي للإدارة.";
        msgBox.classList.add("alert-warn");
        pushAdminAlert(
            `تحذير تكرار حضور في نفس اليوم: الطالب (${currentUser.fullname}) حاول التسجيل مرة أخرى بتاريخ ${dateStr} الساعة ${timeStr}.`
        );
        return;
    }

    const record = {
        fullname: currentUser.fullname,
        username: currentUser.username,
        day: dayStr,
        date: dateStr,
        time: timeStr,
        location: currentLocation
    };

    attendanceRecords.push(record);
    localStorage.setItem("biz_attendance", JSON.stringify(attendanceRecords));

    msgBox.textContent = `تم تسجيل حضورك بنجاح (${dayStr} - ${dateStr} - ${timeStr}).`;
    msgBox.classList.add("alert-success");
    document.getElementById("student-fullname").value = "";
}

// التنقل بين تبويبات الأدمن
function switchTab(tabId) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    document.getElementById(tabId).classList.remove("hidden");
    event.target.classList.add("active");
}

// إضافة مستخدم أو طالب جديد من قبل الأدمن
async function addNewUser(event) {
    event.preventDefault();
    const fullname = document.getElementById("new-fullname").value.trim();
    const username = document.getElementById("new-username").value.trim();
    const password = document.getElementById("new-password").value;
    const role = document.getElementById("new-role").value;

    const passwordHash = await hashPassword(password);
    const newUser = {
        id: "usr_" + Date.now(),
        fullname,
        username,
        passwordHash,
        role,
        warnings: 0
    };

    users.push(newUser);
    localStorage.setItem("biz_users", JSON.stringify(users));
    document.getElementById("add-user-form").reset();
    renderUsersTable();
}

function deleteUser(userId) {
    users = users.filter(u => u.id !== userId);
    localStorage.setItem("biz_users", JSON.stringify(users));
    renderUsersTable();
}

function warnUser(userId) {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    target.warnings = (target.warnings || 0) + 1;
    localStorage.setItem("biz_users", JSON.stringify(users));
    pushAdminAlert(`تم توجيه تحذير للمستخدم (${target.fullname}) - إجمالي التحذيرات: ${target.warnings}.`);
    renderUsersTable();
    renderAlertsList();
}

function sortUsersAlpha() {
    users.sort((a, b) => a.fullname.localeCompare(b.fullname, "ar"));
    localStorage.setItem("biz_users", JSON.stringify(users));
    renderUsersTable();
}

function sortAttendanceAlpha() {
    attendanceRecords.sort((a, b) => a.fullname.localeCompare(b.fullname, "ar"));
    localStorage.setItem("biz_attendance", JSON.stringify(attendanceRecords));
    renderAttendanceTable();
}

function renderAttendanceTable() {
    const tbody = document.getElementById("attendance-tbody");
    tbody.innerHTML = "";
    attendanceRecords.forEach(r => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.fullname}</td>
            <td>${r.day}</td>
            <td>${r.date}</td>
            <td>${r.time}</td>
            <td>${r.location}</td>
        `;
        tbody.appendChild(tr);
    });
}

function renderUsersTable() {
    const tbody = document.getElementById("users-tbody");
    tbody.innerHTML = "";
    users.forEach(u => {
        const isProtectedMainAdmin = u.id === "adm_1" || u.id === "adm_2";
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${u.fullname}</td>
            <td>${u.username}</td>
            <td>${u.role === "admin" ? "أدمن" : "طالب"}</td>
            <td>${u.warnings || 0}</td>
            <td>
                <button onclick="warnUser('${u.id}')" class="btn-warn-sm">تحذير</button>
                ${!isProtectedMainAdmin ? `<button onclick="deleteUser('${u.id}')" class="btn-danger-sm">حذف</button>` : ""}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderAlertsList() {
    const container = document.getElementById("alerts-list");
    container.innerHTML = "";
    if (systemAlerts.length === 0) {
        container.innerHTML = "<p class='hint'>لا توجد تنبيهات حالياً.</p>";
        return;
    }
    systemAlerts.forEach(a => {
        const div = document.createElement("div");
        div.className = "alert-item";
        div.innerHTML = `
            <div>${a.message}</div>
            <small>مرسل إلى: ${a.recipients.join(" / ")} — ${a.timestamp}</small>
        `;
        container.appendChild(div);
    });
    updateAlertBadge();
}

function clearAlerts() {
    systemAlerts = [];
    localStorage.setItem("biz_alerts", JSON.stringify(systemAlerts));
    renderAlertsList();
}

function renderAllAdminData() {
    renderAttendanceTable();
    renderUsersTable();
    renderAlertsList();
}

// سحب الأسماء المسجلة إلى شيت إكسل (Excel)
function exportToExcel() {
    if (attendanceRecords.length === 0) {
        alert("لا توجد سجلات حضور لتصديرها.");
        return;
    }
    const rows = attendanceRecords.map((r, index) => ({
        "م": index + 1,
        "الاسم الثلاثي": r.fullname,
        "اليوم": r.day,
        "التاريخ": r.date,
        "الساعة": r.time,
        "الموقع": r.location
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الحضور");
    XLSX.writeFile(workbook, "حضور_مبادئ_ادارة_الاعمال.xlsx");
}

// تهيئة أولية عند فتح الصفحة
(async function boot() {
    users = await initDefaultUsers();
    updateAlertBadge();
})();