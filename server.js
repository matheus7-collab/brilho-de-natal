// ===============================================
// ARQUIVO: server.js (Versão 16 - Migração BlackCat Pagamentos - COMPLETO)
// ===============================================

// --- 1. Importações ---
require('dotenv').config(); // Carrega o .env (DEVE SER A PRIMEIRA LINHA)
const express = require('express');
const path = require('path');
const db = require('./database.js');
const session = require('express-session');
const bcrypt = require('bcrypt');
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // REMOVIDO

// --- 2. Inicialização do Express ---
const app = express();
const port = 3000;
const lojaNome = 'Brilho de Natal';

// --- 3. Constantes do BlackCat (do .env) ---
const BLACKCAT_API_URL = 'https://api.blackcatpagamentos.com/v1/transactions';
const BLACKCAT_PUBLIC_KEY = process.env.BLACKCAT_PUBLIC_KEY;
const BLACKCAT_SECRET_KEY = process.env.BLACKCAT_SECRET_KEY;
// Cria a string de autenticação 'Basic'
const BLACKCAT_AUTH = 'Basic ' + Buffer.from(BLACKCAT_PUBLIC_KEY + ':' + BLACKCAT_SECRET_KEY).toString('base64');

// --- 4. Configuração de Sessão ---
app.use(session({
    secret: 'troque-isso-por-uma-frase-muito-longa-e-aleatoria!', // <<< LEMBRE-SE DE TROCAR!
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 1000 * 60 * 60 * 24 }
}));

// --- 5. Middleware Global ---
app.use((req, res, next) => {
    res.locals.isAdmin = req.session.userId === 'admin';
    res.locals.clienteLogado = req.session.clienteId ? { id: req.session.clienteId, nome: req.session.clienteNome, email: req.session.clienteEmail } : null;
    res.locals.lojaNome = lojaNome;
    res.locals.currentUrl = req.originalUrl;
    res.locals.titulo = lojaNome;
    next();
});

// --- 6. Configuração Padrão do Express ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // JSON (para o fetch do BlackCat)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- 7. Usuário Admin (Simulação) ---
const adminUser = {
    username: 'admin',
    passwordHash: '$2b$10$0fPbFWGgK4kCB4JBH30AFOt42IflKgqp0er4WdWeCai9h9gkgoMYa' // MANTENHA A SUA HASH
};

// --- 8. Middlewares de Autenticação ---
function isAuthenticatedAdmin(req, res, next) {
    if (res.locals.isAdmin) { return next(); }
    res.redirect('/login');
}
function isAuthenticatedCliente(req, res, next) {
    if (res.locals.clienteLogado) { return next(); }
    res.redirect(`/login-cliente?redirect=${encodeURIComponent(req.originalUrl)}`);
}

// --- 9. Rotas da Aplicação (Públicas e de Cliente) ---

// Rota Principal (Calcula Desconto %)
app.get('/', (req, res) => {
    const sql = "SELECT * FROM produtos";
    db.all(sql, [], (err, rows) => {
        if (err) { console.error("Erro Rota '/':", err); return res.status(500).send("Erro ao carregar produtos."); }
        rows.forEach(produto => {
            const imagemString = produto.imagem || '';
            const imagensArray = imagemString.split(',').map(img => img.trim()).filter(img => img.length > 0);
            produto.imagem_capa = imagensArray.length > 0 ? imagensArray[0] : '/img/placeholder.jpg';
            produto.desconto_percentual = null;
            if (produto.preco_promocional && produto.preco_promocional > 0 && produto.preco > produto.preco_promocional) {
                const diff = produto.preco - produto.preco_promocional;
                const percent = (diff / produto.preco) * 100;
                produto.desconto_percentual = Math.round(percent);
            }
        });
        res.render('index', { produtos: rows, titulo: lojaNome });
    });
});

