import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// Database schemas/types
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string; // 'admin' | 'user'
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string;
  price: number;
  status: string; // 'active' | 'inactive'
  image_url: string;
  created_at: string;
  // Dynamic card inventory info
  stock_count?: number;
  custom_fields?: string; // Comma-separated field names like "手机号,邮箱"
}

export interface Card {
  id: number;
  product_id: number;
  code: string;
  status: string; // 'unsold' | 'sold'
  order_id: string | null;
  created_at: string;
  sold_at: string | null;
}

export interface Order {
  id: string; // Order UUID or custom ID
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
  total_amount: number;
  contact_info: string;
  card_codes: string; // Newline or comma separated keys
  created_at: string;
  custom_values?: string; // custom form values as a JSON string
  exchange_code?: string; // the exchange code used
}

export interface SiteConfig {
  key: string;
  value: string;
}

// Global Database Controller
class Database {
  private pool: Pool | null = null;
  private isPostgres = false;
  private jsonDbPath = process.env.VERCEL 
    ? path.join("/tmp", "db.json") 
    : path.join(process.cwd(), "data", "db.json");

  // In-memory data for JSON fallback
  private localData = {
    users: [] as User[],
    categories: [] as Category[],
    products: [] as Product[],
    cards: [] as Card[],
    orders: [] as Order[],
    site_config: [] as SiteConfig[],
  };

  private maskConnectionString(url: string): string {
    try {
      // Basic split to avoid exposing password
      const parts = url.split("@");
      if (parts.length > 1) {
        const protocolAndAuth = parts[0];
        const hostAndPath = parts[1];
        const authParts = protocolAndAuth.split(":");
        if (authParts.length > 2) {
          return `${authParts[0]}:${authParts[1]}:******@${hostAndPath}`;
        }
        return `******@${hostAndPath}`;
      }
      return url.substring(0, 30) + "...";
    } catch {
      return "DATABASE_URL_MASKED";
    }
  }

