// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCJ4VhGD49H3RNifMf9VCRPnkALAxNpsOU",
    authDomain: "project-2980864980936907935.firebaseapp.com",
    databaseURL: "https://project-2980864980936907935-default-rtdb.firebaseio.com",
    projectId: "project-2980864980936907935",
    storageBucket: "project-2980864980936907935.appspot.com",
    messagingSenderId: "580110751353",
    appId: "1:580110751353:web:8f039f9b34e1709d4126a8",
    measurementId: "G-R3JNPHCFZG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

// متغيرات التطبيق
let currentUser = null;
let currentUserType = null;

// عناصر DOM
const screens = {
    roleSelection: document.getElementById('roleSelection'),
    clientLogin: document.getElementById('clientLogin'),
    barberLogin: document.getElementById('barberLogin'),
    clientDashboard: document.getElementById('clientDashboard'),
    barberDashboard: document.getElementById('barberDashboard')
};

// عرض شاشة معينة وإخفاء الباقي
function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        screen.classList.add('hidden');
    });
    screens[screenId].classList.remove('hidden');
}

// عرض نموذج إنشاء حساب للحلاق
function showBarberSignup() {
    document.getElementById('barberFormTitle').textContent = 'إنشاء حساب حلاق جديد';
    document.getElementById('barberLoginForm').classList.add('hidden');
    document.getElementById('barberSignupForm').classList.remove('hidden');
}

// عرض نموذج تسجيل الدخول للحلاق
function showBarberLogin() {
    document.getElementById('barberFormTitle').textContent = 'تسجيل الدخول للحلاقين';
    document.getElementById('barberSignupForm').classList.add('hidden');
    document.getElementById('barberLoginForm').classList.remove('hidden');
}

// تسجيل دخول الزبون
async function clientLogin() {
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const errorElement = document.getElementById('clientError');
    
    if (!name) {
        errorElement.textContent = 'الرجاء إدخال الاسم';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
        errorElement.textContent = 'الرجاء إدخال رقم هاتف صحيح';
        errorElement.classList.remove('hidden');
        return;
    }
    
    // تسجيل الدخول كزبون
    currentUser = {
        id: generateId(),
        name: name,
        phone: phone,
        type: 'client'
    };
    currentUserType = 'client';
    
    // تحديث الصورة الرمزية
    document.getElementById('clientAvatar').textContent = name.charAt(0);
    
    // عرض لوحة التحكم
    showClientDashboard();
    await loadBarbers();
}

