// ห้ามคลิกขวา
document.addEventListener('contextmenu', event => event.preventDefault());

// ห้ามกด F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
document.onkeydown = function (e) {
    if (
        e.keyCode == 123 || 
        (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || 
        (e.ctrlKey && e.keyCode == 85)
    ) {
        return false;
    }
};
const API_URL = 'https://script.google.com/macros/s/AKfycbw8JQEp7nV0LS-jy6BFeqq6A3fiw4Imqws6cbih6Vaq1bj66B5XYpnMhCLmfpECvz53/exec';
const MY_SECRET = "My_Super_Secret_Password_999";

/* ═══════════════════════════════════════════════════════
   🔐 PIN MANAGER
   - เก็บ PIN hash ไว้ใน localStorage (ไม่เก็บตัวจริง)
   - Auto-lock หลังไม่มีการใช้งาน 15 นาที
   - ล็อก/ปลดล็อกด้วยปุ่ม + เข้าใช้งานครั้งแรก
═══════════════════════════════════════════════════════ */
const pinManager = {
    PIN_KEY: 'pos_pin_hash',
    UNLOCK_KEY: 'pos_unlocked_until',
    TIMEOUT_MS: 15 * 60 * 1000, // 15 นาที
    _input: '',
    _setupStep: 0,     // 0=first entry, 1=confirm
    _firstPin: '',

    // Simple hash (ไม่ใช้ crypto เพื่อ compatibility)
    hash(pin) {
        let h = 0;
        for (let i = 0; i < pin.length; i++) {
            h = ((h << 5) - h) + pin.charCodeAt(i);
            h |= 0;
        }
        return 'ph_' + Math.abs(h).toString(36) + pin.length;
    },

    hasPin() { return !!localStorage.getItem(this.PIN_KEY); },

    isUnlocked() {
        if (!this.hasPin()) return true; // ไม่มี PIN = ไม่ล็อก
        const until = parseInt(localStorage.getItem(this.UNLOCK_KEY) || '0');
        return Date.now() < until;
    },

    setUnlocked() {
        localStorage.setItem(this.UNLOCK_KEY, Date.now() + this.TIMEOUT_MS);
    },

    init() {
        if (!this.hasPin()) {
            // ยังไม่มี PIN — ขึ้น screen ให้ตั้ง PIN ครั้งแรก
            this._setupStep = 0;
            document.getElementById('pin-screen-label').innerText = 'ตั้ง PIN 4 หลัก เพื่อความปลอดภัย';
            document.getElementById('pin-setup-hint').innerText = 'PIN จะป้องกันคนอื่นเข้าใช้งานแทน';
            document.getElementById('pin-screen').style.display = 'flex';
        } else if (!this.isUnlocked()) {
            document.getElementById('pin-screen-label').innerText = 'กรอก PIN 4 หลักเพื่อเข้าใช้งาน';
            document.getElementById('pin-setup-hint').innerText = '';
            document.getElementById('pin-screen').style.display = 'flex';
        } else {
            this.unlock();
        }

        // Auto-lock timer
        this._resetTimer();
        ['click', 'keydown', 'touchstart'].forEach(ev => {
            document.addEventListener(ev, () => {
                if (this.isUnlocked()) this._resetTimer();
            });
        });
    },

    _timer: null,
    _resetTimer() {
        clearTimeout(this._timer);
        if (this.hasPin()) {
            this._timer = setTimeout(() => this.lock(), this.TIMEOUT_MS);
        }
    },

    press(digit) {
        if (this._input.length >= 4) return;
        this._input += digit;
        this._updateDots();
        if (this._input.length === 4) {
            setTimeout(() => this._submit(), 200);
        }
    },

    del() {
        this._input = this._input.slice(0, -1);
        this._updateDots();
    },

    _updateDots(state = '') {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById('d' + i);
            dot.className = 'pin-dot';
            if (i < this._input.length) dot.classList.add('filled');
            if (state === 'error') dot.classList.add('error');
        }
    },

    _submit() {
        if (!this.hasPin()) {
            // กำลังตั้ง PIN ครั้งแรก
            if (this._setupStep === 0) {
                this._firstPin = this._input;
                this._setupStep = 1;
                this._input = '';
                this._updateDots();
                document.getElementById('pin-screen-label').innerText = 'ยืนยัน PIN อีกครั้ง';
                document.getElementById('pin-error').innerText = '';
            } else {
                if (this._input === this._firstPin) {
                    localStorage.setItem(this.PIN_KEY, this.hash(this._input));
                    this.unlock();
                } else {
                    this._showError('PIN ไม่ตรงกัน ลองใหม่อีกครั้ง');
                    this._setupStep = 0;
                    this._firstPin = '';
                    document.getElementById('pin-screen-label').innerText = 'ตั้ง PIN 4 หลัก เพื่อความปลอดภัย';
                }
            }
        } else {
            // ตรวจสอบ PIN
            if (this.hash(this._input) === localStorage.getItem(this.PIN_KEY)) {
                this.unlock();
            } else {
                this._showError('PIN ไม่ถูกต้อง');
            }
        }
    },

    _showError(msg) {
        this._updateDots('error');
        document.getElementById('pin-error').innerText = msg;
        setTimeout(() => {
            this._input = '';
            this._updateDots();
            document.getElementById('pin-error').innerText = '';
        }, 900);
    },

    unlock() {
        this.setUnlocked();
        this._input = '';
        this._setupStep = 0;
        this._firstPin = '';
        document.getElementById('pin-screen').style.display = 'none';
        this._resetTimer();
    },

    lock() {
        if (!this.hasPin()) return;
        localStorage.removeItem(this.UNLOCK_KEY);
        this._input = '';
        this._updateDots();
        document.getElementById('pin-screen-label').innerText = 'กรอก PIN 4 หลักเพื่อเข้าใช้งาน';
        document.getElementById('pin-error').innerText = '';
        document.getElementById('pin-setup-hint').innerText = '';
        document.getElementById('pin-screen').style.display = 'flex';
    },

    // บันทึก PIN ใหม่จาก Settings Modal
    savePin() {
        const oldInput = document.getElementById('set-old-pin').value;
        const newPin = document.getElementById('set-new-pin').value;
        const confirmPin = document.getElementById('set-confirm-pin').value;

        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            return Swal.fire('PIN ต้องเป็นตัวเลข 4 หลัก', '', 'warning');
        }
        if (newPin !== confirmPin) {
            return Swal.fire('PIN ไม่ตรงกัน', 'กรุณากรอก PIN ใหม่และยืนยันให้ตรงกัน', 'warning');
        }
        // ตรวจสอบ PIN เก่า (ถ้ามี)
        if (this.hasPin()) {
            if (this.hash(oldInput) !== localStorage.getItem(this.PIN_KEY)) {
                return Swal.fire('PIN ปัจจุบันไม่ถูกต้อง', '', 'error');
            }
        }

        localStorage.setItem(this.PIN_KEY, this.hash(newPin));
        document.getElementById('set-old-pin').value = '';
        document.getElementById('set-new-pin').value = '';
        document.getElementById('set-confirm-pin').value = '';
        ui.closeModal('settings-modal');
        Swal.fire({ icon: 'success', title: 'บันทึก PIN สำเร็จ', text: 'ระบบจะล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน 15 นาที', timer: 2000, showConfirmButton: false });
        this._updateSettingsStatus();
    },

    disablePin() {
        Swal.fire({
            title: 'ปิดใช้งาน PIN?',
            text: 'ระบบจะไม่มีการป้องกันการเข้าใช้งาน',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ปิดใช้งาน',
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'ยกเลิก'
        }).then(r => {
            if (r.isConfirmed) {
                localStorage.removeItem(this.PIN_KEY);
                localStorage.removeItem(this.UNLOCK_KEY);
                ui.closeModal('settings-modal');
                Swal.fire({ icon: 'info', title: 'ปิด PIN แล้ว', timer: 1500, showConfirmButton: false });
                this._updateSettingsStatus();
            }
        });
    },

    _updateSettingsStatus() {
        const box = document.getElementById('pin-status-box');
        if (this.hasPin()) {
            box.className = 'mb-5 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-200';
            box.innerHTML = '<i class="fa-solid fa-lock text-emerald-500"></i> PIN เปิดใช้งานอยู่ · ล็อกอัตโนมัติ 15 นาที';
        } else {
            box.className = 'mb-5 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 bg-amber-50 text-amber-700 border border-amber-200';
            box.innerHTML = '<i class="fa-solid fa-lock-open text-amber-500"></i> ยังไม่ได้ตั้ง PIN — ระบบไม่มีการป้องกัน';
        }
    }
};

