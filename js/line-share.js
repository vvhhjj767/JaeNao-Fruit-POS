const lineShare = {
    _lastReceipt: null,
    _lastDebtReceipt: null,
    _currentMode: 'sale',

    store(data, cartItems, sub, dep, disc, total) {
        this._currentMode = 'sale';
        this._lastReceipt = { data, cartItems, sub, dep, disc, total };
    },

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
        
        let dateStr = data.date || '';
        try {
            if (dateStr.includes('-')) {
                const [yyyy, mm, dd] = dateStr.split('-');
                const dObj = new Date(yyyy, mm - 1, dd);
                if (!isNaN(dObj)) dateStr = dObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
            }
        } catch(e) {}

        let itemLines = cartItems
            .filter(i => i.name)
            .map(i => {
                const qty = i.qty || 0;
                const price = Number(i.price) || 0;
                return `  • ${i.name} ${qty} x ${price.toLocaleString()}`;
            }).join('\n');

        const numSub = parseFloat(String(sub || '0').replace(/,/g, '')) || 0;
        const numDep = parseFloat(String(dep || '0').replace(/,/g, '')) || 0;
        const numDisc = parseFloat(String(disc || '0').replace(/,/g, '')) || 0;
        const numTotal = Number(total) || 0;

        return `📄 นำส่ง บิลการขาย\n` +
               `━━━━━━━━━━━━━━\n` +
               `เลขที่: ${data.invoiceId}\n` +
               `📅 วันที่: ${dateStr}\n` +
               `👤 ลูกค้า: ${data.customerName}\n` +
               `━━━━━━━━━━━━━━\n` +
               `รายการ:\n${itemLines}\n` +
               `━━━━━━━━━━━━━━\n` +
               `รวมสินค้า:  ${numSub.toLocaleString()} ฿\n` +
               (numDep > 0 ? `บวกมัดจำ:  +${numDep.toLocaleString()} ฿\n` : '') +
               (numDisc > 0 ? `ส่วนลด:    -${numDisc.toLocaleString()} ฿\n` : '') +
               `💰 ยอดสุทธิ: ${numTotal.toLocaleString()} ฿\n` +
               `💳 ชำระโดย: ${data.paymentMethod}\n` +
               `━━━━━━━━━━━━━━\n` +
               `ขอบคุณที่อุดหนุนครับ 🙏`;
    },

    _buildDebtMessage() {
        const r = this._lastDebtReceipt;
        if (!r) return '';
        const { data, paidBills } = r;
        
        let dateStr = data.date || '';
        try {
            if (dateStr.includes('-')) {
                const [yyyy, mm, dd] = dateStr.split('-');
                const dObj = new Date(yyyy, mm - 1, dd);
                if (!isNaN(dObj)) dateStr = dObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
            }
        } catch(e) {}

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
               `📅 วันที่: ${dateStr}\n` +
               `👤 ลูกค้า: ${data.customerName}\n` +
               `━━━━━━━━━━━━━━\n` +
               `นำไปหักยอดบิลดังนี้:\n${billLines}\n` +
               `━━━━━━━━━━━━━━\n` +
               `💰 ยอดรับชำระรวม: ${(Number(data.totalAmount)||0).toLocaleString()} ฿\n` +
               `💳 ชำระผ่าน: ${data.paymentMethod}\n` +
               `━━━━━━━━━━━━━━\n` +
               `ขอบคุณครับ 🙏`;
    },

    openModal() {
        try {
            if (this._currentMode === 'sale' && !this._lastReceipt) {
                Swal.fire('แจ้งเตือน', 'ยังไม่มีข้อมูลบิลล่าสุดให้แชร์', 'warning');
                return;
            }
            if (this._currentMode === 'debt' && !this._lastDebtReceipt) {
                Swal.fire('แจ้งเตือน', 'ยังไม่มีข้อมูลรับชำระหนี้ล่าสุดให้แชร์', 'warning');
                return;
            }
            
            const msg = this.buildMessage();
            document.getElementById('line-message-preview').innerText = msg;
            ui.openModal('line-share-modal');
        } catch (e) {
            console.error("Line Share Error:", e);
            Swal.fire('ข้อผิดพลาด', 'เกิดปัญหาการสร้างข้อความ: ' + e.message, 'error');
        }
    },

    sendLine() {
        try {
            const msg = this.buildMessage();
            const encoded = encodeURIComponent(msg);
            const url = `https://line.me/R/msg/text/?${encoded}`;
            
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            ui.closeModal('line-share-modal');
        } catch(e) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปิดแอป Line ได้', 'error');
        }
    },

    copyText() {
        const msg = this.buildMessage();
        
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
