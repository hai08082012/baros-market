const express = require("express");
const Database = require("better-sqlite3");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");

// ==================== THANH TOÁN NGÂN HÀNG ====================

const BANK_NAME = "MB BANK";
const BANK_ACCOUNT = "0822465866";
const ACCOUNT_NAME = "NGUYEN GIA BAO";

// ==================== DATABASE ====================

const db = new Database("shop.db");

// ==================== ORDERS ====================

db.prepare(`
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product TEXT NOT NULL,
        price TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT NOT NULL
    )
`).run();

// Kiểm tra database cũ có thiếu user_id

const orderColumns = db
    .prepare(`PRAGMA table_info(orders)`)
    .all();

const hasUserId = orderColumns.some(
    column => column.name === "user_id"
);

if (!hasUserId) {

    db.prepare(`
        ALTER TABLE orders
        ADD COLUMN user_id INTEGER
    `).run();

    console.log(
        "Đã thêm cột user_id vào bảng orders."
    );
}

// ==================== USERS ====================

db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        time TEXT NOT NULL
    )
`).run();

// ==================== TRANSACTIONS ====================

db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        time TEXT NOT NULL
    )
`).run();

// ==================== SESSION ====================

const sessions = new Map();

function createSession(userId) {

    const token = crypto
        .randomBytes(32)
        .toString("hex");

    sessions.set(token, userId);

    return token;
}

function getCurrentUser(req) {

    const cookie = req.headers.cookie || "";

    const match = cookie.match(
        /baro_session=([^;]+)/
    );

    if (!match) {
        return null;
    }

    const userId = sessions.get(match[1]);

    if (!userId) {
        return null;
    }

    return db.prepare(`
        SELECT id, username, email, balance
        FROM users
        WHERE id = ?
    `).get(userId);
}

function requireLogin(req, res, next) {

    const user = getCurrentUser(req);

    if (!user) {
        return res.redirect("/login");
    }

    req.user = user;

    next();
}

// ==================== SẢN PHẨM ====================

const products = {

    1: {
        id: 1,
        name: "Dịch vụ 01",
        price: 10000,
        description: "Mô tả chi tiết dịch vụ 01."
    },

    2: {
        id: 2,
        name: "Dịch vụ 02",
        price: 20000,
        description: "Mô tả chi tiết dịch vụ 02."
    },

    3: {
        id: 3,
        name: "Dịch vụ 03",
        price: 50000,
        description: "Mô tả chi tiết dịch vụ 03."
    }

};

function formatMoney(number) {

    return Number(number)
        .toLocaleString("vi-VN") + "đ";
}

// ==================== ADMIN ====================

let adminLoggedIn = false;

// ==================== TRANG CHỦ ====================

app.get("/", (req, res) => {

    res.render("home", {
        user: getCurrentUser(req),
        products
    });

});

// ==================== ĐĂNG KÝ ====================

app.get("/register", (req, res) => {

    res.render("register", {
        error: null
    });

});

app.post("/register", (req, res) => {

    const {
        username,
        email,
        password
    } = req.body;

    if (!username || !email || !password) {

        return res.render("register", {
            error: "Vui lòng nhập đầy đủ thông tin!"
        });

    }

    if (username.length < 3) {

        return res.render("register", {
            error:
                "Username phải có ít nhất 3 ký tự!"
        });

    }

    if (password.length < 6) {

        return res.render("register", {
            error:
                "Mật khẩu phải có ít nhất 6 ký tự!"
        });

    }

    const exists = db.prepare(`
        SELECT id
        FROM users
        WHERE username = ? OR email = ?
    `).get(username, email);

    if (exists) {

        return res.render("register", {
            error:
                "Username hoặc email đã tồn tại!"
        });

    }

    const passwordHash = crypto
        .createHash("sha256")
        .update(password)
        .digest("hex");

    db.prepare(`
        INSERT INTO users
        (username, email, password, balance, time)
        VALUES (?, ?, ?, ?, ?)
    `).run(
        username,
        email,
        passwordHash,
        0,
        new Date().toLocaleString("vi-VN")
    );

    res.redirect("/login");

});

// ==================== ĐĂNG NHẬP ====================

app.get("/login", (req, res) => {

    res.render("login", {
        error: null
    });

});