/* ═══════════════════════════════════════════════════════
   📱 LINE SHARE MANAGER
═══════════════════════════════════════════════════════ */
const lineShare = {
    _lastReceipt: null,
    _lastDebtReceipt: null,
    _currentMode: 'sale', // 'sale' หรือ 'debt'

    // เก็บข้อมูลบิลล่าสุดไว้สำหรับ share (รายการขายปกติ)
    store(data, cartItems, sub, dep, disc, total) {
        this._currentMode = 'sale';
        this._lastReceipt = { data, cartItems, sub, dep, disc, total };
    },

    // เก็บข้อมูลสำหรับการรับชำระหนี้
    storeDebt(data, paidBills) {
        this._currentMode = 'debt';
        this._lastDebtReceipt = { data, paidBills };
    },

    buildMessage() {
        if (this._currentMode === 'sale') return this._buildSaleMessage();
        if (this._currentMode === 'debt') return this._buildDebtMessage();
        return '';
    },

    _buildSaleMessage() {
        const r = this._lastReceipt;
        if (!r) return '';
        const { data, cartItems, sub, dep, disc, total } = r;
        
        // แก้ไขการดึงวันที่ให้ตรงกับ Local Time เสมอ
        const [yyyy, mm, dd] = data.date.split('-');
        const dateObj = new Date(yyyy, mm - 1, dd);
        const date = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        let itemLines = cartItems
            .filter(i => i.name)
            .map(i => {
                const qty = i.qty || 0;
                const price = i.price || 0;
                // ตัดส่วนยอดรวมของแต่ละรายการออก ให้เหลือแค่ ชื่อ ปริมาณ x ราคา
                return `  • ${i.name} ${qty} x ${price.toLocaleString()}`;
            }).join('\n');

        // ลดความยาวเส้นแบ่งลง เพื่อไม่ให้ตกบรรทัดในแอป Line
        return `📄 นำส่ง บิลการขาย\n` +
               `━━━━━━━━━━━━━━\n` +
               `เลขที่: ${data.invoiceId}\n` +
               `📅 วันที่: ${date}\n` +
               `👤 ลูกค้า: ${data.customerName}\n` +
               `━━━━━━━━━━━━━━\n` +
               `รายการ:\n${itemLines}\n` +
               `━━━━━━━━━━━━━━\n` +
               `รวมสินค้า:  ${parseFloat(sub.replace(/,/g,'')).toLocaleString()} ฿\n` +
               (parseFloat(dep.replace(/,/g,'')) > 0 ? `บวกมัดจำ:  +${parseFloat(dep.replace(/,/g,'')).toLocaleString()} ฿\n` : '') +
               (parseFloat(disc) > 0 ? `ส่วนลด:    -${parseFloat(disc).toLocaleString()} ฿\n` : '') +
               `💰 ยอดสุทธิ: ${total.toLocaleString()} ฿\n` +
               `💳 ชำระโดย: ${data.paymentMethod}\n` +
               `━━━━━━━━━━━━━━\n` +
               `ขอบคุณที่อุดหนุนครับ 🙏`;
    },

    _buildDebtMessage() {
        const r = this._lastDebtReceipt;
        if (!r) return '';
        const { data, paidBills } = r;
        
        const [yyyy, mm, dd] = data.date.split('-');
        const dateObj = new Date(yyyy, mm - 1, dd);
        const date = dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });

        // สร้างรายการบิลที่ถูกนำไปตัดยอดแบบใหม่ (เอาวันที่ออก และเพิ่มสถานะการปิดยอด)
        let billLines = paidBills.map(b => {
            if (b.invoiceId === 'OVERPAYMENT') {
                return `  • ชำระเกินยอดค้างทั้งหมด\n    จำนวน: ${b.paid.toLocaleString()}`;
            }
            
            const autoNote = b.isAutoAllocated ? ' (ออโต้)' : '';
            const statusNote = b.remainingAfterPay <= 0 
                ? '🟢 ปิดยอด' 
                : `คงค้าง ${b.remainingAfterPay.toLocaleString()}`;

            return `  • บิล: ${b.invoiceId}${autoNote}\n    ตัดยอด: ${b.paid.toLocaleString()} [${statusNote}]`;
        }).join('\n');

        if (paidBills.length === 0) billLines = `  • ไม่มียอดค้าง / รับชำระล่วงหน้า`;

        return ` ✅ ยืนยันการรับชำระยอดค้าง\n` +
               `━━━━━━━━━━━━━━\n` +
               `อ้างอิง: ${data.invoiceId}\n` +
               `📅 วันที่: ${date}\n` +
               `👤 ลูกค้า: ${data.customerName}\n` +
               `━━━━━━━━━━━━━━\n` +
               `นำไปหักยอดบิลดังนี้:\n${billLines}\n` +
               `━━━━━━━━━━━━━━\n` +
               `💰 ยอดรับชำระรวม: ${data.totalAmount.toLocaleString()} ฿\n` +
               `💳 ชำระผ่าน: ${data.paymentMethod}\n` +
               `━━━━━━━━━━━━━━\n` +
               `ขอบคุณครับ 🙏`;
    },

    openModal() {
        if (this._currentMode === 'sale' && !this._lastReceipt) return;
        if (this._currentMode === 'debt' && !this._lastDebtReceipt) return;
        
        const msg = this.buildMessage();
        document.getElementById('line-message-preview').innerText = msg;
        ui.openModal('line-share-modal');
    },

    sendLine() {
        const msg = this.buildMessage();
        const encoded = encodeURIComponent(msg);
        // Line Share URL — เปิดแอป Line พร้อม pre-filled text
        window.open(`https://line.me/R/msg/text/?${encoded}`, '_blank');
        ui.closeModal('line-share-modal');
    },

    copyText() {
        const msg = this.buildMessage();
        
        // สร้าง textarea ชั่วคราวซ่อนไว้เพื่อใช้คัดลอกข้อความ
        const ta = document.createElement('textarea');
        ta.value = msg;
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        
        ta.focus();
        ta.select();

        try {
            document.execCommand('copy');
            Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว!', text: 'นำไปวางใน Line ได้เลย', timer: 1500, showConfirmButton: false });
            ui.closeModal('line-share-modal');
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'ไม่สามารถคัดลอกได้', text: 'เบราว์เซอร์ไม่รองรับ', timer: 1500, showConfirmButton: false });
        } finally {
            document.body.removeChild(ta);
        }
    }
};

