import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// === 1. CẤU HÌNH FIREBASE (Chỉ dùng Firestore) ===
const firebaseConfig = {
  // DÁN MÃ FIREBASE CONFIG CỦA BẠN VÀO ĐÂY
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

// === 2. CẤU HÌNH IMGBB (Máy chủ lưu ảnh miễn phí) ===
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

// === 5. GỬI GHI CHÚ VÀ ẢNH ===
noteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = noteContentInput.value.trim();
    const imageFile = noteImageInput.files[0];

    // LẤY MÀU ĐANG CHỌN (Dòng mới thêm)
    const selectedColor = document.querySelector('input[name="note-color"]:checked').value;

    if (!content && !imageFile) {
        alert("Vui lòng nhập nội dung hoặc chọn ảnh.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang gửi...";

    try {
        let imageUrl = null;

        // Tải ảnh lên ImgBB (giữ nguyên đoạn này)
        if (imageFile) {
            const formData = new FormData();
            formData.append("image", imageFile);
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: "POST",
                body: formData
            });
            const imgbbData = await imgbbResponse.json();
            if (imgbbData.success) {
                imageUrl = imgbbData.data.url;
            }
        }

        // LƯU VÀO FIREBASE (Đã thêm trường color)
        await addDoc(collection(db, "notes"), {
            content: content,
            imageUrl: imageUrl,
            sender: CURRENT_USER,
            timestamp: serverTimestamp(),
            color: selectedColor // <--- Lưu màu vào đây
        });

        noteForm.reset();
        fileNameDisplay.textContent = "";

    } catch (error) {
        console.error("Lỗi:", error);
        alert("Có lỗi xảy ra khi gửi.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Gửi Ghi Chú";
    }
});

// === 6. ĐỌC VÀ XÓA DỮ LIỆU REAL-TIME ===
// Hàm vẽ (render) một tờ giấy nhớ lên màn hình
function renderNote(docSnapshot) {
    function renderNote(docSnapshot) {
    const data = docSnapshot.data();
    const noteId = docSnapshot.id;

    const noteDiv = document.createElement('div');
    noteDiv.className = 'note';
    
    // THÊM DÒNG NÀY:
    noteDiv.style.backgroundColor = data.color || "#fff9c4"; 
    
    // ... các đoạn code vẽ nội dung phía dưới giữ nguyên ...
}
    const data = docSnapshot.data();
    const noteId = docSnapshot.id; // Lấy ID của ghi chú để phục vụ việc xóa

    const noteDiv = document.createElement('div');
    noteDiv.className = 'note';

    // Xử lý thời gian
    let timeString = "...";
    if (data.timestamp) {
        const date = data.timestamp.toDate();
        timeString = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
    }

    // Nút xóa (Chỉ hiện nếu người đang xem chính là người gửi)
    let deleteBtnHtml = '';
    if (data.sender === CURRENT_USER) {
        deleteBtnHtml = `<button class="delete-btn" data-id="${noteId}">Xóa</button>`;
    }

    let noteHtml = `<div class="note-content">${data.content}</div>`;
    if (data.imageUrl) {
        noteHtml += `<img src="${data.imageUrl}" alt="Ảnh ghi chú" class="note-image">`;
    }
    
    noteHtml += `
        <div class="note-meta">
            <div>
                <span class="note-sender">${data.sender}</span>
                ${deleteBtnHtml} 
            </div>
            <span class="note-time">${timeString}</span>
        </div>
    `;

    noteDiv.innerHTML = noteHtml;
    notesContainer.prepend(noteDiv);
}

// Hàm nghe thay đổi từ Firestore
function listenToNotes() {
    const q = query(collection(db, "notes"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snapshot) => {
        notesContainer.innerHTML = "";
        if (snapshot.empty) {
            notesContainer.innerHTML = '<div class="loading">Bảng tin đang trống. Hãy viết điều gì đó!</div>';
            return;
        }
        // Truyền toàn bộ doc (chứa cả ID và dữ liệu) vào hàm render
        snapshot.forEach((doc) => {
            renderNote(doc); 
        });
    });
}

// Lắng nghe sự kiện click để Xóa (Áp dụng kỹ thuật Event Delegation)
notesContainer.addEventListener('click', async (e) => {
    // Nếu phần tử bị click có chứa class 'delete-btn'
    if (e.target.classList.contains('delete-btn')) {
        const noteId = e.target.getAttribute('data-id');
        
        // Hiển thị hộp thoại xác nhận
        if(confirm("Bạn có chắc chắn muốn xóa mẩu giấy nhớ này không?")) {
            try {
                // Gọi lệnh xóa trên Firebase
                await deleteDoc(doc(db, "notes", noteId));
            } catch (error) {
                console.error("Lỗi khi xóa:", error);
                alert("Không thể xóa, vui lòng thử lại.");
            }
        }
    }
});

// Bắt đầu nghe ngay khi trang web tải xong
listenToNotes();