// إنشاء حساب جديد للحلاق
async function barberSignup() {
    const name = document.getElementById('barberName').value.trim();
    const phone = document.getElementById('newBarberPhone').value.trim();
    const password = document.getElementById('newBarberPassword').value;
    const confirmPassword = document.getElementById('confirmBarberPassword').value;
    const salonLink = document.getElementById('salonLink').value.trim();
    const imageFile = document.getElementById('barberImage').files[0];
    const errorElement = document.getElementById('barberError');
    
    // التحقق من صحة البيانات
    if (!name || !phone || !password || !confirmPassword) {
        errorElement.textContent = 'جميع الحقول مطلوبة';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (!/^[0-9]{10,15}$/.test(phone)) {
        errorElement.textContent = 'رقم الهاتف يجب أن يكون بين 10-15 رقمًا';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (password.length < 6) {
        errorElement.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
        errorElement.classList.remove('hidden');
        return;
    }
    
    if (password !== confirmPassword) {
        errorElement.textContent = 'كلمتا المرور غير متطابقتين';
        errorElement.classList.remove('hidden');
        return;
    }
    
    try {
        // إنشاء حساب في Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, `${phone}@barber.com`, password);
        const user = userCredential.user;
        
        // تحميل الصورة إذا تم اختيارها
        let imageUrl = '';
        if (imageFile) {
            const fileRef = storageRef(storage, `barber_images/${user.uid}`);
            await uploadBytes(fileRef, imageFile);
            imageUrl = await getDownloadURL(fileRef);
        }
        
        // حفظ بيانات الحلاق في قاعدة البيانات
        const barberData = {
            name: name,
            phone: phone,
            status: 'open',
            queue: {},
            salonLink: salonLink || '',
            imageUrl: imageUrl || ''
        };
        
        await set(ref(database, 'barbers/' + user.uid), barberData);
        
        // تسجيل الدخول تلقائياً بعد إنشاء الحساب
        currentUser = {
            id: user.uid,
            name: name,
            phone: phone,
            type: 'barber',
            imageUrl: imageUrl,
            salonLink: salonLink
        };
        
        document.getElementById('barberAvatar').textContent = name.charAt(0);
        showBarberDashboard();
        loadBarberQueue();
        
    } catch (error) {
        let errorMessage = 'حدث خطأ أثناء إنشاء الحساب';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'هذا الرقم مسجل بالفعل، يرجى تسجيل الدخول';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'رقم الهاتف غير صالح';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'كلمة المرور ضعيفة جداً';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
    }
}

// تسجيل دخول الحلاق
async function barberLogin() {
    const phone = document.getElementById('barberPhone').value.trim();
    const password = document.getElementById('barberPassword').value;
    const errorElement = document.getElementById('barberError');
    
    if (!phone || !password) {
        errorElement.textContent = 'رقم الهاتف وكلمة المرور مطلوبان';
        errorElement.classList.remove('hidden');
        return;
    }
    
    try {
        // تسجيل الدخول باستخدام Firebase Authentication
        const userCredential = await signInWithEmailAndPassword(auth, `${phone}@barber.com`, password);
        const user = userCredential.user;
        
        // جلب بيانات الحلاق من قاعدة البيانات
        const barberRef = ref(database, 'barbers/' + user.uid);
        const snapshot = await get(barberRef);
        
        if (snapshot.exists()) {
            const barberData = snapshot.val();
            
            currentUser = {
                id: user.uid,
                name: barberData.name,
                phone: barberData.phone,
                type: 'barber',
                imageUrl: barberData.imageUrl || '',
                salonLink: barberData.salonLink || ''
            };
            
            document.getElementById('barberAvatar').textContent = barberData.name.charAt(0);
            showBarberDashboard();
            loadBarberQueue();
        } else {
            errorElement.textContent = 'بيانات الحلاق غير موجودة';
            errorElement.classList.remove('hidden');
            await signOut(auth);
        }
        
    } catch (error) {
        let errorMessage = 'بيانات الدخول غير صحيحة';
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'لا يوجد حساب مرتبط بهذا الرقم';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'كلمة المرور غير صحيحة';
        }
        
        errorElement.textContent = errorMessage;
        errorElement.classList.remove('hidden');
    }
}

// عرض لوحة تحكم الزبون
function showClientDashboard() {
    showScreen('clientDashboard');
    
    // تحميل الحجز الحالي إذا كان موجودًا
    if (currentUser && currentUser.booking) {
        showCurrentBooking();
    } else {
        document.getElementById('currentBookingContainer').classList.add('hidden');
    }
}

// عرض لوحة تحكم الحلاق
function showBarberDashboard() {
    showScreen('barberDashboard');
    
    // إعداد تبديل حالة المحل
    const statusToggle = document.getElementById('statusToggle');
    const statusText = document.getElementById('statusText');
    
    // تحميل حالة المحل من Firebase
    onValue(ref(database, 'barbers/' + currentUser.id + '/status'), (snapshot) => {
        const status = snapshot.val() || 'open';
        statusToggle.checked = status === 'open';
        statusText.textContent = status === 'open' ? 'مفتوح' : 'مغلق';
    });
    
    // تحديث حالة المحل عند التغيير
    statusToggle.addEventListener('change', function() {
        const newStatus = this.checked ? 'open' : 'closed';
        update(ref(database, 'barbers/' + currentUser.id), { status: newStatus });
    });
}

// تحميل قائمة الحلاقين
async function loadBarbers() {
    const barbersList = document.getElementById('barbersList');
    barbersList.innerHTML = 'جارٍ التحميل...';
    
    onValue(ref(database, 'barbers'), (snapshot) => {
        const barbers = snapshot.val() || {};
        barbersList.innerHTML = '';
        
        Object.entries(barbers).forEach(([id, barber]) => {
            const barberCard = document.createElement('div');
            barberCard.className = 'barber-card';
            
            const statusClass = barber.status === 'open' ? 'status-open' : 'status-closed';
            const statusText = barber.status === 'open' ? 'مفتوح' : 'مغلق';
            const queueLength = barber.queue ? Object.keys(barber.queue).length : 0;
            
            barberCard.innerHTML = `
                <div class="barber-info">
                    <div class="barber-header">
                        ${barber.imageUrl ? 
                            `<img src="${barber.imageUrl}" class="barber-avatar-img" alt="${barber.name}">` : 
                            `<div class="barber-avatar">${barber.name.charAt(0)}</div>`}
                        <div class="barber-name">${barber.name}</div>
                    </div>
                    ${barber.salonLink ? `<a href="${barber.salonLink}" target="_blank" class="salon-link">زيارة الصالون</a>` : ''}
                    <div class="barber-status ${statusClass}">${statusText}</div>
                    <div class="barber-details">
                        <div>رقم الهاتف: ${barber.phone || 'غير متوفر'}</div>
                        <div>عدد المنتظرين: ${queueLength}</div>
                        <div>وقت الانتظار التقريبي: ${queueLength * 15} دقيقة</div>
                    </div>
                </div>
                <button class="book-btn" ${barber.status === 'closed' ? 'disabled' : ''}" 
                        onclick="bookAppointment('${id}', '${barber.name.replace(/'/g, "\\'")}')">
                    ${barber.status === 'open' ? 'احجز الآن' : 'غير متاح'}
                </button>
            `;
            
            barbersList.appendChild(barberCard);
        });
    });
}

// حجز موعد مع حلاق
async function bookAppointment(barberId, barberName) {
    if (!currentUser) return;
    
    try {
        const newBookingRef = push(ref(database, `barbers/${barberId}/queue`));
        await set(newBookingRef, {
            clientId: currentUser.id,
            clientName: currentUser.name,
            clientPhone: currentUser.phone,
            timestamp: Date.now()
        });
        
        // حفظ معلومات الحجز لدى الزبون
        currentUser.booking = {
            barberId: barberId,
            barberName: barberName,
            bookingId: newBookingRef.key,
            timestamp: new Date().toLocaleString()
        };
        
        // عرض الحجز الحالي
        showCurrentBooking();
        
        // عرض رسالة نجاح
        alert(`تم الحجز بنجاح مع الحلاق ${barberName}`);
    } catch (error) {
        alert('حدث خطأ أثناء الحجز: ' + error.message);
    }
}

// عرض الحجز الحالي للزبون
function showCurrentBooking() {
    if (!currentUser || !currentUser.booking) return;
    
    const bookingContainer = document.getElementById('currentBookingContainer');
    const barberId = currentUser.booking.barberId;
    const bookingId = currentUser.booking.bookingId;
    
    // عرض معلومات الحجز
    document.getElementById('bookingBarber').textContent = currentUser.booking.barberName;
    document.getElementById('bookingTime').textContent = currentUser.booking.timestamp;
    
    // تحديث موقع الزبون في الطابور
    onValue(ref(database, `barbers/${barberId}/queue`), (snapshot) => {
        const queue = snapshot.val() || {};
        let position = 0;
        
        Object.keys(queue).forEach((key, index) => {
            if (key === bookingId) {
                position = index + 1;
            }
        });
        
        document.getElementById('bookingPosition').textContent = position;
    });
    
    // إعداد زر إلغاء الحجز
    document.getElementById('cancelBookingBtn').onclick = () => {
        cancelBooking(barberId, bookingId);
    };
    
    bookingContainer.classList.remove('hidden');
}

// إلغاء الحجز
async function cancelBooking(barberId, bookingId) {
    if (!confirm('هل أنت متأكد من إلغاء الحجز؟')) return;
    
    try {
        await remove(ref(database, `barbers/${barberId}/queue/${bookingId}`));
        
        // حذف معلومات الحجز من الزبون
        delete currentUser.booking;
        document.getElementById('currentBookingContainer').classList.add('hidden');
        alert('تم إلغاء الحجز بنجاح');
    } catch (error) {
        alert('حدث خطأ أثناء إلغاء الحجز: ' + error.message);
    }
}

// تحميل قائمة الانتظار للحلاق
async function loadBarberQueue() {
    if (!currentUser || currentUser.type !== 'barber') return;
    
    const barberQueue = document.getElementById('barberQueue');
    const barberId = currentUser.id;
    
    onValue(ref(database, `barbers/${barberId}/queue`), (snapshot) => {
        const queue = snapshot.val() || {};
        barberQueue.innerHTML = '';
        
        if (Object.keys(queue).length === 0) {
            barberQueue.innerHTML = '<li>لا يوجد عملاء في قائمة الانتظار</li>';
            return;
        }
        
        Object.entries(queue).forEach(([bookingId, booking], index) => {
            const queueItem = document.createElement('li');
            queueItem.className = 'queue-item';
            
            queueItem.innerHTML = `
                <div class="queue-info">
                    <div class="queue-position">الرقم ${index + 1}</div>
                    <div class="queue-name">${booking.clientName}</div>
                    <div class="queue-phone">${booking.clientPhone || 'غير متوفر'}</div>
                    <div class="queue-time">${new Date(booking.timestamp).toLocaleString()}</div>
                </div>
                ${index === 0 ? `<button class="delete-btn" onclick="completeClient('${barberId}', '${bookingId}')"><i class="fas fa-check"></i
