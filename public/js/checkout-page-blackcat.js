// ===============================================
// ARQUIVO: public/js/checkout-page-blackcat.js (Corrigido)
// ===============================================

// --- INICIALIZAÇÃO E CARREGAMENTO DO RESUMO ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Carrega o resumo do pedido
    loadCheckoutSummary();

    // 2. Inicializa o BlackCatPay com sua Chave Pública
    // !!! VOCÊ JÁ FEZ CERTO, MANTENHA SUA CHAVE AQUI !!!
    const BLACKCAT_PUBLIC_KEY = 'pk_IOmbGd9TuyA74r51JDxK8mCpTTqIbI1XfBZpqPi6_4MRomXU'; 

    // !!! LINHA 'IF' DE VERIFICAÇÃO REMOVIDA DAQUI !!!
    
    // Configura a chave no BlackCat
    try {
        BlackCatPay.setPublicKey(BLACKCAT_PUBLIC_KEY);
    } catch (e) {
        console.error("Erro ao configurar a Chave Pública do BlackCat:", e);
        showError("Erro fatal na configuração de pagamento. Verifique a Chave Pública.");
        return; // Para a execução se a chave for inválida
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
    setLoading(true, 'pay-with-card-button', 'Tokenizando...');

    try {
        // 1. Coletar dados do cliente (Nome, Email, CPF)
        const customerData = getCustomerData();
        if (!customerData.cpf) {
             throw new Error("CPF/CNPJ é obrigatório.");
        }

        // 2. Coletar dados do cartão
        const cardData = {
            holderName: document.getElementById('cardHolderName').value,
            number: document.getElementById('cardNumber').value.replace(/\s/g, ''), // Remove espaços
            expMonth: parseInt(document.getElementById('cardExpMonth').value),
            expYear: parseInt(document.getElementById('cardExpYear').value),
            cvv: document.getElementById('cardCvv').value
        };

        // 3. Gerar o Token seguro (como na documentação)
        console.log("Criptografando cartão...");
        const token = await BlackCatPay.encrypt(cardData);
        console.log("Token gerado:", token);

        // 4. Enviar os dados para o NOSSO servidor
        const payload = {
            paymentMethod: 'credit_card',
            customer: customerData,
            cart: getCart(),
            cardToken: token // Envia o token seguro, não os dados do cartão
        };

        const response = await fetch('/pagar-com-blackcat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            // Se o NOSSO servidor ou o BlackCat der erro
            throw new Error(data.error || 'Erro desconhecido no pagamento.');
        }

        // 5. Pagamento Aprovado! (Status 'paid')
        console.log("Pagamento aprovado!", data);
        // Limpa o carrinho do localStorage
        localStorage.removeItem('cart');
        // Redireciona para a página de Obrigado
        window.location.href = '/obrigado'; 

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
        // 1. Coletar dados do cliente (Nome, Email, CPF)
        const customerData = getCustomerData();
        if (!customerData.cpf) {
             throw new Error("CPF/CNPJ é obrigatório para gerar o PIX.");
        }
        
        // 2. Enviar os dados para o NOSSO servidor
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

        // 3. Sucesso! O servidor enviou os dados do PIX
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

/**
 * Pega o carrinho do localStorage
 */
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '{}');
}

/**
 * Pega os dados do cliente do formulário
 */
function getCustomerData() {
    return {
        nome: document.getElementById('nome').value,
        email: document.getElementById('email').value,
        cpf: document.getElementById('cpf').value.replace(/\D/g, '') // Remove pontos/traços
    };
}

/**
 * Mostra o Modal do PIX com o QR Code e Copia/Cola
 */
function showPixModal(qrCodeBase64, copiaCola) {
    const qrContainer = document.getElementById('pix-qrcode-container');
    const copiaColaText = document.getElementById('pix-copia-cola');
    const copyButton = document.getElementById('copy-pix-button');
    
    // (A documentação do BlackCat não é clara se 'qrcode' é o texto ou uma imagem base64)
    // Vamos assumir que é o CÓDIGO (Copia e Cola)
    
    qrContainer.innerHTML = `<p class="text-muted small">Não foi possível gerar a imagem do QR Code. Use o Copia e Cola abaixo.</p>`;
    // (Se um dia descobrirmos que é uma imagem:
    // qrContainer.innerHTML = `<img src="data:image/png;base64,${qrCodeBase64}" class="img-fluid">`;)

    copiaColaText.value = copiaCola; // O código 'pix.qrcode' da documentação

    copyButton.addEventListener('click', () => {
        copiaColaText.select();
        document.execCommand('copy');
        copyButton.textContent = 'Copiado!';
        setTimeout(() => { copyButton.textContent = 'Copiar Código'; }, 2000);
    });

    const modalElement = document.getElementById('pixModal');
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // (Em uma versão futura, adicionaríamos um "listener" aqui para verificar o /blackcat-webhook)
    // (Por enquanto, o cliente paga e o admin confere o status no painel)
}

/**
 * Controla o estado de carregamento dos botões
 */
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

/**
 * Mostra uma mensagem de erro na página
 */
function showError(message) {
    const errorMessage = document.getElementById('error-message');
    if (!errorMessage) return;
    errorMessage.textContent = message;
    errorMessage.classList.remove('d-none');
}

/**
 * Carrega o resumo do pedido (código que tínhamos antes)
 */
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