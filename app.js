// --- VERİLER VE TEMEL AYARLAR ---
const defaultDistricts = [
    "Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike",
    "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı",
    "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik", "Büyükşehir"
];

const defaultFish = [
    { name: "Palamut", price: 100 }, { name: "Sardalye", price: 150 }, { name: "Hamsi", price: 200 },
    { name: "İstavrit", price: 200 }, { name: "Gubbes", price: 200 }, { name: "Gümüş", price: 200 },
    { name: "Çıtır Pasa Barbun", price: 985 }, { name: "Karpuzcuk Beyaz Mercan", price: 985 },
    { name: "Mercan", price: 400 }, { name: "Cupra", price: 500 }, { name: "Levrek", price: 600 },
    { name: "Kaya Levregi Granyöz", price: 600 }, { name: "Kolyoz", price: 250 },
    { name: "İri paşa Barbun", price: 2000 }, { name: "Lokum", price: 500 }, { name: "Kefal", price: 285 },
    { name: "Mırmır", price: 650 }, { name: "Jumbo Karides", price: 1000 }, { name: "Çim Çim Karides", price: 1500 },
    { name: "Akya Kuzu", price: 750 }, { name: "Grida (Lagos)", price: 2000 }
];

let fishData = JSON.parse(localStorage.getItem('fishData')) || defaultFish;
let orderData = JSON.parse(localStorage.getItem('orderData')) || [];
let myChart = null;
let currentCalDate = new Date();

// Eski verileri yeni "status" yapısına geçir (Migration)
orderData.forEach(o => {
    if (o.status === undefined) {
        o.status = o.isDelivered ? 1 : 0;
        delete o.isDelivered;
    }
});

function saveData() {
    localStorage.setItem('fishData', JSON.stringify(fishData));
    localStorage.setItem('orderData', JSON.stringify(orderData));
}

// Toast (SweetAlert) Ayarı
const Toast = Swal.mixin({
    toast: true, position: 'top-end', showConfirmButton: false, timer: 2000, timerProgressBar: true
});

// --- YÜKLENME OLAYLARI ---
document.addEventListener('DOMContentLoaded', () => {
    if(!localStorage.getItem('fishData')) saveData();

    populateSelects();
    setupDateLogic();
    renderFishSettings();
    renderCalendar();

    // Uygulama ilk açıldığında seçili olan tarihi (Bugün veya Cumartesi) filtrelere bas
    const todayStr = document.getElementById('o_date').value;
    document.getElementById('filter_date').value = todayStr;
    document.getElementById('r_date').value = todayStr;
    document.getElementById('r_month').value = todayStr.substring(0,7);

    applyListFilters();
});

