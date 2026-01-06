/* === SERVICE WORKER REGISTRATION (OFFLINE SUPPORT) === */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.log('SW Failed:', err));
    });
}

/* === CORE DATA & STATE === */
let db = {
    menu: [
        { id: 1, nama: "Nasi Goreng", harga: 15000, kategori: "makanan", img: "", status: "tersedia", addons: [{name: "Telur", price: 3000}, {name: "Kerupuk", price: 2000}] },
        { id: 2, nama: "Es Teh Manis", harga: 5000, kategori: "minuman", img: "", status: "tersedia", addons: [] },
        { id: 3, nama: "Kentang Goreng", harga: 12000, kategori: "snack", img: "", status: "tersedia", addons: [{name: "Keju", price: 2000}] }
    ],
    cart: [], openBills: [], transaksi: [],
    settings: { logo: null, qris: null, shopName: "Warkop Bu Raden", address: "Indonesia", sheetUrl: "" }
};
let payState = { total: 0, received: 0, change: 0, method: 'cash' };
let currentOrderType = 'Dine In';
let currentFilter = 'all';
let currentView = 'grid';
let isSortAZ = false;
let editId = null;
let salesChart = null; 
let currentChartFilter = '7'; 

// Modal State
let selectedMenuId = null;
let modalQty = 1;

document.addEventListener('DOMContentLoaded', () => {
    if(localStorage.getItem('pos_final_db')) db = JSON.parse(localStorage.getItem('pos_final_db'));
    db.menu.forEach(m => { if(!m.addons) m.addons = []; if(!m.status) m.status = "tersedia"; });
    applySettings(); setViewMode('grid'); renderMenu(); renderCart(); renderKatalogTable(); renderLaporan(); renderOpenBills();
    
    // Default: Panel tersembunyi
    if(window.innerWidth < 768) {
        const sheet = document.getElementById('cart-panel');
        sheet.style.transform = `translateY(110%)`; 
    }
});

function saveDB() { localStorage.setItem('pos_final_db', JSON.stringify(db)); }
function formatRp(n) { return 'Rp ' + n.toLocaleString('id-ID'); }

// --- NAVIGATION & VIEW ---
function nav(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById('page-'+pageId).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => { b.classList.remove('active-nav', 'text-red-500'); b.classList.add('text-gray-400'); });
    const dBtn = document.getElementById('nav-'+pageId); if(dBtn) { dBtn.classList.add('active-nav', 'text-red-500'); dBtn.classList.remove('text-gray-400'); }
    document.querySelectorAll('nav.md\\:hidden button').forEach(b => { b.classList.remove('active-nav-mobile', 'text-red-500'); });
    const mBtn = document.getElementById('mob-'+pageId); if(mBtn) mBtn.classList.add('active-nav-mobile', 'text-red-500');
    if(pageId === 'open-bill') renderOpenBills();
    if(pageId === 'katalog') renderKatalogTable();
    if(pageId === 'laporan') renderLaporan(); 
    
    const fab = document.getElementById('floating-cart-wrapper');
    if(pageId === 'kasir') {
        fab.classList.remove('hidden');
        if(window.innerWidth < 768) toggleCartMobile(false);
    } else {
        fab.classList.add('hidden');
        if(window.innerWidth < 768) toggleCartMobile(false); 
    }
}

function setViewMode(mode) {
    currentView = mode;
    const btnGrid = document.getElementById('btn-view-grid'); const btnList = document.getElementById('btn-view-list');
    if(mode === 'grid') { btnGrid.classList.add('text-red-500', 'bg-white', 'shadow'); btnList.classList.remove('text-red-500', 'bg-white', 'shadow'); } 
    else { btnList.classList.add('text-red-500', 'bg-white', 'shadow'); btnGrid.classList.remove('text-red-500', 'bg-white', 'shadow'); }
    renderMenu();
}

function filterMenu(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active-filter'));
    document.getElementById('cat-'+category).classList.add('active-filter');
    renderMenu();
}

// --- KASIR & MENU LOGIC ---
function toggleSortAZ() {
    isSortAZ = !isSortAZ;
    const btn = document.getElementById('btn-sort-az');
    if(isSortAZ) { btn.classList.add('text-red-500', 'bg-red-50'); showToast("Urutan: A-Z"); } 
    else { btn.classList.remove('text-red-500', 'bg-red-50'); showToast("Urutan: Manual (DB)"); }
    renderMenu();
}