/* ═══════════════════════════════════════════════════════
   OFFLINE QUEUE MANAGER (unchanged)
═══════════════════════════════════════════════════════ */
const queueManager = {
    key: 'pos_offline_queue',
    getQueue() { return JSON.parse(localStorage.getItem(this.key)) || []; },
    addToQueue(data) {
        const q = this.getQueue();
        q.push(data);
        try {
            localStorage.setItem(this.key, JSON.stringify(q));
            this.updateIndicator();
        } catch(e) {
            Swal.fire('หน่วยความจำเต็ม', 'ไม่สามารถบันทึก Offline เพิ่มได้ กรุณาต่อเน็ต', 'error');
        }
    },
    async sync() {
        const q = this.getQueue();
        if (q.length === 0) return;
        document.getElementById('loader').classList.remove('hidden');
        document.getElementById('loader').querySelector('p').innerText = "กำลังซิงค์ข้อมูล...";
        let successCount = 0;
        const newQ = [];
        for (const item of q) {
            try {
                item.secret = MY_SECRET;
                const res = await fetch(API_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(item) });
                const json = await res.json();
                if (json.status === 'success') successCount++;
                else newQ.push(item);
            } catch (e) { newQ.push(item); }
        }
        localStorage.setItem(this.key, JSON.stringify(newQ));
        this.updateIndicator();
        document.getElementById('loader').classList.add('hidden');
        if (successCount > 0) Swal.fire({icon: 'success', title: `ซิงค์สำเร็จ ${successCount} รายการ`});
        else Swal.fire({icon: 'error', title: 'ซิงค์ไม่สำเร็จ', text: 'กรุณาตรวจสอบอินเทอร์เน็ต'});
    },
    updateIndicator() {
        const count = this.getQueue().length;
        const el = document.getElementById('offline-indicator');
        if (count > 0) { el.classList.remove('hidden'); document.getElementById('offline-count').innerText = count; }
        else { el.classList.add('hidden'); }
    }
};

