# Clinic Management System Backend

A backend API for clinic management system built with Node.js, TypeScript, Express, and MongoDB.

## Features

- Patient management
- Appointment scheduling
- Medical records
- Laboratory management
- Inventory tracking
- Invoice and payment processing
- User authentication and authorization
- Department and staff management
- Analytics and reporting
- Prescription management

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn
- MongoDB (local installation or cloud instance)
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory and add the following variables:

```bash
PORT=3000
MONGODB_URI=mongodb://localhost:27017/clinic-pro
NODE_ENV=development
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d
```

### 4. Database Setup

Ensure MongoDB is running on your system:

- For local MongoDB: Start MongoDB service
- For MongoDB Atlas: Use the connection string in MONGODB_URI

### 5. Run Database Seeders (Optional)

To populate the database with initial data:

```bash
npm run seed
```

To clear existing data and reseed:

```bash
npm run seed:clear
```

### 6. Build the Project

```bash
npm run build
```

### 7. Start the Server

For development:
```bash
npm run dev
```

For production:
```bash
npm start
```

## API Documentation

Once the server is running, access the Swagger documentation at:
```
http://localhost:3000/api/docs
```

## Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run dev` - Start development server with auto-reload
- `npm run seed` - Run database seeders
- `npm run seed:clear` - Clear and reseed database

## API Endpoints

The API is available at `http://localhost:3000/api/`

### Health Check
- `GET /api/health` - Check API health status

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Core Modules
- `/api/patients` - Patient management
- `/api/appointments` - Appointment scheduling
- `/api/medical-records` - Medical records
- `/api/inventory` - Inventory management
- `/api/invoices` - Invoice management
- `/api/payments` - Payment processing
- `/api/tests` - Laboratory tests
- `/api/prescriptions` - Prescription management

## Technology Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT
- **Documentation**: Swagger/OpenAPI
- **Development**: Nodemon for auto-reload

## Security Features

- Helmet for security headers
- Rate limiting
- CORS configuration
- JWT token authentication
- Input validation
- Password hashing with bcryptjs

## Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Route handlers
├── middleware/      # Custom middleware
├── models/         # Database models
├── routes/         # API routes
├── seeds/          # Database seeders
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── server.ts       # Application entry point
```
# clinicback
