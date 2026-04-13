import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === 1. CẤU HÌNH FIREBASE ===
const firebaseConfig = {
  apiKey : "AIzaSyCmH8xJhcCAodf_dnoIycvA-cgiAjlePq8" , 
  authDomain : "newcode-cee5d.firebaseapp.com" , 
  projectId : "newcode-cee5d" , 
  storageBucket : "newcode-cee5d.firebasestorage.app" , 
  messagingSenderId : "788317017931" , 
  appId : "1:788317017931:web:aa4de49d2d29a63564bace" , 
  measurementId : "G-9C5XTCCL8Q" 
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 2. CẤU HÌNH IMGBB ===
const IMGBB_API_KEY = "ac4445a7e02ca6c699cfe22c91774617";

// === 3. XỬ LÝ NGƯỜI DÙNG ===
if (!localStorage.getItem('chat_user_name')) {
    const userName = prompt("Nhập tên của bạn để bắt đầu:") || "Người ẩn danh";
    localStorage.setItem('chat_user_name', userName);
}
const CURRENT_USER = localStorage.getItem('chat_user_name');

// === 4. CÁC PHẦN TỬ DOM ===
const notesContainer = document.getElementById('notes-container');
const noteForm = document.getElementById('note-form');
const noteContentInput = document.getElementById('note-content');
const noteImageInput = document.getElementById('note-image');
const fileNameDisplay = document.getElementById('file-name-display');
const submitBtn = document.getElementById('submit-btn');

noteImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    fileNameDisplay.textContent = file ? file.name : "";
});

// === 5. GỬI GHI CHÚ (Tích hợp Firebase + Ảnh + Nhạc) ===
noteForm.addEventListener('submit', async function(e) {
    e.preventDefault(); 

    const text = noteContentInput.value.trim();
    const file = noteImageInput.files[0];
    const musicInput = document.getElementById('music-link-input');
    const musicLink = musicInput ? musicInput.value.trim() : '';

    // Lấy màu nền được chọn (Giả sử bạn dùng radio button có name="color")
    let selectedColor = "#e6ffcc"; // Màu mặc định
    const colorOption = document.querySelector('input[name="color"]:checked');
    if (colorOption) selectedColor = colorOption.value;

    if (!text && !file && !musicLink) {
        alert("Viết gì đó hoặc chèn ảnh/nhạc cho Bống đi chứ!");
        return;
    }

    // Hiệu ứng "Đang gửi"
    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Đang gửi...";
    submitBtn.disabled = true;

    try {
        let imageUrl = null;

        // Xử lý upload ảnh qua ImgBB
        if (file) {
            const formData = new FormData();
            formData.append("image", file);
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                imageUrl = data.data.url;
            } else {
                alert("Lỗi tải ảnh, vui lòng thử lại!");
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
                return;
            }
        }

        // Đẩy toàn bộ dữ liệu lên Firebase
        await addDoc(collection(db, "notes"), {
            content: text,
            imageUrl: imageUrl,
            musicLink: musicLink, // Lưu link nhạc gốc
            sender: CURRENT_USER,
            timestamp: serverTimestamp(),
            likes: 0,
            color: selectedColor
        });

        // Dọn dẹp form sau khi gửi thành công
        noteContentInput.value = '';
        noteImageInput.value = '';
        fileNameDisplay.textContent = '';
        if (musicInput) {
            musicInput.value = '';
            musicInput.classList.add('hidden');
        }

    } catch (error) {
        console.error("Lỗi khi gửi:", error);
        alert("Có lỗi xảy ra khi gửi tin nhắn!");
    } finally {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
    }
});

// === 6. ĐỌC VÀ XÓA DỮ LIỆU REAL-TIME ===
function renderNote(docSnapshot) {
    const data = docSnapshot.data();
    const noteId = docSnapshot.id; 

    const noteDiv = document.createElement('div');
    noteDiv.className = 'note';
    noteDiv.style.backgroundColor = data.color || "#e6ffcc"; 

    let timeString = "...";
    if (data.timestamp) {
        const date = data.timestamp.toDate();
        timeString = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
    }

    let deleteBtnHtml = '';
    if (data.sender === CURRENT_USER) {
        deleteBtnHtml = `<button class="delete-btn" data-id="${noteId}">Xóa</button>`;
    }

    // Lắp ráp HTML
    let noteHtml = '';
    if (data.content) {
        noteHtml += `<div class="note-content">${data.content}</div>`;
    }
    if (data.imageUrl) {
        noteHtml += `<img src="${data.imageUrl}" alt="Ảnh ghi chú" class="note-image">`;
    }
    
    // Nếu có link nhạc, biến nó thành khung Spotify
  if (data.musicLink) {
    noteHtml += createMusicEmbed(data.musicLink);
}
    
    noteHtml += `
        <div class="note-meta">
            <div style="display: flex; align-items: center; gap: 12px;">
                <span class="note-sender">${data.sender}</span>
                <button class="heart-btn" data-id="${noteId}" style="background:none; border:none; cursor:pointer; font-size:1rem; padding:0;">
                    ❤️ <span style="font-weight:bold; color:#ff6b81;">${data.likes || 0}</span>
                </button>
                ${deleteBtnHtml} 
            </div>
            <span class="note-time">${timeString}</span>
        </div>
    `;

    noteDiv.innerHTML = noteHtml;
    notesContainer.prepend(noteDiv);
}

