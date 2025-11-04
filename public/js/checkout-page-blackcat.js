// ===============================================
// ARQUIVO: public/js/checkout-page-blackcat.js
// (Tentativa 4: Enviando dados brutos + token)
// ===============================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega o resumo do pedido
    loadCheckoutSummary();

    // 2. Inicializa o BlackCatPay com sua Chave Pública
    const BLACKCAT_PUBLIC_KEY = 'pk_IOmbGd9TuyA74r51JDxK8mCpTTqIbI1XfBZpqPi6_4MRomXU'; // <<< SUA CHAVE JÁ ESTÁ CORRETA
    try {
        BlackCatPay.setPublicKey(BLACKCAT_PUBLIC_KEY);
    } catch (e) {
        console.error("Erro fatal na configuração de pagamento:", e);
        showError("Erro fatal na configuração de pagamento.");
        return;
    }

    // 3. Pega os elementos do formulário
    const paymentForm = document.getElementById('payment-form');
    const payWithCardButton = document.getElementById('pay-with-card-button');
    const payWithPixButton = document.getElementById('pay-with-pix-button');

    // 4. Adiciona o listener para pagar com CARTÃO
    if (payWithCardButton) {
        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Impede o envio normal do formulário
            handlePayWithCard();
        });
    }

    // 5. Adiciona o listener para pagar com PIX
    if (payWithPixButton) {
        payWithPixButton.addEventListener('click', (e) => {
            e.preventDefault();
            handlePayWithPix();
        });
    }
});

// --- FUNÇÕES DE PAGAMENTO ---

/**
 * Lida com o pagamento com Cartão de Crédito
 */
async function handlePayWithCard() {
    console.log("Iniciando pagamento com Cartão...");
    setLoading(true, 'pay-with-card-button', 'Processando...');

    try {
        const customerData = getCustomerData();
        if (!customerData.cpf) { throw new Error("CPF/CNPJ é obrigatório."); }

        // 1. Coletar dados do cartão (os dados brutos)
        const cardData = {
            holderName: document.getElementById('cardHolderName').value,
            number: document.getElementById('cardNumber').value.replace(/\s/g, ''),
            expMonth: parseInt(document.getElementById('cardExpMonth').value),
            expYear: parseInt(document.getElementById('cardExpYear').value),
            cvv: document.getElementById('cardCvv').value
        };

        // 2. Gerar o Token (vamos enviar os dois, por via das dúvidas)
        console.log("Criptografando cartão...");
        const token = await BlackCatPay.encrypt(cardData);
        console.log("Token gerado:", token);

        // 3. Enviar os dados para o NOSSO servidor
        const payload = {
            paymentMethod: 'credit_card',
            customer: customerData,
            cart: getCart(),
            cardToken: token,       // Enviando o Token
            cardData: cardData        // <<< MUDANÇA: Enviando os dados brutos do cartão
        };

        const response = await fetch('/pagar-com-blackcat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) { 
            // O erro "Requisição com valores inválidos" virá daqui
            throw new Error(data.error || 'Erro desconhecido no pagamento.'); 
        }

        // 5. Pagamento Aprovado!
        console.log("Pagamento aprovado!", data);
        localStorage.removeItem('cart'); // Limpa o carrinho
        window.location.href = '/obrigado'; // Redireciona

    } catch (error) {
        console.error('Erro no pagamento com cartão:', error);
        showError(error.message || 'Não foi possível processar seu pagamento.');
        setLoading(false, 'pay-with-card-button', 'Pagar com Cartão');
    }
}

/**
 * Lida com o pagamento com PIX
 */
