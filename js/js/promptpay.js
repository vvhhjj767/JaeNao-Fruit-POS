const promptPayHelper = {
    crc16(data) {
        let crc = 0xFFFF;
        for (let i = 0; i < data.length; i++) {
            crc ^= data.charCodeAt(i) << 8;
            for (let j = 0; j < 8; j++) {
                if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
                else crc <<= 1;
            }
        }
        return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    },
    generate(id, amount) {
        let target = id.replace(/[^0-9]/g, '');
        if (target.length >= 15) target = "0315" + target; // e-Wallet
        else if (target.length === 13) target = "0213" + target; // ID Card
        else if (target.length === 10) target = "01130066" + target.substring(1); // Mobile
        else target = "02" + target.length.toString().padStart(2, '0') + target;

        let payload = "00020101021229370016A000000677010111" + target + "5802TH5303764";
        if (amount) {
            let amtStr = parseFloat(amount).toFixed(2);
            payload += "54" + amtStr.length.toString().padStart(2, '0') + amtStr;
        }
        payload += "6304";
        return payload + this.crc16(payload);
    }
};
