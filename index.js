const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// ==================== DATABASE ====================

const db = new Database("shop.db");

db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product TEXT NOT NULL,
        price TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL
    )
`).run();

// ==================== SẢN PHẨM ====================

const products = {
    1: {
        id: 1,
        name: "Dịch vụ 01",
        price: "10.000đ",
        description: "Mô tả chi tiết dịch vụ 01."
    },
    2: {
        id: 2,
        name: "Dịch vụ 02",
        price: "20.000đ",
        description: "Mô tả chi tiết dịch vụ 02."
    },
    3: {
        id: 3,
        name: "Dịch vụ 03",
        price: "50.000đ",
        description: "Mô tả chi tiết dịch vụ 03."
    }
};

let adminLoggedIn = false;

// ==================== TRANG CHỦ ====================

app.get("/", (req, res) => {
    res.render("home");
});

// ==================== CHI TIẾT SẢN PHẨM ====================

app.get("/product/:id", (req, res) => {
    const product = products[req.params.id];

    if (!product) {
        return res.status(404).send("Không tìm thấy sản phẩm");
    }

    res.render("product", { product });
});

// ==================== ĐẶT HÀNG ====================

app.get("/order/:id", (req, res) => {
    const product = products[req.params.id];

    if (!product) {
        return res.status(404).send("Không tìm thấy sản phẩm");
    }

    res.render("order", { product });
});

app.post("/order", (req, res) => {
    const { productId, name, email } = req.body;

    const product = products[productId];

    if (!product) {
        return res.status(404).send("Không tìm thấy sản phẩm");
    }

    const time = new Date().toLocaleString("vi-VN");

    const result = db.prepare(`
        INSERT INTO orders
        (product, price, name, email, time, status)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(
        product.name,
        product.price,
        name,
        email,
        time,
        "Chờ xử lý"
    );

    const order = db.prepare(`
        SELECT * FROM orders WHERE id = ?
    `).get(result.lastInsertRowid);

    res.render("success", { order });
});

// ==================== ADMIN LOGIN ====================

app.get("/admin/login", (req, res) => {
    res.render("admin-login", { error: null });
});

app.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (username === "admin" && password === "123456") {
        adminLoggedIn = true;
        return res.redirect("/admin");
    }

    res.render("admin-login", {
        error: "Sai tài khoản hoặc mật khẩu!"
    });
});

// ==================== ADMIN ====================

app.get("/admin", (req, res) => {
    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    const orders = db.prepare(`
        SELECT * FROM orders
        ORDER BY id DESC
    `).all();

    res.render("admin", { orders });
});

// ==================== ĐỔI TRẠNG THÁI ĐƠN ====================

app.post("/admin/order/:id/status", (req, res) => {
    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    const order = db.prepare(`
        SELECT * FROM orders WHERE id = ?
    `).get(req.params.id);

    if (!order) {
        return res.status(404).send("Không tìm thấy đơn hàng");
    }

    db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
    `).run(
        req.body.status,
        req.params.id
    );

    res.redirect("/admin");
});

// ==================== LOGOUT ====================

app.get("/admin/logout", (req, res) => {
    adminLoggedIn = false;
    res.redirect("/admin/login");
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`Web đang chạy tại http://localhost:${PORT}`);
});