// Rota Produto Detalhe (Calcula Desconto %)
app.get('/produto/:id', (req, res) => {
    const idProduto = req.params.id;
    const sql = "SELECT * FROM produtos WHERE id = ?";
    db.get(sql, [idProduto], (err, row) => {
        if (err) { console.error(`Erro Rota /produto/${idProduto}:`, err); return res.status(500).send("Erro ao carregar produto."); }
        if (!row) { return res.status(404).send("Produto não encontrado."); }
        const imagemString = row.imagem || '';
        const imagensArray = imagemString.split(',').map(img => img.trim()).filter(img => img.length > 0);
        const imagemPrincipal = imagensArray.length > 0 ? imagensArray[0] : '/img/placeholder.jpg';
        let desconto_percentual = null;
        if (row.preco_promocional && row.preco_promocional > 0 && row.preco > row.preco_promocional) {
            const diff = row.preco - row.preco_promocional;
            const percent = (diff / row.preco) * 100;
            desconto_percentual = Math.round(percent);
        }
        res.render('produto', {
            titulo: row.nome,
            produto: row,
            imagens: imagensArray,
            imagemPrincipal: imagemPrincipal,
            desconto_percentual: desconto_percentual
        });
    });
});

// API Produtos (Envia ambos os preços)
app.get('/api/produtos', (req, res) => {
    const ids = req.query.ids;
    if (!ids) { return res.json([]); }
    const idArray = ids.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
    if (idArray.length === 0) return res.json([]);
    const placeholders = idArray.map(() => '?').join(',');
    const sql = `SELECT id, preco, preco_promocional, nome, imagem FROM produtos WHERE id IN (${placeholders})`;
    db.all(sql, idArray, (err, rows) => {
        if (err) { console.error("API Erro:", err); return res.status(500).json({ error: "Erro DB" }); }
        rows.forEach(produto => {
            const imagemString = produto.imagem || '';
            const imagensArray = imagemString.split(',').map(img => img.trim()).filter(img => img.length > 0);
            produto.imagem_capa = imagensArray.length > 0 ? imagensArray[0] : '/img/placeholder.jpg';
        });
        res.json(rows);
    });
});

// Rota GET /register
app.get('/register', (req, res) => {
    if (res.locals.clienteLogado) { return res.redirect('/'); }
    res.render('register', { titulo: 'Cadastre-se' });
});

// Rota POST /register
app.post('/register', async (req, res) => {
    const { nome, email, senha, confirmaSenha } = req.body;
    const renderArgs = { titulo: 'Cadastre-se' };
    if (!nome || !email || !senha || !confirmaSenha || senha !== confirmaSenha || senha.length < 6) {
        if (!nome || !email || !senha || !confirmaSenha) renderArgs.error = 'Todos os campos são obrigatórios.';
        else if (senha !== confirmaSenha) renderArgs.error = 'As senhas não coincidem.';
        else if (senha.length < 6) renderArgs.error = 'A senha deve ter pelo menos 6 caracteres.';
        return res.render('register', renderArgs);
    }
    try {
        const sqlCheck = "SELECT id FROM usuarios WHERE email = ?";
        db.get(sqlCheck, [email], async (err, row) => {
            if (err) { renderArgs.error = 'Erro no servidor.'; return res.render('register', renderArgs); }
            if (row) { renderArgs.error = 'Este e-mail já está cadastrado.'; return res.render('register', renderArgs); }
            const senhaHash = await bcrypt.hash(senha, 10);
            const sqlInsert = "INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)";
            db.run(sqlInsert, [nome, email, senhaHash], function (err) {
                if (err) { renderArgs.error = 'Erro ao criar conta.'; return res.render('register', renderArgs); }
                req.session.clienteId = this.lastID;
                req.session.clienteNome = nome;
                req.session.clienteEmail = email;
                res.redirect('/');
            });
        });
    } catch (err) { renderArgs.error = 'Erro inesperado.'; res.render('register', renderArgs); }
});

// Rota GET /login-cliente
app.get('/login-cliente', (req, res) => {
    if (res.locals.clienteLogado) { return res.redirect('/'); }
    res.render('login-cliente', { titulo: 'Login Cliente', error: req.query.error, redirectUrl: req.query.redirect || '/' });
});

