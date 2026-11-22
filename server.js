require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("Configura SESSION_SECRET con al menos 32 caracteres.");
}
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 ||
    process.env.ADMIN_PASSWORD.startsWith("replace-")) {
  throw new Error("Configura ADMIN_PASSWORD con al menos 12 caracteres.");
}
if (!process.env.WHATSAPP_NUMBER || process.env.WHATSAPP_NUMBER.includes("X")) {
  console.warn("Configura WHATSAPP_NUMBER en las variables de entorno.");
}

const db = new Database(path.join(dataDir, "dental-rosse.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT NOT NULL,
 price_cents INTEGER,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 customer_type TEXT NOT NULL,
 service TEXT NOT NULL,
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Nuevo',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admins (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL
);
`);
const productCount = db.prepare("SELECT COUNT(*) AS n FROM products").get().n;
if (productCount === 0) {
  const add = db.prepare("INSERT INTO products(name,description,price_cents) VALUES(?,?,NULL)");
  add.run("Corona dental", "Restauración personalizada. Precio según evaluación.");
  add.run("Prótesis removible", "Solución protésica removible personalizada.");
  add.run("Puente dental", "Restauración de varias piezas.");
  add.run("Prótesis sobre implante", "Solución protésica sobre implantes.");
}
const adminName = process.env.ADMIN_USERNAME || "admin";
const existingAdmin = db.prepare("SELECT id FROM admins WHERE username=?").get(adminName);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);
  db.prepare("INSERT INTO admins(username,password_hash) VALUES(?,?)").run(adminName, hash);
}

app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: isProd ? [] : null
    }
  }
}));
if (isProd) app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    maxAge: 1000 * 60 * 60 * 8
  }
}));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });

function requireAdmin(req, res, next) {
  if (!req.session.adminId) return res.status(401).json({ error: "No autorizado." });
  next();
}
function clean(value, max=500) {
  return String(value || "").trim().slice(0, max);
}

app.get("/api/config", (req,res) => {
  res.json({
    siteName: process.env.SITE_NAME || "Dental Rosse",
    currency: "USD",
    whatsappConfigured: !!(process.env.WHATSAPP_NUMBER && !process.env.WHATSAPP_NUMBER.includes("X")),
    whatsappNumber: (process.env.WHATSAPP_NUMBER && !process.env.WHATSAPP_NUMBER.includes("X")) ? process.env.WHATSAPP_NUMBER : null
  });
});

app.get("/api/products", (req,res) => {
  const rows = db.prepare("SELECT id,name,description,price_cents FROM products WHERE active=1 ORDER BY id DESC").all();
  res.json(rows);
});

app.post("/api/orders", orderLimiter, (req,res) => {
  const name = clean(req.body.name,100);
  const phone = clean(req.body.phone,40);
  const customerType = clean(req.body.customerType,40);
  const service = clean(req.body.service,100);
  const details = clean(req.body.details,1000);
  if (!name || !phone || !service || !["Paciente","Clínica dental","Odontólogo"].includes(customerType)) {
    return res.status(400).json({error:"Revisa los campos obligatorios."});
  }
  const result = db.prepare(
    "INSERT INTO orders(name,phone,customer_type,service,details) VALUES(?,?,?,?,?)"
  ).run(name,phone,customerType,service,details);
  res.status(201).json({ok:true, id:Number(result.lastInsertRowid)});
});

app.post("/api/admin/login", loginLimiter, (req,res) => {
  const username = clean(req.body.username,80);
  const password = String(req.body.password || "");
  const admin = db.prepare("SELECT id,password_hash FROM admins WHERE username=?").get(username);
  if (!admin || !bcrypt.compareSync(password,admin.password_hash)) {
    return res.status(401).json({error:"Usuario o contraseña incorrectos."});
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({error:"No se pudo iniciar sesión."});
    req.session.adminId = admin.id;
    res.json({ok:true});
  });
});
app.post("/api/admin/logout", requireAdmin, (req,res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ok:true});
  });
});
app.get("/api/admin/me", (req,res) => res.json({authenticated:!!req.session.adminId}));

app.get("/api/admin/orders", requireAdmin, (req,res) => {
  res.json(db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 300").all());
});
app.patch("/api/admin/orders/:id", requireAdmin, (req,res) => {
  const status = clean(req.body.status,30);
  if (!["Nuevo","En revisión","En proceso","Completado","Cancelado"].includes(status))
    return res.status(400).json({error:"Estado no válido."});
  const result = db.prepare("UPDATE orders SET status=? WHERE id=?").run(status,Number(req.params.id));
  if (!result.changes) return res.status(404).json({error:"Pedido no encontrado."});
  res.json({ok:true});
});
app.post("/api/admin/products", requireAdmin, (req,res) => {
  const name = clean(req.body.name,100), description = clean(req.body.description,500);
  const price = req.body.price === "" || req.body.price == null ? null : Number(req.body.price);
  if (!name || !description || (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000)))
    return res.status(400).json({error:"Datos de producto no válidos."});
  const cents = price === null ? null : Math.round(price*100);
  const result = db.prepare("INSERT INTO products(name,description,price_cents) VALUES(?,?,?)").run(name,description,cents);
  res.status(201).json({id:Number(result.lastInsertRowid)});
});
app.delete("/api/admin/products/:id", requireAdmin, (req,res) => {
  const result = db.prepare("UPDATE products SET active=0 WHERE id=?").run(Number(req.params.id));
  if (!result.changes) return res.status(404).json({error:"Producto no encontrado."});
  res.json({ok:true});
});

app.use(express.static(path.join(__dirname,"public")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`Dental Rosse activo en puerto ${PORT}`));
