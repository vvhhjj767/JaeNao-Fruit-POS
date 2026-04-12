// js/dashboard.js

// 1. เสริมตัวแปร Data สำหรับจัดการรายงานเข้าไปใน app.data เดิม
Object.assign(app.data, {
    reportData: [],
    reportVisibility: { month: false, week: false, today: false, filter: false },
    calculatedTotals: { month: 0, week: 0, today: 0, filter: 0 }
});

// 2. เสริมฟังก์ชันต่างๆ สำหรับรายงานและ Dashboard เข้าไปใน app เดิม
Object.assign(app, {
    dashTrendChartInst: null,
    dashPaymentChartInst: null,
    currentDashFilter: 'month',

    toggleCard(type) {
        this.data.reportVisibility[type] = !this.data.reportVisibility[type];
        const isVisible = this.data.reportVisibility[type];
        const icon = document.getElementById(`icon-${type}`);
        const valEl = document.getElementById(type === 'filter' ? 'rpt-filter-total' : `rpt-${type}`);

        if (icon) icon.className = isVisible ? 'fa-solid fa-eye text-gray-700' : 'fa-solid fa-eye-slash';
        if (valEl) valEl.innerText = isVisible ? this.data.calculatedTotals[type].toLocaleString('th-TH') : '******';
    },

    async loadReport() {
        this.data.reportVisibility = { month: false, week: false, today: false, filter: false };
        ['month', 'week', 'today', 'filter'].forEach(type => {
            const icon = document.getElementById(`icon-${type}`);
            const valEl = document.getElementById(type === 'filter' ? 'rpt-filter-total' : `rpt-${type}`);
            if(icon) icon.className = 'fa-solid fa-eye-slash';
            if(valEl) valEl.innerText = '******';
        });

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
        
        let filtered = this.data.reportData.filter(d => {
            const matchText = (d.customerName||'').toLowerCase().includes(search) || (d.invoiceId||'').toLowerCase().includes(search);
            let matchDate = true;
            if(startDate && d.date < startDate) matchDate = false;
            if(endDate && d.date > endDate) matchDate = false;
            let matchBank = true;
            if(bankFilter) {
                if(bankFilter === 'เงินสด') { if(!d.paymentMethod.includes('เงินสด')) matchBank = false; }
                else if(bankFilter === 'รอชำระ') { if(!d.paymentMethod.includes('รอชำระ') && d.paymentMethod !== 'ชำระแล้ว (C)') matchBank = false; }
                else { if(!d.paymentMethod.includes(`โอน(${bankFilter})`)) matchBank = false; }
            }
            return matchText && matchDate && matchBank;
        });
        
        const now = new Date();
        const localNow = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
        const todayStr = localNow.toISOString().slice(0, 10);
        const currentMonthPrefix = todayStr.substring(0, 7); 
        
        const dayOfWeek = localNow.getUTCDay(); 
        const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(localNow);
        monday.setUTCDate(localNow.getUTCDate() - diffToMon);
        const startOfWeekStr = monday.toISOString().slice(0, 10);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        const endOfWeekStr = sunday.toISOString().slice(0, 10);

        const debtMap = {};
        const custGroups = {};
        this.data.reportData.forEach(x => { if(!custGroups[x.customerName]) custGroups[x.customerName] = []; custGroups[x.customerName].push(x); });
        
        Object.values(custGroups).forEach(group => {
            group.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
            let generalPool = 0;
            group.forEach(x => {
                if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                    debtMap[x.invoiceId] = x.totalAmount;
                }
            });

            group.forEach(x => {
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

        if (bankFilter === 'รอชำระ') {
            filtered = filtered.filter(d => {
                if (d.note === 'ชำระหนี้ค้าง') return false;
                const remain = debtMap[d.invoiceId];
                return remain !== undefined && remain > 0.01;
            });
        }

        let sumMonth=0, sumWeek=0, sumToday=0;
        this.data.reportData.forEach(d => {
            if(d.note === 'ชำระหนี้ค้าง') return;
            if(d.date.startsWith(currentMonthPrefix)) sumMonth += d.totalAmount;
            if(d.date >= startOfWeekStr && d.date <= endOfWeekStr) sumWeek += d.totalAmount;
            if(d.date === todayStr) sumToday += d.totalAmount;
        });

        let sumFilteredTotal = 0;
        filtered.forEach(d => { 
            if(d.note !== 'ชำระหนี้ค้าง') { 
                if(bankFilter === 'รอชำระ') { 
                    const remain = debtMap[d.invoiceId]; 
                    sumFilteredTotal += (remain !== undefined ? remain : d.totalAmount); 
                } else { sumFilteredTotal += d.totalAmount; } 
            } 
        });
        
        this.data.calculatedTotals = { month: sumMonth, week: sumWeek, today: sumToday, filter: sumFilteredTotal };
        const v = this.data.reportVisibility;
        
        document.getElementById('rpt-month').innerText = v.month ? sumMonth.toLocaleString('th-TH') : '******';
        document.getElementById('rpt-week').innerText = v.week ? sumWeek.toLocaleString('th-TH') : '******';
        document.getElementById('rpt-today').innerText = v.today ? sumToday.toLocaleString('th-TH') : '******';
        document.getElementById('rpt-filter-total').innerText = v.filter ? sumFilteredTotal.toLocaleString('th-TH') : '******';
        
        const container = document.getElementById('rpt-container');
        container.innerHTML = '';
        const grouped = filtered.reduce((acc, curr) => {
            const [ry, rm, rd] = curr.date.split('-');
            const date = new Date(ry, rm - 1, rd).toLocaleDateString('th-TH');
            
            if (!acc[date]) acc[date] = { date, total: 0, pending: 0, items: [] };
            if (curr.note !== 'ชำระหนี้ค้าง') { 
                acc[date].total += curr.totalAmount; 
                if(curr.paymentMethod.includes('รอชำระ') || curr.paymentMethod === 'ชำระแล้ว (C)') { 
                    const remain = debtMap[curr.invoiceId]; 
                    if (remain !== undefined && remain > 0.01) { acc[date].pending += remain; }
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
                else if(d.paymentMethod.includes('รอชำระ') || d.paymentMethod === 'ชำระแล้ว (C)') badgeClass = 'bg-amber-100 text-amber-700 border border-amber-200';
                if(d.note === 'ชำระหนี้ค้าง') badgeClass = 'bg-purple-100 text-purple-700 border border-purple-200';
                
                let displayStatus = d.note === 'ชำระหนี้ค้าง' ? 'รับชำระหนี้' : d.paymentMethod;
                if(d.paymentMethod.includes('รอชำระ') || d.paymentMethod === 'ชำระแล้ว (C)') {
                    const remain = debtMap[d.invoiceId];
                    if(remain !== undefined && remain > 0.01) {
                        displayStatus = `<span class="block leading-tight mb-0.5">รอชำระ</span><span class="block text-red-600 font-bold">(${remain.toLocaleString('th-TH')})</span>`;
                        badgeClass = 'bg-red-50 text-red-700 border border-red-200';
                    }
                    else if(remain !== undefined && remain <= 0.01) {
                        displayStatus = `<span class="text-emerald-600 font-bold flex items-center gap-1 justify-center"><i class="fa-solid fa-check-circle"></i> ชำระครบแล้ว</span>`;
                        badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-100';
                    }
                }
                
                return `<tr class="hover:bg-gray-50 border-b border-gray-100 last:border-0 ${isDebtPay ? 'bg-purple-50/50':''}">
                    <td class="p-4 w-[20%] text-xs font-mono text-gray-400"><div class="font-bold text-gray-600">${d.time}</div>${d.invoiceId}</td>
                    <td class="p-4 w-[25%] font-medium text-gray-700">${d.customerName}</td>
                    <td class="p-4 w-[20%] text-right font-bold text-base ${isDebtPay ? 'text-purple-600':''}">${d.totalAmount.toLocaleString()}</td>
                    <td class="p-4 w-[15%] text-center text-xs"><span class="px-3 py-1.5 rounded-xl ${badgeClass} inline-block font-medium shadow-sm">${displayStatus}</span></td>
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

    /* ---- DASHBOARD LOGIC ---- */
    async openDashboard() {
        if (this.data.reportData.length === 0) await this.loadReport(); 
        const custList = document.getElementById('dash-customer-list');
        const uniqueCusts = [...new Set(this.data.reportData.map(d => d.customerName).filter(Boolean))].sort();
        custList.innerHTML = uniqueCusts.map(c => `<option value="${c}">`).join('');
        document.getElementById('dash-customer-filter').value = ''; 
        ui.openModal('analysis-modal');
        this.setDashFilter('month'); 
    },

    setDashFilter(filterType) {
        this.currentDashFilter = filterType;
        document.querySelectorAll('.dash-btn-filter').forEach(btn => btn.className = 'dash-btn-filter px-3 py-1.5 rounded-full border bg-gray-50 text-gray-600 hover:bg-indigo-50 font-medium transition-colors');
        const activeBtn = document.getElementById(`btn-dash-${filterType}`);
        if(activeBtn) activeBtn.className = 'dash-btn-filter px-3 py-1.5 rounded-full border bg-indigo-50 text-indigo-600 border-indigo-200 font-bold shadow-sm transition-colors';

        const localNow = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
        let startDate = '';
        let endDate = localNow.toISOString().slice(0, 10);

        if (filterType === 'today') startDate = endDate;
        else if (filterType === 'week') { const p = new Date(localNow); p.setDate(localNow.getDate() - 6); startDate = p.toISOString().slice(0, 10); } 
        else if (filterType === 'month') startDate = endDate.slice(0, 7) + '-01';
        else if (filterType === 'year') startDate = endDate.slice(0, 4) + '-01-01';
        else if (filterType === 'custom') { startDate = document.getElementById('dash-start-date').value; endDate = document.getElementById('dash-end-date').value || '9999-12-31'; }

        if (filterType !== 'custom') { document.getElementById('dash-start-date').value = startDate; document.getElementById('dash-end-date').value = endDate; }
        this.renderDashboardFromFilter();
    },

    renderDashboardFromFilter() {
        const sDate = document.getElementById('dash-start-date').value;
        const eDate = document.getElementById('dash-end-date').value || '9999-12-31';
        const custFilter = document.getElementById('dash-customer-filter').value;
        this.renderDashboard(sDate, eDate, custFilter);
    },

    extractVolume(itemsStr) {
        let vol = 0; if(!itemsStr) return vol;
        const regex = /\(([\d.]+)\s*x\s*[\d.]+\)/g; let match;
        while ((match = regex.exec(itemsStr)) !== null) { vol += parseFloat(match[1]) || 0; }
        return vol;
    },

    getPrevPeriodDates(filterType, startStr, endStr) {
        if(!startStr || !endStr) return { pStart: '', pEnd: '' };
        const s = new Date(startStr), e = new Date(endStr);
        let ps = new Date(s), pe = new Date(e);

        if(filterType === 'today') { ps.setDate(s.getDate() - 1); pe.setDate(e.getDate() - 1); } 
        else if(filterType === 'week') { ps.setDate(s.getDate() - 7); pe.setDate(e.getDate() - 7); } 
        else if(filterType === 'month') { ps.setMonth(s.getMonth() - 1); pe = new Date(s.getFullYear(), s.getMonth(), 0); } 
        else if(filterType === 'year') { ps.setFullYear(s.getFullYear() - 1); pe.setFullYear(e.getFullYear() - 1); } 
        else { const diffTime = Math.abs(e - s); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); pe = new Date(s); pe.setDate(s.getDate() - 1); ps = new Date(pe); ps.setDate(pe.getDate() - diffDays); }
        return { pStart: ps.toISOString().slice(0,10), pEnd: pe.toISOString().slice(0,10) };
    },

    getGlobalDebtMap(customerFilter) {
        const debtMap = {}; const custGroups = {};
        let targetData = customerFilter ? this.data.reportData.filter(d => d.customerName === customerFilter) : this.data.reportData;
        targetData.forEach(x => { if(!custGroups[x.customerName]) custGroups[x.customerName] = []; custGroups[x.customerName].push(x); });
        
        Object.values(custGroups).forEach(group => {
            group.sort((a,b) => (a.date + a.time).localeCompare(b.date + b.time));
            let generalPool = 0;
            group.forEach(x => { if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) debtMap[x.invoiceId] = { name: x.customerName, remain: x.totalAmount, date: x.date }; });
            group.forEach(x => {
                if(x.note === 'ชำระหนี้ค้าง') {
                    let allocatedAmount = 0; const match = x.items.match(/\[(.*?)\]/);
                    if (match) {
                        match[1].split(',').forEach(alloc => {
                            const [inv, amtStr] = alloc.split(':'); const amt = parseFloat(amtStr);
                            if (inv && !isNaN(amt) && inv !== 'OVERPAYMENT' && debtMap[inv]) { debtMap[inv].remain = Math.round((debtMap[inv].remain - amt) * 100) / 100; allocatedAmount += amt; }
                        });
                    }
                    generalPool += (x.totalAmount - allocatedAmount); generalPool = Math.round(generalPool * 100) / 100;
                }
            });
            group.forEach(x => {
                if(x.note !== 'ชำระหนี้ค้าง' && (x.paymentMethod.includes('รอชำระ') || x.paymentMethod === 'ชำระแล้ว (C)')) {
                    if (debtMap[x.invoiceId] && debtMap[x.invoiceId].remain > 0.01 && generalPool > 0.01) {
                        const deduct = Math.min(debtMap[x.invoiceId].remain, generalPool);
                        debtMap[x.invoiceId].remain = Math.round((debtMap[x.invoiceId].remain - deduct) * 100) / 100; generalPool = Math.round((generalPool - deduct) * 100) / 100;
                    }
                }
            });
        });
        return debtMap;
    },
calcPeriodStats(data, start, end, customerFilter) {
        let rev = 0, vol = 0, cashCollected = 0, cashSales = 0, cashDebt = 0;
        const trendMap = {}, custStats = {}, debtPaidByCust = {}; 
        let minPrice = Infinity, maxPrice = -Infinity;

        const filtered = data.filter(d => {
            if (start && d.date < start) return false;
            if (end && d.date > end) return false;
            if (customerFilter && d.customerName !== customerFilter) return false;
            return true;
        });

        // ---------------------------------------------------------
        // ส่วนที่เพิ่มใหม่: เติมวันที่ให้เต็มโครงสร้างเพื่อให้กราฟแสดงวันแบบต่อเนื่อง (แม้ไม่มีข้อมูล)
        let effStart = start;
        let localNow = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
        let effEnd = (end === '9999-12-31' || !end) ? localNow : end;
        if (!effStart && data.length > 0) effStart = data.reduce((m, d) => d.date < m ? d.date : m, data[0].date);

        if (effStart && effEnd) {
            let [sY, sM, sD] = effStart.split('-');
            let curr = new Date(sY, sM - 1, sD);
            let [eY, eM, eD] = effEnd.split('-');
            let last = new Date(eY, eM - 1, eD);
            
            while (curr <= last) {
                const dStr = curr.getFullYear() + '-' + String(curr.getMonth() + 1).padStart(2, '0') + '-' + String(curr.getDate()).padStart(2, '0');
                trendMap[dStr] = { rev: 0, vol: 0 };
                curr.setDate(curr.getDate() + 1);
            }
        }
        // ---------------------------------------------------------

        filtered.forEach(d => {
            if (!trendMap[d.date]) trendMap[d.date] = { rev: 0, vol: 0 };
            if (d.note === 'ชำระหนี้ค้าง') {
                cashCollected += d.totalAmount; cashDebt += d.totalAmount;
                if(!debtPaidByCust[d.customerName]) debtPaidByCust[d.customerName] = 0;
                debtPaidByCust[d.customerName] += d.totalAmount;
            } else {
                rev += d.totalAmount; const v = this.extractVolume(d.items); vol += v;
                trendMap[d.date].rev += d.totalAmount; trendMap[d.date].vol += v;

                if (d.paymentMethod.includes('เงินสด') || d.paymentMethod.includes('โอน')) { cashCollected += d.totalAmount; cashSales += d.totalAmount; }
                if (v > 0) { const price = d.totalAmount / v; if(price < minPrice) minPrice = price; if(price > maxPrice) maxPrice = price; }

                if(!custStats[d.customerName]) custStats[d.customerName] = { rev: 0, vol: 0, cashAmt: 0, creditAmt: 0 };
                custStats[d.customerName].rev += d.totalAmount; custStats[d.customerName].vol += v;
                if (d.paymentMethod.includes('เงินสด') || d.paymentMethod.includes('โอน')) custStats[d.customerName].cashAmt += d.totalAmount;
                if (d.paymentMethod.includes('รอชำระ')) custStats[d.customerName].creditAmt += d.totalAmount;
            }
        });
        if(minPrice === Infinity) { minPrice = 0; maxPrice = 0; }
        return { rev, vol, cashCollected, cashSales, cashDebt, minPrice, maxPrice, trendMap, custStats, debtPaidByCust, filtered };
    },

    renderDashboard(startDate, endDate, customerFilter = '') {
        const cur = this.calcPeriodStats(this.data.reportData, startDate, endDate, customerFilter);
        const avgPrice = cur.vol > 0 ? (cur.rev / cur.vol) : 0;
        const prevDates = this.getPrevPeriodDates(this.currentDashFilter, startDate, endDate);
        const prev = this.calcPeriodStats(this.data.reportData, prevDates.pStart, prevDates.pEnd, customerFilter);

        const calcTrend = (c, p) => {
            if(p === 0) return c > 0 ? { val: '+100', class: 'trend-up', icon: '▲' } : { val: '-', class: 'trend-flat', icon: '-' };
            const diff = ((c - p) / p) * 100;
            if(diff > 0) return { val: '+' + diff.toFixed(1), class: 'trend-up', icon: '▲' };
            if(diff < 0) return { val: diff.toFixed(1), class: 'trend-down', icon: '▼' };
            return { val: '0', class: 'trend-flat', icon: '-' };
        };

        const tRev = calcTrend(cur.rev, prev.rev), tVol = calcTrend(cur.vol, prev.vol), tCash = calcTrend(cur.cashCollected, prev.cashCollected);

        document.getElementById('dash-kpi-revenue').innerText = cur.rev.toLocaleString('th-TH', {maximumFractionDigits:0});
        document.getElementById('dash-trend-rev').innerHTML = `${tRev.icon} ${tRev.val}%`; document.getElementById('dash-trend-rev').className = `text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tRev.class}`;
        document.getElementById('dash-kpi-volume').innerText = cur.vol.toLocaleString('th-TH', {maximumFractionDigits:1});
        document.getElementById('dash-trend-vol').innerHTML = `${tVol.icon} ${tVol.val}%`; document.getElementById('dash-trend-vol').className = `text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tVol.class}`;
        document.getElementById('dash-kpi-avgprice').innerText = avgPrice.toLocaleString('th-TH', {maximumFractionDigits:2});
        document.getElementById('dash-min-price').innerText = cur.minPrice.toLocaleString('th-TH', {maximumFractionDigits:0});
        document.getElementById('dash-max-price').innerText = cur.maxPrice.toLocaleString('th-TH', {maximumFractionDigits:0});
        document.getElementById('dash-kpi-cash').innerText = cur.cashCollected.toLocaleString('th-TH', {maximumFractionDigits:0});
        document.getElementById('dash-trend-cash').innerHTML = `${tCash.icon} ${tCash.val}%`; document.getElementById('dash-trend-cash').className = `text-[10px] font-bold px-1.5 py-0.5 rounded-md ${tCash.class}`;
        document.getElementById('dash-cash-sales').innerText = cur.cashSales.toLocaleString('th-TH', {maximumFractionDigits:0});
        document.getElementById('dash-cash-debt').innerText = cur.cashDebt.toLocaleString('th-TH', {maximumFractionDigits:0});

        const debtMap = this.getGlobalDebtMap(customerFilter);
        let totalGlobalDebt = 0; const debtorBalances = {};
        Object.values(debtMap).forEach(d => {
            // ถ้ายอดค้างในบิลนั้นมากกว่า 0 ให้บวกยอดรวมและนับจำนวนบิล
            if (d.remain > 0.01) {
                totalGlobalDebt += d.remain;
                
                // สร้าง billCount เพื่อนับจำนวนบิลค้าง
                if(!debtorBalances[d.name]) debtorBalances[d.name] = { total: 0, oldestDate: d.date, billCount: 0 };
                
                debtorBalances[d.name].total += d.remain;
                debtorBalances[d.name].billCount += 1; // บวกจำนวนบิลเพิ่ม 1 เสมอที่เจอค้าง
                
                if(d.date < debtorBalances[d.name].oldestDate) debtorBalances[d.name].oldestDate = d.date;
            }
        });
        document.getElementById('dash-kpi-debt').innerText = totalGlobalDebt.toLocaleString('th-TH', {maximumFractionDigits:0});

        // --- เริ่มโค้ดส่วน Top 10 ลูกค้า ---
        const topCustomers = Object.entries(cur.custStats)
            .map(([name, stat]) => ({ name, ...stat }))
            .sort((a, b) => b.rev - a.rev) // เรียงลำดับยอดขาย (Revenue) จากมากไปน้อย
            .slice(0, 10); // เอาแค่ 10 อันดับแรก

        document.getElementById('dash-top-customers').innerHTML = topCustomers.length ? topCustomers.map(c => {
            // คำนวณป้ายกำกับวิธีจ่ายเงิน
            let payBadge = '';
            if (c.creditAmt > 0 && c.cashAmt === 0) {
                payBadge = '<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[10px] font-bold">เครดิต</span>';
            } else if (c.creditAmt > 0 && c.cashAmt > 0) {
                payBadge = '<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">ผสม</span>';
            } else {
                payBadge = '<span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[10px] font-bold">เงินสด/โอน</span>';
            }

            return `<tr class="hover:bg-gray-50 transition-colors">
                <td class="px-3 py-2 font-medium text-gray-700">${c.name || 'ไม่ระบุชื่อ'}</td>
                <td class="px-3 py-2 text-right font-bold text-indigo-600">${c.rev.toLocaleString('th-TH', {maximumFractionDigits: 0})}</td>
                <td class="px-3 py-2 text-center text-gray-600">${c.vol.toLocaleString('th-TH', {maximumFractionDigits: 1})}</td>
                <td class="px-3 py-2 text-center">${payBadge}</td>
            </tr>`;
        }).join('') : `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">ไม่มีข้อมูลการซื้อขายในช่วงเวลานี้</td></tr>`;
        // --- จบโค้ดส่วน Top 10 ลูกค้า ---

        const todayObj = new Date();
        // ดึงตัวแปร billCount ออกมาใช้
        const topDebtors = Object.entries(debtorBalances).map(([name, data]) => ({ name, amt: data.total, date: data.oldestDate, billCount: data.billCount })).sort((a,b) => b.amt - a.amt).slice(0, 10);
            
        document.getElementById('dash-top-debtors').innerHTML = topDebtors.length ? topDebtors.map(d => {
            const [y, m, day] = d.date.split('-'); const bDate = new Date(y, m - 1, day);
            const diffDays = Math.floor((todayObj.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
            let daysHtml = diffDays > 7 ? `<span class="bg-red-100 text-red-700 px-2 py-1 rounded font-bold">${diffDays} วัน</span>` : (diffDays > 0 ? `<span class="bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold">${diffDays} วัน</span>` : `<span class="text-gray-500 font-medium">วันนี้</span>`);
            
            // แสดงป้ายบอกจำนวนบิลค้างสีน้ำเงินดูง่ายๆ
            const billCountHtml = `<span class="bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-lg text-xs font-bold">${d.billCount} บิล</span>`;
            
            return `<tr class="hover:bg-red-50/50"><td class="px-3 py-2 font-medium text-gray-700">${d.name}</td><td class="px-3 py-2 text-right font-bold text-red-500">${d.amt.toLocaleString()}</td><td class="px-3 py-2 text-center">${billCountHtml}</td><td class="px-3 py-2 text-center text-xs">${daysHtml}</td></tr>`;
        }).join('') : `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 italic">ไม่มียอดหนี้ค้างชำระ</td></tr>`;
        let payCash = 0, payTransfer = 0, payCredit = 0;
        cur.filtered.forEach(d => {
            if(d.note === 'ชำระหนี้ค้าง') {
                if(d.paymentMethod.includes('เงินสด')) payCash += d.totalAmount; else if(d.paymentMethod.includes('โอน')) payTransfer += d.totalAmount;
            } else {
                if(d.paymentMethod.includes('เงินสด')) payCash += d.totalAmount; else if(d.paymentMethod.includes('โอน')) payTransfer += d.totalAmount;
                else if(d.paymentMethod.includes('รอชำระ') || d.paymentMethod === 'ชำระแล้ว (C)') { const remain = debtMap[d.invoiceId] ? debtMap[d.invoiceId].remain : 0; payCredit += remain; }
            }
        });

        const bankStats = {};
        cur.filtered.forEach(d => {
            if (d.paymentMethod && d.paymentMethod.includes('โอน')) {
                let bankName = 'ไม่ระบุบัญชี';
                const match = d.paymentMethod.match(/โอน\((.*?)\)/);
                if (match && match[1]) bankName = match[1].trim(); else if (d.paymentMethod === 'โอน (QR Code)') bankName = 'โอน (QR Code)'; 
                if (!bankStats[bankName]) bankStats[bankName] = { count: 0, amount: 0 };
                bankStats[bankName].count += 1; bankStats[bankName].amount += d.totalAmount;
            }
        });

        const bankList = Object.entries(bankStats).map(([name, data]) => ({ name, count: data.count, amount: data.amount })).sort((a, b) => b.amount - a.amount);
        document.getElementById('dash-bank-transfers').innerHTML = bankList.length ? bankList.map(b => {
            let level1 = 0; if (b.count >= 2930) level1 = 2; else if (b.count >= 2900) level1 = 1; 
            let level2 = 0; if (b.count >= 380 && b.amount >= 1900000) level2 = 2; else if (b.count >= 360 && b.amount >= 1800000) level2 = 1; 
            let finalLevel = Math.max(level1, level2);
            
            let rowClass = "hover:bg-blue-50/50", iconClass = "text-blue-300", textClassCount = "text-gray-600", textClassAmount = "text-blue-600", alertHtml = "";

            if (finalLevel === 2) {
                rowClass = "bg-red-50 hover:bg-red-100 border-l-4 border-red-500"; iconClass = "text-red-500 animate-pulse"; textClassCount = "text-red-600"; textClassAmount = "text-red-600";
                let tooltipMsg = level1 === 2 ? "อันตราย! รับโอนทะลุ 2,930 ครั้งแล้ว (ใกล้ 3,000 ครั้ง)" : "อันตราย! รับโอนทะลุ 380 ครั้ง และยอดเกิน 1.9 ล้านบาท";
                alertHtml = `<div class="mt-1"><span class="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm animate-pulse cursor-help" title="${tooltipMsg}"><i class="fa-solid fa-triangle-exclamation"></i> เสี่ยงสูงมาก (เตรียมสลับบัญชี)</span></div>`;
            } else if (finalLevel === 1) {
                rowClass = "bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400"; iconClass = "text-orange-400"; textClassCount = "text-orange-600"; textClassAmount = "text-orange-600";
                let tooltipMsg = level1 === 1 ? "เฝ้าระวัง! รับโอนทะลุ 2,900 ครั้งแล้ว" : "เฝ้าระวัง! รับโอนทะลุ 360 ครั้ง และยอดเกิน 1.8 ล้านบาท";
                alertHtml = `<div class="mt-1"><span class="bg-orange-400 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm cursor-help" title="${tooltipMsg}"><i class="fa-solid fa-circle-exclamation"></i> เฝ้าระวัง</span></div>`;
            }

            return `<tr class="${rowClass} transition-colors"><td class="px-3 py-3 font-medium ${finalLevel > 0 ? 'text-gray-800' : 'text-gray-700'}"><div class="flex items-start"><i class="fa-solid fa-building-columns ${iconClass} mr-2 mt-1"></i><div>${b.name}${alertHtml}</div></div></td><td class="px-3 py-3 text-center ${textClassCount} font-bold">${b.count.toLocaleString()}</td><td class="px-3 py-3 text-right font-bold ${textClassAmount}">${b.amount.toLocaleString('th-TH')}</td></tr>`;
        }).join('') : `<tr><td colspan="3" class="px-3 py-4 text-center text-gray-400 italic">ไม่มีรายการโอนเงินในรอบเวลานี้</td></tr>`;

        this.renderDashCharts(cur.trendMap, payCash, payTransfer, payCredit);
    },

   renderDashCharts(trendMap, cash, transfer, credit) {
        const dates = Object.keys(trendMap).sort();
        const thDates = dates.map(d => { const [y,m,day] = d.split('-'); return `${day}/${m}`; });
        const revData = dates.map(d => trendMap[d].rev);
        const volData = dates.map(d => trendMap[d].vol);

        const ctxTrend = document.getElementById('dashTrendChart').getContext('2d');
        if(this.dashTrendChartInst) this.dashTrendChartInst.destroy();
        
        // ไล่สี Gradient สำหรับ ยอดขาย (สีเขียว)
        const gradientRev = ctxTrend.createLinearGradient(0, 0, 0, 400);
        gradientRev.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradientRev.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        // ไล่สี Gradient สำหรับ ปริมาณ (สีม่วง)
        const gradientVol = ctxTrend.createLinearGradient(0, 0, 0, 400);
        gradientVol.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
        gradientVol.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

        this.dashTrendChartInst = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: thDates,
                datasets: [
                    { 
                        label: 'ยอดขาย (บาท)', 
                        data: revData, 
                        borderColor: '#10b981', 
                        backgroundColor: gradientRev, 
                        borderWidth: 3, 
                        pointRadius: 0, // ซ่อนจุดแบบถาวร (ให้ดูคลีน)
                        pointHoverRadius: 6, // แสดงจุดเฉพาะตอนเอาเมาส์ชี้
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#10b981',
                        pointBorderWidth: 2,
                        yAxisID: 'y', 
                        fill: true, 
                        tension: 0.4,
                        hidden: false // แสดงเป็นค่าเริ่มต้น
                    },
                    { 
                        label: 'ปริมาณ (หน่วย)', 
                        data: volData, 
                        borderColor: '#6366f1', 
                        backgroundColor: gradientVol, 
                        borderWidth: 3, 
                        pointRadius: 0, // ซ่อนจุดแบบถาวร
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#6366f1',
                        pointBorderWidth: 2,
                        yAxisID: 'y', // ใช้แกน Y เดียวกันไปเลย เพราะเราสลับดูทีละกราฟ
                        fill: true, // เลิกใช้เส้นประ เปลี่ยนเป็นกราฟพื้นที่ทึบเรียบๆ
                        tension: 0.4,
                        hidden: true // ซ่อนไว้ก่อนเป็นค่าเริ่มต้น
                    }
                ]
            },
            options: {
                responsive: true, 
                maintainAspectRatio: false, 
                interaction: { mode: 'index', intersect: false },
                plugins: { 
                    legend: { 
                        position: 'top', 
                        labels: { usePointStyle: true, boxWidth: 10, font: { family: "'Prompt', sans-serif", size: 12, weight: 'bold' }, color: '#4b5563' },
                        onClick: function(e, legendItem, legend) {
                            // โค้ดส่วนนี้ทำหน้าที่สลับกราฟ (Exclusive Toggle)
                            // คลิกอันไหน จะโชว์แค่อันนั้น และซ่อนอีกอันอัตโนมัติ
                            const index = legendItem.datasetIndex;
                            const ci = legend.chart;
                            
                            ci.data.datasets.forEach((ds, i) => {
                                ds.hidden = (i !== index);
                            });
                            ci.update();
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1f2937',
                        bodyColor: '#4b5563',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true,
                        titleFont: { family: "'Prompt', sans-serif", size: 13, weight: 'bold' },
                        bodyFont: { family: "'Prompt', sans-serif", size: 12 },
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) { label += ': '; }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('th-TH').format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        ticks: { 
                            font: { family: "'Prompt', sans-serif", size: 10 }, 
                            color: '#9ca3af',
                            maxRotation: 45,
                            maxTicksLimit: 15 // ไม่ให้แกน X เบียดกันเกินไปถ้าเลือกดูหลายวัน
                        }, 
                        grid: { display: false } 
                    },
                    y: { 
                        type: 'linear', display: true, position: 'left', 
                        ticks: { font: { family: "'Prompt', sans-serif", size: 10 }, color: '#9ca3af' },
                        grid: { color: '#f3f4f6', drawBorder: false }
                    }
                }
            }
        });

        const ctxPay = document.getElementById('dashPaymentChart').getContext('2d');
        if(this.dashPaymentChartInst) this.dashPaymentChartInst.destroy();

        if (cash === 0 && transfer === 0 && credit === 0) {
            this.dashPaymentChartInst = new Chart(ctxPay, { type: 'doughnut', data: { labels: ['ไม่มีข้อมูล'], datasets: [{ data: [1], backgroundColor: ['#f3f4f6'] }] }, options: { plugins: { legend: { display: false }, tooltip: { enabled: false } } }});
            return;
        }

        this.dashPaymentChartInst = new Chart(ctxPay, {
            type: 'doughnut',
            data: {
                labels: ['เงินสด', 'โอนเงิน', 'เครดิต (แปะโป้ง)'],
                datasets: [{ data: [cash, transfer, credit], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'], borderWidth: 2, borderColor: '#ffffff' }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: "'Prompt', sans-serif", size: 11 } } },
                    tooltip: { callbacks: { label: function(context) { let label = context.label || ''; if (label) { label += ': '; } if (context.parsed !== null) { label += new Intl.NumberFormat('th-TH').format(context.parsed) + ' ฿'; } return label; }}}
                }
            }
        });
    }
});