app.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    const passwordHash = crypto
        .createHash("sha256")
        .update(password || "")
        .digest("hex");

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE username = ? AND password = ?
    `).get(
        username,
        passwordHash
    );

    if (!user) {

        return res.render("login", {
            error:
                "Sai username hoặc mật khẩu!"
        });

    }

    const token = createSession(user.id);

    res.setHeader(
        "Set-Cookie",
        `baro_session=${token}; HttpOnly; Path=/; SameSite=Lax`
    );

    res.redirect("/account");

});

// ==================== ĐĂNG XUẤT ====================

app.get("/logout", (req, res) => {

    const cookie = req.headers.cookie || "";

    const match = cookie.match(
        /baro_session=([^;]+)/
    );

    if (match) {
        sessions.delete(match[1]);
    }

    res.setHeader(
        "Set-Cookie",
        "baro_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
    );

    res.redirect("/");

});

// ==================== TÀI KHOẢN ====================

app.get("/account", requireLogin, (req, res) => {

    const transactions = db.prepare(`
        SELECT *
        FROM transactions
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(req.user.id);

    res.render("account", {
        user: req.user,
        transactions
    });

});

// ==================== NẠP TIỀN ====================

app.get("/deposit", requireLogin, (req, res) => {

    res.render("payment", {

        user: req.user,

        bankName: BANK_NAME,

        bankAccount: BANK_ACCOUNT,

        accountName: ACCOUNT_NAME

    });

});

// ==================== CHI TIẾT SẢN PHẨM ====================

app.get("/product/:id", (req, res) => {

    const product = products[req.params.id];

    if (!product) {

        return res.status(404).send(
            "Không tìm thấy sản phẩm"
        );

    }

    res.render("product", {

        product,

        user: getCurrentUser(req),

        formatMoney

    });

});

// ==================== TRANG ĐẶT HÀNG ====================

app.get("/order/:id", requireLogin, (req, res) => {

    const product = products[req.params.id];

    if (!product) {

        return res.status(404).send(
            "Không tìm thấy sản phẩm"
        );

    }

    res.render("order", {

        product,

        user: req.user,

        formatMoney

    });

});

// ==================== ĐẶT HÀNG ====================

app.post("/order", requireLogin, (req, res) => {

    const {
        productId,
        name,
        email
    } = req.body;

    const product = products[productId];

    if (!product) {

        return res.status(404).send(
            "Không tìm thấy sản phẩm"
        );

    }

    if (!name || !email) {

        return res.status(400).send(
            "Vui lòng nhập đầy đủ thông tin!"
        );

    }

    const user = db.prepare(`
        SELECT *
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    // Kiểm tra số dư

    if (user.balance < product.price) {

        return res.status(400).send(`

            <html>

            <head>

                <meta charset="UTF-8">

                <title>
                    Không đủ số dư
                </title>

                <style>

                    body {
                        background:#0b0d12;
                        color:white;
                        font-family:Arial;
                        text-align:center;
                        padding-top:100px;
                    }

                    .box {
                        background:#151821;
                        border:1px solid #292d38;
                        border-radius:16px;
                        padding:35px;
                        max-width:500px;
                        margin:auto;
                    }

                    .money {
                        color:#6c63ff;
                        font-weight:bold;
                    }

                    a {
                        display:inline-block;
                        margin-top:20px;
                        padding:12px 20px;
                        background:#6c63ff;
                        color:white;
                        text-decoration:none;
                        border-radius:8px;
                    }

                </style>

            </head>

            <body>

                <div class="box">

                    <h1>
                        ❌ Không đủ số dư
                    </h1>

                    <p>
                        Dịch vụ:
                        <b>${product.name}</b>
                    </p>

                    <p>
                        Giá:
                        <span class="money">
                            ${formatMoney(product.price)}
                        </span>
                    </p>

                    <p>
                        Số dư hiện tại:
                        <span class="money">
                            ${formatMoney(user.balance)}
                        </span>
                    </p>

                    <p>
                        Bạn cần nạp thêm tiền
                        để mua dịch vụ này.
                    </p>

                    <a href="/account">
                        ← Về tài khoản
                    </a>

                </div>

            </body>

            </html>

        `);

    }

    // ==================== GIAO DỊCH ====================

    const transaction = db.transaction(() => {

        // Trừ tiền

        db.prepare(`
            UPDATE users
            SET balance = balance - ?
            WHERE id = ?
        `).run(
            product.price,
            user.id
        );

        // Ghi lịch sử

        db.prepare(`
            INSERT INTO transactions
            (user_id, type, amount, description, time)
            VALUES (?, ?, ?, ?, ?)
        `).run(

            user.id,

            "Mua dịch vụ",

            -product.price,

            `Mua ${product.name}`,

            new Date().toLocaleString("vi-VN")

        );

        // Tạo đơn hàng

        const result = db.prepare(`
            INSERT INTO orders
            (user_id, product, price, name, email, time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(

            user.id,

            product.name,

            formatMoney(product.price),

            name,

            email,

            new Date().toLocaleString("vi-VN"),

            "Đã thanh toán bằng số dư"

        );

        return result.lastInsertRowid;

    });

    const orderId = transaction();

    const order = db.prepare(`
        SELECT *
        FROM orders
        WHERE id = ?
    `).get(orderId);

    res.render("success", {

        order,

        user: getCurrentUser(req)

    });

});

