# Expense Tracker Backend API

A complete backend API for an expense tracker application built with Node.js, Express, and MongoDB.

## Features

- 🔐 **Authentication**: OTP-based login via Gmail and Google OAuth2
- 📊 **Expense Management**: Upload, add, retrieve, and compare expenses
- 📈 **Charts & Insights**: Monthly totals, category distribution, and trend analysis
- 🗄️ **MongoDB**: Robust data storage with Mongoose ODM

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Gmail account with App Password (for OTP emails)
- Google OAuth2 credentials (for Google Sign-In)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and update with your values:
```bash
cp .env.example .env
```

3. Edit `.env` file with your configuration:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/expense-tracker
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
FRONTEND_URL=http://localhost:3001
```

4. Start the server:
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

## API Endpoints

### Authentication

#### Send OTP
```
POST /api/auth/otp/send
Body: { "phone": "1234567890" } or { "email": "user@example.com" }
```

#### Verify OTP
```
POST /api/auth/otp/verify
Body: { "userId": "...", "otp": "123456" }
```

#### Google Sign-In
```
POST /api/auth/google
Body: { "idToken": "google-id-token" }
```

#### Get Profile
```
GET /api/auth/profile
Headers: { "Authorization": "Bearer <token>" }
```

#### Update Profile
```
PUT /api/auth/profile
Headers: { "Authorization": "Bearer <token>" }
Body: { "name": "John Doe", "email": "john@example.com" }
```

### Expenses

#### Upload Expenses (Bulk)
```
POST /api/expenses/upload
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "expenses": [
    {
      "month": "2024-01",
      "category": "Food",
      "amount": 100,
      "notes": "Lunch",
      "moneyIn": 0,
      "moneyOut": 100,
      "remaining": -100
    }
  ]
}
```

#### Add Single Expense
```
POST /api/expenses
Headers: { "Authorization": "Bearer <token>" }
Body: {
  "month": "2024-01",
  "category": "Food",
  "amount": 100,
  "notes": "Lunch",
  "moneyIn": 0,
  "moneyOut": 100
}
```

#### Get Expenses by Month
```
GET /api/expenses/:month
Headers: { "Authorization": "Bearer <token>" }
Example: GET /api/expenses/2024-01
```

#### Get Expense Summary
```
GET /api/expenses/summary/:month
Headers: { "Authorization": "Bearer <token>" }
Example: GET /api/expenses/summary/2024-01
```

#### Compare Expenses
```
GET /api/expenses/compare?month1=2024-01&month2=2024-02
Headers: { "Authorization": "Bearer <token>" }
```

### Charts & Insights

#### Monthly Totals
```
GET /api/chart/monthly?limit=12
Headers: { "Authorization": "Bearer <token>" }
```

#### Category Distribution
```
GET /api/chart/category/:month
Headers: { "Authorization": "Bearer <token>" }
Example: GET /api/chart/category/2024-01
```

#### Trends
```
GET /api/chart/trend?limit=12
Headers: { "Authorization": "Bearer <token>" }
```

## Data Models

### User
```javascript
{
  name: String,
  email: String,
  phone: String,
  authMethod: 'otp' | 'google',
  googleId: String,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Expense
```javascript
{
  userId: ObjectId,
  month: String, // Format: YYYY-MM
  category: String,
  amount: Number,
  notes: String,
  moneyIn: Number,
  moneyOut: Number,
  remaining: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## Gmail App Password Setup

1. Go to your Google Account settings
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate a new app password for "Mail"
5. Use this password in `GMAIL_APP_PASSWORD` (not your regular Gmail password)

## Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs
6. Copy Client ID and Client Secret to `.env`

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   ├── expenseController.js # Expense management
│   │   └── chartController.js   # Chart & insights
│   ├── middleware/
│   │   ├── auth.js              # JWT authentication
│   │   └── errorHandler.js      # Error handling
│   ├── models/
│   │   ├── User.js              # User schema
│   │   └── Expense.js           # Expense schema
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   ├── expenseRoutes.js     # Expense endpoints
│   │   └── chartRoutes.js       # Chart endpoints
│   ├── utils/
│   │   ├── jwt.js               # JWT utilities
│   │   └── otpService.js        # OTP generation & sending
│   └── server.js                # Main server file
├── .env.example                # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Error Handling

All errors are handled consistently with the following format:
```json
{
  "success": false,
  "message": "Error message",
  "errors": [] // Optional validation errors
}
```

## Security Notes

- JWT tokens expire after 30 days
- OTP codes expire after 10 minutes
- All expense routes require authentication
- Input validation using express-validator
- CORS configured for frontend URL

## License

ISC

