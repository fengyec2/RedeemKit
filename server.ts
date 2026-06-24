import express, { Request, Response } from "express";
import * as path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import { db } from "./server/db";
import { adminRequired, generateToken, AuthenticatedRequest } from "./server/auth";

// Helper function to send notification email when redemption occurs
async function sendNotificationEmail(order: any, customValues: string) {
  try {
    const config = await db.getAllConfig();
    const adminEmail = config["admin_email"];
    if (!adminEmail) {
      console.log("Email Notification: No admin_email configured in settings. Skipping email notification.");
      return;
    }

    const smtpHost = config["smtp_host"];
    const smtpPort = config["smtp_port"];
    const smtpUser = config["smtp_user"];
    const smtpPass = config["smtp_pass"];
    const smtpFrom = config["smtp_from"] || smtpUser || "noreply@example.com";

    // Format custom values for readable display
    let fieldsHtml = "";
    if (customValues) {
      try {
        const parsed = JSON.parse(customValues);
        fieldsHtml = Object.entries(parsed)
          .map(([key, val]) => `<li><strong>${key}:</strong> ${val}</li>`)
          .join("\n");
      } catch (e) {
        fieldsHtml = `<li><strong>自定义字段原始值:</strong> ${customValues}</li>`;
      }
    }

    const emailSubject = `【新卡密兑换提醒】商品：${order.product_name} (订单号: ${order.id})`;
    const emailHtml = `
      <h2>您有新的商品兑换订单！</h2>
      <p>请及时登录后台管理台查看并进行人工发卡。</p>
      <hr/>
      <h3>订单详情</h3>
      <ul>
        <li><strong>订单编号：</strong> ${order.id}</li>
        <li><strong>兑换商品：</strong> ${order.product_name}</li>
        <li><strong>商品价格 (参考)：</strong> ¥${Number(order.price).toFixed(2)}</li>
        <li><strong>兑换时间：</strong> ${new Date(order.created_at).toLocaleString("zh-CN")}</li>
        <li><strong>联系方式：</strong> ${order.contact_info}</li>
        <li><strong>所用兑换卡密：</strong> ${order.card_codes || order.exchange_code}</li>
      </ul>
      
      <h3>用户填写的额外到账账号信息</h3>
      <ul>
        ${fieldsHtml || "<li>无额外输入项</li>"}
      </ul>
      <p>发卡成功后，可手动标记或处理。</p>
    `;

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      console.log(`Email Notification: Sending real email to ${adminEmail} via SMTP...`);
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: adminEmail,
        subject: emailSubject,
        html: emailHtml,
      });
      console.log("Email Notification: Real email sent successfully!");
    } else {
      console.log("=================================================");
      console.log("Email Notification (SMTP not fully configured, printed to console logs):");
      console.log(`To: ${adminEmail}`);
      console.log(`Subject: ${emailSubject}`);
      console.log(`HTML Body:\n${emailHtml}`);
      console.log("=================================================");
    }
  } catch (err) {
    console.error("Email Notification: Failed to send email", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Initialize DB tables
  await db.init();

  // ==========================================
  // PUBLIC CLIENT APIS
  // ==========================================

  // Get general site configuration
  app.get("/api/site-info", async (req: Request, res: Response) => {
    try {
      const config = await db.getAllConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: "获取站点配置失败: " + err.message });
    }
  });

  // Get active product categories
  app.get("/api/categories", async (req: Request, res: Response) => {
    try {
      const categories = await db.getCategories();
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ error: "获取商品分类失败: " + err.message });
    }
  });

  // Get products (only active products, with stock count attached)
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const products = await db.getProducts(true);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: "获取商品列表失败: " + err.message });
    }
  });

  // Search/Lookup orders by contact info (email/phone) or order ID
  app.get("/api/search-orders", async (req: Request, res: Response) => {
    const contact = req.query.contact as string;
    if (!contact) {
      res.status(400).json({ error: "请提供查询联系方式或订单号" });
      return;
    }

    try {
      const orders = await db.getOrdersByContact(contact);
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: "查询订单失败: " + err.message });
    }
  });

  // Create Order / Redeem with exchange code
  app.post("/api/order", async (req: Request, res: Response) => {
    const { productId, contactInfo, exchangeCode, customValues } = req.body;

    if (!productId || !contactInfo || !exchangeCode) {
      res.status(400).json({ error: "请填写完整的兑换信息(商品、联系方式、兑换卡密)" });
      return;
    }

    try {
      const customValuesStr = typeof customValues === "object" ? JSON.stringify(customValues) : (customValues || "{}");
      const order = await db.createOrder(Number(productId), contactInfo, exchangeCode, customValuesStr);
      
      // Trigger admin email notification in the background
      sendNotificationEmail(order, customValuesStr).catch(err => {
        console.error("邮件通知发送失败:", err);
      });

      res.json({
        success: true,
        message: "卡密兑换成功！管理员将尽快人工审核发货。",
        order,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // ADMIN AUTH APIS
  // ==========================================

  // Admin login
  app.post("/api/admin/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: "请输入用户名和密码" });
      return;
    }

    try {
      const user = await db.getUserByUsername(username);
      if (!user) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      const hash = db.hashPassword(password);
      if (user.password_hash !== hash) {
        res.status(401).json({ error: "用户名或密码错误" });
        return;
      }

      if (user.role !== "admin") {
        res.status(403).json({ error: "无管理员访问权限" });
        return;
      }

      // Generate verification token
      const token = generateToken({
        id: user.id,
        username: user.username,
        role: user.role,
      });

      res.json({
        success: true,
        token,
        user: {
          username: user.username,
          role: user.role,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: "登录服务器错误: " + err.message });
    }
  });

  // Get currently logged-in admin details
  app.get("/api/admin/me", adminRequired as any, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // ==========================================
  // ADMIN CATEGORY APIS (PROTECTED)
  // ==========================================

  // Create Category
  app.post("/api/admin/categories", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, sortOrder } = req.body;
    if (!name) {
      res.status(400).json({ error: "分类名称不能为空" });
      return;
    }

    try {
      const cat = await db.createCategory(name, description || "", Number(sortOrder || 0));
      res.json({ success: true, category: cat });
    } catch (err: any) {
      res.status(500).json({ error: "创建分类失败: " + err.message });
    }
  });

  // Update Category
  app.put("/api/admin/categories/:id", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const { name, description, sortOrder } = req.body;

    if (!name) {
      res.status(400).json({ error: "分类名称不能为空" });
      return;
    }

    try {
      const cat = await db.updateCategory(id, name, description || "", Number(sortOrder || 0));
      if (!cat) {
        res.status(404).json({ error: "该分类不存在" });
        return;
      }
      res.json({ success: true, category: cat });
    } catch (err: any) {
      res.status(500).json({ error: "更新分类失败: " + err.message });
    }
  });

  // Delete Category
  app.delete("/api/admin/categories/:id", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    try {
      const success = await db.deleteCategory(id);
      if (!success) {
        res.status(404).json({ error: "分类删除失败或分类不存在" });
        return;
      }
      res.json({ success: true, message: "分类删除成功" });
    } catch (err: any) {
      res.status(500).json({ error: "删除分类失败: " + err.message });
    }
  });

  // ==========================================
  // ADMIN PRODUCT APIS (PROTECTED)
  // ==========================================

  // Get products (all products, including inactive ones)
  app.get("/api/admin/products", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const products = await db.getProducts(false);
      res.json(products);
    } catch (err: any) {
      res.status(500).json({ error: "获取商品列表失败: " + err.message });
    }
  });

  // Create Product
  app.post("/api/admin/products", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const { categoryId, name, description, price, status, imageUrl, customFields } = req.body;

    if (!categoryId || !name || price === undefined) {
      res.status(400).json({ error: "商品名称、价格、以及分类为必填项" });
      return;
    }

    try {
      const product = await db.createProduct(
        Number(categoryId),
        name,
        description || "",
        Number(price),
        status || "active",
        imageUrl || "",
        customFields || ""
      );
      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ error: "创建商品失败: " + err.message });
    }
  });

  // Update Product
  app.put("/api/admin/products/:id", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    const { categoryId, name, description, price, status, imageUrl, customFields } = req.body;

    if (!categoryId || !name || price === undefined) {
      res.status(400).json({ error: "商品名称、价格、以及分类为必填项" });
      return;
    }

    try {
      const product = await db.updateProduct(
        id,
        Number(categoryId),
        name,
        description || "",
        Number(price),
        status || "active",
        imageUrl || "",
        customFields || ""
      );
      if (!product) {
        res.status(404).json({ error: "商品不存在" });
        return;
      }
      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ error: "更新商品失败: " + err.message });
    }
  });

  // Delete Product
  app.delete("/api/admin/products/:id", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    try {
      const success = await db.deleteProduct(id);
      if (!success) {
        res.status(404).json({ error: "商品删除失败或商品不存在" });
        return;
      }
      res.json({ success: true, message: "商品及相关未售出卡密删除成功" });
    } catch (err: any) {
      res.status(500).json({ error: "删除商品失败: " + err.message });
    }
  });

  // ==========================================
  // ADMIN CARD APIS (PROTECTED)
  // ==========================================

  // Get cards list (can filter by productId)
  app.get("/api/admin/cards", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    try {
      const cards = await db.getCards(productId);
      res.json(cards);
    } catch (err: any) {
      res.status(500).json({ error: "获取卡密库存失败: " + err.message });
    }
  });

  // Import Cards (Batch upload key codes)
  app.post("/api/admin/cards/import", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const { productId, codes } = req.body;

    if (!productId || !codes) {
      res.status(400).json({ error: "必须指定对应的商品和卡密文本" });
      return;
    }

    // Split text codes by newline or commas
    const codesList = typeof codes === "string" 
      ? codes.split(/\r?\n/).map(c => c.trim()).filter(c => c.length > 0)
      : codes;

    if (codesList.length === 0) {
      res.status(400).json({ error: "解析出的有效卡密为空，请检查输入格式" });
      return;
    }

    try {
      const count = await db.importCards(Number(productId), codesList);
      res.json({ success: true, message: `成功导入 ${count} 张卡密！` });
    } catch (err: any) {
      res.status(500).json({ error: "导入卡密失败: " + err.message });
    }
  });

  // Delete Card
  app.delete("/api/admin/cards/:id", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const id = Number(req.params.id);
    try {
      const success = await db.deleteCard(id);
      if (!success) {
        res.status(404).json({ error: "卡密不存在或删除失败" });
        return;
      }
      res.json({ success: true, message: "卡密删除成功" });
    } catch (err: any) {
      res.status(500).json({ error: "删除卡密失败: " + err.message });
    }
  });

  // Clear all unsold cards for a product
  app.delete("/api/admin/cards/clear/:productId", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const productId = Number(req.params.productId);
    try {
      const count = await db.clearUnsoldCards(productId);
      res.json({ success: true, message: `成功清空 ${count} 个未售出卡密` });
    } catch (err: any) {
      res.status(500).json({ error: "清空卡密失败: " + err.message });
    }
  });

  // ==========================================
  // ADMIN ORDER LIST & CONFIGS APIS (PROTECTED)
  // ==========================================

  // Get all orders
  app.get("/api/admin/orders", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orders = await db.getOrders();
      res.json(orders);
    } catch (err: any) {
      res.status(500).json({ error: "获取订单列表失败: " + err.message });
    }
  });

  // Save Site Configuration
  app.post("/api/admin/config", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    const { key, value } = req.body;
    if (!key) {
      res.status(400).json({ error: "配置键 (key) 不能为空" });
      return;
    }

    try {
      await db.setConfig(key, value || "");
      res.json({ success: true, message: "配置已保存" });
    } catch (err: any) {
      res.status(500).json({ error: "保存配置失败: " + err.message });
    }
  });

  // Get Admin Dashboard Stats
  app.get("/api/admin/stats", adminRequired as any, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await db.getStats();
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: "获取站点统计失败: " + err.message });
    }
  });

  // ==========================================
  // VITE SERVER & FRONTEND SERVING
  // ==========================================

  if (process.env.NODE_ENV !== "production") {
    // Development Mode: Use Vite Middleware
    console.log("Database: Initializing Vite in dev middleware mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production Mode: Serve compiled static files
    console.log("Database: Running in Production Mode. Serving dist files.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Listen
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`==================================================`);
    console.log(`Server successfully started and running on port ${PORT}`);
    console.log(`Address: http://0.0.0.0:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`==================================================`);
  });
}

startServer().catch(err => {
  console.error("Critical error while starting express server:", err);
});