// Rota POST /login-cliente
app.post('/login-cliente', (req, res) => {
    const { email, senha } = req.body;
    const redirectUrl = req.body.redirectUrl || '/';
    const renderArgs = { titulo: 'Login Cliente', redirectUrl };
    if (!email || !senha) { renderArgs.error = 'E-mail e senha são obrigatórios.'; return res.render('login-cliente', renderArgs); }
    const sql = "SELECT * FROM usuarios WHERE email = ?";
    db.get(sql, [email], async (err, usuario) => {
        if (err) { renderArgs.error = 'Erro no servidor.'; return res.render('login-cliente', renderArgs); }
        if (usuario) {
            try {
                const match = await bcrypt.compare(senha, usuario.senha_hash);
                if (match) {
                    req.session.clienteId = usuario.id;
                    req.session.clienteNome = usuario.nome;
                    req.session.clienteEmail = usuario.email;
                    return res.redirect(redirectUrl);
                }
            } catch (compareErr) { renderArgs.error = 'Erro no servidor.'; return res.render('login-cliente', renderArgs); }
        }
        renderArgs.error = 'E-mail ou senha inválidos.';
        res.render('login-cliente', renderArgs);
    });
});

// Rota GET /logout-cliente
app.get('/logout-cliente', (req, res) => {
    delete req.session.clienteId;
    delete req.session.clienteNome;
    delete req.session.clienteEmail;
    res.redirect('/');
});

// Rota GET /minha-conta
app.get('/minha-conta', isAuthenticatedCliente, (req, res) => {
    const usuarioId = req.session.clienteId;
    const sqlPedidos = `SELECT id, data_pedido, valor_total, status FROM pedidos WHERE usuario_id = ? ORDER BY data_pedido DESC`;
    db.all(sqlPedidos, [usuarioId], (err, pedidos) => {
        const renderArgs = { titulo: 'Minha Conta', pedidos: [] };
        if (err) {
            console.error("Erro buscar pedidos:", err);
            renderArgs.error = 'Erro ao carregar pedidos.';
        } else {
             pedidos.forEach(pedido => {
                 try {
                     const dateObj = new Date(pedido.data_pedido);
                     pedido.data_formatada = !isNaN(dateObj) ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : "Data inválida";
                 } catch (formatError) { pedido.data_formatada = "Erro na data"; }
             });
             renderArgs.pedidos = pedidos;
        }
        res.render('minha-conta', renderArgs);
    });
});

// Rotas de Login/Logout ADMIN
app.get('/login', (req, res) => {
    if (res.locals.isAdmin) { return res.redirect('/admin'); }
    res.render('login', { titulo: 'Login Admin', error: req.query.error });
});
app.post('/login', async (req, res) => {
     const { username, password } = req.body;
     const renderArgs = { titulo: 'Login Admin' };
     if (username === adminUser.username) {
         try {
             const match = await bcrypt.compare(password, adminUser.passwordHash);
             if (match) { req.session.userId = username; return res.redirect('/admin'); }
         } catch (err) { console.error("Erro bcrypt admin:", err); renderArgs.error = '1'; return res.redirect('/login?error=1');}
     }
     console.log('Login admin falhou:', username);
     res.redirect('/login?error=1');
});
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) { console.error("Erro logout admin:", err); return res.redirect('/'); }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// =======================================================
// --- ROTAS DE CHECKOUT (MIGRAÇÃO BLACKCAT) ---
// =======================================================

// Rota GET /checkout
app.get('/checkout', isAuthenticatedCliente, (req, res) => {
    res.render('checkout', { titulo: 'Finalizar Compra' });
});

// Rota GET /obrigado (SIMPLIFICADA: agora só mostra a página)
app.get('/obrigado', isAuthenticatedCliente, (req, res) => {
    // A lógica de salvar o pedido agora está no /pagar-com-blackcat (cartão) ou /blackcat-webhook (PIX)
    res.render('obrigado', { titulo: 'Pedido Confirmado!' });
});


/**
 * Função helper para salvar o pedido no banco.
 * Será chamada pelo pagamento com cartão (imediato) ou pelo webhook (PIX).
 */
