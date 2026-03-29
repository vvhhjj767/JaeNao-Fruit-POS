const ui = {
    openModal(id) {
        document.getElementById(id).classList.remove('hidden');
        if(id==='product-modal' && typeof app !== 'undefined') app.renderProdList();
        if(id==='bank-modal' && typeof app !== 'undefined') app.renderBankList();
        if(id==='settings-modal' && typeof pinManager !== 'undefined') pinManager._updateSettingsStatus();
    },
    closeModal(id) { 
        document.getElementById(id).classList.add('hidden'); 
    }
};