function renderMenu() {
    const container = document.getElementById('menu-container'); container.innerHTML = '';
    container.className = currentView === 'grid' ? "flex-1 overflow-y-auto p-3 grid grid-cols-2 lg:grid-cols-4 gap-3 content-start pb-[150px] md:pb-3" : "flex-1 overflow-y-auto p-3 flex flex-col gap-2 content-start pb-[150px] md:pb-3";
    const searchInput = document.getElementById('search'); const searchKey = searchInput.value.toLowerCase();
    const clearBtn = document.getElementById('clear-search-btn');
    
    if(searchKey.length > 0) clearBtn.classList.remove('hidden'); else clearBtn.classList.add('hidden');
    
    let menuToRender = [...db.menu];
    if(isSortAZ) { menuToRender.sort((a, b) => a.nama.localeCompare(b.nama)); }

    menuToRender.forEach(m => {
        if((currentFilter === 'all' || m.kategori.toLowerCase() === currentFilter.toLowerCase()) && m.nama.toLowerCase().includes(searchKey)) {
            const img = m.img || 'https://via.placeholder.com/150?text=Menu';
            const isHabis = m.status === 'habis';
            const grayClass = isHabis ? 'grayscale' : '';
            const clickAction = isHabis ? '' : `onclick="addToCart(${m.id})"`; 
            const habisOverlay = isHabis ? '<div class="absolute inset-0 flex items-center justify-center"><span class="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded shadow">HABIS</span></div>' : '';

            if(currentView === 'grid') {
                container.innerHTML += `<div ${clickAction} class="bg-white p-2 rounded-xl shadow-sm border border-transparent ${isHabis ? 'cursor-not-allowed' : 'active:border-red-400 cursor-pointer active:scale-95'} flex flex-col transition relative ${grayClass}"><div class="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden mb-2 relative"><img src="${img}" class="w-full h-full object-cover">${habisOverlay}</div><div class="flex-1 flex flex-col justify-between"><div class="text-[10px] md:text-sm font-bold text-gray-800 leading-tight line-clamp-2">${m.nama}</div><div class="flex justify-between items-center mt-1"><div class="text-red-600 font-bold text-[10px] md:text-xs">${formatRp(m.harga)}</div><div class="bg-red-50 text-red-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px]"><i class="fas fa-plus"></i></div></div></div></div>`;
            } else {
                container.innerHTML += `<div ${clickAction} class="bg-white p-2 rounded-lg shadow-sm border border-transparent ${isHabis ? 'cursor-not-allowed' : 'active:border-red-400 cursor-pointer active:scale-95'} flex items-center gap-3 transition relative ${grayClass}"><div class="relative"><img src="${img}" class="w-12 h-12 rounded bg-gray-100 object-cover">${habisOverlay}</div><div class="flex-1"><div class="font-bold text-xs md:text-sm text-gray-800">${m.nama}</div><div class="text-[10px] text-gray-400 capitalize">${m.kategori}</div></div><div class="text-right"><div class="text-red-600 font-bold text-xs">${formatRp(m.harga)}</div></div></div>`;
            }
        }
    });
}
function clearSearch() { document.getElementById('search').value = ''; renderMenu(); }

let toastTimeout;
function showToast(msg) {
    const el = document.getElementById('toast-container'); const msgEl = document.getElementById('toast-message');
    msgEl.innerText = msg; el.classList.add('show');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { el.classList.remove('show'); }, 2000);
}

/* === NEW: MENU POPUP LOGIC === */
function addToCart(id) { 
    const m = db.menu.find(x => x.id === id); 
    selectedMenuId = id;
    modalQty = 1;
    
    // Populate Modal
    document.getElementById('modal-menu-img').src = m.img || 'https://via.placeholder.com/150?text=Menu';
    document.getElementById('modal-menu-name').innerText = m.nama;
    document.getElementById('modal-menu-price').innerText = formatRp(m.harga);
    document.getElementById('modal-menu-qty').innerText = modalQty;
    
    // Render Addons in Modal
    const addonsList = document.getElementById('modal-addons-list');
    const addonsSection = document.getElementById('modal-addons-section');
    addonsList.innerHTML = '';
    
    if(m.addons && m.addons.length > 0) {
        addonsSection.classList.remove('hidden');
        m.addons.forEach((a, idx) => {
            addonsList.innerHTML += `
            <label class="flex items-center justify-between p-2 border rounded-lg hover:bg-red-50 cursor-pointer transition select-none">
                <div class="flex items-center gap-2">
                    <input type="checkbox" class="modal-addon-checkbox w-4 h-4 text-red-600 rounded focus:ring-red-500" data-name="${a.name}" data-price="${a.price}" onchange="updateModalTotal()">
                    <span class="text-sm text-gray-700 font-medium">${a.name}</span>
                </div>
                <span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">+${formatRp(a.price)}</span>
            </label>`;
        });
    } else {
        addonsSection.classList.add('hidden');
    }
    
    updateModalTotal();
    
    // LOGIKA ANIMASI:
    const modal = document.getElementById('menu-modal');
    const content = document.getElementById('modal-content-box');
    
    modal.classList.remove('hidden');
    
    // Restart animasi CSS setiap kali dibuka
    content.classList.remove('animate-popup-content');
    void content.offsetWidth; // Trigger reflow
    content.classList.add('animate-popup-content');
}

function closeMenuModal() {
    document.getElementById('menu-modal').classList.add('hidden');
}

function adjModalQty(v) {
    modalQty += v;
    if(modalQty < 1) modalQty = 1;
    document.getElementById('modal-menu-qty').innerText = modalQty;
    updateModalTotal();
}

function updateModalTotal() {
    const m = db.menu.find(x => x.id === selectedMenuId);
    let addonTotal = 0;
    document.querySelectorAll('.modal-addon-checkbox:checked').forEach(cb => {
        addonTotal += parseInt(cb.dataset.price);
    });
    const grandTotal = (m.harga + addonTotal) * modalQty;
    document.getElementById('modal-total-btn').innerText = formatRp(grandTotal);
}