const api = {
    async post(payload, background = false) {
        if (!background) {
            document.getElementById('loader').classList.remove('hidden');
            document.getElementById('loader').querySelector('p').innerText = "กำลังดำเนินการ...";
        }
        payload.secret = MY_SECRET;
        try {
            const res = await fetch(API_URL, { method: 'POST', headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!background) document.getElementById('loader').classList.add('hidden');
            if (data.status === 'error') throw new Error(data.message);
            return data;
        } catch (e) {
            if (!background) document.getElementById('loader').classList.add('hidden');
            console.warn("API Error / Offline", e);
            if (e.message && e.message.includes('Access Denied')) {
                Swal.fire('ข้อผิดพลาด', 'รหัสความปลอดภัยไม่ถูกต้อง (API Secret Key)', 'error');
                throw e;
            }
            if (payload.action === 'save_transaction' || payload.action === 'upload_pdf') {
                queueManager.addToQueue(payload);
                return { status: 'success', offline: true };
            } else { throw e; }
        }
    }
};

/* ═══════════════════════════════════════════════════════
   APP (unchanged core, + lineShare integration)
═══════════════════════════════════════════════════════ */
const app = {
    data: {
        cart: [],
        products: JSON.parse(localStorage.getItem('pos_products')) || [{id:1, name:'ทุเรียนหมอนทอง', price:150}],
        banks: JSON.parse(localStorage.getItem('pos_banks')) || [],
        reportData: [],
        payMethod: 'เงินสด',
        selectedBank: null,
        invNo: '',
        currentDebtList: []
    },
    init() {
        this.resetForm();
        this.renderProdList();
        this.renderBankList();
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
        document.getElementById('inp-discount').addEventListener('input', () => this.renderCart());
        queueManager.updateIndicator();
    },
    clearDebtForm() {
        document.getElementById('debt-pay-name').value = '';
        document.getElementById('debt-pay-amt').value = '';
        document.getElementById('modal-debt-val').innerText = '0.00';
        document.getElementById('debt-display-area').classList.add('hidden');
        document.getElementById('debt-breakdown').innerHTML = '';
        document.getElementById('debt-breakdown').classList.add('hidden');
    },
    resetForm() {
        this.data.cart = [];
        this.data.payMethod = 'เงินสด';
        this.data.selectedBank = null;
        this.genInv();
        
        // แก้ไขการเซ็ตวันที่ปัจจุบันให้ตรงกับ Local Time เสมอ
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('inv-date').value = localDate;
        
        document.getElementById('cust-name').value = '';
        document.getElementById('inp-discount').value = '';
        this.clearDebtForm();
        const bulkSelect = document.getElementById('bulk-deposit-select');
        if(bulkSelect) bulkSelect.value = '';
        this.addRow();
        this.setPayment('เงินสด', document.querySelector('.payment-option:first-child'));
        // ซ่อนปุ่ม Line Share (ทั้งสองจุด) เมื่อเริ่มบิลใหม่
        document.getElementById('line-share-btn').classList.add('hidden');
        if(document.getElementById('debt-line-share-btn')) {
            document.getElementById('debt-line-share-btn').classList.add('hidden');
        }
    },
    cancelDebtModal() { ui.closeModal('debt-modal'); this.clearDebtForm(); },
    updateTime() {
        const now = new Date();
        document.getElementById('current-datetime').innerText = now.toLocaleDateString('th-TH', {day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit'});
    },
    genInv() {
        const r = Math.floor(1000 + Math.random() * 9000);
        // แก้ไขดึงวันที่สำหรับเลขบิลให้เป็นเวลา Local Time
        const now = new Date();
        const d = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(2,10).replace(/-/g,'');
        this.data.invNo = `INV-${d}-${r}`;
        document.getElementById('inv-no').value = this.data.invNo;
    },
    renderProdList() {
        document.getElementById('prod-list').innerHTML = this.data.products.map(p =>
            `<tr><td class="p-3 font-medium">${p.name}</td><td class="text-right p-3 text-slate-500">${p.price||'-'}</td>
            <td class="text-center text-red-400 hover:text-red-600 cursor-pointer p-3" onclick="app.delProd(${p.id})"><i class="fa-solid fa-trash"></i></td></tr>`
        ).join('');
    },
    addProduct() {
        const n = document.getElementById('new-prod-name').value;
        const p = document.getElementById('new-prod-price').value;
        if(n) {
            this.data.products.push({id:Date.now(), name:n, price:p});
            localStorage.setItem('pos_products', JSON.stringify(this.data.products));
            this.renderProdList(); this.renderCart();
            document.getElementById('new-prod-name').value = '';
            document.getElementById('new-prod-price').value = '';
        }
    },
    delProd(id) {
        this.data.products = this.data.products.filter(p=>p.id!==id);
        localStorage.setItem('pos_products', JSON.stringify(this.data.products));
        this.renderProdList(); this.renderCart();
    },
    renderBankList() {
        document.getElementById('bank-list-manage').innerHTML = this.data.banks.map(b =>
            `<tr><td class="p-2 font-medium">${b.name}</td>
            <td class="text-center text-red-400 hover:text-red-600 cursor-pointer p-2" onclick="app.delBank(${b.id})"><i class="fa-solid fa-trash"></i></td></tr>`
        ).join('');
        const chipsContainer = document.getElementById('bank-list-chips');
        if(this.data.banks.length === 0) {
            chipsContainer.innerHTML = `<div class="text-xs text-slate-400 italic w-full text-center py-2">ยังไม่มีบัญชี (กดจัดการเพื่อเพิ่ม)</div>`;
        } else {
            chipsContainer.innerHTML = this.data.banks.map(b =>
                `<div class="bank-chip px-3 py-1.5 rounded-lg text-xs font-medium ${this.data.selectedBank === b.name ? 'selected' : 'bg-white text-slate-600'}"
                onclick="app.selectBank('${b.name}', this)">
                <i class="fa-solid fa-building-columns mr-1"></i> ${b.name}
                </div>`
            ).join('');
        }
    },
    addBank() {
        const n = document.getElementById('new-bank-name').value.trim();
        if(n) {
            this.data.banks.push({id:Date.now(), name:n});
            localStorage.setItem('pos_banks', JSON.stringify(this.data.banks));
            document.getElementById('new-bank-name').value = '';
            this.renderBankList();
        }
    },
    delBank(id) {
        this.data.banks = this.data.banks.filter(b=>b.id!==id);
        localStorage.setItem('pos_banks', JSON.stringify(this.data.banks));
        if(this.data.selectedBank && !this.data.banks.find(b=>b.name === this.data.selectedBank)) this.data.selectedBank = null;
        this.renderBankList();
    },
    selectBank(name, el) {
        this.data.selectedBank = name;
        document.querySelectorAll('.bank-chip').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    },
    addRow() {
        let newItem = {id:Date.now(), prodId:'', price:0, qty:'', deposit:0, name:''};
        if (this.data.cart.length > 0) {
            const lastItem = this.data.cart[this.data.cart.length - 1];
            if (lastItem.prodId) { newItem.prodId = lastItem.prodId; newItem.name = lastItem.name; newItem.price = lastItem.price; newItem.deposit = lastItem.deposit; }
        }
        this.data.cart.push(newItem);
        this.renderCart();
    },
    updateRow(id, key, val) {
        const item = this.data.cart.find(x=>x.id===id);
        if(!item) return;
        if(key==='prodId') {
            const p = this.data.products.find(x=>x.id==val);
            item.prodId = val; item.name = p?p.name:''; item.price = p?p.price:'';
        } else {
            item[key] = val === "" ? "" : parseFloat(val);
        }
        this.renderCart();
    },
    delRow(id) { this.data.cart = this.data.cart.filter(x=>x.id!==id); this.renderCart(); },
    setAllDeposit(val) {
        if(val === "") return;
        const v = parseFloat(val);
        this.data.cart.forEach(item => item.deposit = v);
        this.renderCart();
        document.getElementById('bulk-deposit-select').value = "";
    },
    renderCart() {
        const tbody = document.getElementById('cart-body');
        tbody.innerHTML = '';
        let sub=0, depTotal=0;
        this.data.cart.forEach(item => {
            const q = item.qty === '' ? 0 : parseFloat(item.qty) || 0;
            const p = item.price === '' ? 0 : parseFloat(item.price) || 0;
            const d = parseFloat(item.deposit) || 0;
            const lineTotal = (p * q) + d;
            sub += (p * q);
            depTotal += d;
            const opts = `<option value="">--เลือก--</option>` + this.data.products.map(p=>`<option value="${p.id}" ${p.id==item.prodId?'selected':''}>${p.name}</option>`).join('');
            const depOpts = [0, 100, 200].map(v => `<option value="${v}" ${v==item.deposit?'selected':''}>${v===0?'ไม่มัดจำ':v}</option>`).join('');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-1"><select class="custom-input w-full p-2.5 border border-gray-200 rounded-lg bg-white text-sm" onchange="app.updateRow(${item.id},'prodId',this.value)">${opts}</select></td>
                <td class="p-1"><input type="number" class="custom-input w-full p-2.5 border border-gray-200 rounded-lg text-right text-sm" placeholder="0" value="${item.price}" onfocus="this.select()" onchange="app.updateRow(${item.id},'price',this.value)"></td>
                <td class="p-1"><input type="number" class="custom-input w-full p-2.5 border border-gray-200 rounded-lg text-center text-sm font-bold text-emerald-600" placeholder="0" value="${item.qty}" onfocus="this.select()" onchange="app.updateRow(${item.id},'qty',this.value)"></td>
                <td class="p-1"><select class="custom-input w-full p-2.5 border border-gray-200 rounded-lg text-center bg-white text-sm text-gray-500" onchange="app.updateRow(${item.id},'deposit',this.value)">${depOpts}</select></td>
                <td class="p-1 text-right font-bold text-gray-700 text-sm py-2">${lineTotal.toLocaleString()}</td>
                <td class="p-1 text-center text-red-400 hover:text-red-600 cursor-pointer" onclick="app.delRow(${item.id})"><i class="fa-solid fa-trash-can"></i></td>
            `;
            tbody.appendChild(tr);
        });
        const disc = parseFloat(document.getElementById('inp-discount').value) || 0;
        const total = sub + depTotal - disc;
        document.getElementById('sum-subtotal').innerText = sub.toLocaleString('th-TH',{minimumFractionDigits:2});
        document.getElementById('sum-deposit').innerText = depTotal.toLocaleString('th-TH',{minimumFractionDigits:2});
        document.getElementById('sum-total').innerText = total.toLocaleString('th-TH',{minimumFractionDigits:2});
    },
    setPayment(m, el) {
        this.data.payMethod = m;
        document.querySelectorAll('.payment-option').forEach(x=>x.classList.remove('active'));
        if(el) el.classList.add('active');
        const bankArea = document.getElementById('bank-selector-area');
        if(m === 'โอน (QR Code)') { bankArea.classList.remove('hidden'); this.renderBankList(); }
        else { bankArea.classList.add('hidden'); this.data.selectedBank = null; }
    },
    async checkDebt() {
        const name = document.getElementById('cust-name').value.trim();
        if(!name) return Swal.fire('แจ้งเตือน', 'กรุณาระบุชื่อลูกค้า', 'warning');
        try {
            const res = await api.post({ action: 'get_debt', name: name });
            if(res.status==='success') Swal.fire(`หนี้คงค้าง: ${res.debt.toLocaleString()} บาท`, name, 'info');
        } catch(e) { Swal.fire('Offline', 'ไม่สามารถเช็คยอดหนี้ได้ขณะออฟไลน์', 'warning'); }
    },
    async checkDebtInModal() {
        const name = document.getElementById('debt-pay-name').value.trim();
        if(!name) return;
        document.getElementById('modal-debt-val').innerText = "...";
        document.getElementById('debt-display-area').classList.remove('hidden');
        const breakdownDiv = document.getElementById('debt-breakdown');
        breakdownDiv.innerHTML = ''; breakdownDiv.classList.add('hidden');
        this.data.currentDebtList = [];
        try {
            const res = await api.post({ action: 'get_report' });
            if(res.status === 'success') {
                const transactions = res.data;
                const custTx = transactions.filter(t => t.customerName === name);
                custTx.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
                
                const debtMap = {};
                const debtBills = [];
                
                // สร้างรายการหนี้ทั้งหมด
                custTx.forEach(x => {
                    if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                        debtMap[x.invoiceId] = x.totalAmount;
                        debtBills.push(x);
                    }
                });

                let generalPool = 0;
                // ประมวลผลเงินที่ชำระเข้ามา
                custTx.forEach(x => {
                    if(x.note === 'ชำระหนี้ค้าง') {
                        let allocatedAmount = 0;
                        // แกะข้อมูลว่าเจาะจงจ่ายบิลไหนบ้าง (อ่านจากที่แอบฝังไว้)
                        const match = x.items.match(/\[(.*?)\]/);
                        if (match) {
                            const allocs = match[1].split(',');
                            allocs.forEach(alloc => {
                                const [inv, amtStr] = alloc.split(':');
                                const amt = parseFloat(amtStr);
                                if (inv && !isNaN(amt) && inv !== 'OVERPAYMENT') {
                                    if (debtMap[inv] !== undefined) {
                                        // เพิ่มการปัดเศษเพื่อแก้ปัญหาเลขทศนิยมผิดเพี้ยน
                                        debtMap[inv] = Math.round((debtMap[inv] - amt) * 100) / 100;
                                        allocatedAmount += amt;
                                    }
                                }
                            });
                        }
                        // เงินที่เหลือจากการจัดสรร หรือยอดจ่ายเกิน ให้นำไปใส่กองกลาง
                        generalPool += (x.totalAmount - allocatedAmount);
                        generalPool = Math.round(generalPool * 100) / 100; // ปัดเศษกองกลาง
                    }
                });

                let totalDebt = 0;
                const outstandingBills = [];
                
                // นำเงินกองกลางไปตัดยอดบิลเก่าที่เหลืออยู่ (FIFO)
                debtBills.forEach(x => {
                    let remain = debtMap[x.invoiceId];
                    if (remain > 0.01 && generalPool > 0.01) { // ใช้ 0.01 เพื่อป้องกันเศษเสี้ยวทศนิยม
                        const deduct = Math.min(remain, generalPool);
                        remain = Math.round((remain - deduct) * 100) / 100;
                        generalPool = Math.round((generalPool - deduct) * 100) / 100;
                        debtMap[x.invoiceId] = remain;
                    }
                    // ถ้ายังมียอดค้าง ให้แสดงในหน้าจอ
                    if (remain > 0.01) {
                        outstandingBills.push({ ...x, remaining: remain });
                        totalDebt += remain;
                    }
                });

                document.getElementById('modal-debt-val').innerText = totalDebt.toLocaleString('th-TH');
                this.data.currentDebtList = outstandingBills;
                if(outstandingBills.length > 0) {
                    breakdownDiv.classList.remove('hidden');
                    // เพิ่มระบบ Checkbox และปุ่มเลือกทั้งหมด
                    let html = `<div class="flex justify-between items-center mb-2">
                                    <p class="font-bold text-slate-500 text-[10px] uppercase">เลือกบิลที่ต้องการชำระ:</p>
                                    <span class="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded cursor-pointer hover:bg-amber-100 font-bold" onclick="app.selectAllDebt()">เลือกทั้งหมด</span>
                                </div>`;
                    html += outstandingBills.map(b => {
                        const bDate = new Date(b.date).toLocaleDateString('th-TH', {day:'numeric', month:'short'});
                        return `<label class="flex justify-between items-center border-b border-red-100 py-2 text-slate-600 text-xs last:border-0 cursor-pointer hover:bg-red-50 rounded px-1 transition-colors">
                            <div class="flex items-center gap-2">
                                <input type="checkbox" class="debt-checkbox w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-500" value="${b.invoiceId}" data-amount="${b.remaining}" onchange="app.calcSelectedDebt()">
                                <span>${bDate} <span class="text-gray-400">(${b.invoiceId})</span></span>
                            </div>
                            <span class="font-bold text-red-500">${b.remaining.toLocaleString()}</span>
                        </label>`;
                    }).join('');
                    breakdownDiv.innerHTML = html;
                }
            }
        } catch(e) { document.getElementById('modal-debt-val').innerText = "0.00"; console.error(e); }
    },
    calcSelectedDebt() {
        const checkboxes = document.querySelectorAll('.debt-checkbox:checked');
        if (checkboxes.length === 0) return; // ถ้าไม่ได้ติ๊กเลย ให้คงตัวเลขเดิมไว้ เผื่อพิมพ์เอง
        let total = 0;
        checkboxes.forEach(cb => total += parseFloat(cb.dataset.amount));
        document.getElementById('debt-pay-amt').value = total;
    },
    selectAllDebt() {
        const checkboxes = document.querySelectorAll('.debt-checkbox');
        // ตรวจสอบว่ามีอันไหนยังไม่ถูกติ๊กไหม ถ้ามีให้ติ๊กให้หมด ถ้าติ๊กหมดแล้วให้เอาออกให้หมด
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        
        if (!allChecked) {
            this.calcSelectedDebt();
        } else {
            document.getElementById('debt-pay-amt').value = '';
        }
    },
    async printDebtInvoice() {
        const list = this.data.currentDebtList;
        const name = document.getElementById('debt-pay-name').value.trim();
        const total = document.getElementById('modal-debt-val').innerText;
        if(!list || list.length === 0) return Swal.fire('ไม่พบยอดค้าง', 'ไม่มีรายการหนี้ให้พิมพ์', 'warning');
        document.getElementById('di-name').innerText = name;
        document.getElementById('di-date').innerText = new Date().toLocaleDateString('th-TH');
        document.getElementById('di-total').innerText = total;
        
        // แปลงวันที่ Local Time สำหรับใบแจ้งหนี้
        document.getElementById('di-body').innerHTML = list.map(item => {
            const [y, m, d] = item.date.split('-');
            const dateObj = new Date(y, m - 1, d);
            return `<tr><td>${dateObj.toLocaleDateString('th-TH')}</td><td>${item.invoiceId}</td><td style="text-align:right">${item.remaining.toLocaleString()}</td></tr>`;
        }).join('');
        
        const el = document.getElementById('debt-invoice-render-area');
        try {
            const canvas = await html2canvas(el, {scale: 2});
            const img = canvas.toDataURL('image/jpeg');
            const pdf = new jspdf.jsPDF({orientation: 'p', unit: 'mm', format: 'a5'});
            const w = pdf.internal.pageSize.getWidth();
            pdf.addImage(img, 'JPEG', 0, 0, w, (canvas.height * w) / canvas.width);
            pdf.save(`DebtNote_${name}.pdf`);
        } catch(e) { Swal.fire('Error', 'ไม่สามารถพิมพ์ได้', 'error'); }
    },
    async submitDebtPayment() {
        const name = document.getElementById('debt-pay-name').value.trim();
        const amtInput = document.getElementById('debt-pay-amt').value;
        const amt = parseFloat(amtInput);
        if(!name || !amt || isNaN(amt)) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุยอดชำระให้ถูกต้อง', 'warning');
        
        // คำนวณว่าชำระบิลไหนไปบ้างตามยอดที่รับมาแบบใหม่
        let remainingPayment = amt;
        const paidBills = [];
        
        // แยกบิลที่ถูกเลือก กับ บิลที่ไม่ได้เลือก ออกจากกัน
        const checkedBoxes = document.querySelectorAll('.debt-checkbox:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
        
        const selectedBills = [];
        const unselectedBills = [];
        
        this.data.currentDebtList.forEach(bill => {
            if (selectedIds.includes(bill.invoiceId)) {
                selectedBills.push(bill);
            } else {
                unselectedBills.push(bill);
            }
        });

        // 1. นำเงินไปตัดบิลที่จิ้มเลือกก่อน
        for (const bill of selectedBills) {
            if (remainingPayment <= 0) break;
            const paidForThisBill = Math.min(remainingPayment, bill.remaining);
            paidBills.push({
                invoiceId: bill.invoiceId,
                date: bill.date,
                paid: paidForThisBill,
                isAutoAllocated: false, // บิลที่จิ้มเลือกเอง
                remainingAfterPay: bill.remaining - paidForThisBill // คำนวณยอดคงเหลือหลังหัก
            });
            remainingPayment -= paidForThisBill;
        }

        // 2. ถ้ายอดเงินยังเหลือ ให้นำส่วนที่เกินมาไปตัดบิลเก่าสุดที่ไม่ได้เลือก
        if (remainingPayment > 0) {
            for (const bill of unselectedBills) {
                if (remainingPayment <= 0) break;
                const paidForThisBill = Math.min(remainingPayment, bill.remaining);
                paidBills.push({
                    invoiceId: bill.invoiceId,
                    date: bill.date,
                    paid: paidForThisBill,
                    isAutoAllocated: selectedIds.length > 0, // ถ้ามีการจิ้มเลือกบิลไปแล้ว แต่เงินเหลือมาตัดบิลนี้ ถือว่าระบบตัดให้อัตโนมัติ
                    remainingAfterPay: bill.remaining - paidForThisBill // คำนวณยอดคงเหลือหลังหัก
                });
                remainingPayment -= paidForThisBill;
            }
        }

        // 3. ถ้าเงินยังเหลืออีก แสดงว่าลูกค้าจ่ายเกินหนี้ค้างทั้งหมดที่มี
        if (remainingPayment > 0) {
            paidBills.push({
                invoiceId: 'OVERPAYMENT',
                date: '',
                paid: remainingPayment
            });
        }
        
        // แก้ไขดึงวันที่บันทึกหนี้ให้เป็นเวลา Local Time
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,10);
        
        // บันทึกการแบ่งยอดเจาะจงบิล (Allocation) ลงในฐานข้อมูลเลย เพื่อให้อ่านค่าได้ตรงเป๊ะในครั้งถัดไป
        let allocationStrs = paidBills.map(b => `${b.invoiceId}:${b.paid}`);
        const itemsStr = `ชำระหนี้ค้าง [${allocationStrs.join(',')}]`;
        
        const payload = { action: 'save_transaction', invoiceId: 'PAY-'+Date.now(), date: localDate, time: now.toLocaleTimeString('th-TH'), customerName: name, items: itemsStr, totalAmount: amt, paymentMethod: 'โอน/เงินสด', note: 'ชำระหนี้ค้าง' };
        const res = await api.post(payload);
        
        if(res.status==='success') {
            ui.closeModal('debt-modal');
            
            // เก็บข้อมูลสำหรับการแชร์ลง Line
            lineShare.storeDebt(payload, paidBills);
            
            Swal.fire({
                icon:'success', 
                title: res.offline ? 'บันทึกออฟไลน์แล้ว' : 'บันทึกสำเร็จ',
                html: `<button onclick="lineShare.openModal(); Swal.close();" style="background:#06C755;color:white;border:none;padding:10px 24px;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;margin:8px auto 0">📱 แชร์ผ่าน Line</button>`,
                showConfirmButton:false, 
                timer: 3000
            });
            this.resetForm();
            // แสดงปุ่ม Line Share ข้างปุ่มรับชำระหนี้ หลังจากชำระสำเร็จ
            document.getElementById('debt-line-share-btn').classList.remove('hidden');
        }
    },
    async loadReport() {
        try {
            const res = await api.post({ action: 'get_report' });
            if(res.status==='success') {
                this.data.reportData = res.data;
                const select = document.getElementById('rpt-bank-filter');
                const staticOpts = '<option value="">-- ทั้งหมด --</option><option value="เงินสด">เงินสด</option><option value="รอชำระ">รอชำระ</option>';
                const historyBanks = new Set();
                this.data.reportData.forEach(d => { const match = d.paymentMethod.match(/โอน\((.*?)\)/); if(match && match[1]) historyBanks.add(match[1]); });
                this.data.banks.forEach(b => historyBanks.add(b.name));
                select.innerHTML = staticOpts + Array.from(historyBanks).sort().map(name => `<option value="${name}">โอน (${name})</option>`).join('');
                this.renderReportTable();
            }
        } catch(e) { Swal.fire('Offline', 'ไม่สามารถดูรายงานได้ขณะออฟไลน์', 'warning'); }
    },
    clearReportFilters() {
        ['rpt-search','rpt-bank-filter','rpt-start-date','rpt-end-date'].forEach(id => document.getElementById(id).value = '');
        this.renderReportTable();
    },
    renderReportTable() {
        const search = document.getElementById('rpt-search').value.toLowerCase();
        const bankFilter = document.getElementById('rpt-bank-filter').value;
        const startDate = document.getElementById('rpt-start-date').value;
        const endDate = document.getElementById('rpt-end-date').value;
        const filtered = this.data.reportData.filter(d => {
            const matchText = (d.customerName||'').toLowerCase().includes(search) || (d.invoiceId||'').toLowerCase().includes(search);
            let matchDate = true;
            if(startDate && d.date < startDate) matchDate = false;
            if(endDate && d.date > endDate) matchDate = false;
            let matchBank = true;
            if(bankFilter) {
                if(bankFilter === 'เงินสด') { if(!d.paymentMethod.includes('เงินสด')) matchBank = false; }
                else if(bankFilter === 'รอชำระ') { if(!d.paymentMethod.includes('รอชำระ')) matchBank = false; }
                else { if(!d.paymentMethod.includes(`โอน(${bankFilter})`)) matchBank = false; }
            }
            return matchText && matchDate && matchBank;
        });
        
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        const todayStr = localNow.toISOString().slice(0, 10);
        const currentMonthPrefix = todayStr.substring(0, 7); // เช่น "2026-03"
        
        // หาขอบเขตวันที่ของสัปดาห์นี้ (จันทร์ - อาทิตย์)
        const dayOfWeek = localNow.getUTCDay(); // 0=Sun, 1=Mon...
        const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(localNow);
        monday.setUTCDate(localNow.getUTCDate() - diffToMon);
        const startOfWeekStr = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        const endOfWeekStr = sunday.toISOString().slice(0, 10);

        let sumMonth=0, sumWeek=0, sumToday=0;
        this.data.reportData.forEach(d => {
            if(d.note === 'ชำระหนี้ค้าง') return;
            
            // ยอดเดือนนี้: เช็คว่าขึ้นต้นด้วย YYYY-MM ตรงกับเดือนปัจจุบัน
            if(d.date.startsWith(currentMonthPrefix)) sumMonth += d.totalAmount;
            
            // ยอดสัปดาห์นี้: เช็คว่าวันที่อยู่ในช่วง จันทร์ - อาทิตย์
            if(d.date >= startOfWeekStr && d.date <= endOfWeekStr) sumWeek += d.totalAmount;
            
            // ยอดวันนี้
            if(d.date === todayStr) sumToday += d.totalAmount;
        });

        const debtMap = {};
        const custGroups = {};
        this.data.reportData.forEach(x => { if(!custGroups[x.customerName]) custGroups[x.customerName] = []; custGroups[x.customerName].push(x); });
        
        Object.values(custGroups).forEach(group => {
            group.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
            
            let generalPool = 0;
            // สร้างแผนที่หนี้ (เก็บยอดหนี้เดิมของแต่ละบิล)
            group.forEach(x => {
                if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                    debtMap[x.invoiceId] = x.totalAmount;
                }
            });

            // ประมวลผลการรับชำระหนี้
            group.forEach(x => {
                if(x.note === 'ชำระหนี้ค้าง') {
                    let allocatedAmount = 0;
                    // ตรวจสอบว่ามีการระบุการตัดยอดเจาะจงบิลหรือไม่
                    const match = x.items.match(/\[(.*?)\]/);
                    if (match) {
                        const allocs = match[1].split(',');
                        allocs.forEach(alloc => {
                            const [inv, amtStr] = alloc.split(':');
                            const amt = parseFloat(amtStr);
                            if (inv && !isNaN(amt) && inv !== 'OVERPAYMENT') {
                                if (debtMap[inv] !== undefined) {
                                    // ปัดเศษเพื่อความแม่นยำทางการเงิน
                                    debtMap[inv] = Math.round((debtMap[inv] - amt) * 100) / 100;
                                    allocatedAmount += amt;
                                }
                            }
                        });
                    }
                    // ยอดที่เหลือจากการจัดสรร (หรือบิลเก่าๆ ที่ไม่ได้ระบุ) ให้นำไปรวมในกองกลาง
                    generalPool += (x.totalAmount - allocatedAmount);
                    generalPool = Math.round(generalPool * 100) / 100;
                }
            });

            // นำเงินในกองกลางไปตัดยอดบิลเก่าสุด (FIFO)
            group.forEach(x => {
                if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                    let remain = debtMap[x.invoiceId];
                    if (remain > 0.01 && generalPool > 0.01) {
                        const deduct = Math.min(remain, generalPool);
                        remain = Math.round((remain - deduct) * 100) / 100;
                        generalPool = Math.round((generalPool - deduct) * 100) / 100;
                        debtMap[x.invoiceId] = remain;
                    }
                }
            });
        });

        let sumFilteredTotal = 0;
        filtered.forEach(d => { if(d.note !== 'ชำระหนี้ค้าง') { if(d.paymentMethod.includes('รอชำระ')) { const remain = debtMap[d.invoiceId]; sumFilteredTotal += (remain !== undefined ? remain : d.totalAmount); } else { sumFilteredTotal += d.totalAmount; } } });
        document.getElementById('rpt-month').innerText = sumMonth.toLocaleString();
        document.getElementById('rpt-week').innerText = sumWeek.toLocaleString();
        document.getElementById('rpt-today').innerText = sumToday.toLocaleString();
        document.getElementById('rpt-filter-total').innerText = sumFilteredTotal.toLocaleString();
        const container = document.getElementById('rpt-container');
        container.innerHTML = '';
        const grouped = filtered.reduce((acc, curr) => {
            // แก้ไขการแสดงวันที่ในรายงานให้อ่านจาก Local Time เสมอ
            const [ry, rm, rd] = curr.date.split('-');
            const date = new Date(ry, rm - 1, rd).toLocaleDateString('th-TH');
            
            if (!acc[date]) acc[date] = { date, total: 0, pending: 0, items: [] };
            if (curr.note !== 'ชำระหนี้ค้าง') { 
                acc[date].total += curr.totalAmount; 
                if(curr.paymentMethod.includes('รอชำระ')) { 
                    const remain = debtMap[curr.invoiceId]; 
                    if (remain !== undefined && remain > 0.01) {
                        acc[date].pending += remain; 
                    }
                } 
            }
            acc[date].items.push(curr);
            return acc;
        }, {});
        Object.values(grouped).forEach(group => {
            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden";
            let rows = group.items.map(d => {
                const isDebtPay = d.note === 'ชำระหนี้ค้าง';
                let actions = isDebtPay ? `<div class="flex gap-2 justify-center"><button onclick="app.prepEdit('${d.invoiceId}', ${d.totalAmount})" class="text-blue-500 hover:text-blue-700 text-xs border border-blue-200 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100">แก้ไข</button><button onclick="app.deleteTx('${d.invoiceId}')" class="text-red-500 hover:text-red-700 text-xs border border-red-200 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100">ลบ</button></div>` : '';
                let badgeClass = 'bg-gray-100 text-gray-600';
                if(d.paymentMethod.includes('เงินสด')) badgeClass = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
                else if(d.paymentMethod.includes('โอน')) badgeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                else if(d.paymentMethod.includes('รอชำระ')) badgeClass = 'bg-amber-100 text-amber-700 border border-amber-200';
                if(d.note === 'ชำระหนี้ค้าง') badgeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                
                let displayStatus = d.note === 'ชำระหนี้ค้าง' ? 'รับชำระหนี้' : d.paymentMethod;
                if(d.paymentMethod.includes('รอชำระ')) {
                    const remain = debtMap[d.invoiceId];
                    if(remain !== undefined && remain > 0.01) {
                        // แสดงข้อความค้างชำระให้ชัดเจน พร้อมพื้นหลังสีแดงเตือน
                        displayStatus = `รอชำระ <span class="text-red-600 font-bold ml-1">(ค้าง ${remain.toLocaleString('th-TH')} ฿)</span>`;
                        badgeClass = 'bg-red-50 text-red-700 border border-red-200';
                    }
                    else if(remain !== undefined && remain <= 0.01) {
                        // ปิดยอดแล้วให้ขึ้นสีเขียวติ๊กถูก
                        displayStatus = `<span class="text-emerald-600 font-bold flex items-center gap-1 justify-center"><i class="fa-solid fa-check-circle"></i> ชำระครบแล้ว</span>`;
                        badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    }
                }
                
                return `<tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0 ${isDebtPay ? 'bg-purple-50/50':''}">
                    <td class="p-4 w-[20%] text-xs font-mono text-gray-400"><div class="font-bold text-gray-600">${d.time}</div>${d.invoiceId}</td>
                    <td class="p-4 w-[25%] font-medium text-gray-700">${d.customerName}</td>
                    <td class="p-4 w-[20%] text-right font-bold text-base ${isDebtPay ? 'text-purple-600':''}">${d.totalAmount.toLocaleString()}</td>
                    <td class="p-4 w-[15%] text-center text-xs"><span class="px-3 py-1.5 rounded-full ${badgeClass} inline-block font-medium shadow-sm">${displayStatus}</span></td>
                    <td class="p-4 w-[20%] text-center">${actions}</td>
                </tr>`;
            }).join('');
            card.innerHTML = `<div class="bg-gradient-to-r from-gray-50 to-white px-5 py-4 border-b border-gray-100 flex justify-between items-center"><span class="font-bold text-gray-700 flex items-center gap-2 text-lg"><i class="fa-regular fa-calendar-check text-emerald-500"></i> ${group.date}</span><div class="text-sm flex gap-4 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm"><span class="font-bold text-gray-500">รอชำระ: <span class="text-amber-600">${group.pending.toLocaleString()}</span></span><div class="w-px h-4 bg-gray-200"></div><span class="font-bold text-emerald-600">ขายรวม: ${group.total.toLocaleString()}</span></div></div><table class="w-full text-sm"><tbody>${rows}</tbody></table>`;
            container.appendChild(card);
        });
    },
    prepEdit(inv, amt) { document.getElementById('edit-inv-id').value = inv; document.getElementById('edit-amt').value = amt; ui.openModal('edit-modal'); },
    async confirmEdit() {
        const inv = document.getElementById('edit-inv-id').value;
        const amt = document.getElementById('edit-amt').value;
        if(!amt) return;
        const res = await api.post({ action: 'edit_transaction', invoiceId: inv, amount: amt });
        if(res.status==='success') { ui.closeModal('edit-modal'); Swal.fire({icon:'success', title:'แก้ไขแล้ว', timer:1500, showConfirmButton:false}); this.loadReport(); }
    },
    async deleteTx(inv) {
        const conf = await Swal.fire({title:'ยืนยันลบ?', icon:'warning', showCancelButton:true, confirmButtonText:'ลบ', confirmButtonColor:'#ef4444'});
        if(conf.isConfirmed) {
            const res = await api.post({ action: 'delete_transaction', invoiceId: inv });
            if(res.status==='success') { Swal.fire('ลบสำเร็จ', '', 'success'); this.loadReport(); }
        }
    },
    async processCheckout() {
        const name = document.getElementById('cust-name').value.trim();
        const total = parseFloat(document.getElementById('sum-total').innerText.replace(/,/g,''));
        if(!name || (this.data.cart.length===0 && total <= 0)) return Swal.fire('ข้อมูลไม่ครบ', '', 'warning');
        let finalPayMethod = this.data.payMethod;
        if (finalPayMethod === 'โอน (QR Code)') {
            if (!this.data.selectedBank) return Swal.fire('กรุณาเลือกบัญชี', 'โปรดเลือกบัญชีธนาคารที่รับเงิน', 'warning');
            finalPayMethod = `โอน(${this.data.selectedBank})`;
        }
        let oldDebt = null;
        try { const r = await api.post({ action: 'get_debt', name: name }); if(r.status==='success') oldDebt = r.debt; } catch(e){}
        const itemsStr = this.data.cart.map(x=>`${x.name} (${x.qty||0}x${x.price})`).join(', ');
        const payload = {
            action: 'save_transaction',
            date: document.getElementById('inv-date').value,
            time: new Date().toLocaleTimeString('th-TH'),
            invoiceId: this.data.invNo,
            customerName: name,
            items: itemsStr,
            totalAmount: total,
            paymentMethod: finalPayMethod,
            note: 'ขายสินค้า'
        };
        const res = await api.post(payload);
        if(res.status==='success') {
            // เก็บข้อมูลสำหรับ Line Share ก่อน reset
            const sub = document.getElementById('sum-subtotal').innerText;
            const dep = document.getElementById('sum-deposit').innerText;
            const disc = document.getElementById('inp-discount').value || '0';
            const cartSnapshot = [...this.data.cart];
            lineShare.store({...payload, paymentMethod: finalPayMethod}, cartSnapshot, sub, dep, disc, total);

            await this.printA5({...payload, paymentMethod: finalPayMethod}, oldDebt);

            // แสดงปุ่ม Line Share หลัง checkout สำเร็จ
            document.getElementById('line-share-btn').classList.remove('hidden');

            Swal.fire({
                icon:'success',
                title: res.offline ? 'บันทึกออฟไลน์แล้ว' : 'บันทึกเรียบร้อย',
                html: `<button onclick="lineShare.openModal(); Swal.close();" style="background:#06C755;color:white;border:none;padding:10px 24px;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:8px;margin:8px auto 0">📱 แชร์ผ่าน Line</button>`,
                showConfirmButton: false,
                timer: 3000
            });

            // Reset form แต่คง line share btn ไว้
            const lineBtn = document.getElementById('line-share-btn');
            this.resetForm();
            lineBtn.classList.remove('hidden'); // คืนหลัง resetForm ซ่อนไป
        }
    },
    async uploadPdf(invId, base64) {
        api.post({ action: 'upload_pdf', fileName: `Receipt_${invId}.pdf`, fileData: base64, mimeType: 'application/pdf' }, true);
    },
    async printA5(data, oldDebt) {
        document.getElementById('r-name').innerText = data.customerName;
        document.getElementById('r-inv').innerText = data.invoiceId;
        
        // แก้ไขวันที่บนใบเสร็จ A5 ให้ตรงกับ Local Time
        const [py, pm, pd] = data.date.split('-');
        document.getElementById('r-date').innerText = new Date(py, pm - 1, pd).toLocaleDateString('th-TH');
        
        document.getElementById('r-time').innerText = data.time;
        document.getElementById('r-pay').innerText = data.paymentMethod;
        document.getElementById('r-body').innerHTML = this.data.cart.map(i => `<tr><td>${i.name}</td><td style="text-align:right">${i.price}</td><td style="text-align:center">${i.qty||0}</td><td style="text-align:right">${(i.price*(i.qty||0)).toLocaleString()}</td></tr>`).join('');
        document.getElementById('r-sub').innerText = document.getElementById('sum-subtotal').innerText;
        document.getElementById('r-dep').innerText = document.getElementById('sum-deposit').innerText;
        document.getElementById('r-disc').innerText = document.getElementById('inp-discount').value || '0.00';
        document.getElementById('r-total').innerText = data.totalAmount.toLocaleString();
        const debtDiv = document.getElementById('r-debt-section');
        if(data.paymentMethod === 'รอชำระ' || (oldDebt !== null && oldDebt > 0)) {
            debtDiv.classList.remove('hidden');
            if (oldDebt === null) { document.getElementById('r-debt-old').innerText = "(ออฟไลน์)"; document.getElementById('r-debt-new').innerText = "(รออัปเดต)"; }
            else { document.getElementById('r-debt-old').innerText = oldDebt.toLocaleString(); let newDebt = oldDebt; if(data.paymentMethod === 'รอชำระ') newDebt += data.totalAmount; document.getElementById('r-debt-new').innerText = newDebt.toLocaleString(); }
        } else { debtDiv.classList.add('hidden'); }
        const el = document.getElementById('receipt-render-area');
        const canvas = await html2canvas(el, {scale:2});
        const img = canvas.toDataURL('image/jpeg');
        const pdf = new jspdf.jsPDF({orientation:'p', unit:'mm', format:'a5'});
        const w = pdf.internal.pageSize.getWidth();
        pdf.addImage(img, 'JPEG', 0, 0, w, (canvas.height * w) / canvas.width);
        pdf.save(`${data.invoiceId}.pdf`);
        this.uploadPdf(data.invoiceId, pdf.output('datauristring').split(',')[1]);
    }
};

const ui = {
    openModal(id) {
        document.getElementById(id).classList.remove('hidden');
        if(id==='product-modal') app.renderProdList();
        if(id==='bank-modal') app.renderBankList();
        if(id==='settings-modal') pinManager._updateSettingsStatus();
    },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); }
};

// ── Keyboard support for PIN screen ──
document.addEventListener('keydown', e => {
    const screen = document.getElementById('pin-screen');
    if(screen.style.display === 'none') return;
    if(e.key >= '0' && e.key <= '9') pinManager.press(e.key);
    else if(e.key === 'Backspace') pinManager.del();
});

// ── Boot ──
pinManager.init();
app.init();
