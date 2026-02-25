const app = {
    data: {
        cart: [],
        products: JSON.parse(localStorage.getItem('pos_products')) || [{id:1, name:'ทุเรียนหมอนทอง', price:150}],
        banks: JSON.parse(localStorage.getItem('pos_banks')) || [],
        payMethod: 'เงินสด',
        selectedBank: null,
        invNo: ''
    },
    init() {
        this.resetForm();
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
        document.getElementById('inp-discount').addEventListener('input', () => this.renderCart());
        queueManager.updateIndicator();
    },
    resetForm() {
        this.data.cart = [];
        this.genInv();
        document.getElementById('inv-date').valueAsDate = new Date();
        document.getElementById('cust-name').value = '';
        this.addRow();
        this.setPayment('เงินสด', document.querySelector('.payment-option:first-child'));
    },
    addRow() {
        let newItem = {id:Date.now(), prodId:'', price:0, qty:'', deposit:0, name:''};
        if (this.data.cart.length > 0) {
            const last = this.data.cart[this.data.cart.length - 1];
            if (last.prodId) { newItem.prodId = last.prodId; newItem.name = last.name; newItem.price = last.price; }
        }
        this.data.cart.push(newItem);
        this.renderCart();
    },
    renderCart() {
        const tbody = document.getElementById('cart-body');
        if (!tbody) return;
        let sub = 0, depTotal = 0;
        // ... (ลอจิกการ Loop สร้าง <tr> เหมือนในโค้ดเดิม) ...
        // และอัปเดตตัวเลขผลรวมด้านขวา
    },
    async processCheckout() {
        // ... (ลอจิกการตรวจสอบข้อมูลและการเรียก api.post เหมือนโค้ดเดิม) ...
    },
    async printA5(data, oldDebt) {
        // ... (ลอจิก html2canvas และ jspdf เหมือนโค้ดเดิม) ...
    }
};

const ui = {
    openModal(id) { 
        document.getElementById(id).classList.remove('hidden'); 
        if(id==='product-modal') app.renderProdList(); 
    },
    closeModal(id) { document.getElementById(id).classList.add('hidden'); }
};

// เรียกใช้งาน
app.init();