async function handlePayWithPix() {
    console.log("Iniciando pagamento com PIX...");
    setLoading(true, 'pay-with-pix-button', 'Gerando PIX...');

     try {
        const customerData = getCustomerData();
        if (!customerData.cpf) {
             throw new Error("CPF/CNPJ é obrigatório para gerar o PIX.");
        }
        
        const payload = {
            paymentMethod: 'pix',
            customer: customerData,
            cart: getCart()
        };

        const response = await fetch('/pagar-com-blackcat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Erro desconhecido ao gerar PIX.');
        }

        console.log("PIX gerado:", data);
        showPixModal(data.pix.qrcode, data.pix.copiaCola);
        setLoading(false, 'pay-with-pix-button', 'Pagar com PIX');

     } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        showError(error.message || 'Não foi possível gerar o PIX.');
        setLoading(false, 'pay-with-pix-button', 'Pagar com PIX');
     }
}

// --- FUNÇÕES AUXILIARES ---

function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '{}');
}

function getCustomerData() {
    return {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        cpf: document.getElementById('cpf').value.replace(/\D/g, '')
    };
}

function showPixModal(qrCodeBase64, copiaCola) {
    const qrContainer = document.getElementById('pix-qrcode-container');
    const copiaColaText = document.getElementById('pix-copia-cola');
    const copyButton = document.getElementById('copy-pix-button');
    
    qrContainer.innerHTML = `<p class="text-muted small">Não foi possível gerar a imagem do QR Code. Use o Copia e Cola abaixo.</p>`;
    copiaColaText.value = copiaCola;

    copyButton.addEventListener('click', () => {
        copiaColaText.select();
        document.execCommand('copy');
        copyButton.textContent = 'Copiado!';
        setTimeout(() => { copyButton.textContent = 'Copiar Código'; }, 2000);
    });

    const modalElement = document.getElementById('pixModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

function setLoading(isLoading, buttonId, loadingText) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    const originalText = (buttonId === 'pay-with-card-button') ? 'Pagar com Cartão' : 'Pagar com PIX';
    
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ${loadingText}`;
    } else {
        button.disabled = false;
        button.innerHTML = originalText;
    }
    
    const otherButtonId = (buttonId === 'pay-with-card-button') ? 'pay-with-pix-button' : 'pay-with-card-button';
    const otherButton = document.getElementById(otherButtonId);
    if(otherButton) otherButton.disabled = isLoading;
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
}

async function loadCheckoutSummary() {
    const itemsContainer = document.getElementById('order-summary-items');
    const totalPriceElement = document.getElementById('order-total-price');
    const cart = getCart();
    const productIds = Object.keys(cart);

    if (!itemsContainer || !totalPriceElement) return;

    if (productIds.length === 0) {
        itemsContainer.innerHTML = '<p class="text-muted">Seu carrinho está vazio.</p>';
        totalPriceElement.textContent = 'R$ 0,00';
        setLoading(true, 'pay-with-card-button', 'Carrinho Vazio');
        setLoading(true, 'pay-with-pix-button', 'Carrinho Vazio');
        return;
    }

    try {
        const response = await fetch(`/api/produtos?ids=${productIds.join(',')}`);
        if (!response.ok) throw new Error('Falha ao buscar produtos');
        const produtosDoBanco = await response.json();
        itemsContainer.innerHTML = '';
        let granTotal = 0;

        produtosDoBanco.forEach(produto => {
            const quantidade = cart[produto.id].quantity;
            const precoAtual = (produto.preco_promocional && produto.preco_promocional > 0) ? produto.preco_promocional : produto.preco;
            const subtotal = precoAtual * quantidade;
            granTotal += subtotal;
            const itemHtml = `
                <div class="summary-item">
                    <img src="${produto.imagem_capa}" alt="${produto.nome}" class="summary-item-image">
                    <div class="summary-item-details">
                        <h6>${produto.nome}</h6>
                        <small>Quantidade: ${quantidade}</small>
                    </div>
                    <span class="summary-item-price">R$ ${subtotal.toFixed(2)}</span>
                </div>
            `;
            itemsContainer.innerHTML += itemHtml;
        });
        totalPriceElement.textContent = `R$ ${granTotal.toFixed(2)}`;
    } catch (error) {
        console.error('Erro ao carregar resumo do checkout:', error);
        itemsContainer.innerHTML = '<p class="text-danger">Erro ao carregar seu pedido.</p>';
    }
}