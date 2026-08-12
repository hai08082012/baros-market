const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

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

const orders = [];

let adminLoggedIn = false;

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/product/:id", (req, res) => {
    const product = products[req.params.id];

    if (!product) {
        return res.status(404).send("Không tìm thấy sản phẩm");
    }

    res.render("product", { product });
});

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

    const order = {
        id: orders.length + 1,
        product: product.name,
        price: product.price,
        name: name,
        email: email,
        time: new Date().toLocaleString("vi-VN"),
        status: "Chờ xử lý"
    };

    orders.push(order);

    res.render("success", { order });
});

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

app.get("/admin", (req, res) => {
    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    res.render("admin", { orders });
});

app.post("/admin/order/:id/status", (req, res) => {
    if (!adminLoggedIn) {
        return res.redirect("/admin/login");
    }

    const order = orders.find(
        order => order.id === Number(req.params.id)
    );

    if (!order) {
        return res.status(404).send("Không tìm thấy đơn hàng");
    }

    order.status = req.body.status;

    res.redirect("/admin");
});

app.get("/admin/logout", (req, res) => {
    adminLoggedIn = false;
    res.redirect("/admin/login");
});

app.listen(PORT, () => {
    console.log(`Web đang chạy tại http://localhost:${PORT}`);
});