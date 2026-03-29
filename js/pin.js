const pinManager = {
    PIN_KEY: 'pos_pin_hash',
    UNLOCK_KEY: 'pos_unlocked_until',
    TIMEOUT_MS: 15 * 60 * 1000, // 15 นาที
    _input: '',
    _setupStep: 0,
    _firstPin: '',

    async hash(pin) {
        let salt = localStorage.getItem('pos_pin_salt');
        if (!salt) {
            const array = new Uint8Array(16);
            window.crypto.getRandomValues(array);
            salt = Array.from(array, dec => dec.toString(16).padStart(2, "0")).join('');
            localStorage.setItem('pos_pin_salt', salt);
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + salt);
        
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    hasPin() { return !!localStorage.getItem(this.PIN_KEY); },

    isUnlocked() {
        if (!this.hasPin()) return true;
        const until = parseInt(localStorage.getItem(this.UNLOCK_KEY) || '0');
        return Date.now() < until;
    },

    setUnlocked() {
        localStorage.setItem(this.UNLOCK_KEY, Date.now() + this.TIMEOUT_MS);
    },

    init() {
        if (!this.hasPin()) {
            this.unlock();
        } else if (!this.isUnlocked()) {
            document.getElementById('pin-screen-label').innerText = 'กรอก PIN 4 หลักเพื่อเข้าใช้งาน';
            document.getElementById('pin-setup-hint').innerText = '';
            document.getElementById('pin-screen').style.display = 'flex';
        } else {
            this.unlock();
        }

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
            if (dot) {
                dot.className = 'pin-dot';
                if (i < this._input.length) dot.classList.add('filled');
                if (state === 'error') dot.classList.add('error');
            }
        }
    },

    async _submit() {
        if (!this.hasPin()) {
            if (this._setupStep === 0) {
                this._firstPin = this._input;
                this._setupStep = 1;
                this._input = '';
                this._updateDots();
                document.getElementById('pin-screen-label').innerText = 'ยืนยัน PIN อีกครั้ง';
                document.getElementById('pin-error').innerText = '';
            } else {
                if (this._input === this._firstPin) {
                    const hashedPin = await this.hash(this._input);
                    localStorage.setItem(this.PIN_KEY, hashedPin);
                    this.unlock();
                } else {
                    this._showError('PIN ไม่ตรงกัน ลองใหม่อีกครั้ง');
                    this._setupStep = 0;
                    this._firstPin = '';
                    document.getElementById('pin-screen-label').innerText = 'ตั้ง PIN 4 หลัก เพื่อความปลอดภัย';
                }
            }
        } else {
            const hashedInput = await this.hash(this._input);
            if (hashedInput === localStorage.getItem(this.PIN_KEY)) {
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

    async savePin() {
        const oldInput = document.getElementById('set-old-pin').value;
        const newPin = document.getElementById('set-new-pin').value;
        const confirmPin = document.getElementById('set-confirm-pin').value;

        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
            return Swal.fire('PIN ต้องเป็นตัวเลข 4 หลัก', '', 'warning');
        }
        if (newPin !== confirmPin) {
            return Swal.fire('PIN ไม่ตรงกัน', 'กรุณากรอก PIN ใหม่และยืนยันให้ตรงกัน', 'warning');
        }
        if (this.hasPin()) {
            const hashedOld = await this.hash(oldInput);
            if (hashedOld !== localStorage.getItem(this.PIN_KEY)) {
                return Swal.fire('PIN ปัจจุบันไม่ถูกต้อง', '', 'error');
            }
        }

        const hashedNew = await this.hash(newPin);
        localStorage.setItem(this.PIN_KEY, hashedNew);
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
        if(!box) return;
        if (this.hasPin()) {
            box.className = 'mb-5 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 bg-emerald-50 text-emerald-700 border border-emerald-200';
            box.innerHTML = '<i class="fa-solid fa-lock text-emerald-500"></i> PIN เปิดใช้งานอยู่ · ล็อกอัตโนมัติ 15 นาที';
        } else {
            box.className = 'mb-5 p-4 rounded-2xl text-sm font-medium flex items-center gap-3 bg-amber-50 text-amber-700 border border-amber-200';
            box.innerHTML = '<i class="fa-solid fa-lock-open text-amber-500"></i> ยังไม่ได้ตั้ง PIN — ระบบไม่มีการป้องกัน';
        }
    }
};
