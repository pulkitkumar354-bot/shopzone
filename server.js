require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// File paths for data storage
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const BANNERS_FILE = path.join(DATA_DIR, 'banners.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

// In-memory cache
let orders = [];
let products = [];
let banners = [];
let orderIdCounter = 1001;

// Initialize data directory and files
async function initializeStorage() {
    try {
        // Create data directory if it doesn't exist
        await fs.mkdir(DATA_DIR, { recursive: true });
        console.log('📁 Data directory ready');
        
        // Load or create orders file
        try {
            const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
            orders = JSON.parse(ordersData);
            console.log('✅ Loaded', orders.length, 'orders');
        } catch (err) {
            orders = [];
            await saveOrders();
            console.log('📝 Created new orders.json');
        }
        
        // Load or create products file
        try {
            const productsData = await fs.readFile(PRODUCTS_FILE, 'utf8');
            products = JSON.parse(productsData);
            console.log('✅ Loaded', products.length, 'products');
        } catch (err) {
            // Create default products if file doesn't exist
            products = getDefaultProducts();
            await saveProducts();
            console.log('📝 Created products.json with', products.length, 'default products');
        }
        
        // Load or create banners file
        try {
            const bannersData = await fs.readFile(BANNERS_FILE, 'utf8');
            banners = JSON.parse(bannersData);
            console.log('✅ Loaded', banners.length, 'banners');
        } catch (err) {
            // Create default banners if file doesn't exist
            banners = getDefaultBanners();
            await saveBanners();
            console.log('📝 Created banners.json with', banners.length, 'default banners');
        }
        
        // Load or create counter file
        try {
            const counterData = await fs.readFile(COUNTER_FILE, 'utf8');
            const counterObj = JSON.parse(counterData);
            orderIdCounter = counterObj.orderIdCounter || 1001;
            console.log('✅ Order counter at:', orderIdCounter);
        } catch (err) {
            await saveCounter();
            console.log('📝 Created new counter.json');
        }
        
    } catch (error) {
        console.error('❌ Error initializing storage:', error);
    }
}

// Save functions with error handling
async function saveOrders() {
    try {
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving orders:', error);
        return false;
    }
}

async function saveProducts() {
    try {
        await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving products:', error);
        return false;
    }
}

async function saveBanners() {
    try {
        await fs.writeFile(BANNERS_FILE, JSON.stringify(banners, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving banners:', error);
        return false;
    }
}

async function saveCounter() {
    try {
        await fs.writeFile(COUNTER_FILE, JSON.stringify({ orderIdCounter }, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Error saving counter:', error);
        return false;
    }
}

// ========== API ROUTES ==========

// Get products and banners
app.get('/api/data', (req, res) => {
    res.json({ products, banners });
});

// Save products and banners (from admin panel)
app.post('/api/data', async (req, res) => {
    try {
        products = req.body.products || [];
        banners = req.body.banners || [];
        
        const saved = await Promise.all([saveProducts(), saveBanners()]);
        
        if (saved.every(s => s === true)) {
            console.log('💾 Saved:', products.length, 'products,', banners.length, 'banners');
            res.json({ success: true, message: 'Data saved successfully' });
        } else {
            throw new Error('Failed to save some data');
        }
    } catch (error) {
        console.error('❌ Error saving data:', error);
        res.status(500).json({ success: false, message: 'Failed to save data' });
    }
});

// Get all orders
app.get('/api/orders', (req, res) => {
    res.json(orders);
});

// Create new order (from checkout)
app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        
        // Validate required fields
        if (!orderData.customer || !orderData.address || !orderData.items) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        const newOrder = {
            id: orderIdCounter++,
            orderId: 'ORD-' + Date.now(),
            customer: {
                fullName: orderData.customer.fullName,
                phone: orderData.customer.phone,
                email: orderData.customer.email || null
            },
            address: {
                houseNo: orderData.address.houseNo,
                street: orderData.address.street,
                city: orderData.address.city,
                state: orderData.address.state,
                pincode: orderData.address.pincode,
                landmark: orderData.address.landmark || null
            },
            items: orderData.items,
            totalAmount: orderData.totalAmount,
            paymentMethod: orderData.paymentMethod || 'COD',
            notes: orderData.notes || '',
            status: 'Pending',
            orderDate: new Date().toISOString()
        };
        
        orders.push(newOrder);
        
        // Save to file
        const saved = await Promise.all([saveOrders(), saveCounter()]);
        
        if (saved.every(s => s === true)) {
            console.log('✅ New order:', newOrder.orderId, '| Customer:', newOrder.customer.fullName, '| Amount: ₹' + newOrder.totalAmount);
            res.status(201).json({ 
                success: true, 
                orderId: newOrder.orderId, 
                order: newOrder 
            });
        } else {
            throw new Error('Failed to save order');
        }
    } catch (error) {
        console.error('❌ Error creating order:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Get single order by ID
app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === parseInt(req.params.id));
    if (!order) {
        return res.status(404).json({ 
            success: false, 
            message: 'Order not found' 
        });
    }
    res.json(order);
});

// Update order status (from admin panel)
app.put('/api/orders/:id', async (req, res) => {
    try {
        const order = orders.find(o => o.id === parseInt(req.params.id));
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        // Update order fields
        if (req.body.status) order.status = req.body.status;
        if (req.body.notes !== undefined) order.notes = req.body.notes;
        
        // Save to file
        await saveOrders();
        
        console.log('📝 Updated order:', order.orderId, '→ Status:', order.status);
        res.json({ success: true, order });
    } catch (error) {
        console.error('❌ Error updating order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update order' 
        });
    }
});

// Delete order (from admin panel)
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const index = orders.findIndex(o => o.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        const deletedOrder = orders.splice(index, 1)[0];
        
        // Save to file
        await saveOrders();
        
        console.log('🗑️ Deleted order:', deletedOrder.orderId);
        res.json({ 
            success: true, 
            message: 'Order deleted successfully' 
        });
    } catch (error) {
        console.error('❌ Error deleting order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete order' 
        });
    }
});

// Root route - API status
app.get('/', (req, res) => {
    res.json({ 
        message: '🛍️ ShopZone API Running',
        status: 'online',
        stats: {
            totalOrders: orders.length,
            totalProducts: products.length,
            totalBanners: banners.length,
            nextOrderId: orderIdCounter
        },
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Start server after loading data
const PORT = process.env.PORT || 3000;

initializeStorage().then(() => {
    app.listen(PORT, () => {
        console.log('');
        console.log('=================================');
        console.log('🚀 ShopZone Server Started');
        console.log('=================================');
        console.log('🌐 URL: http://localhost:' + PORT);
        console.log('📊 Stats:');
        console.log('   📦 Orders:', orders.length);
        console.log('   🛒 Products:', products.length);
        console.log('   🎨 Banners:', banners.length);
        console.log('💾 Storage: ./data/ folder');
        console.log('=================================');
        console.log('');
    });
}).catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
});

// Graceful shutdown - save data before exiting
process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    await Promise.all([
        saveOrders(), 
        saveProducts(), 
        saveBanners(), 
        saveCounter()
    ]);
    console.log('💾 All data saved successfully!');
    console.log('👋 Goodbye!\n');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️  Received SIGTERM...');
    await Promise.all([
        saveOrders(), 
        saveProducts(), 
        saveBanners(), 
        saveCounter()
    ]);
    console.log('💾 Data saved!');
    process.exit(0);
});