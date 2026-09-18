// --- VERİLER VE TEMEL AYARLAR ---
const defaultDistricts = [
    "Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike",
    "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı",
    "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik", "Büyükşehir"
];

const defaultFish = [
    { name: "Palamut" }, { name: "Sardalye" }, { name: "Hamsi" },
    { name: "İstavrit" }, { name: "Gubbes" }, { name: "Gümüş" },
    { name: "Çıtır Pasa Barbun" }, { name: "Karpuzcuk Beyaz Mercan" },
    { name: "Mercan" }, { name: "Cupra" }, { name: "Levrek" },
    { name: "Kaya Levregi Granyöz" }, { name: "Kolyoz" },
    { name: "İri paşa Barbun" }, { name: "Lokum" }, { name: "Kefal" },
    { name: "Mırmır" }, { name: "Jumbo Karides" }, { name: "Çim Çim Karides" },
    { name: "Akya Kuzu" }, { name: "Grida (Lagos)" }
];

let fishData = JSON.parse(localStorage.getItem('fishData')) || defaultFish;
let orderData = JSON.parse(localStorage.getItem('orderData')) || [];
let currentCalDate = new Date();
let currentlyFilteredOrders = [];

// --- VERİ GÖÇÜ (MIGRATION) ---
fishData = fishData.map(f => typeof f === 'object' ? { name: f.name } : { name: f });

orderData.forEach(o => {
    if (o.status === undefined) { o.status = o.isDelivered ? 1 : 0; delete o.isDelivered; }
    if (o.kg !== undefined) {
        o.amount = Math.round(o.kg); // Varsa eski ondalıkları tam sayıya yuvarlar
        o.unitType = "KG";
        delete o.kg;
    }
});

function saveData() {
    localStorage.setItem('fishData', JSON.stringify(fishData));
    localStorage.setItem('orderData', JSON.stringify(orderData));
}

const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true
});

document.addEventListener('DOMContentLoaded', () => {
    if(!localStorage.getItem('fishData')) saveData();

    populateSelects();
    setupDateLogic();
    renderFishSettings();
    renderCalendar();

    const todayStr = document.getElementById('o_date').value;
    document.getElementById('filter_date').value = todayStr;

    applyListFilters();
});

function isPastDate(dateString) {
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selectedDate < today;
}

function getIsoWeek(dateString) {
    const d = new Date(dateString);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNumber = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    return `${d.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

function switchTab(tabId, el) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    el.classList.add('active');

    if(tabId === 'list') { renderCalendar(); applyListFilters(); }
}

function setupDateLogic() {
    const today = new Date();
    const day = today.getDay();
    let daysToSaturday = (6 - day);
    if(daysToSaturday < 0) daysToSaturday = 6;

    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + daysToSaturday);
    document.getElementById('o_date').value = nextSaturday.toISOString().split('T')[0];
}

function populateSelects() {
    const districtHTML = defaultDistricts.map(d => `<option value="${d}">${d}</option>`).join('');
    document.getElementById('o_district').innerHTML = districtHTML;
    document.getElementById('e_district').innerHTML = districtHTML;

    const filterDistrictHTML = `<option value="ALL">Tüm İlçeler</option>` + districtHTML;
    document.getElementById('filter_district').innerHTML = filterDistrictHTML;

    updateFishSelect();
}

function updateFishSelect() {
    const fishHTML = fishData.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
    document.getElementById('o_fish').innerHTML = fishHTML;
    document.getElementById('e_fish').innerHTML = fishHTML;
}

// --- AKILLI ARAMA ---
const customerInput = document.getElementById('o_customer');
const suggestionsBox = document.getElementById('customerSuggestions');

function getUniqueCustomers() {
    const uniqueMap = new Map();
    orderData.forEach(o => {
        uniqueMap.set(o.customer.toLowerCase(), { name: o.customer, phone: o.phone, district: o.district });
    });
    return Array.from(uniqueMap.values());
}

customerInput.addEventListener('input', function() {
    const val = this.value.toLowerCase().trim();
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }

    const customers = getUniqueCustomers();
    const matches = customers.filter(c => c.name.toLowerCase().includes(val));

    if (matches.length > 0) {
        matches.forEach(match => {
            const div = document.createElement('div');
            div.innerHTML = `<strong>${match.name}</strong> <small class="text-muted">(${match.district})</small>`;
            div.onclick = function() {
                customerInput.value = match.name;
                document.getElementById('o_phone').value = match.phone || '';
                document.getElementById('o_district').value = match.district;
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});
document.addEventListener('click', function(e) {
    if (!document.getElementById('customer-wrapper').contains(e.target)) { suggestionsBox.style.display = 'none'; }
});

// --- TAKVİM ---
function changeCalMonth(dir) {
    currentCalDate.setMonth(currentCalDate.getMonth() + dir);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calDaysGrid');
    const monthText = document.getElementById('calMonthYearText');
    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();
    const monthsTR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    monthText.innerText = `${monthsTR[month]} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let html = `<div class="cal-day-name">Pzt</div><div class="cal-day-name">Sal</div><div class="cal-day-name">Çar</div>
                <div class="cal-day-name">Per</div><div class="cal-day-name">Cum</div><div class="cal-day-name">Cmt</div><div class="cal-day-name">Paz</div>`;

    let emptyDays = (firstDay === 0) ? 6 : firstDay - 1;
    for (let i = 0; i < emptyDays; i++) html += `<div></div>`;

    const datesWithOrders = new Set(orderData.map(o => o.date));
    const activeFilterDate = document.getElementById('filter_date').value;

    for (let i = 1; i <= daysInMonth; i++) {
        let dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        let hasOrder = datesWithOrders.has(dateStr) ? 'has-order' : '';
        let isActive = (dateStr === activeFilterDate) ? 'active-day' : '';
        html += `<div class="cal-day ${hasOrder} ${isActive}" onclick="selectDateFromCalendar('${dateStr}')">${i}</div>`;
    }
    grid.innerHTML = html;
}

