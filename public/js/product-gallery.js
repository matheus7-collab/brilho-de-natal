// Arquivo: public/js/product-gallery.js

document.addEventListener('DOMContentLoaded', () => {
    // Encontra a imagem principal
    const mainImage = document.getElementById('main-product-image');
    
    // Encontra todas as miniaturas
    // Usamos querySelectorAll para pegar todas as imagens com a classe
    const thumbnails = document.querySelectorAll('.thumbnail-item');

    if (mainImage && thumbnails.length > 0) {
        
        // Adiciona um "ouvidor" de clique para CADA miniatura
        thumbnails.forEach(thumb => {
            thumb.addEventListener('click', () => {
                // 1. Pega a URL da imagem da miniatura clicada (do atributo src)
                const newImageSrc = thumb.getAttribute('src');
                
                // 2. Define a URL da imagem principal para ser a da miniatura
                mainImage.setAttribute('src', newImageSrc);

                // 3. (Bônus) Atualiza a classe 'active'
                // Remove 'active' de todas as miniaturas
                thumbnails.forEach(t => t.classList.remove('active'));
                // Adiciona 'active' apenas na miniatura clicada
                thumb.classList.add('active');
            });
        });
    }
});