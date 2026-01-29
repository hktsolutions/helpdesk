const WEBHOOK_URL = 'https://zhubliberal.cloud/webhook/ticket';

const ui = {
  loading: document.getElementById('loading'),
  welcome: document.getElementById('welcome'),
  error: document.getElementById('error'),
  success: document.getElementById('success'),
  content: document.getElementById('contentLayout'),
  errorText: document.getElementById('errorText'),
  displayId: document.getElementById('displayId'),
  infoList: document.getElementById('infoList'),
  stars: document.querySelectorAll('.star'),
  starContainer: document.getElementById('starContainer'),
  ratingText: document.getElementById('ratingText'),
  submitBtn: document.getElementById('submitBtn'),
  comment: document.getElementById('comment'),
  card: document.getElementById('appCard')
};

const labels = ["Rất không hài lòng", "Không hài lòng", "Bình thường", "Hài lòng", "Rất hài lòng"];

// Bảng dịch trạng thái
const statusMapping = {
  'Wait_Confirm': 'Chờ xác nhận',
  'Open': 'Mở sự vụ',
  'In_progress': 'Đang xử lý',
  'Pending': 'Tạm hoãn',
  'Fix': 'Điều chỉnh',
  'Close': 'Đóng sự vụ',
  'Cancel': 'Hủy bỏ'
};

let currentRating = 0;
let ticketId = null;

function switchState(state) {
  ui.loading.classList.remove('show');
  ui.welcome.classList.remove('show');
  ui.error.classList.remove('show');
  ui.success.classList.remove('show');
  ui.content.style.display = 'none';

  if (state === 'content') {
    ui.content.style.display = 'flex';
  } else if (ui[state]) {
    ui[state].classList.add('show');
  }
}

