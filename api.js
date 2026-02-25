const API_URL = 'https://script.google.com/macros/s/AKfycbw8JQEp7nV0LS-jy6BFeqq6A3fiw4Imqws6cbih6Vaq1bj66B5XYpnMhCLmfpECvz53/exec'; 
const MY_SECRET = "My_Super_Secret_Password_999"; 

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
            Swal.fire('หน่วยความจำเต็ม', 'กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อซิงค์ข้อมูล', 'error');
        }
    },
    async sync() {
        const q = this.getQueue();
        if (q.length === 0) return;
        document.getElementById('loader').classList.remove('hidden');
        
        let successCount = 0;
        const newQ = [];
        for (const item of q) {
            try {
                item.secret = MY_SECRET;
                const res = await fetch(API_URL, {
                    method: 'POST',
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify(item)
                });
                const json = await res.json();
                if (json.status === 'success') successCount++;
                else newQ.push(item);
            } catch (e) { newQ.push(item); }
        }
        localStorage.setItem(this.key, JSON.stringify(newQ));
        this.updateIndicator();
        document.getElementById('loader').classList.add('hidden');
        Swal.fire({icon: 'success', title: `ซิงค์สำเร็จ ${successCount} รายการ`});
    },
    updateIndicator() {
        const count = this.getQueue().length;
        const el = document.getElementById('offline-indicator');
        if (el) el.classList.toggle('hidden', count === 0);
        if (document.getElementById('offline-count')) document.getElementById('offline-count').innerText = count;
    }
};

const api = {
    async post(payload, background = false) {
        if (!background) document.getElementById('loader').classList.remove('hidden');
        payload.secret = MY_SECRET; 
        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!background) document.getElementById('loader').classList.add('hidden');
            if (data.status === 'error') throw new Error(data.message);
            return data;
        } catch (e) {
            if (!background) document.getElementById('loader').classList.add('hidden');
            if (payload.action === 'save_transaction' || payload.action === 'upload_pdf') {
                queueManager.addToQueue(payload);
                return { status: 'success', offline: true };
            }
            throw e;
        }
    }
};