function processAddToCart() {
    const m = db.menu.find(x => x.id === selectedMenuId);
    const selectedAddons = [];
    
    document.querySelectorAll('.modal-addon-checkbox:checked').forEach(cb => {
        selectedAddons.push({name: cb.dataset.name, price: parseInt(cb.dataset.price)});
    });

    db.cart.push({
        ...m, 
        qty: modalQty, 
        note: '', 
        selectedAddons: selectedAddons 
    });
    
    closeMenuModal();
    renderCart(); 
    showToast(`${m.nama} ditambahkan`);
    
    const badge = document.getElementById('cart-badge-count');
    badge.classList.remove('scale-0');
    badge.classList.add('badge-pop');
    setTimeout(() => badge.classList.remove('badge-pop'), 300);
}

/* === CART LOGIC (SYNC WITH POPUP) === */
function toggleAddon(cartIdx, addonName, addonPrice) { const item = db.cart[cartIdx]; const existingIdx = item.selectedAddons.findIndex(x => x.name === addonName); if(existingIdx > -1) { item.selectedAddons.splice(existingIdx, 1); } else { item.selectedAddons.push({name: addonName, price: addonPrice}); } renderCart(); }
function clearCart() { if(db.cart.length > 0) { if(confirm("Hapus semua menu di keranjang?")) { db.cart = []; renderCart(); } } }

function renderCart() {
    const c = document.getElementById('cart-items'); c.innerHTML = ''; let t = 0;
    const totalItems = db.cart.reduce((a, b) => a + b.qty, 0);
    const badge = document.getElementById('cart-badge-count');
    badge.innerText = totalItems;
    if(totalItems > 0) badge.classList.remove('scale-0'); else badge.classList.add('scale-0');

    if(db.cart.length===0) c.innerHTML = '<div class="text-center text-gray-400 text-xs mt-4">Keranjang Kosong</div>';
    db.cart.forEach((i, idx) => {
        let addonTotal = i.selectedAddons.reduce((sum, a) => sum + a.price, 0); let unitPrice = i.harga + addonTotal; let itemTotal = unitPrice * i.qty; t += itemTotal;
        let addonsHtml = '';
        if(i.addons && i.addons.length > 0) {
            addonsHtml = '<div class="mt-1 flex flex-wrap gap-1">';
            i.addons.forEach(opt => { 
                const isChecked = i.selectedAddons.find(x => x.name === opt.name) ? 'checked' : ''; 
                addonsHtml += `<label class="flex items-center text-[9px] bg-gray-100 px-1.5 py-0.5 rounded cursor-pointer border border-gray-200 hover:bg-red-50 ${isChecked ? 'bg-red-50 border-red-200 text-red-600' : 'text-gray-600'}"><input type="checkbox" ${isChecked} onchange="toggleAddon(${idx}, '${opt.name}', ${opt.price})" class="hidden">${isChecked ? '<i class="fas fa-check mr-1 text-[8px]"></i>' : ''} ${opt.name} (+${opt.price/1000}k)</label>`; 
            });
            addonsHtml += '</div>';
        }
        c.innerHTML += `<div class="bg-white p-2 rounded border border-gray-100 relative shadow-sm"><div class="flex justify-between font-bold text-xs text-gray-700 items-start"><div>${i.nama}</div><div>${formatRp(itemTotal)}</div></div><div class="text-[10px] text-gray-400 mb-1">${i.qty} x ${formatRp(unitPrice)}</div>${addonsHtml}<input type="text" placeholder="Catatan..." value="${i.note}" onchange="updateNote(${idx}, this.value)" class="w-full text-[10px] border-b border-dashed outline-none mt-1 bg-transparent text-gray-500"><div class="flex items-center gap-2 justify-end mt-2"><button onclick="modQty(${idx}, -1)" class="w-5 h-5 bg-gray-100 rounded text-xs text-gray-600 flex items-center justify-center">-</button><span class="text-xs font-bold w-4 text-center">${i.qty}</span><button onclick="modQty(${idx}, 1)" class="w-5 h-5 bg-red-50 text-red-500 rounded text-xs flex items-center justify-center">+</button></div><button onclick="delCart(${idx})" class="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center">x</button></div>`;
    });
    document.getElementById('cart-total').innerText = formatRp(t); payState.total = t; saveDB(); c.scrollTop = c.scrollHeight;
}
function modQty(i, v) { db.cart[i].qty += v; if(db.cart[i].qty<=0) db.cart.splice(i,1); renderCart(); }
function delCart(i) { db.cart.splice(i, 1); renderCart(); }
function updateNote(i, v) { db.cart[i].note = v; saveDB(); }

// --- UX: ORDER TYPE COLORS ---
function setOrderType(t) { 
    currentOrderType = t; 
    const dineBtn = document.getElementById('btn-dine');
    const takeBtn = document.getElementById('btn-take');
    
    if(t === 'Dine In') {
        dineBtn.className = "flex-1 py-2 text-xs font-bold bg-blue-600 text-white shadow-md rounded-lg transition";
        takeBtn.className = "flex-1 py-2 text-xs font-bold bg-gray-100 text-gray-400 rounded-lg transition";
    } else {
        takeBtn.className = "flex-1 py-2 text-xs font-bold bg-yellow-500 text-white shadow-md rounded-lg transition";
        dineBtn.className = "flex-1 py-2 text-xs font-bold bg-gray-100 text-gray-400 rounded-lg transition";
    }
}