function selectDateFromCalendar(dateStr) {
    document.getElementById('filter_date').value = dateStr;
    document.getElementById('filter_week').value = "";
    renderCalendar(); applyListFilters();
}

function onDateFilterChange() {
    document.getElementById('filter_week').value = "";
    renderCalendar(); applyListFilters();
}

function onWeekFilterChange() {
    document.getElementById('filter_date').value = "";
    renderCalendar(); applyListFilters();
}

// --- YENİ KAYIT EKLENMESİ ---
document.getElementById('orderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('o_date').value;

    if(isPastDate(dateVal)) {
        Swal.fire('Hata', 'Geçmiş bir tarihe yeni sipariş ekleyemezsiniz!', 'error');
        return;
    }

    const fishOpt = document.getElementById('o_fish').value;
    const unitType = document.getElementById('o_unit').value;
    // Tam sayı (Integer) parse ediliyor
    const amount = parseInt(document.getElementById('o_amount').value, 10);
    const customPrice = parseFloat(document.getElementById('o_price').value);

    orderData.push({
        id: Date.now(),
        date: dateVal,
        customer: document.getElementById('o_customer').value,
        phone: document.getElementById('o_phone').value,
        district: document.getElementById('o_district').value,
        fishName: fishOpt,
        amount: amount,
        unitType: unitType,
        unitPrice: customPrice,
        totalPrice: amount * customPrice,
        note: document.getElementById('o_note').value,
        status: 0, cancelNote: ""
    });

    saveData();
    Toast.fire({ icon: 'success', title: 'Sipariş Kaydedildi' });
    document.getElementById('orderForm').reset();
    setupDateLogic();
});

// --- LİSTELEME VE FİLTRELEME ---
function applyListFilters() {
    const fDistrict = document.getElementById('filter_district').value;
    const fDate = document.getElementById('filter_date').value;
    const fWeek = document.getElementById('filter_week').value;

    let filtered = orderData;

    if(fDistrict !== 'ALL') filtered = filtered.filter(o => o.district === fDistrict);
    if(fDate) filtered = filtered.filter(o => o.date === fDate);
    if(fWeek) filtered = filtered.filter(o => getIsoWeek(o.date) === fWeek);

    currentlyFilteredOrders = filtered;

    renderOrdersHTML(filtered);
    updateListSummaries(filtered);
}