function listenToNotes() {
    const q = query(collection(db, "notes"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        notesContainer.innerHTML = "";
        if (snapshot.empty) {
            notesContainer.innerHTML = '<div class="loading">Bảng tin đang trống. Hãy viết điều gì đó!</div>';
            return;
        }
        snapshot.forEach((doc) => renderNote(doc)); 
    });
}

// Lắng nghe Xóa
notesContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const noteId = e.target.getAttribute('data-id');
        if(confirm("Bạn có chắc chắn muốn xóa mẩu giấy nhớ này không?")) {
            try {
                await deleteDoc(doc(db, "notes", noteId));
            } catch (error) {
                console.error("Lỗi khi xóa:", error);
                alert("Không thể xóa, vui lòng thử lại.");
            }
        }
    }
});

listenToNotes();

// === 7. CÁC TÍNH NĂNG GIAO DIỆN (Nút Mũi Tên, Dark Mode, Thả Tim) ===
const toggleFormBtn = document.getElementById('toggle-form-btn');
const noteFormContainer = document.getElementById('note-form'); 
const arrowIcon = document.getElementById('arrow-icon');

if (toggleFormBtn && noteFormContainer && arrowIcon) {
    toggleFormBtn.addEventListener('click', () => {
        noteFormContainer.classList.toggle('hidden');
        if (noteFormContainer.classList.contains('hidden')) {
            arrowIcon.classList.remove('arrow-down');
            arrowIcon.classList.add('arrow-up');
        } else {
            arrowIcon.classList.remove('arrow-up');
            arrowIcon.classList.add('arrow-down');
        }
    });
}

const changeNameBtn = document.getElementById('change-name-btn');
if (changeNameBtn) {
    changeNameBtn.addEventListener('click', () => {
        if(confirm("Bạn có muốn đổi tên khác không?")) {
            localStorage.removeItem('chat_user_name');
            location.reload(); 
        }
    });
}

const themeToggle = document.getElementById('theme-toggle'); 
const bodyElement = document.body;
if (localStorage.getItem('dark_mode') === 'true') {
    bodyElement.classList.add('dark');
    if(themeToggle) themeToggle.textContent = '☀️';
}
if(themeToggle) {
    themeToggle.addEventListener('click', () => {
        bodyElement.classList.toggle('dark');
        const isDark = bodyElement.classList.contains('dark');
        localStorage.setItem('dark_mode', isDark); 
        themeToggle.textContent = isDark ? '☀️' : '🌙';
    });
}

notesContainer.addEventListener('click', async (e) => {
    const heartBtn = e.target.closest('.heart-btn');
    if (heartBtn) {
        const noteId = heartBtn.getAttribute('data-id');
        const noteRef = doc(db, "notes", noteId);
        await updateDoc(noteRef, { likes: increment(1) });

        const floatingHeart = document.createElement('div');
        floatingHeart.textContent = '💖';
        floatingHeart.className = 'floating-heart';
        heartBtn.appendChild(floatingHeart);
        setTimeout(() => floatingHeart.remove(), 800);
    }
});

// === 8. LÍNH GÁC NÚT CHÈN NHẠC VÀ HÀM SPOTIFY ===
document.addEventListener('DOMContentLoaded', function() {
    const musicBtn = document.getElementById('music-toggle-btn');
    const musicInput = document.getElementById('music-link-input');

    if (musicBtn && musicInput) {
        musicBtn.addEventListener('click', function() {
            musicInput.classList.toggle('hidden');
            if (!musicInput.classList.contains('hidden')) {
                musicInput.focus();
            }
        });
    }
});

// === HÀM TẠO KHUNG PHÁT NHẠC THÔNG MINH (HỖ TRỢ SPOTIFY & SOUNDCLOUD) ===
function createMusicEmbed(url) {
    if (!url) return ''; 

    // 1. NẾU LÀ LINK SPOTIFY
    if (url.includes('spotify.com')) {
        const embedUrl = url.split('?')[0].replace('track/', 'embed/track/');
        return `
            <iframe class="note-spotify-player" 
                    src="${embedUrl}?utm_source=generator&theme=0" 
                    frameBorder="0" 
                    allowfullscreen="" 
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                    loading="lazy"
                    style="border-radius: 12px; width: 100%; height: 80px; margin-top: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            </iframe>
        `;
    }

    // 2. NẾU LÀ LINK SOUNDCLOUD
    if (url.includes('soundcloud.com')) {
        // Biến link gốc thành định dạng an toàn cho web
        const encodedUrl = encodeURIComponent(url);
        // Mã màu %23ff6b81 chính là màu hồng pastel của giao diện web bạn
        return `
            <iframe class="note-soundcloud-player" 
                    src="https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23ff6b81&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false" 
                    frameBorder="0" 
                    allow="autoplay"
                    style="border-radius: 12px; width: 100%; height: 166px; margin-top: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            </iframe>
        `;
    }

    // Nếu dán link linh tinh (không phải nhạc) thì bỏ qua
    return '';
}