async function salvarPedidoNoBanco(clienteId, carrinho, valorTotal, enderecoEntrega, metodoPagamento) {
    return new Promise((resolve, reject) => {
        const itensPedidoParaSalvar = Object.keys(carrinho).map(id => ({
            produto_id: parseInt(id),
            quantidade: carrinho[id].quantity,
        }));
        
        if (itensPedidoParaSalvar.length === 0) {
            return reject(new Error("Carrinho vazio, não é possível salvar pedido."));
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            // Salva o status inicial e o método de pagamento
            const sqlPedido = `INSERT INTO pedidos (usuario_id, valor_total, status, endereco_entrega, metodo_pagamento) VALUES (?, ?, ?, ?, ?)`;
            db.run(sqlPedido, [clienteId, valorTotal, 'Processando', enderecoEntrega, metodoPagamento], function(pedidoErr) {
                if (pedidoErr) {
                    console.error("Erro salvar pedido:", pedidoErr);
                    db.run('ROLLBACK');
                    return reject(pedidoErr);
                }
                
                const pedidoId = this.lastID;
                const stmtItens = db.prepare(`INSERT INTO pedido_itens (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)`);
                
                const productIds = itensPedidoParaSalvar.map(item => item.produto_id);
                const placeholders = productIds.map(() => '?').join(',');
                const sqlPrecos = `SELECT id, preco, preco_promocional FROM produtos WHERE id IN (${placeholders})`;

                db.all(sqlPrecos, productIds, (errPrecos, produtosDoBanco) => {
                    if (errPrecos) {
                        console.error("Erro buscar preços (salvarPedido):", errPrecos);
                        return db.run('ROLLBACK', () => reject(errPrecos));
                    }

                    const precosMap = {};
                    produtosDoBanco.forEach(p => { 
                        precosMap[p.id] = (p.preco_promocional && p.preco_promocional > 0) ? p.preco_promocional : p.preco;
                    });

                    let itemErrors = false;
                    itensPedidoParaSalvar.forEach(item => {
                        const precoUnitario = precosMap[item.produto_id];
                        if(precoUnitario !== undefined) {
                            stmtItens.run(pedidoId, item.produto_id, item.quantidade, precoUnitario, (itemErr) => {
                                if(itemErr && !itemErrors) { itemErrors = true; console.error("Erro ao salvar item:", itemErr); }
                            });
                        } else {
                            itemErrors = true;
                            console.error(`Produto ID ${item.produto_id} não encontrado.`);
                        }
                    });

                    stmtItens.finalize(finalizeErr => {
                        if (finalizeErr || itemErrors) {
                            console.error("Erro finalize itens:", finalizeErr || "Erro ao salvar item.");
                            return db.run('ROLLBACK', () => reject(finalizeErr || new Error("Erro ao salvar itens")));
                        }
                        db.run('COMMIT', commitErr => {
                            if (commitErr) {
                                console.error("Commit Err:", commitErr);
                                return db.run('ROLLBACK', () => reject(commitErr));
                            }
                            console.log(`Pedido ${pedidoId} salvo com sucesso para usuário ${clienteId}.`);
                            resolve(pedidoId); // Sucesso! Retorna o ID do pedido.
                        });
                    });
                });
            });
        });
    });
}

