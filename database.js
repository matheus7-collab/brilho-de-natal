// ===============================================
// ARQUIVO: database.js (Versão 8 - Com Preço Promocional)
// ===============================================
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./loja.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) { console.error("Erro ao abrir o banco de dados:", err.message); return; }
    console.log("Conectado ao banco de dados SQLite 'loja.db'.");

    db.serialize(() => {
        // --- Tabela de Produtos (COM preco_promocional) ---
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            preco REAL NOT NULL,
            imagem TEXT,
            descricao TEXT,
            preco_promocional REAL DEFAULT NULL 
        )`, (err) => {
            if (err) { console.error("Erro ao criar tabela produtos:", err.message); }
            else { console.log("Tabela 'produtos' verificada/criada."); }
        });

        // --- Tabela de Usuários ---
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            senha_hash TEXT NOT NULL,
            data_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) { console.error("Erro ao criar tabela usuarios:", err.message); }
            else { console.log("Tabela 'usuarios' verificada/criada."); }
        });

        // --- Tabela de Pedidos ---
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
            valor_total REAL NOT NULL,
            status TEXT DEFAULT 'Processando',
            endereco_entrega TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )`, (err) => {
            if (err) { console.error("Erro ao criar tabela pedidos:", err.message); }
            else { console.log("Tabela 'pedidos' verificada/criada."); }
        });

        // --- Tabela de Itens do Pedido ---
        db.run(`CREATE TABLE IF NOT EXISTS pedido_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER NOT NULL,
            produto_id INTEGER NOT NULL,
            quantidade INTEGER NOT NULL,
            preco_unitario REAL NOT NULL,
            FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        )`, (err) => {
            if (err) { console.error("Erro ao criar tabela pedido_itens:", err.message); }
            else { console.log("Tabela 'pedido_itens' verificada/criada."); }
        });

        // Populador de produtos (com um item em promoção)
        db.get("SELECT COUNT(*) as count FROM produtos", (err, row) => {
             if (!err && row && row.count === 0) {
                 console.log("Populando tabela 'produtos' com promoção...");
                 const stmt = db.prepare("INSERT INTO produtos (nome, preco, preco_promocional, imagem, descricao) VALUES (?, ?, ?, ?, ?)");
                 
                 const produtosExemplo = [
                    { 
                        nome: 'Guirlanda Festiva Luxo', 
                        preco: 89.90, 
                        preco_promocional: 75.00, // <<< EM PROMOÇÃO
                        imagem: '/img/guirlanda1.jpg,/img/guirlanda2.jpg,/img/guirlanda3.jpg', 
                        descricao: 'Guirlanda premium decorada com pinhas naturais, laços de veludo vermelho e luzes LED.'
                    },
                    { 
                        nome: 'Kit 50 Bolas Natalinas (Ouro e Bronze)', 
                        preco: 129.99, 
                        preco_promocional: null, // <<< SEM PROMOÇÃO
                        imagem: '/img/bolas1.jpg,/img/bolas2.jpg,/img/bolas3.jpg', 
                        descricao: 'Conjunto completo com 50 bolas de Natal em acabamentos fosco, brilhante e glitter.'
                    },
                    { 
                        nome: 'Árvore de Natal Nevada (1.80m)', 
                        preco: 499.50, 
                        preco_promocional: null, // <<< SEM PROMOÇÃO
                        imagem: '/img/arvore1.jpg,/img/arvore2.jpg,/img/arvore3.jpg', 
                        descricao: 'Linda árvore de 1.80m com efeito nevado nos galhos. Fácil de montar.'
                    }
                 ];
                 produtosExemplo.forEach(p => stmt.run(p.nome, p.preco, p.preco_promocional, p.imagem, p.descricao));
                 stmt.finalize();
             } else if(err) {
                 console.error("Erro ao verificar contagem de produtos:", err.message);
             }
         });
    });
});

module.exports = db;