// ==================== ADMIN LOGIN ====================

app.get("/admin/login", (req, res) => {

    res.render("admin-login", {
        error: null
    });

});

app.post("/admin/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

    if (
        username === "admin" &&
        password === "123456"
    ) {

        adminLoggedIn = true;

        return res.redirect("/admin");

    }

    res.render("admin-login", {

        error:
            "Sai tài khoản hoặc mật khẩu!"

    });

});

// ==================== ADMIN ====================

app.get("/admin", (req, res) => {

    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    const orders = db.prepare(`
        SELECT *
        FROM orders
        ORDER BY id DESC
    `).all();

    const users = db.prepare(`
        SELECT id, username, email, balance, time
        FROM users
        ORDER BY id DESC
    `).all();

    res.render("admin", {

        orders,

        users,

        formatMoney

    });

});

// ==================== ADMIN XEM USER ====================

app.get("/admin/user/:id", (req, res) => {

    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    const userId = Number(req.params.id);

    const user = db.prepare(`
        SELECT id, username, email, balance, time
        FROM users
        WHERE id = ?
    `).get(userId);

    if (!user) {

        return res.status(404).send(
            "Không tìm thấy tài khoản"
        );

    }

    const transactions = db.prepare(`
        SELECT *
        FROM transactions
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(userId);

    const orders = db.prepare(`
        SELECT *
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
    `).all(userId);

    res.render("admin-user", {

        user,

        transactions,

        orders,

        formatMoney

    });

});

// ==================== ADMIN CỘNG / TRỪ TIỀN ====================

app.post(
    "/admin/user/:id/balance",
    (req, res) => {

        if (!adminLoggedIn) {
            return res.redirect(
                "/admin/login"
            );
        }

        const userId =
            Number(req.params.id);

        const amount =
            Number(req.body.amount);

        const action =
            req.body.action;

        if (
            !Number.isInteger(amount) ||
            amount <= 0
        ) {

            return res.status(400).send(
                "Số tiền không hợp lệ"
            );

        }

        const user = db.prepare(`
            SELECT *
            FROM users
            WHERE id = ?
        `).get(userId);

        if (!user) {

            return res.status(404).send(
                "Không tìm thấy tài khoản"
            );

        }

        // CỘNG TIỀN

        if (action === "add") {

            db.prepare(`
                UPDATE users
                SET balance = balance + ?
                WHERE id = ?
            `).run(
                amount,
                userId
            );

            db.prepare(`
                INSERT INTO transactions
                (user_id, type, amount, description, time)
                VALUES (?, ?, ?, ?, ?)
            `).run(

                userId,

                "Nạp tiền",

                amount,

                "Admin cộng tiền",

                new Date().toLocaleString("vi-VN")

            );

        }

        // TRỪ TIỀN

        else if (action === "remove") {

            if (user.balance < amount) {

                return res.status(400).send(
                    "Không thể trừ tiền: số dư không đủ!"
                );

            }

            db.prepare(`
                UPDATE users
                SET balance = balance - ?
                WHERE id = ?
            `).run(
                amount,
                userId
            );

            db.prepare(`
                INSERT INTO transactions
                (user_id, type, amount, description, time)
                VALUES (?, ?, ?, ?, ?)
            `).run(

                userId,

                "Trừ tiền",

                -amount,

                "Admin trừ tiền",

                new Date().toLocaleString("vi-VN")

            );

        }

        else {

            return res.status(400).send(
                "Thao tác không hợp lệ"
            );

        }

        res.redirect(
            `/admin/user/${userId}`
        );

    }
);

// ==================== ĐỔI TRẠNG THÁI ĐƠN ====================

app.post(
    "/admin/order/:id/status",
    (req, res) => {

        if (!adminLoggedIn) {

            return res.redirect(
                "/admin/login"
            );

        }

        const order = db.prepare(`
            SELECT *
            FROM orders
            WHERE id = ?
        `).get(req.params.id);

        if (!order) {

            return res.status(404).send(
                "Không tìm thấy đơn hàng"
            );

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

    }
);

// ==================== ADMIN LOGOUT ====================

app.get("/admin/logout", (req, res) => {

    adminLoggedIn = false;

    res.redirect("/admin/login");

});

// ==================== START ====================

app.listen(PORT, () => {

    console.log(
        `Web đang chạy tại http://localhost:${PORT}`
    );

});