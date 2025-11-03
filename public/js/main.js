// ===============================================
// ARQUIVO: public/js/main.js (Corrigido com Lógica de Promoção)
// ===============================================

// --- Elementos do DOM (Variáveis Globais) ---
const cartSidebar = document.getElementById('cart-sidebar');
const cartOverlay = document.getElementById('cart-overlay');
const cartCloseBtn = document.getElementById('cart-close-btn');
const cartLink = document.getElementById('cart-link');
const cartLinkProduto = document.getElementById('cart-link-produto'); // Link da pág. de produto
const cartItemsContainer = document.getElementById('cart-items-list');
const cartTotalPriceEl = document.getElementById('cart-total-price');
const clearCartBtn = document.getElementById('btn-limpar-carrinho');

// --- Funções do Carrinho (Lógica) ---
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '{}');
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId) {
    console.log(`Adicionando produto ID: ${productId} ao carrinho.`);
    let cart = getCart();
    cart[productId] = cart[productId] ? { quantity: cart[productId].quantity + 1 } : { quantity: 1 };
    saveCart(cart);
    updateCartCounter();
    loadCart(); 
    openCartSidebar();
}

function updateItemQuantity(productId, newQuantity) {
    let cart = getCart();
    if (cart[productId]) {
        if (newQuantity <= 0) { delete cart[productId]; } 
        else { cart[productId].quantity = newQuantity; }
        saveCart(cart);
        loadCart();
        updateCartCounter();
    }
}

function removeItemFromCart(productId) {
    let cart = getCart();
    if (cart[productId]) {
        delete cart[productId];
        saveCart(cart);
        loadCart();
        updateCartCounter();
    }
}

function clearCart() {
    if (confirm('Você tem certeza que quer limpar o carrinho?')) {
        localStorage.removeItem('cart');
        loadCart();
        updateCartCounter();
    }
}

function updateCartCounter() {
    const cart = getCart();
    let totalItems = 0;
    for (const id in cart) {
        totalItems += cart[id].quantity;
    }
    const counters = document.querySelectorAll('#cart-counter');
    counters.forEach(counter => {
        if (counter) {
            if (totalItems > 0) {
                counter.textContent = totalItems; 
                counter.style.display = 'inline-block'; 
            } else {
                counter.style.display = 'none';
            }
        }
    });
}

// Função loadCart (MODIFICADA: usa lógica de promoção)
async function loadCart() {
    const cart = getCart();
    const productIds = Object.keys(cart);
    
    // Assegura que os elementos existem antes de tentar usá-los
    if (!cartItemsContainer || !cartTotalPriceEl) {
        console.error("Elementos do DOM do carrinho não encontrados.");
        return;
    }

    cartItemsContainer.innerHTML = '';
    
    if (productIds.length === 0) {
        cartItemsContainer.innerHTML = '<p id="cart-empty-msg">Seu carrinho está vazio.</p>';
        cartTotalPriceEl.textContent = 'R$ 0,00';
        return;
    }

    try {
        // A API (server.js) já envia 'preco' E 'preco_promocional'
        const response = await fetch(`/api/produtos?ids=${productIds.join(',')}`);
        if (!response.ok) throw new Error('Falha ao buscar produtos');
        
        const produtosDoBanco = await response.json();
        let granTotal = 0;

        produtosDoBanco.forEach(produto => {
            const quantidade = cart[produto.id].quantity;

            // <<< !!! ESTA É A CORREÇÃO !!! >>>
            // Verifica se existe um preço promocional VÁLIDO (maior que 0)
            const precoAtual = (produto.preco_promocional && produto.preco_promocional > 0)
                               ? produto.preco_promocional // Usa o preço de promoção
                               : produto.preco; // Senão, usa o preço normal
            
            const subtotal = precoAtual * quantidade;
            granTotal += subtotal;

            const imagemCapa = produto.imagem_capa || '/img/placeholder.jpg'; // Pega a imagem da capa

            // HTML atualizado para mostrar o preço correto
            const itemHtml = `
                <div class="cart-item">
                    <img src="${imagemCapa}" alt="${produto.nome}" class="cart-item-image">
                    <div class="cart-item-info">
                        <h4>${produto.nome}</h4>
                        <p>R$ ${precoAtual.toFixed(2)}</p>
                        
                        <div class="cart-item-controls">
                            <button class="cart-qty-btn" data-id="${produto.id}" data-action="decrease">-</button>
                            <span class="mx-2">${quantidade}</span>
                            <button class="cart-qty-btn" data-id="${produto.id}" data-action="increase">+</button>
                        </div>
                    </div>
                    <div class="cart-item-price">
                        <p>R$ ${subtotal.toFixed(2)}</p>
                        <button class="cart-remove-btn" data-id="${produto.id}">Remover</button>
                    </div>
                </div>
            `;
            cartItemsContainer.innerHTML += itemHtml;
        });

        cartTotalPriceEl.textContent = `R$ ${granTotal.toFixed(2)}`;

    } catch (error) {
        console.error('Erro ao carregar carrinho:', error);
        cartItemsContainer.innerHTML = '<p id="cart-empty-msg" class="text-danger">Erro ao carregar seu carrinho.</p>';
    }
}

// --- Funções de Controle do Sidebar (UI) ---
function openCartSidebar() {
    if (cartSidebar) cartSidebar.classList.add('is-open');
    if (cartOverlay) cartOverlay.classList.add('is-open');
}
function closeCartSidebar() {
    if (cartSidebar) cartSidebar.classList.remove('is-open');
    if (cartOverlay) cartOverlay.classList.remove('is-open');
}

// --- Event Listeners (Ouvidores de Eventos) ---
document.addEventListener('DOMContentLoaded', () => {
    
    document.addEventListener('click', (e) => {
        // Botões "Comprar"
        const buyButton = e.target.closest('.btn-comprar');
        if (buyButton) {
            const productId = buyButton.getAttribute('data-product-id');
            addToCart(productId);
        }
    });

    // Links do Carrinho no Header
    if (cartLink) {
        cartLink.addEventListener('click', (e) => {
            e.preventDefault(); 
            loadCart(); 
            openCartSidebar();
        });
    }
    // Link do carrinho na página do produto
    if (cartLinkProduto) { 
        cartLinkProduto.addEventListener('click', (e) => {
            e.preventDefault();
            loadCart();
            openCartSidebar();
        });
    }

    // Botão de Fechar e Overlay
    if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCartSidebar);
    if (cartOverlay) cartOverlay.addEventListener('click', closeCartSidebar);
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    // Binds para +/- e Remover (Event Delegation)
    if(cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const target = e.target; 
            if (target.classList.contains('cart-qty-btn')) {
                const id = target.getAttribute('data-id');
                const action = target.getAttribute('data-action');
                let cart = getCart();
                if (!cart[id]) return; // Segurança
                let currentQty = cart[id].quantity;

                if (action === 'increase') {
                    updateItemQuantity(id, currentQty + 1);
                } else if (action === 'decrease') {
                    updateItemQuantity(id, currentQty - 1);
                }
            }

            if (target.classList.contains('cart-remove-btn')) {
                const id = target.getAttribute('data-id');
                const itemNome = target.closest('.cart-item').querySelector('h4').textContent;
                if (confirm(`Remover ${itemNome} do carrinho?`)) {
                    removeItemFromCart(id);
                }
            }
        });
    }
    
    updateCartCounter();
});