function renderRow(label, value, isExpandable = false) {
  // Xử lý giá trị rỗng hoặc giá trị lỗi từ backend (Invalid Date...)
  let safeValue = value;
  if (!safeValue || safeValue === 'Invalid Date' || safeValue === 'Invalid DateTime') {
    safeValue = '--';
  }
  
  if (isExpandable) {
    const uniqueId = 'row_' + Math.random().toString(36).substr(2, 9);
    return `
      <div class="info-row" id="${uniqueId}">
        <span class="label">${label}</span>
        <div class="value-container">
          <div class="value-text text-clamped">${safeValue}</div>
          <button class="toggle-btn" title="Xem thêm" onclick="toggleExpand('${uniqueId}')">
              ▼
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="info-row">
      <span class="label">${label}</span>
      <div class="value-container">
        <div class="value-text">${safeValue}</div>
      </div>
    </div>
  `;
}

function checkOverflow() {
  const rows = document.querySelectorAll('.info-row');
  rows.forEach(row => {
    const textEl = row.querySelector('.text-clamped');
    const btn = row.querySelector('.toggle-btn');
    
    if (textEl && btn) {
      if (textEl.scrollHeight > textEl.clientHeight) {
        btn.style.display = 'inline-block';
      } else {
        btn.style.display = 'none';
      }
    }
  });
}

window.toggleExpand = function(rowId) {
  const row = document.getElementById(rowId);
  if (!row) return;
  row.classList.toggle('expanded');
};

async function initApp() {
  const params = new URLSearchParams(window.location.search);
  ticketId = params.get('ticket_id');

  if (!ticketId) {
    ui.card.style.height = 'auto';
    ui.card.style.minHeight = '400px'; 
    switchState('welcome');
    return;
  }

  try {
    switchState('loading');
    
    const res = await fetch(`${WEBHOOK_URL}?action=get_ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket_id: ticketId })
    });

    if (!res.ok) throw new Error(`Lỗi kết nối máy chủ (${res.status})`);

    const raw = await res.json();
    const data = Array.isArray(raw) ? raw[0] : raw;

    if (!data || Object.keys(data).length === 0) throw new Error('Không tìm thấy thông tin Ticket này.');

    ui.displayId.innerText = ticketId;
    
    // Xử lý map trạng thái
    const displayStatus = statusMapping[data.status] || data.status;

    ui.infoList.innerHTML = `
      ${renderRow('Khách hàng', data.name)}
      ${renderRow('Bộ phận/Chức vụ', data.department)}
      ${renderRow('Công ty', data.unit)}
      
      ${renderRow('Yêu cầu', data.request, true)}
      
      ${renderRow('Mở yêu cầu', data.request_time)}
      ${renderRow('Đóng yêu cầu', data.resolve_time)}
      ${renderRow('Nhân viên hỗ trợ', data.staff)}
      ${renderRow('Trạng thái', displayStatus)}
      
      ${renderRow('Nguyên nhân', data.reason, true)}
      ${renderRow('Chú thích kỹ thuật', data.note, true)}
    `;

    const existingRate = parseInt(data.Rate);
    
    if (!isNaN(existingRate) && existingRate > 0) {
      currentRating = existingRate;
      updateStars(currentRating);
      ui.ratingText.innerText = labels[currentRating - 1];
      ui.comment.value = data.Comment || '';
      ui.comment.disabled = true;
      ui.submitBtn.disabled = true;
      ui.submitBtn.classList.add('btn-done');
      ui.submitBtn.innerHTML = '<span>✓ Bạn đã đánh giá phiếu này</span>';
      ui.starContainer.classList.add('disabled');
    } else {
      ui.comment.disabled = false;
      ui.submitBtn.disabled = false;
      ui.starContainer.classList.remove('disabled');
    }

    switchState('content');
    setTimeout(checkOverflow, 100);

  } catch (err) {
    console.error(err);
    ui.errorText.innerText = err.message || 'Lỗi không xác định';
    switchState('error');
  }
}

ui.stars.forEach(star => {
  star.addEventListener('mouseenter', () => {
    if (ui.starContainer.classList.contains('disabled')) return;
    const val = parseInt(star.dataset.val);
    updateStars(val);
    ui.ratingText.innerText = labels[val - 1];
  });
  
  star.addEventListener('mouseleave', () => {
    if (ui.starContainer.classList.contains('disabled')) return;
    updateStars(currentRating);
    ui.ratingText.innerText = currentRating > 0 ? labels[currentRating - 1] : '';
  });
  
  star.addEventListener('click', () => {
    if (ui.starContainer.classList.contains('disabled')) return;
    currentRating = parseInt(star.dataset.val);
    updateStars(currentRating);
    star.style.transform = "scale(0.9)";
    setTimeout(() => star.style.transform = "scale(1.15)", 150);
  });
});

function updateStars(val) {
  ui.stars.forEach(s => {
    const sVal = parseInt(s.dataset.val);
    s.classList.toggle('active', sVal <= val);
    s.style.color = sVal <= val ? 'var(--star-active)' : 'var(--star-idle)';
  });
}

ui.submitBtn.addEventListener('click', async () => {
  if (ui.submitBtn.disabled) return;
  if (currentRating === 0) {
    alert("Vui lòng chọn số sao để đánh giá!");
    return;
  }
  ui.submitBtn.disabled = true;
  const oldBtnContent = ui.submitBtn.innerHTML;
  ui.submitBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;display:inline-block;vertical-align:middle;border-color:#fff;border-top-color:transparent;animation: spin 0.8s linear infinite;border-radius:50%;"></div> Đang gửi...';

  try {
    const res = await fetch(`${WEBHOOK_URL}?action=send_rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: ticketId,
        rating: currentRating,
        comment: ui.comment.value
      })
    });
    if (!res.ok) throw new Error('Gửi thất bại');
    switchState('success');
  } catch (err) {
    alert('Có lỗi xảy ra: ' + err.message);
    ui.submitBtn.disabled = false;
    ui.submitBtn.innerHTML = oldBtnContent;
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(checkOverflow, 200);
});

document.addEventListener('DOMContentLoaded', initApp);