// --- YARDIMCI FONKSİYONLAR ---
function isPastDate(dateString) {
    const selectedDate = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Bugünün tarihine izin ver
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

// --- SEKME (TAB) YÖNETİMİ ---
function switchTab(tabId, el) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${tabId}`).classList.add('active');
    el.classList.add('active');

    if(tabId === 'list') { renderCalendar(); applyListFilters(); }
    if(tabId === 'report') generateReport();
}

// --- TARİH VE SELECT DOLDURMA ---
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
    document.getElementById('r_district').innerHTML = filterDistrictHTML;
    document.getElementById('filter_district').innerHTML = filterDistrictHTML;

    updateFishSelect();
}

function updateFishSelect() {
    const fishHTML = fishData.map(f => `<option value="${f.name}" data-price="${f.price}">${f.name} - ${f.price} ₺</option>`).join('');
    document.getElementById('o_fish').innerHTML = fishHTML;
    document.getElementById('e_fish').innerHTML = fishHTML;
}

// --- AKILLI MÜŞTERİ ARAMA (AUTOCOMPLETE) ---
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
    if (!document.getElementById('customer-wrapper').contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

// --- TAKVİM MANTIĞI ---
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
    for (let i = 0; i < emptyDays; i++) {
        html += `<div></div>`;
    }

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
    renderCalendar();
    applyListFilters();
}

function onDateFilterChange() {
    document.getElementById('filter_week').value = "";
    renderCalendar(); applyListFilters();
}

function onWeekFilterChange() {
    document.getElementById('filter_date').value = "";
    renderCalendar(); applyListFilters();
}

// --- YENİ KAYIT ---
document.getElementById('orderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const dateVal = document.getElementById('o_date').value;

    if(isPastDate(dateVal)) {
        Swal.fire('Hata', 'Geçmiş bir tarihe yeni sipariş ekleyemezsiniz!', 'error');
        return;
    }

    const fishOpt = document.getElementById('o_fish').options[document.getElementById('o_fish').selectedIndex];
    const kg = parseFloat(document.getElementById('o_kg').value);
    const fishPrice = parseFloat(fishOpt.getAttribute('data-price'));

    orderData.push({
        id: Date.now(),
        date: dateVal,
        customer: document.getElementById('o_customer').value,
        phone: document.getElementById('o_phone').value,
        district: document.getElementById('o_district').value,
        fishName: fishOpt.value,
        kg: kg,
        unitPrice: fishPrice,
        totalPrice: kg * fishPrice,
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

    renderOrdersHTML(filtered);
    updateChart(filtered);
}

function renderOrdersHTML(filteredOrders) {
    const container = document.getElementById('ordersContainer');
    if(filteredOrders.length === 0) {
        container.innerHTML = `<div class="alert alert-info">Kriterlere uygun sipariş yok.</div>`;
        return;
    }

    container.innerHTML = filteredOrders.map(o => {
        let borderClass = o.status === 1 ? "status-1" : o.status === 2 ? "status-2" : "";
        return `
        <div class="card card-order p-3 mb-2 shadow-sm ${borderClass}">
            <div class="d-flex justify-content-between align-items-start">
                <div style="flex-grow:1; padding-right:10px;">
                    <h6 class="mb-1">${o.customer} <small class="text-muted">(${o.district})</small></h6>
                    <a href="tel:${o.phone}" class="text-decoration-none d-block mb-1"><i class="bi bi-telephone-fill"></i> ${o.phone}</a>
                    <span class="badge bg-secondary">${o.fishName} x ${o.kg} KG</span>
                    <span class="badge bg-primary">${o.totalPrice} ₺</span>
                    ${o.note ? `<div class="text-muted small mt-1"><i class="bi bi-info-circle"></i> ${o.note}</div>` : ''}
                    ${o.status === 2 && o.cancelNote ? `<div class="text-danger small mt-1 fw-bold"><i class="bi bi-x-circle"></i> Neden: ${o.cancelNote}</div>` : ''}
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

// --- GRAFİK VE LİSTE ÖZETİ GÜNCELLEME (YENİLENEN BÖLÜM) ---
function updateChart(data) {
    const grouped = {};

    // Verileri hesapla (Toplam, Teslim Edilen, Kalan)
    data.forEach(o => {
        if(!grouped[o.fishName]) {
            grouped[o.fishName] = { total: 0, del: 0, remain: 0 };
        }
        grouped[o.fishName].total += o.kg;
        if(o.status === 1) grouped[o.fishName].del += o.kg;
        else if(o.status === 0) grouped[o.fishName].remain += o.kg;
        // İptal (2) olanlar toplama girer ama teslim/kalan hanesine yazılmaz.
    });

    // --- LİSTE SAYFASI ÖZET KARTLARI (YENİ) ---
    const summaryContainer = document.getElementById('listSummaryContainer');
    if(Object.keys(grouped).length === 0) {
        summaryContainer.innerHTML = '<span class="text-muted small">Kayıtlı veri yok</span>';
    } else {
        summaryContainer.innerHTML = Object.entries(grouped).map(([fish, stats]) => `
            <div class="card shadow-sm border-0 border-start border-4 border-primary" style="width: 140px;">
                <div class="card-body p-2 text-center">
                    <strong class="d-block text-truncate mb-1" style="font-size: 13px;">${fish}</strong>
                    <div class="d-flex justify-content-between text-muted" style="font-size: 11px;">
                        <span title="Toplam Sipariş">Top: <b class="text-dark">${stats.total}</b></span>
                        <span title="Teslim Edilen">Tes: <b class="text-success">${stats.del}</b></span>
                        <span title="Bekleyen">Kal: <b class="text-warning">${stats.remain}</b></span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // --- CHART.JS GÜNCELLEMESİ (YIĞINLI GRAFİK - STACKED) ---
    const labels = Object.keys(grouped);
    const delData = labels.map(f => grouped[f].del);
    const remainData = labels.map(f => grouped[f].remain);

    if(myChart) myChart.destroy();

    const ctx = document.getElementById('fishChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Teslim Edilen',
                    data: delData,
                    backgroundColor: 'rgba(25, 135, 84, 0.8)', // Yeşil
                    borderColor: 'rgba(25, 135, 84, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Bekleyen (Kalan)',
                    data: remainData,
                    backgroundColor: 'rgba(255, 193, 7, 0.8)', // Sarı
                    borderColor: 'rgba(255, 193, 7, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true }, // Yığınlı yapı X ekseni
                y: { stacked: true, beginAtZero: true } // Yığınlı yapı Y ekseni
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            }
        }
    });
}

// --- DÜZENLEME (EDIT MODAL) ---
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
    document.getElementById('e_kg').value = order.kg;
    document.getElementById('e_note').value = order.note;

    if(!editModalInstance) {
        editModalInstance = new bootstrap.Modal(document.getElementById('editModal'));
    }
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

    const fishOpt = document.getElementById('e_fish').options[document.getElementById('e_fish').selectedIndex];
    const kg = parseFloat(document.getElementById('e_kg').value);

    order.date = newDate;
    order.customer = document.getElementById('e_customer').value;
    order.phone = document.getElementById('e_phone').value;
    order.district = document.getElementById('e_district').value;
    order.fishName = fishOpt.value;
    order.kg = kg;
    order.unitPrice = parseFloat(fishOpt.getAttribute('data-price'));
    order.totalPrice = order.kg * order.unitPrice;
    order.note = document.getElementById('e_note').value;

    saveData();
    editModalInstance.hide();
    Toast.fire({ icon: 'success', title: 'Sipariş Güncellendi' });

    renderCalendar();
    applyListFilters();
});

// --- SİPARİŞ DURUM & SİLME ---
function changeOrderStatus(id, selectEl) {
    const val = parseInt(selectEl.value);
    const order = orderData.find(o => o.id === id);
    if(val === 2) {
        Swal.fire({
            title: 'Neden İptal Edildi?',
            input: 'text',
            showCancelButton: true,
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

// --- RAPORLAMA EKRANI ---
function toggleDateFilter() {
    const type = document.getElementById('r_date_type').value;
    document.getElementById('r_date').style.display = type === 'date' ? 'block' : 'none';
    document.getElementById('r_month').style.display = type === 'month' ? 'block' : 'none';
}

function generateReport() {
    const dateType = document.getElementById('r_date_type').value;
    const rDate = document.getElementById('r_date').value;
    const rMonth = document.getElementById('r_month').value;
    const rDistrict = document.getElementById('r_district').value;
    const container = document.getElementById('reportContainer');

    let filtered = orderData;

    if(dateType === 'date' && rDate) {
        filtered = filtered.filter(o => o.date === rDate);
    } else if(dateType === 'month' && rMonth) {
        filtered = filtered.filter(o => o.date.startsWith(rMonth));
    }

    if(rDistrict !== 'ALL') {
        filtered = filtered.filter(o => o.district === rDistrict);
    }

    if(filtered.length === 0) {
        container.innerHTML = `<div class="alert alert-warning">Seçili kriterlere uygun veri bulunamadı.</div>`;
        return;
    }

    const reportData = {};

    filtered.forEach(o => {
        if(!reportData[o.fishName]) {
            reportData[o.fishName] = { req: 0, del: 0, cancel: 0, remain: 0 };
        }
        reportData[o.fishName].req += o.kg;

        if(o.status === 1) reportData[o.fishName].del += o.kg;
        else if(o.status === 2) reportData[o.fishName].cancel += o.kg;
        else reportData[o.fishName].remain += o.kg;
    });

    let html = `<table class="table table-bordered table-sm mt-3" style="font-size: 13px;">
        <thead class="table-dark">
            <tr>
                <th>Tür</th>
                <th>Tlp</th>
                <th>Teslim</th>
                <th>Kalan</th>
                <th>İptal</th>
            </tr>
        </thead>
        <tbody>`;

    for (const [fish, data] of Object.entries(reportData)) {
        html += `<tr>
            <td><strong>${fish}</strong></td>
            <td class="text-primary fw-bold">${data.req}</td>
            <td class="text-success fw-bold">${data.del}</td>
            <td class="text-warning fw-bold">${data.remain}</td>
            <td class="text-danger fw-bold">${data.cancel}</td>
        </tr>`;
    }
    html += `</tbody></table>`;

    const totalReqKg = Object.values(reportData).reduce((sum, item) => sum + item.req, 0);
    const totalDelKg = Object.values(reportData).reduce((sum, item) => sum + item.del, 0);

    html = `
    <div class="row text-center mb-3">
        <div class="col-6 mb-2">
            <div class="card bg-primary text-white p-2 shadow-sm">
                <h6 class="mb-1">Talep Edilen</h6>
                <h4 class="m-0">${totalReqKg} KG</h4>
            </div>
        </div>
        <div class="col-6 mb-2">
            <div class="card bg-success text-white p-2 shadow-sm">
                <h6 class="mb-1">Teslim Edilen</h6>
                <h4 class="m-0">${totalDelKg} KG</h4>
            </div>
        </div>
    </div>
    ` + html;

    container.innerHTML = html;
}

// --- AYARLAR (BALIK EKLME / DÜZENLEME) ---
document.getElementById('fishForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('f_name').value;
    const price = document.getElementById('f_price').value;

    const existing = fishData.find(f => f.name.toLowerCase() === name.toLowerCase());
    if(existing) {
        existing.price = parseFloat(price);
        Toast.fire({ icon: 'success', title: 'Fiyat Güncellendi' });
    } else {
        fishData.push({ name, price: parseFloat(price) });
        Toast.fire({ icon: 'success', title: 'Yeni Balık Eklendi' });
    }

    saveData();
    renderFishSettings();
    updateFishSelect();
    e.target.reset();
});

function editFish(name) {
    const fish = fishData.find(f => f.name === name);
    if(fish) {
        document.getElementById('f_name').value = fish.name;
        document.getElementById('f_price').value = fish.price;
        document.getElementById('f_price').focus();
    }
}

function renderFishSettings() {
    const container = document.getElementById('fishListContainer');
    container.innerHTML = fishData.map((f, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center">
            <span><strong>${f.name}</strong> <span class="badge bg-secondary ms-2">${f.price} ₺</span></span>
            <div>
                <button class="btn btn-sm btn-info text-white me-1" onclick="editFish('${f.name}')"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteFish(${index})"><i class="bi bi-trash"></i></button>
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

// --- İÇE AKTAR / DIŞA AKTAR / SIFIRLA ---
function exportData() {
    const data = { fishData, orderData };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
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
        preConfirm: (val) => {
            if (val !== 'SİL') { Swal.showValidationMessage('Onaylamak için SİL yazmalısınız'); }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.clear(); location.reload();
        }
    });
}

// --- PWA SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
