// Conteúdo resumido do server.js (não coloco inteiro aqui por limite)
// server.js
import express from "express";
import session from "express-session";
import bcrypt from "bcrypt";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

// Garante pasta uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer setup (salva em /uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    // nome único: timestamp + originalname (remover espaços problemáticos)
    const safeName = file.originalname.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
    cb(null, `${Date.now()}_${safeName}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // aceita apenas audio (mp3, m4a, wav) — ajustar conforme necessário
    if (/audio|mpeg|mp3|wav|m4a/.test(file.mimetype) || /\.(mp3|m4a|wav)$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de áudio são permitidos"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB max
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "troque_essa_chave_para_producao",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 3600 * 1000 }
}));

// Servir estáticos
app.use(express.static(path.join(__dirname, "public")));
app.use("/admin", express.static(path.join(__dirname, "admin")));
app.use("/uploads", express.static(uploadsDir)); // arquivos de áudio públicos

let db;
(async () => {
  db = await open({
    filename: path.join(__dirname, "database.sqlite"),
    driver: sqlite3.Database
  });

  await db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
    CREATE TABLE IF NOT EXISTS musicas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      posicao INTEGER NOT NULL,
      titulo TEXT,
      audio TEXT,
      letra TEXT,
      capa TEXT,
      UNIQUE(data, posicao)
    );
  `);

  const admin = await db.get("SELECT * FROM users WHERE username = ?", "admin");
  if (!admin) {
    const hash = await bcrypt.hash("1234", 10);
    const novaSenhaHash = await bcrypt.hash("F1003J", 10);
    await db.run("UPDATE users SET password = ? WHERE username = ?", novaSenhaHash, "admin");
    await db.run("INSERT INTO users (username, password) VALUES (?, ?)", "admin", hash);
    console.log("Usuário admin criado -> usuário: admin / senha: 1234 (altere depois)");

  }

  app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
})();

// Middleware auth
function auth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: "Não autorizado" });
}

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Dados incompletos" });
    const user = await db.get("SELECT * FROM users WHERE username = ?", username);
    if (!user) return res.status(401).json({ error: "Usuário ou senha inválidos" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Usuário ou senha inválidos" });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// UPLOAD (admin) - envia arquivo e retorna { url }
app.post("/api/upload", auth, upload.single("audio"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Arquivo não enviado" });
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro no upload" });
  }
});

// GET public: retornar músicas agrupadas por data (AAAA-MM-DD)
app.get("/api/musicas", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM musicas ORDER BY data, posicao");
    const out = {};
    for (const r of rows) {
      if (!out[r.data]) out[r.data] = [];
      out[r.data][r.posicao - 1] = {
        id: r.id,
        titulo: r.titulo,
        audio: r.audio,
        letra: r.letra,
        capa: r.capa,
        posicao: r.posicao
      };
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar músicas" });
  }
});

// GET admin raw: lista todas (para painel)
app.get("/api/admin/musicas", auth, async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM musicas ORDER BY data DESC, posicao");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro" });
  }
});

// POST adicionar/editar música (admin)
// Se posicao não for passada, adiciona ao final (posicao = max+1)
app.post("/api/musicas", auth, async (req, res) => {
  try {
    const { data, posicao, titulo, audio, letra, capa } = req.body;
    if (!data) return res.status(400).json({ error: "Campo data é obrigatório (AAAA-MM-DD)" });

    let p;
    if (posicao) {
      p = parseInt(posicao, 10);
      if (isNaN(p) || p < 1) return res.status(400).json({ error: "posicao inválida" });
    } else {
      const row = await db.get("SELECT MAX(posicao) as m FROM musicas WHERE data = ?", data);
      p = (row && row.m) ? row.m + 1 : 1;
    }

    // Upsert manual para compatibilidade
    const exists = await db.get("SELECT * FROM musicas WHERE data = ? AND posicao = ?", data, p);
    if (exists) {
      await db.run(
        `UPDATE musicas SET titulo = ?, audio = ?, letra = ?, capa = ? WHERE data = ? AND posicao = ?`,
        titulo || null, audio || null, letra || null, capa || null, data, p
      );
    } else {
      await db.run(
        `INSERT INTO musicas (data, posicao, titulo, audio, letra, capa) VALUES (?, ?, ?, ?, ?, ?)`,
        data, p, titulo || null, audio || null, letra || null, capa || null
      );
    }

    res.json({ success: true, posicao: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao salvar música" });
  }
});

// DELETE música (admin) opcional — para gerenciar
app.delete("/api/musicas/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;
    await db.run("DELETE FROM musicas WHERE id = ?", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao deletar" });
  }
});


// No final, use a versão detalhada enviada antes adaptada para N músicas
