# 💰 Spendo

A full-stack expense tracking application built with React Native and Node.js, designed to help users manage their finances efficiently with intuitive UI, comprehensive analytics, and seamless data management.

## 📱 Features

### Authentication & User Management
- **OTP-based Login**: Secure email-based OTP authentication
- **Google Sign-In**: Quick authentication via Google OAuth2
- **Profile Management**: Edit user profile with name updates
- **Secure Token Management**: JWT-based authentication with automatic token refresh

### Expense Management
- **Manual Entry**: Add expenses with category, amount, notes, and date
- **Bulk Upload**: Import expenses from Excel files (.xlsx)
- **Edit & Delete**: Modify existing expenses with pre-filled forms
- **Smart Categorization**: Custom categories with dynamic creation
- **Monthly Organization**: Expenses sorted by month in descending order
- **Pagination**: Efficient loading with pull-to-refresh support

### Analytics & Insights
- **Dashboard Overview**: 
  - Total expenses summary
  - Monthly expense trends
  - Category-wise distribution (pie chart)
  - All-time and monthly statistics
- **Charts & Visualizations**:
  - Monthly expense trends
  - Category distribution (all-time and monthly)
  - Interactive pie charts
- **Money In/Out Tracking**: Separate tracking for income and expenses

### User Experience
- **Custom Fonts**: Bricolage Grotesque font family throughout the app
- **Smooth Animations**: Animated expense cards with optimized performance
- **Bottom Sheet Modals**: Elegant modal dialogs for forms and actions
- **Dynamic Bottom Bar**: Auto-hiding bottom navigation on scroll
- **Floating Action Button**: Smart positioning based on bottom bar visibility
- **Toast Notifications**: User-friendly Android toast messages
- **Dark Theme**: Modern dark UI with consistent color scheme

## 🏗️ Tech Stack

### Frontend (React Native)
- **React Native** 0.82.1
- **React Navigation** - Stack and Bottom Tab navigation
- **React Native Chart Kit** - Data visualization
- **Axios** - HTTP client
- **AsyncStorage** - Local data persistence
- **React Native Linear Gradient** - Gradient buttons
- **Lucide React Native** - Icon library
- **XLSX** - Excel file parsing

### Backend (Node.js)
- **Express.js** - RESTful API server
- **MongoDB** with **Mongoose** - Database and ODM
- **JWT** - Authentication tokens
- **Nodemailer** - OTP email delivery
- **Bcryptjs** - Password hashing
- **Express Validator** - Input validation
- **CORS** - Cross-origin resource sharing

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** or **yarn**
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **React Native development environment**:
  - Android Studio (for Android)
  - Xcode (for iOS - macOS only)
- **Gmail account** with App Password (for OTP emails)
- **Google OAuth2 credentials** (for Google Sign-In)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables:**
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

5. **Start the backend server:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

   The server will run on `http://localhost:3000` (or your configured PORT).

### Frontend Setup

1. **Navigate to Spendo directory:**
   ```bash
   cd Spendo
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure API base URL:**
   Edit `src/utils/BASE_URL.js`:
   ```javascript
   // For local development
   export const BASE_URL = 'http://YOUR_LOCAL_IP:3000/api';
   
   // For production
   // export const BASE_URL = 'https://your-api-domain.com/api';
   ```

4. **For iOS (macOS only):**
   ```bash
   # Install CocoaPods dependencies
   cd ios
   pod install
   cd ..
   ```

5. **Start Metro bundler:**
   ```bash
   npm start
   ```

6. **Run the app:**
   ```bash
   # Android
   npm run android

   # iOS (macOS only)
   npm run ios
   ```

## 🔧 Configuration

### Gmail App Password Setup

1. Go to your [Google Account settings](https://myaccount.google.com/)
2. Enable **2-Step Verification**
3. Navigate to **App Passwords**
4. Generate a new app password for "Mail"
5. Use this password in `GMAIL_APP_PASSWORD` (not your regular Gmail password)

### Google OAuth2 Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Google+ API**
4. Create **OAuth 2.0 credentials**
5. Add authorized redirect URIs
6. Copy **Client ID** and **Client Secret** to `.env`

### MongoDB Setup

#### Local MongoDB
1. Install MongoDB locally
2. Start MongoDB service
3. Use connection string: `mongodb://localhost:27017/expense-tracker`

#### MongoDB Atlas (Cloud)
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster
3. Get connection string and update `MONGODB_URI` in `.env`

## 🎨 Customization

### Fonts
The app uses **Bricolage Grotesque** font family. Fonts are located in:
- `Spendo/assets/fonts/`
- Configured in `Spendo/assets/fonts/index.js`

### Theme
Theme configuration is in:
- `Spendo/src/theme/theme.js` - Color scheme and spacing
- `Spendo/src/theme/paperTheme.js` - React Native Paper theme

### Colors
The app uses a dark theme with:
- Primary background: `#0b0f1a`
- Secondary: `#6366f1` (Indigo)
- Text colors: Various shades of white/gray
- Accent colors for charts and highlights

## 🐛 Troubleshooting

### Backend Issues

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify network connectivity for cloud MongoDB

**OTP Email Not Sending:**
- Verify Gmail App Password is correct
- Check Gmail account has 2-Step Verification enabled
- Ensure `GMAIL_USER` and `GMAIL_APP_PASSWORD` are set correctly

**Port Already in Use:**
- Change `PORT` in `.env` to an available port
- Kill the process using the port: `lsof -ti:3000 | xargs kill`

### Frontend Issues

**Metro Bundler Issues:**
```bash
# Clear cache and restart
npm start -- --reset-cache
```

**Android Build Errors:**
```bash
cd android
./gradlew clean
cd ..
npm run android
```

**iOS Build Errors:**
```bash
cd ios
pod deintegrate
pod install
cd ..
npm run ios
```

**Font Not Loading:**
- Ensure fonts are in `Spendo/assets/fonts/`
- Check `react-native.config.js` configuration
- Rebuild the app after adding fonts

**API Connection Issues:**
- Verify `BASE_URL` in `src/utils/BASE_URL.js`
- Ensure backend server is running
- Check network connectivity
- For Android emulator, use `10.0.2.2` instead of `localhost`

## 📱 Platform-Specific Notes

### Android
- Minimum SDK: 21
- Target SDK: 33
- Uses Material Design components
- Toast notifications via `ToastAndroid`

### iOS
- Minimum iOS version: 13.0
- Requires CocoaPods for dependencies
- Uses native iOS components where applicable

## 🔒 Security

- JWT tokens expire after 30 days
- OTP codes expire after 10 minutes
- All expense routes require authentication
- Input validation on all endpoints
- CORS configured for frontend URL
- Secure password hashing with bcrypt

## 📄 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For issues and questions:
- Check existing issues in the repository
- Create a new issue with detailed description
- Include error logs and steps to reproduce

## 🎯 Roadmap

- [ ] Export expenses to PDF/Excel
- [ ] Recurring expenses feature
- [ ] Budget planning and alerts
- [ ] Multi-currency support
- [ ] Data backup and restore
- [ ] Dark/Light theme toggle
- [ ] Expense reminders and notifications
- [ ] Advanced filtering and search

---

**Built with ❤️ using React Native and Node.js**