  constructor() {
    const dbUrl = process.env.DATABASE_URL;
    console.log(`[Database Startup] NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`[Database Startup] VERCEL Environment detected: ${!!process.env.VERCEL}`);
    
    if (dbUrl) {
      console.log(`[Database Startup] DATABASE_URL is provided: ${this.maskConnectionString(dbUrl)}`);
      try {
        // Clean the connection string: remove parameters that can cause issues
        // with the pg library in serverless environments.
        // - channel_binding: can cause connection failures in serverless
        // - sslmode: we set ssl explicitly below, removing sslmode avoids
        //   pg treating 'require' as 'verify-full' which may fail if the
        //   serverless environment lacks the proper CA bundle
        let cleanUrl = dbUrl;
        try {
          const parsed = new URL(dbUrl);
          let modified = false;
          if (parsed.searchParams.has("channel_binding")) {
            parsed.searchParams.delete("channel_binding");
            modified = true;
            console.log("[Database Startup] Removed channel_binding parameter for pg compatibility.");
          }
          if (parsed.searchParams.has("sslmode")) {
            parsed.searchParams.delete("sslmode");
            modified = true;
            console.log("[Database Startup] Removed sslmode parameter (using explicit ssl config instead).");
          }
          if (modified) {
            cleanUrl = parsed.toString();
          }
        } catch {
          // Fallback: regex removal if URL parsing fails
          cleanUrl = dbUrl.replace(/&?channel_binding=[^&]*/g, "").replace(/&?sslmode=[^&]*/g, "");
        }

        this.pool = new Pool({
          connectionString: cleanUrl,
          ssl: {
            rejectUnauthorized: false,
          },
          connectionTimeoutMillis: 5000,
          max: 4,
          idleTimeoutMillis: 10000,
        });
        this.isPostgres = true;
        console.log("[Database Startup] PostgreSQL Connection Pool initialized.");
      } catch (err: any) {
        console.error("[Database Startup] Failed to initialize Postgres Pool. Falling back to local storage.", err);
        this.isPostgres = false;
        this.pool = null;
      }
    } else {
      console.log("[Database Startup] No DATABASE_URL found in environment. Defaulting to local JSON storage.");
    }

    if (!this.isPostgres) {
      this.initJsonDb();
    }
  }

  // Public status method for health check endpoint
  public getStatus(): { isPostgres: boolean; hasPool: boolean } {
    return {
      isPostgres: this.isPostgres,
      hasPool: !!this.pool,
    };
  }

  // Initialize and seed Postgres tables
  public async init() {
    if (this.isPostgres && this.pool) {
      console.log("[Database Init] Testing connection to PostgreSQL...");
      try {
        // Try simple connection to check if DB is accessible
        const client = await this.pool.connect();
        client.release();
        console.log("[Database Init] Connection test successful.");

        // Highly efficient check to skip migrations if already seeded
        let isAlreadyMigrated = false;
        try {
          await this.query("SELECT key FROM site_config LIMIT 1");
          isAlreadyMigrated = true;
          console.log("[Database Init] Database tables and configurations already present. Skipping table check/creation DDL queries.");
        } catch (e) {
          console.log("[Database Init] Database site_config table not found or incomplete. Proceeding with table check and DDL migrations...");
        }

        if (!isAlreadyMigrated) {
          // Create tables if they don't exist
          console.log("[Database Init] Verifying table: 'users'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS users (
              id SERIAL PRIMARY KEY,
              username VARCHAR(255) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              role VARCHAR(50) NOT NULL DEFAULT 'user',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          console.log("[Database Init] Verifying table: 'categories'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS categories (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              description TEXT,
              sort_order INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          console.log("[Database Init] Verifying table: 'products'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS products (
              id SERIAL PRIMARY KEY,
              category_id INTEGER NOT NULL,
              name VARCHAR(255) NOT NULL,
              description TEXT,
              price DECIMAL(10, 2) NOT NULL,
              status VARCHAR(50) DEFAULT 'active',
              image_url TEXT,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          console.log("[Database Init] Verifying table: 'cards'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS cards (
              id SERIAL PRIMARY KEY,
              product_id INTEGER NOT NULL,
              code TEXT NOT NULL,
              status VARCHAR(50) DEFAULT 'unsold',
              order_id VARCHAR(255),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              sold_at TIMESTAMP
            );
          `);

          console.log("[Database Init] Verifying table: 'orders'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS orders (
              id VARCHAR(255) PRIMARY KEY,
              product_id INTEGER NOT NULL,
              product_name VARCHAR(255) NOT NULL,
              quantity INTEGER NOT NULL,
              price DECIMAL(10, 2) NOT NULL,
              total_amount DECIMAL(10, 2) NOT NULL,
              contact_info VARCHAR(255) NOT NULL,
              card_codes TEXT NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
          `);

          console.log("[Database Init] Verifying table: 'site_config'...");
          await this.query(`
            CREATE TABLE IF NOT EXISTS site_config (
              key VARCHAR(255) PRIMARY KEY,
              value TEXT NOT NULL
            );
          `);

          // Check and apply column upgrades for custom fields and redemption code
          console.log("[Database Init] Verifying schemas for columns (products.custom_fields, orders.custom_values, orders.exchange_code)...");
          await this.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_fields TEXT DEFAULT '';`);
          await this.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_values TEXT DEFAULT '';`);
          await this.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS exchange_code VARCHAR(255) DEFAULT '';`);
          
          // Seed default admin if missing
          const adminCheck = await this.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
          if (adminCheck.rows.length === 0) {
            const defaultHash = this.hashPassword("admin123");
            await this.query(
              "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
              ["admin", defaultHash, "admin"]
            );
            console.log("[Database Init] Default admin account seeded (username: admin, password: admin123)");
          }