function renderOrdersHTML(filteredOrders) {
    const container = document.getElementById('ordersContainer');
    if(filteredOrders.length === 0) {
        container.innerHTML = `<div class="alert alert-info">Kriterlere uygun sipariş yok.</div>`;
        return;
    }

    container.innerHTML = filteredOrders.map(o => {
        let borderClass = o.status === 1 ? "status-1" : o.status === 2 ? "status-2" : "";
        let priceTag = `${o.unitPrice} ₺/${o.unitType}`;

        return `
        <div class="card card-order p-3 mb-2 shadow-sm ${borderClass}">
            <div class="d-flex justify-content-between align-items-start">
                <div style="flex-grow:1; padding-right:10px;">
                    <h6 class="mb-1">${o.customer} <small class="text-muted">(${o.district})</small></h6>
                    <a href="tel:${o.phone}" class="text-decoration-none d-block mb-1"><i class="bi bi-telephone-fill"></i> ${o.phone}</a>
                    <span class="badge bg-secondary mb-1" style="font-size: 13px;">${o.fishName} x ${o.amount} ${o.unitType} <small class="text-light fw-normal">(${priceTag})</small></span><br>
                    <span class="badge bg-primary fs-6" title="Müşterinin Ödeyeceği Tutar">${o.totalPrice.toLocaleString('tr-TR')} ₺ Ödenecek</span>
                    ${o.note ? `<div class="text-muted small mt-1"><i class="bi bi-info-circle"></i> ${o.note}</div>` : ''}
                    ${o.status === 2 && o.cancelNote ? `<div class="text-danger small mt-1 fw-bold"><i class="bi bi-x-circle"></i> İptal Nedeni: ${o.cancelNote}</div>` : ''}
                </div>
                <div class="text-end" style="min-width: 120px;">
                    <select class="form-select form-select-sm mb-2 fw-bold
                        ${o.status===0 ? 'text-warning' : o.status===1 ? 'text-success' : 'text-danger'}"
                        onchange="changeOrderStatus(${o.id}, this)">
                        <option value="0" ${o.status === 0 ? 'selected' : ''}>Bekliyor</option>
                        <option value="1" ${o.status === 1 ? 'selected' : ''}>Teslim</option>
                        <option value="2" ${o.status === 2 ? 'selected' : ''}>İptal</option>
                    </select>
                    <div class="btn-group w-100">
                        <button class="btn btn-sm btn-outline-info" onclick="openEditModal(${o.id})"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteOrder(${o.id})"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>
        </div>`
    }).join('');
}

// --- TÜR VE BİRİME GÖRE DETAYLI, BÜYÜTÜLMÜŞ ÖZET KARTLARI ---
function updateListSummaries(data) {
    const grouped = {};

    data.forEach(o => {
        if(!grouped[o.fishName]) {
            grouped[o.fishName] = {
                KG: { total: 0, del: 0, remain: 0 },
                Adet: { total: 0, del: 0, remain: 0 }
            };
        }
        let u = o.unitType;
        if(o.status !== 2) grouped[o.fishName][u].total += o.amount;
        if(o.status === 1) grouped[o.fishName][u].del += o.amount;
        if(o.status === 0) grouped[o.fishName][u].remain += o.amount;
    });

    const summaryContainer = document.getElementById('listSummaryContainer');
    if(Object.keys(grouped).length === 0) {
        summaryContainer.innerHTML = '<span class="text-muted small">Kayıtlı veri yok</span>';
    } else {
        summaryContainer.innerHTML = Object.entries(grouped).map(([fish, units]) => {
            if(units.KG.total === 0 && units.Adet.total === 0 && units.KG.remain === 0 && units.Adet.remain === 0) return '';

            // Kart Boyutu ve Yazılar Büyütüldü
            let html = `
            <div class="card shadow-sm border-0 border-start border-4 border-primary m-1" style="width: 100%; max-width: 250px;">
                <div class="card-body p-2 text-center">
                    <strong class="d-block text-truncate mb-2" style="font-size: 16px;" title="${fish}">${fish}</strong>`;

            if(units.KG.total > 0 || units.KG.del > 0 || units.KG.remain > 0) {
                html += `
                <div class="mb-2 p-2 bg-light rounded border">
                    <span class="badge bg-secondary w-100 mb-2" style="font-size: 12px;">KG Olarak</span>
                    <div class="d-flex justify-content-around text-dark" style="font-size: 14px; font-weight: 500;">
                        <span class="d-flex flex-column">Top<b class="fs-5 text-primary">${units.KG.total}</b></span>
                        <span class="d-flex flex-column">Teslim<b class="fs-5 text-success">${units.KG.del}</b></span>
                        <span class="d-flex flex-column">Kalan<b class="fs-5 text-warning">${units.KG.remain}</b></span>
                    </div>
                </div>`;
            }

            if(units.Adet.total > 0 || units.Adet.del > 0 || units.Adet.remain > 0) {
                html += `
                <div class="p-2 bg-light rounded border">
                    <span class="badge bg-secondary w-100 mb-2" style="font-size: 12px;">Adet Olarak</span>
                    <div class="d-flex justify-content-around text-dark" style="font-size: 14px; font-weight: 500;">
                        <span class="d-flex flex-column">Top<b class="fs-5 text-primary">${units.Adet.total}</b></span>
                        <span class="d-flex flex-column">Teslim<b class="fs-5 text-success">${units.Adet.del}</b></span>
                        <span class="d-flex flex-column">Kalan<b class="fs-5 text-warning">${units.Adet.remain}</b></span>
                    </div>
                </div>`;
            }

            html += `</div></div>`;
            return html;
        }).join('');
    }
}