// --- MANAJEMEN MENU ---
function addAddonRow(name='', price='') { const container = document.getElementById('addon-inputs-container'); const row = document.createElement('div'); row.className = "flex gap-2 items-center"; row.innerHTML = `<input type="text" placeholder="Nama (Telur)" value="${name}" class="addon-name-input w-2/3 p-1 border rounded text-xs"><input type="number" placeholder="Rp" value="${price}" class="addon-price-input w-1/3 p-1 border rounded text-xs"><button onclick="this.parentElement.remove()" class="text-red-500 text-xs"><i class="fas fa-trash"></i></button>`; container.appendChild(row); }

// --- LOGIKA SIMPAN MENU ---
function simpanMenu() {
    const n = document.getElementById('input-nama').value; const h = parseInt(document.getElementById('input-harga').value); const k = document.getElementById('input-kategori').value; const s = document.getElementById('input-status').value; 
    let i = document.getElementById('menu-img-preview').src;
    if(i.includes('via.placeholder.com')) i = "";

    const addonRows = document.querySelectorAll('#addon-inputs-container > div'); let addons = [];
    addonRows.forEach(row => { const aName = row.querySelector('.addon-name-input').value; const aPrice = parseInt(row.querySelector('.addon-price-input').value); if(aName && !isNaN(aPrice)) addons.push({name: aName, price: aPrice}); });
    if(!n || !h) return alert("Lengkapi Data");
    if(editId) { const idx = db.menu.findIndex(x => x.id === editId); db.menu[idx] = { id: editId, nama: n, harga: h, kategori: k, status: s, img: i, addons: addons }; editId = null; } else { db.menu.push({ id: Date.now(), nama: n, harga: h, kategori: k, status: s, img: i, addons: addons }); }
    saveDB(); resetMenuForm(); renderKatalogTable(); renderMenu();
}

function hapusFoto() {
    document.getElementById('menu-img-preview').src = 'https://via.placeholder.com/150?text=Upload+Foto';
    document.getElementById('menu-img-input').value = ''; 
}

function editMenu(id) { const m = db.menu.find(x => x.id === id); editId = id; document.getElementById('input-nama').value = m.nama; document.getElementById('input-harga').value = m.harga; document.getElementById('input-kategori').value = m.kategori; document.getElementById('input-status').value = m.status || 'tersedia'; document.getElementById('menu-img-preview').src = m.img || 'https://via.placeholder.com/150?text=Upload+Foto'; const container = document.getElementById('addon-inputs-container'); container.innerHTML = ''; if(m.addons) { m.addons.forEach(a => addAddonRow(a.name, a.price)); } }
function resetMenuForm() { editId = null; document.getElementById('input-nama').value=''; document.getElementById('input-harga').value=''; document.getElementById('input-status').value='tersedia'; document.getElementById('addon-inputs-container').innerHTML=''; document.getElementById('menu-img-preview').src='https://via.placeholder.com/150?text=Upload+Foto'; document.getElementById('menu-img-input').value = ''; }

function renderKatalogTable() { 
    const b = document.getElementById('table-katalog-body'); b.innerHTML = ''; 
    db.menu.forEach((m, index) => { 
        b.innerHTML += `<tr class="border-b"><td class="p-3"><img src="${m.img||'https://via.placeholder.com/50'}" class="w-8 h-8 rounded object-cover bg-gray-100"></td><td class="p-3"><div class="font-bold">${m.nama}</div><div class="text-[10px] text-gray-500">${m.kategori}</div></td><td class="p-3 text-right">${formatRp(m.harga)}</td><td class="p-3 text-center text-xs font-bold ${m.status==='habis'?'text-red-500':'text-green-500'} uppercase">${m.status}</td><td class="p-3 text-center"><button onclick="editMenu(${m.id})" class="text-blue-500 mr-2"><i class="fas fa-edit"></i></button><button onclick="hapusMenu(${m.id})" class="text-red-500"><i class="fas fa-trash"></i></button></td><td class="p-3 text-center"><button onclick="moveMenu(${index}, -1)" class="text-gray-500 hover:text-blue-600 block"><i class="fas fa-chevron-up"></i></button><button onclick="moveMenu(${index}, 1)" class="text-gray-500 hover:text-blue-600 block"><i class="fas fa-chevron-down"></i></button></td></tr>`; 
    }); 
}

function moveMenu(index, direction) { if (direction === -1 && index > 0) { [db.menu[index], db.menu[index - 1]] = [db.menu[index - 1], db.menu[index]]; } else if (direction === 1 && index < db.menu.length - 1) { [db.menu[index], db.menu[index + 1]] = [db.menu[index + 1], db.menu[index]]; } saveDB(); renderKatalogTable(); renderMenu(); }
function hapusMenu(id) { if(confirm("Hapus?")) { db.menu = db.menu.filter(x => x.id !== id); saveDB(); renderKatalogTable(); } }

function renderLaporan() { 
    const tr = db.transaksi || []; 
    const filterDate = document.getElementById('filter-date').value;
    let filteredTr = tr;
    if (filterDate) { filteredTr = tr.filter(t => { const tDate = new Date(t.id); return `${tDate.getFullYear()}-${String(tDate.getMonth()+1).padStart(2,'0')}-${String(tDate.getDate()).padStart(2,'0')}` === filterDate; }); }
    document.getElementById('lap-transaksi').innerText = filteredTr.length; 
    document.getElementById('lap-omset').innerText = formatRp(filteredTr.reduce((a,b)=>a+b.total,0)); 
    const b = document.getElementById('table-laporan-body'); b.innerHTML = ''; 
    filteredTr.slice().reverse().forEach(t => { b.innerHTML += `<tr class="border-b hover:bg-gray-100"><td class="p-3 text-xs">${t.tanggal}</td><td class="p-3 text-xs font-bold">${t.pelanggan}</td><td class="p-3 text-right text-xs font-bold text-green-600">${formatRp(t.total)}</td></tr>`; }); 
    
    initChart(tr); 
}

