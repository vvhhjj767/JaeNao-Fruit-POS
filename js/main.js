// js/main.js
const app = {
    // ข้อมูลระบบหลัก
    data: {
        cart: [],
        products: JSON.parse(localStorage.getItem('pos_products')) || [{id:1, name:'ทุเรียนหมอนทอง', price:150}],
        banks: JSON.parse(localStorage.getItem('pos_banks')) || [],
        payMethod: 'เงินสด',
        selectedBank: null,
        invNo: '',
        currentDebtList: [],
        debtPayMethod: 'เงินสด',
        debtSelectedBank: null
    },

    init() {
        this.resetForm();
        this.renderProdList();
        this.loadBanks();
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
        document.getElementById('inp-discount').addEventListener('input', () => this.renderCart());
        if(typeof queueManager !== 'undefined') queueManager.updateIndicator();
    },

    async loadBanks() {
        const cachedBanks = localStorage.getItem('pos_banks');
        if (cachedBanks && JSON.parse(cachedBanks).length > 0) {
            this.data.banks = JSON.parse(cachedBanks);
            this.renderBankList();
            return; 
        }
        try {
            const res = await api.post({ action: 'get_banks' }, true); 
            if (res.status === 'success' && res.data.length > 0) {
                this.data.banks = res.data;
                localStorage.setItem('pos_banks', JSON.stringify(res.data)); 
                this.renderBankList();
            }
        } catch(e) { console.warn("ระบบออฟไลน์ ใช้ข้อมูลเดิมไปก่อน"); }
    },

    async forceLoadBanks(btnEl) {
        const originalText = btnEl.innerHTML;
        btnEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดึง...';
        try {
            const res = await api.post({ action: 'get_banks' }, true);
            if (res.status === 'success') {
                this.data.banks = res.data;
                localStorage.setItem('pos_banks', JSON.stringify(res.data));
                this.renderBankList();
                Swal.fire({icon: 'success', title: 'อัปเดตบัญชีสำเร็จ', timer: 1500, showConfirmButton: false});
            } else { Swal.fire('ไม่พบข้อมูล', 'ไม่พบบัญชีธนาคารใน Google Sheet', 'info'); }
        } catch(e) { Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อดึงข้อมูลได้', 'error'); }
        btnEl.innerHTML = originalText;
    },

    clearDebtForm() {
        document.getElementById('debt-pay-name').value = '';
        document.getElementById('debt-pay-amt').value = '';
        document.getElementById('modal-debt-val').innerText = '0.00';
        document.getElementById('debt-display-area').classList.add('hidden');
        document.getElementById('debt-breakdown').innerHTML = '';
        document.getElementById('debt-breakdown').classList.add('hidden');
        if(typeof this.setDebtPayment === 'function') this.setDebtPayment('เงินสด');
    },

    resetForm() {
        this.data.cart = [];
        this.data.payMethod = 'เงินสด';
        this.data.selectedBank = null;
        this.genInv();
        
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
        const r = Math.floor(10000 + Math.random() * 90000);
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
            `<tr><td class="p-2 font-medium">${b.name} ${b.promptpay ? `<br><span class="text-xs text-gray-500"><i class="fa-solid fa-qrcode"></i> ${b.promptpay}</span>` : ''}</td>
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
        const pp = document.getElementById('new-bank-promptpay').value.trim(); 
        if(n) {
            this.data.banks.push({id:Date.now(), name:n, promptpay: pp}); 
            localStorage.setItem('pos_banks', JSON.stringify(this.data.banks));
            document.getElementById('new-bank-name').value = '';
            document.getElementById('new-bank-promptpay').value = ''; 
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

    setDebtPayment(m) {
        this.data.debtPayMethod = m;
        document.getElementById('debt-pay-cash').classList.toggle('active', m === 'เงินสด');
        document.getElementById('debt-pay-transfer').classList.toggle('active', m === 'โอน');
        const bankArea = document.getElementById('debt-bank-area');
        if (m === 'โอน') {
            bankArea.classList.remove('hidden');
            this.renderDebtBankList();
        } else {
            bankArea.classList.add('hidden');
            this.data.debtSelectedBank = null;
        }
    },

    renderDebtBankList() {
        const container = document.getElementById('debt-bank-chips');
        if (this.data.banks.length === 0) {
            container.innerHTML = '<div class="text-xs text-slate-400 italic w-full py-1">ไม่มีข้อมูลบัญชี</div>';
            return;
        }
        container.innerHTML = this.data.banks.map(b =>
            `<div class="bank-chip px-3 py-1.5 rounded-lg text-xs font-medium ${this.data.debtSelectedBank === b.name ? 'selected' : 'bg-white text-slate-600'}"
            onclick="app.selectDebtBank('${b.name}', this)">
            <i class="fa-solid fa-building-columns mr-1"></i> ${b.name}
            </div>`
        ).join('');
    },

    selectDebtBank(name, el) {
        this.data.debtSelectedBank = name;
        const chips = document.getElementById('debt-bank-chips').querySelectorAll('.bank-chip');
        chips.forEach(c => c.classList.remove('selected'));
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
        } else { item[key] = val === "" ? "" : parseFloat(val); }
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
                
                custTx.forEach(x => {
                    if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                        debtMap[x.invoiceId] = x.totalAmount;
                        debtBills.push(x);
                    }
                });

                let generalPool = 0;
                custTx.forEach(x => {
                    if(x.note === 'ชำระหนี้ค้าง') {
                        let allocatedAmount = 0;
                        const match = x.items.match(/\[(.*?)\]/);
                        if (match) {
                            match[1].split(',').forEach(alloc => {
                                const [inv, amtStr] = alloc.split(':');
                                const amt = parseFloat(amtStr);
                                if (inv && !isNaN(amt) && inv !== 'OVERPAYMENT' && debtMap[inv] !== undefined) {
                                    debtMap[inv] = Math.round((debtMap[inv] - amt) * 100) / 100;
                                    allocatedAmount += amt;
                                }
                            });
                        }
                        generalPool += (x.totalAmount - allocatedAmount);
                        generalPool = Math.round(generalPool * 100) / 100; 
                    }
                });

                let totalDebt = 0;
                const outstandingBills = [];
                
                debtBills.forEach(x => {
                    let remain = debtMap[x.invoiceId];
                    if (remain > 0.01 && generalPool > 0.01) { 
                        const deduct = Math.min(remain, generalPool);
                        remain = Math.round((remain - deduct) * 100) / 100;
                        generalPool = Math.round((generalPool - deduct) * 100) / 100;
                        debtMap[x.invoiceId] = remain;
                    }
                    if (remain > 0.01) {
                        outstandingBills.push({ ...x, remaining: remain });
                        totalDebt += remain;
                    }
                });

                document.getElementById('modal-debt-val').innerText = totalDebt.toLocaleString('th-TH');
                this.data.currentDebtList = outstandingBills;
                if(outstandingBills.length > 0) {
                    breakdownDiv.classList.remove('hidden');
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
        if (checkboxes.length === 0) return; 
        let total = 0;
        checkboxes.forEach(cb => total += parseFloat(cb.dataset.amount));
        document.getElementById('debt-pay-amt').value = total;
    },

    selectAllDebt() {
        const checkboxes = document.querySelectorAll('.debt-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked);
        if (!allChecked) { this.calcSelectedDebt(); } else { document.getElementById('debt-pay-amt').value = ''; }
    },

    async printDebtInvoice() {
        const list = this.data.currentDebtList;
        const name = document.getElementById('debt-pay-name').value.trim();
        const total = document.getElementById('modal-debt-val').innerText;
        if(!list || list.length === 0) return Swal.fire('ไม่พบยอดค้าง', 'ไม่มีรายการหนี้ให้พิมพ์', 'warning');
        document.getElementById('di-name').innerText = name;
        document.getElementById('di-date').innerText = new Date().toLocaleDateString('th-TH');
        document.getElementById('di-total').innerText = total;
        
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
        
        let finalPayMethod = this.data.debtPayMethod;
        if (finalPayMethod === 'โอน') {
            if (!this.data.debtSelectedBank) return Swal.fire('กรุณาเลือกบัญชี', 'โปรดเลือกบัญชีธนาคารที่รับเงิน', 'warning');
            finalPayMethod = `โอน(${this.data.debtSelectedBank})`;
        }
        
        let remainingPayment = amt;
        const paidBills = [];
        
        const checkedBoxes = document.querySelectorAll('.debt-checkbox:checked');
        const selectedIds = Array.from(checkedBoxes).map(cb => cb.value);
        
        const selectedBills = [];
        const unselectedBills = [];
        
        this.data.currentDebtList.forEach(bill => {
            if (selectedIds.includes(bill.invoiceId)) { selectedBills.push(bill); } else { unselectedBills.push(bill); }
        });

        for (const bill of selectedBills) {
            if (remainingPayment <= 0) break;
            const paidForThisBill = Math.min(remainingPayment, bill.remaining);
            paidBills.push({ invoiceId: bill.invoiceId, date: bill.date, paid: paidForThisBill, isAutoAllocated: false, remainingAfterPay: bill.remaining - paidForThisBill });
            remainingPayment -= paidForThisBill;
        }

        if (remainingPayment > 0) {
            for (const bill of unselectedBills) {
                if (remainingPayment <= 0) break;
                const paidForThisBill = Math.min(remainingPayment, bill.remaining);
                paidBills.push({ invoiceId: bill.invoiceId, date: bill.date, paid: paidForThisBill, isAutoAllocated: selectedIds.length > 0, remainingAfterPay: bill.remaining - paidForThisBill });
                remainingPayment -= paidForThisBill;
            }
        }

        if (remainingPayment > 0) { paidBills.push({ invoiceId: 'OVERPAYMENT', date: '', paid: remainingPayment }); }
        
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0,10);
        let allocationStrs = paidBills.map(b => `${b.invoiceId}:${b.paid}`);
        const itemsStr = `ชำระหนี้ค้าง [${allocationStrs.join(',')}]`;
        
        const payload = { action: 'save_transaction', invoiceId: 'PAY-'+Date.now(), date: localDate, time: now.toLocaleTimeString('th-TH'), customerName: name, items: itemsStr, totalAmount: amt, paymentMethod: finalPayMethod, note: 'ชำระหนี้ค้าง' };
        const res = await api.post(payload);
        
        if(res.status==='success') {
            ui.closeModal('debt-modal');
            lineShare.storeDebt(payload, paidBills);
            Swal.fire({
                icon:'success', title: res.offline ? 'บันทึกออฟไลน์แล้ว' : 'บันทึกสำเร็จ',
                html: `<button onclick="lineShare.openModal(); Swal.close();" style="background:#06C755;color:white;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 14px rgba(6,199,85,0.35);margin-top:8px;font-family:'Prompt', sans-serif;">ส่งผ่าน Line</button>`,
                showConfirmButton:false, timer: 3000
            });
            this.resetForm();
            document.getElementById('debt-line-share-btn').classList.remove('hidden');
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
            action: 'save_transaction', date: document.getElementById('inv-date').value, time: new Date().toLocaleTimeString('th-TH'),
            invoiceId: this.data.invNo, customerName: name, items: itemsStr, totalAmount: total, paymentMethod: finalPayMethod, note: 'ขายสินค้า'
        };
        
        const res = await api.post(payload);
        if(res.status==='success') {
            const sub = document.getElementById('sum-subtotal').innerText;
            const dep = document.getElementById('sum-deposit').innerText;
            const disc = document.getElementById('inp-discount').value || '0';
            const cartSnapshot = [...this.data.cart];
            lineShare.store({...payload, paymentMethod: finalPayMethod}, cartSnapshot, sub, dep, disc, total);

            await this.printA5({...payload, paymentMethod: finalPayMethod}, oldDebt);

            Swal.fire({
                icon:'success', title: res.offline ? 'บันทึกออฟไลน์แล้ว' : 'บันทึกเรียบร้อย',
                html: `<button onclick="lineShare.openModal(); Swal.close();" style="background:#06C755;color:white;border:none;border-radius:14px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 14px rgba(6,199,85,0.35);margin-top:8px;font-family:'Prompt', sans-serif;">ส่งผ่าน Line</button>`,
                showConfirmButton: false, timer: 3000
            });
            this.resetForm();
            document.getElementById('line-share-btn').classList.remove('hidden'); 
        }
    },

    async uploadPdf(invId, base64) {
        api.post({ action: 'upload_pdf', fileName: `Receipt_${invId}.pdf`, fileData: base64, mimeType: 'application/pdf' }, true);
    },

    async printA5(data, oldDebt) {
        document.getElementById('r-name').innerText = data.customerName;
        document.getElementById('r-inv').innerText = data.invoiceId;
        
        const [py, pm, pd] = data.date.split('-');
        document.getElementById('r-date').innerText = new Date(py, pm - 1, pd).toLocaleDateString('th-TH');
        
        document.getElementById('r-time').innerText = data.time;
        document.getElementById('r-pay').innerText = data.paymentMethod;
        document.getElementById('r-body').innerHTML = this.data.cart.map(i => `<tr><td>${i.name}</td><td style="text-align:right">${i.price}</td><td style="text-align:center">${i.qty||0}</td><td style="text-align:right">${(i.price*(i.qty||0)).toLocaleString()}</td></tr>`).join('');
        document.getElementById('r-sub').innerText = document.getElementById('sum-subtotal').innerText;
        document.getElementById('r-dep').innerText = document.getElementById('sum-deposit').innerText;
        document.getElementById('r-disc').innerText = document.getElementById('inp-discount').value || '0.00';
        document.getElementById('r-total').innerText = data.totalAmount.toLocaleString();
        
        const qrSection = document.getElementById('r-qr-section');
        if (data.paymentMethod.includes('โอน')) {
            qrSection.classList.remove('hidden');
            let targetPromptPay = SHOP_PROMPTPAY_ID; 
            let bankName = "";
            
            if (this.data.selectedBank && data.paymentMethod.includes(this.data.selectedBank)) { bankName = this.data.selectedBank; } 
            else { const match = data.paymentMethod.match(/โอน\((.*)\)/); if (match && match[1]) bankName = match[1].trim(); }

            if (bankName) {
                const selectedBankObj = this.data.banks.find(b => b.name === bankName);
                if (selectedBankObj && selectedBankObj.promptpay && selectedBankObj.promptpay.toString().trim() !== '') {
                    targetPromptPay = selectedBankObj.promptpay.toString().trim();
                }
            }

            const payload = promptPayHelper.generate(targetPromptPay, data.totalAmount);
            new QRious({ element: document.getElementById('promptpay-qr'), value: payload, size: 85, level: 'M' });
        } else { qrSection.classList.add('hidden'); }

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