// --- DÜZENLEME MODALI ---
let editModalInstance = null;

function openEditModal(id) {
    const order = orderData.find(o => o.id === id);
    if(!order) return;

    document.getElementById('e_id').value = order.id;
    document.getElementById('e_date').value = order.date;
    document.getElementById('e_customer').value = order.customer;
    document.getElementById('e_phone').value = order.phone;
    document.getElementById('e_district').value = order.district;
    document.getElementById('e_fish').value = order.fishName;
    document.getElementById('e_unit').value = order.unitType;
    document.getElementById('e_amount').value = order.amount;
    document.getElementById('e_price').value = order.unitPrice;
    document.getElementById('e_note').value = order.note;

    if(!editModalInstance) editModalInstance = new bootstrap.Modal(document.getElementById('editModal'));
    editModalInstance.show();
}

document.getElementById('editOrderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('e_id').value);
    const newDate = document.getElementById('e_date').value;
    const order = orderData.find(o => o.id === id);

    if (newDate !== order.date && isPastDate(newDate)) {
        Swal.fire('Hata', 'Teslimat tarihini geçmiş bir tarihe güncelleyemezsiniz!', 'error');
        return;
    }

    const fishOpt = document.getElementById('e_fish').value;
    const unitType = document.getElementById('e_unit').value;
    const amount = parseInt(document.getElementById('e_amount').value, 10);
    const customPrice = parseFloat(document.getElementById('e_price').value);

    order.date = newDate;
    order.customer = document.getElementById('e_customer').value;
    order.phone = document.getElementById('e_phone').value;
    order.district = document.getElementById('e_district').value;
    order.fishName = fishOpt;
    order.unitType = unitType;
    order.amount = amount;
    order.unitPrice = customPrice;
    order.totalPrice = amount * customPrice;
    order.note = document.getElementById('e_note').value;

    saveData();
    editModalInstance.hide();
    Toast.fire({ icon: 'success', title: 'Sipariş Güncellendi' });
    renderCalendar(); applyListFilters();
});

// --- DURUM & SİLME ---
function changeOrderStatus(id, selectEl) {
    const val = parseInt(selectEl.value);
    const order = orderData.find(o => o.id === id);
    if(val === 2) {
        Swal.fire({
            title: 'Neden İptal Edildi?', input: 'text', showCancelButton: true,
            confirmButtonText: 'Kaydet', cancelButtonText: 'Vazgeç'
        }).then((result) => {
            if(result.isConfirmed) {
                order.status = 2; order.cancelNote = result.value || "Belirtilmedi";
                saveData(); applyListFilters();
            } else { selectEl.value = order.status; }
        });
    } else {
        order.status = val; order.cancelNote = "";
        saveData(); applyListFilters();
    }
}

function deleteOrder(id) {
    Swal.fire({
        title: 'Emin misiniz?', icon: 'warning', showCancelButton: true,
        confirmButtonText: 'Evet, Sil!', cancelButtonText: 'İptal'
    }).then((result) => {
        if (result.isConfirmed) {
            orderData = orderData.filter(o => o.id !== id);
            saveData(); applyListFilters(); renderCalendar();
            Toast.fire({ icon: 'error', title: 'Silindi' });
        }
    });
}

