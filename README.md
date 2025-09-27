# ClothCraft - Professional Cloth Shop Billing System

A modern, full-stack cloth shop billing web application built with React, Node.js, Express, and SQLite. Features a professional admin panel, POS billing system, and integrated payment processing with QR code generation.

## 🚀 Features

### Admin Panel
- **Product Management**: Add, edit, and delete products with comprehensive details
- **Inventory Tracking**: Real-time stock management with low-stock alerts
- **Category Organization**: Organize products by categories, sizes, and colors
- **Bulk Operations**: Efficient product management tools

### POS Billing System
- **Interactive Product Selection**: Easy-to-use interface for selecting items
- **Real-time Cart Management**: Add/remove items with quantity controls
- **Customer Management**: Store customer information for orders
- **Discount Application**: Automatic discount calculations
- **Invoice Generation**: Professional invoice layout with business branding

### Payment Integration
- **QR Code Generation**: Razorpay integration for seamless payments
- **Multiple Payment Methods**: Support for UPI, cards, and digital wallets
- **Payment Status Tracking**: Real-time payment confirmation
- **Transaction History**: Complete order and payment records

### Design Features
- **Modern UI/UX**: Clean, professional interface with intuitive navigation
- **Responsive Design**: Optimized for tablets, desktops, and mobile devices
- **Real-time Updates**: Live inventory and order status updates
- **Professional Branding**: Customizable business information and styling

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React Icons
- **Backend**: Node.js, Express.js
- **Database**: SQLite (easy local setup)
- **Payment**: Razorpay API integration
- **QR Code**: qrcode library for payment QR generation
- **Build Tool**: Vite for fast development and building

## 📦 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set up Environment Variables
Create a `.env` file in the root directory:
```env
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

### Step 3: Run the Application

#### Development Mode
```bash
# Start the backend server
npm run start

# In a new terminal, start the frontend (if needed)
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

#### Production Build
```bash
npm run build
npm run start
```

## 🔧 Configuration

### Database Setup
The SQLite database is automatically created on first run with sample products. The database file `cloth_shop.db` will be created in the root directory.

### Razorpay Integration
1. Sign up at [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Navigate to Settings → API Keys
3. Copy your Key ID and Key Secret
4. Update your `.env` file with the credentials

### Production Deployment
For production deployment:
1. Update Razorpay keys with live credentials
2. Configure proper CORS settings
3. Set up SSL certificates
4. Use environment variables for sensitive data
5. Consider using PostgreSQL or MongoDB for production database

## 📱 Usage Guide

### Admin Panel
1. **Product Management**: Click on "Products" tab to add/edit inventory
2. **Add Products**: Use the "Add Product" button to create new items
3. **Update Stock**: Edit existing products to update inventory levels

### POS Billing
1. **Select Customer**: Enter customer details in the billing section
2. **Add Products**: Click on products to add them to the cart
3. **Adjust Quantities**: Use +/- buttons to modify quantities
4. **Generate Payment**: Click "Generate Payment QR" to create payment link
5. **Complete Transaction**: Customer scans QR code to complete payment

### Order Management
1. **View Orders**: Check "Orders" tab for transaction history
2. **Order Details**: Click "View" to see complete order information
3. **Payment Status**: Monitor payment confirmations and status

## 🔒 Security Features

- Input validation and sanitization
- SQL injection prevention
- Secure payment processing
- Environment variable protection
- CORS configuration for API security

## 🎨 Customization

### Branding
- Update company logo and name in `src/App.tsx`
- Modify color scheme in Tailwind configuration
- Customize invoice layout in billing components

### Features
- Add new product fields in database schema
- Implement additional payment methods
- Add reporting and analytics features
- Integrate with external inventory systems

## 📞 Support

For technical support or feature requests:
- Review the code documentation
- Check the GitHub issues
- Contact the development team

## 🔄 Updates

To update the application:
1. Pull latest changes from repository
2. Run `npm install` to update dependencies
3. Restart the server with `npm run start`

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

---

**ClothCraft** - Empowering your clothing business with modern technology and professional design.