// NOVA ROTA: Processa o pagamento (Cartão ou PIX)
app.post('/pagar-com-blackcat', isAuthenticatedCliente, async (req, res) => {
    const { paymentMethod, customer, cart, cardToken } = req.body;
    const clienteId = req.session.clienteId;
    
    // 1. Buscar produtos e calcular valor total (Validação de Preço)
    const productIds = Object.keys(cart).map(id => parseInt(id)).filter(id => !isNaN(id));
    if (productIds.length === 0) { return res.status(400).json({ error: 'Carrinho vazio' }); }
    
    const placeholders = productIds.map(() => '?').join(',');
    const sqlProdutos = `SELECT id, nome, preco, preco_promocional FROM produtos WHERE id IN (${placeholders})`;

    db.all(sqlProdutos, productIds, async (err, produtosDoBanco) => {
        if (err) { return res.status(500).json({ error: 'Erro ao buscar produtos' }); }

        let valorTotalCalculado = 0;
        const itensParaBlackCat = [];
        let carrinhoValido = true;

        for (const idStr in cart) {
            const id = parseInt(idStr);
            const produtoDoBanco = produtosDoBanco.find(p => p.id === id);
            
            if (!produtoDoBanco) {
                carrinhoValido = false;
                break;
            }

            const quantidade = cart[idStr].quantity;
            const precoAtual = (produtoDoBanco.preco_promocional && produtoDoBanco.preco_promocional > 0) ? produtoDoBanco.preco_promocional : produtoDoBanco.preco;
            
            valorTotalCalculado += precoAtual * quantidade;
            
            itensParaBlackCat.push({
                title: produtoDoBanco.nome,
                quantity: quantidade,
                tangible: true, 
                unitPrice: Math.round(precoAtual * 100) // Preço em centavos
            });
        }
        
        if (!carrinhoValido) {
            return res.status(400).json({ error: 'Carrinho inválido. Um produto não foi encontrado.' });
        }
        
        // 2. Montar o Payload Básico para a API do BlackCat
        const payload = {
            amount: Math.round(valorTotalCalculado * 100), // Total em centavos
            paymentMethod: paymentMethod,
            postbackUrl: `http://localhost:3000/blackcat-webhook`, // !!! ATENÇÃO: Em produção, precisa ser uma URL pública (https) !!!
            metadata: JSON.stringify({ clienteId: clienteId, cart: JSON.stringify(cart) }), // Salva nossos dados
            items: itensParaBlackCat,
            customer: {
                name: customer.nome,
                email: customer.email,
                document: {
                    type: customer.cpf.length === 11 ? 'cpf' : 'cnpj',
                    number: customer.cpf
                }
            }
        };

        // 3. Adicionar dados específicos do método de pagamento
        if (paymentMethod === 'credit_card') {
            payload.cardToken = cardToken;
            payload.installments = 1; 
        }

        // 4. Chamar a API do BlackCat Pagamentos
        try {
            console.log(">>> Enviando para BlackCat:", JSON.stringify(payload, null, 2));
            const response = await fetch(BLACKCAT_API_URL, {
                method: 'POST',
                headers: {
                    'Authorization': BLACKCAT_AUTH,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Erro da API BlackCat:", data);
                throw new Error(data.message || 'Gateway de pagamento recusou a transação.');
            }

            console.log("<<< Resposta do BlackCat:", data);

            // 5. Lidar com a resposta
            if (data.paymentMethod === 'credit_card') {
                if (data.status === 'paid' || data.status === 'approved') {
                    // SUCESSO NO CARTÃO! Salva o pedido imediatamente.
                    const enderecoEntrega = data.customer.address ? `${data.customer.address.street}, ${data.customer.address.streetNumber}` : "Endereço no Gateway";
                    await salvarPedidoNoBanco(clienteId, cart, valorTotalCalculado, enderecoEntrega, 'credit_card');
                    res.status(200).json({ status: 'paid', orderId: data.id });
                } else {
                    throw new Error(data.refusedReason || 'Pagamento recusado.');
                }
            } 
            else if (data.paymentMethod === 'pix') {
                if (data.status === 'waiting_payment' && data.pix && data.pix.qrcode) {
                    // SUCESSO AO GERAR PIX! Envia o QR Code para o navegador.
                    res.status(200).json({ 
                        status: 'waiting_payment', 
                        pix: {
                            qrcode: data.pix.qrcode, // Este é o "Copia e Cola"
                            copiaCola: data.pix.qrcode
                        }
                    });
                } else {
                    throw new Error('Não foi possível gerar o PIX.');
                }
            }

        } catch (error) {
            console.error('Erro na requisição para o BlackCat:', error);
            res.status(500).json({ error: error.message });
        }
    }); // Fim do db.all (busca de produtos)
});

// NOVA ROTA: Recebe Postbacks (Webhooks) do BlackCat
app.post('/blackcat-webhook', (req, res) => {
    const payload = req.body;
    console.log(">>> /blackcat-webhook: Postback Recebido <<<", JSON.stringify(payload, null, 2));

    try {
        if (payload.type === 'transaction' && payload.data) {
            const transacao = payload.data;

            if (transacao.status === 'paid' && (transacao.paymentMethod === 'pix' || transacao.paymentMethod === 'boleto')) {
                
                console.log(`>>> Transação ${transacao.id} foi paga! <<<`);
                const metadata = JSON.parse(transacao.metadata || '{}');
                const clienteId = metadata.clienteId;
                const cart = JSON.parse(metadata.cart || '{}');
                
                if (!clienteId || !cart) {
                     console.error("Webhook: Metadados inválidos (clienteId ou carrinho faltando).");
                     return res.status(400).send('Metadados inválidos');
                }

                const valorTotal = transacao.amount / 100;
                const endereco = transacao.customer.address;
                const enderecoEntrega = (endereco && endereco.street)
                    ? `${endereco.street}, ${endereco.streetNumber} - ${endereco.neighborhood}, ${endereco.city}/${endereco.state}`
                    : "Endereço no Gateway";

                // (Idealmente, verificaríamos se o pedido já não foi salvo pelo externalRef)
                
                salvarPedidoNoBanco(clienteId, cart, valorTotal, enderecoEntrega, transacao.paymentMethod)
                    .then(pedidoId => {
                        console.log(`Webhook: Pedido ${pedidoId} (PIX/Boleto) salvo com sucesso.`);
                    })
                    .catch(err => {
                        console.error(`Webhook: ERRO ao salvar pedido ${transacao.id}:`, err);
                    });
            } else {
                 console.log(`Webhook: Status ${transacao.status} recebido (não é 'paid') ou método ${transacao.paymentMethod}. Nada a fazer.`);
            }
        }
        
        res.status(200).send('OK'); 
    } catch (error) {
        console.error("Erro ao processar webhook:", error);
        res.status(500).send('Erro');
    }
});


// =======================================================
// --- Rotas do Painel de Administrador (Corrigidas) ---
// =======================================================

// Rota GET /admin (CORRIGIDA: Sem db.serialize)
app.get('/admin', isAuthenticatedAdmin, (req, res) => {
    let produtos = [];
    let pedidos = [];
    let errorMsg = null;
    
    // 1. Buscar Produtos
    const sqlProdutos = "SELECT * FROM produtos ORDER BY id DESC";
    db.all(sqlProdutos, [], (err, rowsProdutos) => {
        if (err) {
            console.error("Erro ao buscar produtos para admin:", err);
            errorMsg = "Erro ao buscar produtos.";
        } else {
            produtos = rowsProdutos;
        }

        // 2. Buscar Pedidos
        const sqlPedidos = `
            SELECT
                p.id, p.data_pedido, p.valor_total, p.status, p.endereco_entrega,
                u.nome as cliente_nome, u.email as cliente_email
            FROM pedidos p
            LEFT JOIN usuarios u ON p.usuario_id = u.id
            ORDER BY p.data_pedido DESC`;
        
        db.all(sqlPedidos, [], (errPedidos, rowsPedidos) => {
            if (errPedidos) {
                console.error("Erro ao buscar pedidos para admin:", errPedidos);
                errorMsg = errorMsg ? errorMsg + " Erro ao buscar pedidos." : "Erro ao buscar pedidos.";
            } else {
                rowsPedidos.forEach(pedido => {
                    try {
                        const dateObj = new Date(pedido.data_pedido);
                        pedido.data_formatada = !isNaN(dateObj) ? dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : "Data inválida";
                    } catch (e) { pedido.data_formatada = "Erro data"; }
                });
                pedidos = rowsPedidos;
            }

            // 3. Renderizar a página
            res.render('admin', {
                titulo: 'Painel Admin',
                produtos: produtos,
                pedidos: pedidos,
                error: errorMsg
            });
        });
    });
});

// Rota POST /admin/adicionar-produto
app.post('/admin/adicionar-produto', isAuthenticatedAdmin, (req, res) => {
    console.log(">>> Rota /admin/adicionar-produto: Dados recebidos:", req.body);
    let { nome, preco, preco_promocional, imagem, descricao } = req.body;
    if (!nome || !preco || !descricao) {
        console.warn(">>> FALHA NA VALIDAÇÃO: Campos obrigatórios faltando.", { nome, preco, descricao });
        return res.redirect('/admin?error=camposObrigatorios'); 
    }
    const precoPromoFinal = (preco_promocional && parseFloat(preco_promocional) > 0) ? parseFloat(preco_promocional) : null;
    const sql = "INSERT INTO produtos (nome, preco, preco_promocional, imagem, descricao) VALUES (?, ?, ?, ?, ?)";
    console.log(">>> Executando SQL Insert...");
    db.run(sql, [nome, preco, precoPromoFinal, imagem, descricao], function(err) {
        if (err) { 
            console.error(">>> ERRO AO INSERIR NO BANCO (db.run):", err.message); 
            return res.redirect(`/admin?error=dbError&msg=${encodeURIComponent(err.message)}`); 
        }
        console.log(`>>> SUCESSO: Produto adicionado com ID: ${this.lastID}`);
        res.redirect('/admin');
    });
});

// Rota POST /admin/update-status
app.post('/admin/update-status', isAuthenticatedAdmin, (req, res) => {
    const { pedidoId, novoStatus } = req.body;
    const statusValidos = ['Processando', 'Enviado', 'Entregue', 'Cancelado'];
    if (!pedidoId || !novoStatus || !statusValidos.includes(novoStatus)) {
        console.error("Tentativa de atualização de status inválida:", req.body);
        return res.redirect('/admin?statusError=1');
    }
    const sql = "UPDATE pedidos SET status = ? WHERE id = ?";
    db.run(sql, [novoStatus, pedidoId], function(err) {
        if (err) {
            console.error(`Erro ao atualizar status do pedido ${pedidoId}:`, err);
            return res.redirect('/admin?statusError=1');
        }
        if (this.changes === 0) {
             console.warn(`Nenhum pedido encontrado com ID ${pedidoId} para atualizar status.`);
             return res.redirect('/admin?statusError=2');
        }
        console.log(`Status do pedido ${pedidoId} atualizado para ${novoStatus}.`);
        res.redirect('/admin');
    });
});

// Rotas de Gerenciamento de Produtos (Editar, Excluir, Atualizar)
app.post('/admin/excluir', isAuthenticatedAdmin, (req, res) => {
    const { id } = req.body;
    const sql = "DELETE FROM produtos WHERE id = ?";
    db.run(sql, [id], function(err) {
        if (err) { console.error("Erro del prod:", err); return res.status(500).send("Erro excluir produto."); }
        res.redirect('/admin');
    });
});
app.get('/admin/editar/:id', isAuthenticatedAdmin, (req, res) => {
     const idProduto = req.params.id;
     const sql = "SELECT * FROM produtos WHERE id = ?";
     db.get(sql, [idProduto], (err, row) => {
         if (err) { console.error("Erro edit prod (get):", err); return res.status(500).send("Erro carregar produto."); }
         if (!row) { return res.status(404).send("Produto não encontrado."); }
         res.render('editar-produto', { titulo: `Editando: ${row.nome}`, produto: row });
     });
});
app.post('/admin/atualizar', isAuthenticatedAdmin, (req, res) => {
    let { id, nome, preco, preco_promocional, imagem, descricao } = req.body;
    if (!id || !nome || !preco || !descricao) { return res.status(400).send("Campos obrigatórios."); }
    const precoPromoFinal = (preco_promocional && parseFloat(preco_promocional) > 0) ? parseFloat(preco_promocional) : null;
    const sql = `UPDATE produtos SET nome = ?, preco = ?, preco_promocional = ?, imagem = ?, descricao = ? WHERE id = ?`;
    db.run(sql, [nome, preco, precoPromoFinal, imagem, descricao, id], function(err) {
        if (err) { console.error("Erro att prod:", err); return res.status(500).send("Erro atualizar produto."); }
        res.redirect('/admin');
    });
});

// --- 10. Iniciar Servidor ---
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

// --- Logs de Erro Genéricos ---
process.on('uncaughtException', (err) => { console.error('ERRO NÃO TRATADO:', err); });
process.on('unhandledRejection', (reason, promise) => { console.error('REJEIÇÃO NÃO TRATADA:', reason); });