// --- PDF İNDİRME ---
function downloadPDF() {
    if(currentlyFilteredOrders.length === 0) {
        Swal.fire('Bilgi', 'PDF olarak indirilecek sipariş bulunamadı.', 'info');
        return;
    }

    const tbody = document.getElementById('pdfTableBody');
    tbody.innerHTML = '';

    let totalPendingMoney = 0;
    let totalDeliveredMoney = 0;
    let totalCanceledMoney = 0;

    currentlyFilteredOrders.forEach(o => {
        let statusText = o.status === 1 ? "Teslim" : o.status === 2 ? "İptal" : "Bekliyor";

        // PDF Altında göstermek için paraları status'e göre topla
        if (o.status === 1) totalDeliveredMoney += o.totalPrice;
        else if (o.status === 2) totalCanceledMoney += o.totalPrice;
        else totalPendingMoney += o.totalPrice;

        let noteTxt = o.note ? `<br><small style="color:gray;">${o.note}</small>` : '';

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px;">${o.customer}</td>
            <td style="padding: 8px;">${o.district}</td>
            <td style="padding: 8px;">${o.phone}</td>
            <td style="padding: 8px;">${o.fishName} ${noteTxt}</td>
            <td style="padding: 8px;">${o.amount} ${o.unitType}</td>
            <td style="padding: 8px;">${o.totalPrice.toLocaleString('tr-TR')} ₺</td>
            <td style="padding: 8px; font-weight:bold;">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });

    let overallMoney = totalPendingMoney + totalDeliveredMoney; // İptaller hariç beklenen ciro

    document.getElementById('pdfSummaryArea').innerHTML = `
        <div style="margin-bottom: 5px;"><span style="color:#666;">Bekleyen Siparişler:</span> <strong>${totalPendingMoney.toLocaleString('tr-TR')} ₺</strong></div>
        <div style="margin-bottom: 5px;"><span style="color:green;">Teslim Edilenler:</span> <strong>${totalDeliveredMoney.toLocaleString('tr-TR')} ₺</strong></div>
        <div style="margin-bottom: 5px;"><span style="color:red;">İptal Edilenler:</span> <strong>${totalCanceledMoney.toLocaleString('tr-TR')} ₺</strong></div>
        <hr style="border-top:1px dashed #ccc; margin: 10px 0;">
        <div style="font-size: 16px;">GENEL TOPLAM CİRO (İptaller Hariç): <strong style="color:blue;">${overallMoney.toLocaleString('tr-TR')} ₺</strong></div>
    `;

    const element = document.getElementById('pdfPrintArea');
    const opt = {
        margin:       10,
        filename:     `Siparis_Listesi_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    element.parentElement.style.display = "block";
    html2pdf().set(opt).from(element).save().then(() => {
        element.parentElement.style.display = "none";
    });
}

// --- AYARLAR (BALIK TÜRÜ YÖNETİMİ) ---
document.getElementById('fishForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('f_name').value.trim();

    const existing = fishData.find(f => f.name.toLowerCase() === name.toLowerCase());
    if(!existing) {
        fishData.push({ name: name });
        Toast.fire({ icon: 'success', title: 'Yeni Balık Eklendi' });
        saveData(); renderFishSettings(); updateFishSelect();
    } else {
        Swal.fire('Bilgi', 'Bu balık türü zaten mevcut!', 'info');
    }
    e.target.reset();
});

function renderFishSettings() {
    const container = document.getElementById('fishListContainer');
    container.innerHTML = fishData.map((f, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <span><strong>${f.name}</strong></span>
            <div>
                <button class="btn btn-sm btn-danger" onclick="deleteFish(${index})"><i class="bi bi-trash"></i> Sil</button>
            </div>
        </li>
    `).join('');
}

function deleteFish(index) {
    Swal.fire({
        title: 'Silmek istiyor musunuz?', icon: 'warning', showCancelButton: true,
        confirmButtonColor: '#d33', confirmButtonText: 'Evet, sil'
    }).then((result) => {
        if (result.isConfirmed) {
            fishData.splice(index, 1);
            saveData(); renderFishSettings(); updateFishSelect();
        }
    });
}

function exportData() {
    const data = { fishData, orderData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `Balik_Takip_Yedek_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(event) {
    const file = event.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if(imported.fishData && imported.orderData) {
                fishData = imported.fishData; orderData = imported.orderData;
                saveData();
                Swal.fire('Başarılı', 'Veriler yüklendi, sayfa yenileniyor.', 'success').then(() => location.reload());
            } else { Swal.fire('Hata', 'Geçersiz dosya formatı!', 'error'); }
        } catch(err) { Swal.fire('Hata', 'Dosya okunurken hata oluştu!', 'error'); }
    };
    reader.readAsText(file);
}

function clearAllData() {
    Swal.fire({
        title: 'Tüm veriler silinecek!', text: "Onaylamak için kutuya SİL yazın", input: 'text',
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Sıfırla', cancelButtonText: 'İptal',
        preConfirm: (val) => { if (val !== 'SİL') { Swal.showValidationMessage('Onaylamak için SİL yazmalısınız'); } }
    }).then((result) => {
        if (result.isConfirmed) { localStorage.clear(); location.reload(); }
    });
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
