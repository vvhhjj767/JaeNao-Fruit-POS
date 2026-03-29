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