          // Seed default site config if missing
          const configCheck = await this.query("SELECT * FROM site_config LIMIT 1");
          if (configCheck.rows.length === 0) {
            await this.query("INSERT INTO site_config (key, value) VALUES ($1, $2)", ["site_title", "自动发卡平台"]);
            await this.query("INSERT INTO site_config (key, value) VALUES ($1, $2)", ["announcement", "欢迎使用本自动发卡平台！24小时自助发卡，安全可靠。"]);
            await this.query("INSERT INTO site_config (key, value) VALUES ($1, $2)", ["contact_info", "QQ: 123456789 | Email: service@example.com"]);
            await this.query("INSERT INTO site_config (key, value) VALUES ($1, $2)", ["payment_instructions", "请选择以下模拟支付通道，支付成功后系统将自动发放卡密！"]);
            console.log("[Database Init] Default site configurations seeded.");
          }
        }

        // Fetch counts for startup log summary
        const userCount = await this.query("SELECT COUNT(*) FROM users");
        const categoryCount = await this.query("SELECT COUNT(*) FROM categories");
        const productCount = await this.query("SELECT COUNT(*) FROM products");
        const cardCount = await this.query("SELECT COUNT(*) FROM cards");
        const orderCount = await this.query("SELECT COUNT(*) FROM orders");
        
        console.log(`=========================================`);
        console.log(`[Database Init] POSTGRES DATABASE SUMMARY:`);
        console.log(`- Total Registered Users: ${userCount.rows[0].count}`);
        console.log(`- Total Categories: ${categoryCount.rows[0].count}`);
        console.log(`- Total Products: ${productCount.rows[0].count}`);
        console.log(`- Total Cards (Redemption Keys): ${cardCount.rows[0].count}`);
        console.log(`- Total Orders: ${orderCount.rows[0].count}`);
        console.log(`=========================================`);

      } catch (err: any) {
        console.error("[Database Init] PostgreSQL connection or migration failed! Error detail:", err);
        console.warn("[Database Init] Falling back to JSON local storage.");
        this.isPostgres = false;
        this.pool = null;
        this.initJsonDb();
      }
    }
  }

  // Local JSON Database Helper
  private initJsonDb() {
    const dir = path.dirname(this.jsonDbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.jsonDbPath)) {
      try {
        const raw = fs.readFileSync(this.jsonDbPath, "utf-8");
        this.localData = JSON.parse(raw);
        console.log("Database: Loaded local JSON database.");
      } catch (err) {
        console.error("Database: Error reading JSON database, resetting database.", err);
        this.saveJsonDb();
      }
    } else {
      console.log("Database: Initializing new JSON database.");
      // Seed local JSON database
      const defaultHash = this.hashPassword("admin123");
      this.localData.users.push({
        id: 1,
        username: "admin",
        password_hash: defaultHash,
        role: "admin",
        created_at: new Date().toISOString(),
      });

      this.localData.site_config.push(
        { key: "site_title", value: "自动发卡平台" },
        { key: "announcement", value: "欢迎使用本自动发卡平台！24小时自助发卡，安全可靠。" },
        { key: "contact_info", value: "QQ: 123456789 | Email: service@example.com" },
        { key: "payment_instructions", value: "请选择以下模拟支付通道，支付成功后系统将自动发放卡密！" }
      );

      // Add a default category and product for local experience
      this.localData.categories.push({
        id: 1,
        name: "演示分类",
        description: "这是一个默认的演示分类",
        sort_order: 1,
        created_at: new Date().toISOString(),
      });

      this.localData.products.push({
        id: 1,
        category_id: 1,
        name: "演示商品 (1分钱体验卡密)",
        description: "购买后即可提取卡密测试，自动发卡。库存充足！",
        price: 0.01,
        status: "active",
        image_url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400",
        created_at: new Date().toISOString(),
      });

      // Add 5 demo cards
      this.localData.cards.push(
        { id: 1, product_id: 1, code: "DEMO-KEY-8F9G2-X82JS", status: "unsold", order_id: null, created_at: new Date().toISOString(), sold_at: null },
        { id: 2, product_id: 1, code: "DEMO-KEY-1H5S2-K89QL", status: "unsold", order_id: null, created_at: new Date().toISOString(), sold_at: null },
        { id: 3, product_id: 1, code: "DEMO-KEY-9U3N8-P01XW", status: "unsold", order_id: null, created_at: new Date().toISOString(), sold_at: null },
        { id: 4, product_id: 1, code: "DEMO-KEY-7R4V6-B22PT", status: "unsold", order_id: null, created_at: new Date().toISOString(), sold_at: null },
        { id: 5, product_id: 1, code: "DEMO-KEY-5Z1M4-M55YY", status: "unsold", order_id: null, created_at: new Date().toISOString(), sold_at: null }
      );

      this.saveJsonDb();
    }
  }

  private saveJsonDb() {
    try {
      fs.writeFileSync(this.jsonDbPath, JSON.stringify(this.localData, null, 2), "utf-8");
    } catch (err) {
      console.error("Database: Error saving JSON database.", err);
    }
  }

  // Password hashing utility using native crypto pbkdf2
  public hashPassword(password: string): string {
    const salt = "9f27fa0bca710893"; // fixed salt for simplicity/consistency or we can use standard sha256
    const hash = crypto.createHmac("sha256", salt).update(password).digest("hex");
    return hash;
  }

  // Run arbitrary query on PostgreSQL
  private async query(text: string, params?: any[]) {
    if (!this.pool) throw new Error("Postgres pool is not initialized");
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;
      const cleanSql = text.replace(/\s+/g, " ").trim();
      const sqlSnippet = cleanSql.substring(0, 150) + (cleanSql.length > 150 ? "..." : "");
      console.log(`[SQL Query] SUCCESS (${duration}ms): ${sqlSnippet}`);
      return res;
    } catch (err: any) {
      const duration = Date.now() - start;
      const cleanSql = text.replace(/\s+/g, " ").trim();
      const sqlSnippet = cleanSql.substring(0, 150) + (cleanSql.length > 150 ? "..." : "");
      console.error(`[SQL Query] FAILED (${duration}ms): ${sqlSnippet} - Error: ${err.message}`);
      throw err;
    }
  }

  // ==========================================
  // USERS SECTION
  // ==========================================
  public async getUserByUsername(username: string): Promise<User | null> {
    if (this.isPostgres) {
      const res = await this.query("SELECT * FROM users WHERE username = $1 LIMIT 1", [username]);
      if (res.rows.length === 0) return null;
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id)
      };
    } else {
      const user = this.localData.users.find(u => u.username === username);
      return user || null;
    }
  }

  public async createUser(username: string, passwordHash: string, role = "user"): Promise<User> {
    if (this.isPostgres) {
      const res = await this.query(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING *",
        [username, passwordHash, role]
      );
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id)
      };
    } else {
      const newUser: User = {
        id: this.localData.users.length > 0 ? Math.max(...this.localData.users.map(u => u.id)) + 1 : 1,
        username,
        password_hash: passwordHash,
        role,
        created_at: new Date().toISOString(),
      };
      this.localData.users.push(newUser);
      this.saveJsonDb();
      return newUser;
    }
  }

  public async getUserCount(): Promise<number> {
    if (this.isPostgres) {
      const res = await this.query("SELECT COUNT(*) FROM users");
      return parseInt(res.rows[0].count, 10);
    } else {
      return this.localData.users.length;
    }
  }

  // ==========================================
  // CATEGORIES SECTION
  // ==========================================
  public async getCategories(): Promise<Category[]> {
    if (this.isPostgres) {
      const res = await this.query("SELECT * FROM categories ORDER BY sort_order ASC, id ASC");
      return res.rows.map(row => ({
        ...row,
        id: Number(row.id)
      }));
    } else {
      return [...this.localData.categories].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }
  }

  public async createCategory(name: string, description: string, sortOrder = 0): Promise<Category> {
    if (this.isPostgres) {
      const res = await this.query(
        "INSERT INTO categories (name, description, sort_order) VALUES ($1, $2, $3) RETURNING *",
        [name, description, sortOrder]
      );
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id)
      };
    } else {
      const newCat: Category = {
        id: this.localData.categories.length > 0 ? Math.max(...this.localData.categories.map(c => c.id)) + 1 : 1,
        name,
        description,
        sort_order: sortOrder,
        created_at: new Date().toISOString(),
      };
      this.localData.categories.push(newCat);
      this.saveJsonDb();
      return newCat;
    }
  }

  public async updateCategory(id: number, name: string, description: string, sortOrder: number): Promise<Category | null> {
    if (this.isPostgres) {
      const res = await this.query(
        "UPDATE categories SET name = $1, description = $2, sort_order = $3 WHERE id = $4 RETURNING *",
        [name, description, sortOrder, id]
      );
      if (res.rows.length === 0) return null;
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id)
      };
    } else {
      const idx = this.localData.categories.findIndex(c => c.id === id);
      if (idx === -1) return null;
      this.localData.categories[idx] = {
        ...this.localData.categories[idx],
        name,
        description,
        sort_order: sortOrder,
      };
      this.saveJsonDb();
      return this.localData.categories[idx];
    }
  }

  public async deleteCategory(id: number): Promise<boolean> {
    if (this.isPostgres) {
      const res = await this.query("DELETE FROM categories WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } else {
      const idx = this.localData.categories.findIndex(c => c.id === id);
      if (idx === -1) return false;
      this.localData.categories.splice(idx, 1);
      this.saveJsonDb();
      return true;
    }
  }

  // ==========================================
  // PRODUCTS SECTION
  // ==========================================
  public async getProducts(activeOnly = false): Promise<Product[]> {
    if (this.isPostgres) {
      const queryText = activeOnly 
        ? "SELECT * FROM products WHERE status = 'active' ORDER BY id DESC" 
        : "SELECT * FROM products ORDER BY id DESC";
      const res = await this.query(queryText);
      const products = res.rows.map(row => ({
        ...row,
        id: Number(row.id),
        category_id: Number(row.category_id),
        price: parseFloat(row.price),
        custom_fields: row.custom_fields || "",
      }));

      // Fetch card stock counts: since they are globally applicable, the stock count of each product is just the count of all unsold cards in the global card table!
      const stockRes = await this.query("SELECT COUNT(*) FROM cards WHERE status = 'unsold'");
      const totalUnsold = parseInt(stockRes.rows[0].count, 10);
      for (const prod of products) {
        prod.stock_count = totalUnsold;
      }
      return products;
    } else {
      let prods = [...this.localData.products];
      if (activeOnly) {
        prods = prods.filter(p => p.status === "active");
      }
      prods = prods.sort((a, b) => b.id - a.id);
      
      // Attach stock counts: since they are globally applicable, the stock count of each product is just the count of all unsold cards!
      const totalUnsold = this.localData.cards.filter(c => c.status === "unsold").length;
      return prods.map(p => ({
        ...p,
        stock_count: totalUnsold,
        custom_fields: p.custom_fields || ""
      }));
    }
  }

  public async createProduct(
    categoryId: number,
    name: string,
    description: string,
    price: number,
    status = "active",
    imageUrl = "",
    customFields = ""
  ): Promise<Product> {
    if (this.isPostgres) {
      const res = await this.query(
        "INSERT INTO products (category_id, name, description, price, status, image_url, custom_fields) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [categoryId, name, description, price, status, imageUrl, customFields]
      );
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id),
        category_id: Number(res.rows[0].category_id),
        price: parseFloat(res.rows[0].price),
        custom_fields: res.rows[0].custom_fields || "",
        stock_count: 0
      };
    } else {
      const newProd: Product = {
        id: this.localData.products.length > 0 ? Math.max(...this.localData.products.map(p => p.id)) + 1 : 1,
        category_id: categoryId,
        name,
        description,
        price,
        status,
        image_url: imageUrl || "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&q=80&w=400",
        created_at: new Date().toISOString(),
        custom_fields: customFields,
      };
      this.localData.products.push(newProd);
      this.saveJsonDb();
      return {
        ...newProd,
        stock_count: 0
      };
    }
  }

  public async updateProduct(
    id: number,
    categoryId: number,
    name: string,
    description: string,
    price: number,
    status: string,
    imageUrl: string,
    customFields: string
  ): Promise<Product | null> {
    if (this.isPostgres) {
      const res = await this.query(
        "UPDATE products SET category_id = $1, name = $2, description = $3, price = $4, status = $5, image_url = $6, custom_fields = $7 WHERE id = $8 RETURNING *",
        [categoryId, name, description, price, status, imageUrl, customFields, id]
      );
      if (res.rows.length === 0) return null;
      
      const stockRes = await this.query("SELECT COUNT(*) FROM cards WHERE status = 'unsold'");
      return {
        ...res.rows[0],
        id: Number(res.rows[0].id),
        category_id: Number(res.rows[0].category_id),
        price: parseFloat(res.rows[0].price),
        custom_fields: res.rows[0].custom_fields || "",
        stock_count: parseInt(stockRes.rows[0].count, 10),
      };
    } else {
      const idx = this.localData.products.findIndex(p => p.id === id);
      if (idx === -1) return null;
      this.localData.products[idx] = {
        ...this.localData.products[idx],
        category_id: categoryId,
        name,
        description,
        price,
        status,
        image_url: imageUrl || this.localData.products[idx].image_url,
        custom_fields: customFields,
      };
      this.saveJsonDb();
      const totalUnsold = this.localData.cards.filter(c => c.status === "unsold").length;
      return {
        ...this.localData.products[idx],
        stock_count: totalUnsold
      };
    }
  }

  public async deleteProduct(id: number): Promise<boolean> {
    if (this.isPostgres) {
      // Also delete unsold cards associated with it
      await this.query("DELETE FROM cards WHERE product_id = $1 AND status = 'unsold'", [id]);
      const res = await this.query("DELETE FROM products WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } else {
      const idx = this.localData.products.findIndex(p => p.id === id);
      if (idx === -1) return false;
      this.localData.products.splice(idx, 1);
      // Clean up unsold cards for this product
      this.localData.cards = this.localData.cards.filter(c => !(c.product_id === id && c.status === "unsold"));
      this.saveJsonDb();
      return true;
    }
  }

  // ==========================================
  // CARDS (INVENTORY) SECTION
  // ==========================================
  public async getCards(productId?: number): Promise<Card[]> {
    if (this.isPostgres) {
      const queryText = productId 
        ? "SELECT * FROM cards WHERE product_id = $1 ORDER BY id DESC"
        : "SELECT * FROM cards ORDER BY id DESC";
      const params = productId ? [productId] : [];
      const res = await this.query(queryText, params);
      return res.rows.map(row => ({
        ...row,
        id: Number(row.id),
        product_id: Number(row.product_id),
      }));
    } else {
      let cards = [...this.localData.cards];
      if (productId) {
        cards = cards.filter(c => c.product_id === productId);
      }
      return cards.sort((a, b) => b.id - a.id);
    }
  }

  public async importCards(productId: number, codes: string[]): Promise<number> {
    const validCodes = codes.map(c => c.trim()).filter(c => c.length > 0);
    if (validCodes.length === 0) return 0;

    if (this.isPostgres) {
      // Insert in a single transaction or multiple inserts
      const client = await this.pool!.connect();
      try {
        await client.query("BEGIN");
        for (const code of validCodes) {
          await client.query(
            "INSERT INTO cards (product_id, code, status) VALUES ($1, $2, 'unsold')",
            [productId, code]
          );
        }
        await client.query("COMMIT");
        return validCodes.length;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      let maxId = this.localData.cards.length > 0 ? Math.max(...this.localData.cards.map(c => c.id)) : 0;
      for (const code of validCodes) {
        maxId++;
        this.localData.cards.push({
          id: maxId,
          product_id: productId,
          code,
          status: "unsold",
          order_id: null,
          created_at: new Date().toISOString(),
          sold_at: null,
        });
      }
      this.saveJsonDb();
      return validCodes.length;
    }
  }

  public async deleteCard(id: number): Promise<boolean> {
    if (this.isPostgres) {
      const res = await this.query("DELETE FROM cards WHERE id = $1", [id]);
      return (res.rowCount ?? 0) > 0;
    } else {
      const idx = this.localData.cards.findIndex(c => c.id === id);
      if (idx === -1) return false;
      this.localData.cards.splice(idx, 1);
      this.saveJsonDb();
      return true;
    }
  }

  public async clearUnsoldCards(productId: number): Promise<number> {
    if (this.isPostgres) {
      const res = await this.query("DELETE FROM cards WHERE product_id = $1 AND status = 'unsold'", [productId]);
      return res.rowCount ?? 0;
    } else {
      const initialCount = this.localData.cards.length;
      this.localData.cards = this.localData.cards.filter(c => !(c.product_id === productId && c.status === "unsold"));
      const deletedCount = initialCount - this.localData.cards.length;
      this.saveJsonDb();
      return deletedCount;
    }
  }

  // ==========================================
  // ORDERS & PURCHASE TRANSACTION
  // ==========================================
  public async getOrders(): Promise<Order[]> {
    if (this.isPostgres) {
      const res = await this.query("SELECT * FROM orders ORDER BY created_at DESC");
      return res.rows.map(row => ({
        ...row,
        product_id: Number(row.product_id),
        quantity: Number(row.quantity),
        price: parseFloat(row.price),
        total_amount: parseFloat(row.total_amount),
      }));
    } else {
      return [...this.localData.orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }

  public async getOrder(id: string): Promise<Order | null> {
    if (this.isPostgres) {
      const res = await this.query("SELECT * FROM orders WHERE id = $1 LIMIT 1", [id]);
      if (res.rows.length === 0) return null;
      return {
        ...res.rows[0],
        product_id: Number(res.rows[0].product_id),
        quantity: Number(res.rows[0].quantity),
        price: parseFloat(res.rows[0].price),
        total_amount: parseFloat(res.rows[0].total_amount),
      };
    } else {
      const ord = this.localData.orders.find(o => o.id === id);
      return ord || null;
    }
  }

  public async getOrdersByContact(contact: string): Promise<Order[]> {
    const term = contact.trim();
    if (!term) return [];

    if (this.isPostgres) {
      const res = await this.query(
        "SELECT * FROM orders WHERE contact_info = $1 OR id = $2 ORDER BY created_at DESC",
        [term, term]
      );
      return res.rows.map(row => ({
        ...row,
        product_id: Number(row.product_id),
        quantity: Number(row.quantity),
        price: parseFloat(row.price),
        total_amount: parseFloat(row.total_amount),
      }));
    } else {
      return this.localData.orders
        .filter(o => o.contact_info === term || o.id === term)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
  }

  /**
   * Redeem product with an exchange code.
   * Atomically locks and checks the exchange code, marks it as used, and logs the exchange order.
   */
  public async createOrder(
    productId: number,
    contactInfo: string,
    exchangeCode: string,
    customValues: string
  ): Promise<Order> {
    const orderId = "FK-" + crypto.randomBytes(8).toString("hex").toUpperCase();

    if (this.isPostgres) {
      const client = await this.pool!.connect();
      try {
        await client.query("BEGIN");

        // 1. Fetch the product details
        const prodRes = await client.query("SELECT * FROM products WHERE id = $1 FOR UPDATE", [productId]);
        if (prodRes.rows.length === 0) {
          throw new Error("未找到对应的商品");
        }
        const product = prodRes.rows[0];
        if (product.status !== "active") {
          throw new Error("商品已下架，无法兑换");
        }

        // 2. Fetch and lock the specific exchange code
        const cardRes = await client.query(
          "SELECT * FROM cards WHERE code = $1 AND status = 'unsold' FOR UPDATE",
          [exchangeCode]
        );

        if (cardRes.rows.length === 0) {
          throw new Error("该兑换卡密不存在，或已被使用");
        }

        const selectedCard = cardRes.rows[0];

        // 3. Update the selected card to 'sold' (used)
        await client.query(
          "UPDATE cards SET status = 'sold', order_id = $1, sold_at = CURRENT_TIMESTAMP WHERE id = $2",
          [orderId, selectedCard.id]
        );

        // 4. Create the order log
        const price = parseFloat(product.price);
        const orderRes = await client.query(
          `INSERT INTO orders (id, product_id, product_name, quantity, price, total_amount, contact_info, card_codes, custom_values, exchange_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [orderId, productId, product.name, 1, price, price, contactInfo, exchangeCode, customValues, exchangeCode]
        );

        await client.query("COMMIT");

        return {
          ...orderRes.rows[0],
          product_id: Number(orderRes.rows[0].product_id),
          quantity: Number(orderRes.rows[0].quantity),
          price: parseFloat(orderRes.rows[0].price),
          total_amount: parseFloat(orderRes.rows[0].total_amount),
          custom_values: orderRes.rows[0].custom_values || "",
          exchange_code: orderRes.rows[0].exchange_code || "",
        };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else {
      // JSON in-memory transaction
      const product = this.localData.products.find(p => p.id === productId);
      if (!product) {
        throw new Error("未找到对应的商品");
      }
      if (product.status !== "active") {
        throw new Error("商品已下架，无法兑换");
      }

      // Look up card by code
      const card = this.localData.cards.find(c => c.code === exchangeCode && c.status === "unsold");
      if (!card) {
        throw new Error("该兑换卡密不存在，或已被使用");
      }

      // Mark card as used
      card.status = "sold";
      card.order_id = orderId;
      card.sold_at = new Date().toISOString();

      const price = product.price;

      const newOrder: Order = {
        id: orderId,
        product_id: productId,
        product_name: product.name,
        quantity: 1,
        price,
        total_amount: price,
        contact_info: contactInfo,
        card_codes: exchangeCode,
        created_at: new Date().toISOString(),
        custom_values: customValues,
        exchange_code: exchangeCode
      };

      this.localData.orders.push(newOrder);
      this.saveJsonDb();
      return newOrder;
    }
  }

  // ==========================================
  // CONFIGURATION SECTION
  // ==========================================
  public async getAllConfig(): Promise<Record<string, string>> {
    if (this.isPostgres) {
      const res = await this.query("SELECT * FROM site_config");
      const config: Record<string, string> = {};
      res.rows.forEach(row => {
        config[row.key] = row.value;
      });
      return config;
    } else {
      const config: Record<string, string> = {};
      this.localData.site_config.forEach(c => {
        config[c.key] = c.value;
      });
      return config;
    }
  }

  public async getConfig(key: string, defaultValue = ""): Promise<string> {
    if (this.isPostgres) {
      const res = await this.query("SELECT value FROM site_config WHERE key = $1 LIMIT 1", [key]);
      if (res.rows.length === 0) return defaultValue;
      return res.rows[0].value;
    } else {
      const item = this.localData.site_config.find(c => c.key === key);
      return item ? item.value : defaultValue;
    }
  }

  public async setConfig(key: string, value: string): Promise<void> {
    if (this.isPostgres) {
      await this.query(
        `INSERT INTO site_config (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    } else {
      const idx = this.localData.site_config.findIndex(c => c.key === key);
      if (idx !== -1) {
        this.localData.site_config[idx].value = value;
      } else {
        this.localData.site_config.push({ key, value });
      }
      this.saveJsonDb();
    }
  }

  // ==========================================
  // STATISTICS
  // ==========================================
  public async getStats(): Promise<{
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    totalCards: number;
    unsoldCards: number;
    soldCards: number;
  }> {
    if (this.isPostgres) {
      const ordersRes = await this.query("SELECT COUNT(*), SUM(total_amount) FROM orders");
      const productsRes = await this.query("SELECT COUNT(*) FROM products");
      const totalCardsRes = await this.query("SELECT COUNT(*) FROM cards");
      const unsoldCardsRes = await this.query("SELECT COUNT(*) FROM cards WHERE status = 'unsold'");
      const soldCardsRes = await this.query("SELECT COUNT(*) FROM cards WHERE status = 'sold'");

      return {
        totalSales: parseFloat(ordersRes.rows[0].sum || "0"),
        totalOrders: parseInt(ordersRes.rows[0].count, 10),
        totalProducts: parseInt(productsRes.rows[0].count, 10),
        totalCards: parseInt(totalCardsRes.rows[0].count, 10),
        unsoldCards: parseInt(unsoldCardsRes.rows[0].count, 10),
        soldCards: parseInt(soldCardsRes.rows[0].count, 10),
      };
    } else {
      const totalSales = this.localData.orders.reduce((sum, o) => sum + o.total_amount, 0);
      const totalOrders = this.localData.orders.length;
      const totalProducts = this.localData.products.length;
      const totalCards = this.localData.cards.length;
      const unsoldCards = this.localData.cards.filter(c => c.status === "unsold").length;
      const soldCards = this.localData.cards.filter(c => c.status === "sold").length;

      return {
        totalSales,
        totalOrders,
        totalProducts,
        totalCards,
        unsoldCards,
        soldCards,
      };
    }
  }
}

// Singleton database instance
export const db = new Database();