// --- CHART JS LOGIC ---
function updateChartFilter(days) {
    currentChartFilter = days;
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active', 'text-white', 'bg-blue-500'); 
        btn.classList.add('text-gray-500'); 
    });
    const activeBtn = document.getElementById('chart-btn-'+days);
    activeBtn.classList.add('active');
    activeBtn.classList.remove('text-gray-500');
    renderLaporan(); 
}

function initChart(transactions) {
    const ctx = document.getElementById('salesChart');
    if(!ctx) return;
    
    const grouped = {};
    const labels = [];
    const dataValues = [];

    const limit = parseInt(currentChartFilter);
    const today = new Date();
    
    for(let i = limit - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        
        let key;
        let label;
        
        if (limit === 365) {
            key = `${d.getMonth()+1}/${d.getFullYear()}`; 
            label = d.toLocaleString('id-ID', { month: 'short' }); 
        } else {
            key = `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
            label = `${d.getDate()}/${d.getMonth()+1}`;
        }

        if(!grouped[key]) {
            grouped[key] = { label: label, total: 0 };
        }
    }

    transactions.forEach(t => {
        const tDate = new Date(t.id);
        let key;
        if (limit === 365) {
            key = `${tDate.getMonth()+1}/${tDate.getFullYear()}`;
        } else {
            key = `${tDate.getDate()}/${tDate.getMonth()+1}/${tDate.getFullYear()}`;
        }

        if(grouped[key]) {
            grouped[key].total += t.total;
        }
    });

    Object.values(grouped).forEach(item => {
        labels.push(item.label);
        dataValues.push(item.total);
    });

    if(salesChart) salesChart.destroy();

    const canvas = ctx.getContext('2d');
    const gradient = canvas.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); 
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)'); 

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Omset',
                data: dataValues,
                borderColor: '#3b82f6', 
                backgroundColor: gradient, 
                borderWidth: 2,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#3b82f6',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    grid: { borderDash: [2, 4], color: '#f3f4f6' },
                    ticks: { callback: function(value) { return (value/1000) + 'k'; }, font: {size: 10} } 
                },
                x: {
                    grid: { display: false },
                    ticks: { font: {size: 10}, maxTicksLimit: limit === 365 ? 12 : 7 }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1f2937',
                    bodyColor: '#1f2937',
                    borderColor: '#e5e7eb',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return 'Rp ' + context.parsed.y.toLocaleString('id-ID');
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
}

function printDapurForSave(custName, isAuto = false) {
    const nameInput = document.getElementById('customer-name');
    if(currentOrderType === 'Dine In' && !custName && !isAuto) {
        nameInput.classList.add('animate-shake', 'border-red-500', 'bg-red-50');
        setTimeout(() => nameInput.classList.remove('animate-shake', 'border-red-500', 'bg-red-50'), 500);
        return showToast("⚠️ Nama Pelanggan Wajib untuk Dine In!");
    }
    if(!custName) custName = "Take Away";

    if(db.cart.length === 0) return showToast("Keranjang Kosong!");

    const date = new Date().toLocaleString();
    document.getElementById('print-area').innerHTML = `<div class="print-dapur"><div class="header">TIKET DAPUR</div><div class="meta"><div>${date}</div><div style="font-size:16px; font-weight:bold;">${custName} (${currentOrderType})</div></div>${db.cart.map(i => { const addons = i.selectedAddons.map(a => `<span class="addon-badge">+${a.name}</span>`).join(' '); if(i.printed) { return `<div class="item done"><div class="qty"><i class="fas fa-check"></i></div><div class="details"><div class="name">${i.nama} (${i.qty})</div>${addons}</div></div>`; } else { return `<div class="item"><div class="qty">${i.qty}</div><div class="details"><div class="name">${i.nama}</div>${addons}${i.note?`<div class="note">Note: ${i.note}</div>`:''}</div></div>`; } }).join('')}</div>`;
    window.print();
}

async function processPayment() {
    const nameInput = document.getElementById('customer-name');
    let custName = nameInput.value;
    
    if(currentOrderType === 'Dine In' && !custName) {
        closeModal();
        nameInput.classList.add('animate-shake', 'border-red-500', 'bg-red-50');
        setTimeout(() => nameInput.classList.remove('animate-shake', 'border-red-500', 'bg-red-50'), 500);
        return showToast("⚠️ Masukkan Nama Pelanggan (Dine In)!");
    }
    if(!custName) custName = "Take Away";

    closeModal();
    const anim = document.getElementById('success-anim'); anim.classList.remove('hidden');
    await new Promise(r => setTimeout(r, 2000)); anim.classList.add('hidden');
    const trx = { id: Date.now(), tanggal: new Date().toLocaleString(), pelanggan: custName, tipe: currentOrderType, total: payState.total, method: payState.method, itemsDetail: [...db.cart] };
    if(!db.transaksi) db.transaksi = []; db.transaksi.push(trx);
    if(db.settings.sheetUrl) fetch(db.settings.sheetUrl, { method:'POST', mode:'no-cors', body:JSON.stringify(trx) });
    const logo = db.settings.logo ? `<img src="${db.settings.logo}" class="logo">` : '';
    
    const itemsHtml = db.cart.map(i => { 
        let unitPrice = i.harga + i.selectedAddons.reduce((s,a)=>s+a.price,0); 
        const addonsHtml = i.selectedAddons.map(a => `<span class="item-addon">+ ${a.name} (${formatRp(a.price)})</span>`).join(''); 
        return `
        <div class="item-row">
            <div class="item-main">
                <span class="item-name">${i.nama} x${i.qty}</span>
                <span class="item-price">${formatRp(unitPrice * i.qty)}</span>
            </div>
            ${addonsHtml}
        </div>`; 
    }).join('');
    
    const kitchenHtml = db.cart.map(i => { const addons = i.selectedAddons.map(a => `<span class="addon-badge">+${a.name}</span>`).join(' '); if(i.printed) { return `<div class="item done"><div class="qty"><i class="fas fa-check"></i></div><div class="details"><div class="name">${i.nama} (${i.qty})</div>${addons}</div></div>`; } else { return `<div class="item"><div class="qty">${i.qty}</div><div class="details"><div class="name">${i.nama}</div>${addons}${i.note?`<div class="note">Note: ${i.note}</div>`:''}</div></div>`; } }).join('');
    
    let cashDetails = '';
    if(payState.method === 'cash') {
        cashDetails = `
        <div class="row-summary"><span class="label">TUNAI</span><span class="val">${formatRp(payState.received)}</span></div>
        <div class="row-summary"><span class="label">KEMBALI</span><span class="val">${formatRp(payState.change)}</span></div>
        `;
    }

    document.getElementById('print-area').innerHTML = `
    <div class="print-dapur">
        <div class="header">TIKET DAPUR</div>
        <div class="meta"><div>${trx.tanggal}</div><div style="font-size:16px; font-weight:bold;">${trx.pelanggan} (${trx.tipe})</div></div>
        ${kitchenHtml}
    </div>
    <div style="page-break-before: always;"></div>
    <div class="print-invoice">
        <div class="header">${logo}<h2 class="shop-name">${db.settings.shopName}</h2><p>${db.settings.address}</p><div class="divider"></div></div>
        <div>${itemsHtml}</div>
        <div class="divider"></div>
        <div class="total-section">
            <div class="row-summary"><span class="label">TOTAL</span><span class="val grand-total">${formatRp(payState.total)}</span></div>
            ${cashDetails}
            <div class="payment-badge">LUNAS</div>
            <div style="font-size:10px; margin-top:5px; text-align:right;">Metode: ${payState.method.toUpperCase()}</div>
        </div>
        <div class="divider"></div>
        <center style="font-size:10px;">Terima Kasih<br>${trx.tanggal}</center>
    </div>`;
    window.print(); db.cart = []; document.getElementById('customer-name').value=''; renderCart(); saveDB();
    if(window.innerWidth < 768) toggleCartMobile(false);
}

function openPaymentModal() { 
    if(db.cart.length===0) return showToast("Keranjang Kosong!"); 
    const nameInput = document.getElementById('customer-name');
    if(currentOrderType === 'Dine In' && !nameInput.value) {
            nameInput.classList.add('animate-shake', 'border-red-500', 'bg-red-50');
            setTimeout(() => nameInput.classList.remove('animate-shake', 'border-red-500', 'bg-red-50'), 500);
            return showToast("⚠️ Isi Nama Pelanggan (Dine In)!");
    }
    document.getElementById('payment-modal').classList.remove('hidden'); setPaymentMethod('cash'); payState.total = db.cart.reduce((t,i)=> t + (i.harga + i.selectedAddons.reduce((s,a)=>s+a.price,0))*i.qty, 0); document.getElementById('modal-total-display').innerText = formatRp(payState.total); document.getElementById('qris-amount-display').innerText = formatRp(payState.total); updateCalc(); 
}

function closeModal() { document.getElementById('payment-modal').classList.add('hidden'); }
function setPaymentMethod(m) { payState.method = m; document.getElementById('btn-pm-cash').className = m==='cash'?"flex-1 py-2 border-2 border-green-500 bg-green-50 text-green-700 font-bold rounded text-sm":"flex-1 py-2 border border-gray-300 text-gray-500 rounded text-sm"; document.getElementById('btn-pm-qris').className = m==='qris'?"flex-1 py-2 border-2 border-blue-500 bg-blue-50 text-blue-700 font-bold rounded text-sm":"flex-1 py-2 border border-gray-300 text-gray-500 rounded text-sm"; document.getElementById('view-cash').style.display = m==='cash'?'block':'none'; document.getElementById('view-qris').style.display = m==='qris'?'block':'none'; if(m==='qris') { document.getElementById('btn-finish-pay').disabled=false; document.getElementById('qris-display-img').src = db.settings.qris || 'https://via.placeholder.com/300?text=Belum+Upload+QRIS'; } else updateCalc(); }
function inputNumpad(k) { if(k==='C') payState.received=0; else if(k==='00') payState.received = parseInt(payState.received.toString()+'00'); else payState.received = parseInt(payState.received.toString() + k); updateCalc(); }
function addNominal(n) { payState.received += n; updateCalc(); }
function setUangPas() { payState.received = payState.total; updateCalc(); }
function updateCalc() { document.getElementById('cash-received-display').innerText = payState.received.toLocaleString(); payState.change = payState.received - payState.total; const el = document.getElementById('change-display'); if(payState.change < 0) { el.innerText = "Kurang " + Math.abs(payState.change); el.className="font-bold text-xl text-red-500"; document.getElementById('btn-finish-pay').disabled=true; } else { el.innerText = formatRp(payState.change); el.className="font-bold text-xl text-green-600"; document.getElementById('btn-finish-pay').disabled=false; } }

function saveOpenBill() { 
    let nm = document.getElementById('customer-name').value; 
    if(currentOrderType === 'Dine In' && !nm) {
        const nameInput = document.getElementById('customer-name');
        nameInput.classList.add('animate-shake', 'border-red-500', 'bg-red-50');
        setTimeout(() => nameInput.classList.remove('animate-shake', 'border-red-500', 'bg-red-50'), 500);
        return showToast("⚠️ Isi Nama Pelanggan (Dine In)!");
    }
    if(db.cart.length===0) return showToast("Cart Kosong!"); 
    if(!nm) nm = "Take Away";
    printDapurForSave(nm, true); 
    db.cart.forEach(item => { item.printed = true; }); db.openBills.push({ id: Date.now(), nama: nm, cart: [...db.cart], type: currentOrderType, time: new Date().toLocaleString() }); db.cart = []; document.getElementById('customer-name').value = ''; renderCart(); 
    if(window.innerWidth < 768) toggleCartMobile(false);
}

function renderOpenBills() { const g = document.getElementById('bill-grid'); g.innerHTML = ''; db.openBills.forEach((b, idx) => { const tot = b.cart.reduce((t,i)=> t + (i.harga + (i.selectedAddons?i.selectedAddons.reduce((s,a)=>s+a.price,0):0))*i.qty, 0); g.innerHTML += `<div class="bg-white p-3 rounded shadow border-l-4 border-yellow-400 relative"><div class="flex justify-between font-bold text-sm"><span>${b.nama}</span><span>${formatRp(tot)}</span></div><div class="text-[10px] text-gray-500 mb-2">${b.time} • ${b.type}</div><div class="flex gap-2"><button onclick="restoreBill(${idx})" class="flex-1 bg-blue-500 text-white py-1 rounded text-xs font-bold">Bayar</button><button onclick="hapusBill(${idx})" class="w-8 bg-red-100 text-red-500 rounded"><i class="fas fa-trash"></i></button></div></div>`; }); }
function restoreBill(i) { const b = db.openBills[i]; db.cart = b.cart; document.getElementById('customer-name').value = b.nama; currentOrderType = b.type; setOrderType(b.type); db.openBills.splice(i, 1); saveDB(); nav('kasir'); renderCart(); if(window.innerWidth < 768) toggleCartMobile(true); }
function hapusBill(i) { if(confirm("Hapus?")) { db.openBills.splice(i, 1); saveDB(); renderOpenBills(); } }

/* === FUNGSI KOMPRES GAMBAR OTOMATIS === */
function previewMenuImg(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 150; 
                const QUALITY = 0.5;    
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_WIDTH) { width *= MAX_WIDTH / height; height = MAX_WIDTH; } }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                document.getElementById('menu-img-preview').src = dataUrl;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function applySettings() { if(db.settings.logo) { document.getElementById('sidebar-logo').src = db.settings.logo; const mobLogo = document.getElementById('mobile-logo'); if(mobLogo) mobLogo.src = db.settings.logo; document.getElementById('setting-logo-preview').src = db.settings.logo; } if(db.settings.qris) { document.getElementById('setting-qris-preview').src = db.settings.qris; } document.getElementById('shop-name').value = db.settings.shopName; document.getElementById('shop-address').value = db.settings.address; document.getElementById('g-sheet-url').value = db.settings.sheetUrl || ''; }
function saveSettings() { db.settings.shopName = document.getElementById('shop-name').value; db.settings.address = document.getElementById('shop-address').value; db.settings.sheetUrl = document.getElementById('g-sheet-url').value; saveDB(); alert('Pengaturan Berhasil Disimpan!'); }
function handleLogoUpload(input) { if (input.files && input.files[0]) { var reader = new FileReader(); reader.onload = function (e) { db.settings.logo = e.target.result; saveDB(); location.reload(); }; reader.readAsDataURL(input.files[0]); } }
function handleQrisUpload(input) { if (input.files && input.files[0]) { var reader = new FileReader(); reader.onload = function (e) { db.settings.qris = e.target.result; document.getElementById('setting-qris-preview').src = e.target.result; saveDB(); }; reader.readAsDataURL(input.files[0]); } }
function downloadExcel() { let csv = "ID_Transaksi,Waktu,Pelanggan,Tipe,Metode_Bayar,Kategori_Menu,Nama_Menu,Harga_Satuan,Qty,Addons,Subtotal_Item\n"; db.transaksi.forEach(t => { const items = t.itemsDetail || []; if(items.length > 0) { items.forEach(item => { const addonTotal = item.selectedAddons.reduce((s,a)=>s+a.price,0); const unitPrice = item.harga + addonTotal; const subtotal = unitPrice * item.qty; const addonsStr = item.selectedAddons.map(a=>a.name).join(' + '); const safeName = item.nama.replace(/,/g, ' '); const safeCat = item.kategori.replace(/,/g, ' '); const safeAddons = addonsStr.replace(/,/g, ' '); csv += `${t.id},"${t.tanggal}","${t.pelanggan}",${t.tipe},${t.method},${safeCat},${safeName},${unitPrice},${item.qty},"${safeAddons}",${subtotal}\n`; }); } else { csv += `${t.id},"${t.tanggal}","${t.pelanggan}",${t.tipe},${t.method},MULTIPLE_ITEMS,"(Data Lama)",0,0,"-",${t.total}\n`; } }); const link = document.createElement("a"); link.href = "data:text/csv;charset=utf-8," + encodeURI(csv); link.download = "Laporan_POS_Detail.csv"; link.click(); }
function backupData() { const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)); const downloadAnchorNode = document.createElement('a'); downloadAnchorNode.setAttribute("href", dataStr); downloadAnchorNode.setAttribute("download", "database_warkop.json"); document.body.appendChild(downloadAnchorNode); downloadAnchorNode.click(); downloadAnchorNode.remove(); }
function restoreData() { 
    const input = document.getElementById('restore-file-input'); 
    
    // Validasi file
    if (!input.files[0]) return alert("Pilih file dulu!"); 
    
    const file = input.files[0]; 
    const reader = new FileReader(); 
    
    reader.onload = function(e) { 
        try { 
            const data = JSON.parse(e.target.result); 
            
            if(confirm("Yakin mau restore? Data saat ini akan tertimpa!")) { 
                // 1. Timpa database dengan data dari file JSON
                db = data; 
                saveDB(); 
                
                // 2. JANGAN RELOAD HALAMAN (location.reload dihapus)
                // Kita panggil ulang fungsi-fungsi render agar tampilan berubah instan
                applySettings();       // Update logo/nama toko
                renderMenu();          // Update daftar menu
                renderKatalogTable();  // Update tabel edit menu
                renderCart();          // Update keranjang (jika ada sisa)
                renderOpenBills();     // Update bill tersimpan
                renderLaporan();       // Update laporan
                
                // 3. Reset input file biar bersih
                input.value = '';
                
                // 4. Beri kabar sukses
                alert("Berhasil Restore! Data sudah diperbarui tanpa reload."); 
                
                // Opsional: Pindah ke halaman kasir otomatis biar langsung kelihatan
                nav('kasir');
            } 
        } catch(err) { 
            console.error(err);
            alert("File rusak atau bukan database yang benar!"); 
        } 
    }; 
    
    reader.readAsText(file); 
}
function resetLaporan() { if(confirm("Yakin hapus SEMUA riwayat transaksi sisa tes tadi? (Menu & Settingan Toko TETAP AMAN)")) { if(confirm("Serius? Data laporan akan jadi 0!")) { db.transaksi = []; saveDB(); alert("Laporan Penjualan sudah 0 kembali. Siap Opening!"); location.reload(); } } }
function resetData() { if(confirm("AWAS! Ini akan menghapus SEMUA DATA (Menu, Setting, Laporan). Yakin?")) { localStorage.clear(); location.reload(); } }

/* === FLOATING BUTTON & PANEL ANIMATION === */
let isCartOpen = false;
function toggleCartMobile(forceState = null) {
    const sheet = document.getElementById('cart-panel');
    const fabWrapper = document.getElementById('floating-cart-wrapper');
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    if (forceState !== null) { isCartOpen = forceState; } else { isCartOpen = !isCartOpen; }
    if (isCartOpen) { sheet.style.transform = `translateY(0)`; fabWrapper.classList.add('hidden-fab'); } else { sheet.style.transform = `translateY(110%)`; fabWrapper.classList.remove('hidden-fab'); }
}

(function() {
    const sheet = document.getElementById('cart-panel');
    const dragHandle = document.getElementById('drag-handle');
    let startY, currentY, initialSheetY;
    let isDragging = false;
    const isMobile = () => window.innerWidth < 768;
    const getEventY = (e) => e.touches ? e.touches[0].clientY : e.clientY;

    const startDrag = (e) => {
        if (!isMobile()) return;
        isDragging = true;
        startY = getEventY(e);
        const style = window.getComputedStyle(sheet);
        const matrix = new WebKitCSSMatrix(style.transform);
        initialSheetY = matrix.m42; 
        sheet.classList.add('is-dragging');
    };

    const onDrag = (e) => {
        if (!isDragging || !isMobile()) return;
        if(e.cancelable) e.preventDefault(); 
        const currentTouchY = getEventY(e);
        const deltaY = currentTouchY - startY;
        let newY = initialSheetY + deltaY;
        if (newY < 0) newY = 0; 
        sheet.style.transform = `translateY(${newY}px)`;
        currentY = newY;
    };

    const endDrag = (e) => {
        if (!isDragging || !isMobile()) return;
        isDragging = false;
        sheet.classList.remove('is-dragging');
        if (currentY > 150) { toggleCartMobile(false); } else { toggleCartMobile(true); }
    };

    if(dragHandle && sheet) {
        dragHandle.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', onDrag, {passive: false});
        document.addEventListener('touchend', endDrag);
        dragHandle.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', endDrag);
    }

})();
