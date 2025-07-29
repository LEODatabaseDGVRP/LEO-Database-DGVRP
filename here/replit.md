# Law Enforcement Database Portal

## Overview

This is a law enforcement database management system built as a full-stack web application. The system provides authenticated access to citation and arrest management tools with role-based permissions for law enforcement officers. The application features a professional dark theme optimized for law enforcement use cases with file-based authentication to avoid database costs.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern React patterns
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **UI Framework**: shadcn/ui components built on Radix UI primitives for professional design
- **Styling**: Tailwind CSS with custom law enforcement color scheme (dark navy palette)
- **State Management**: TanStack Query for server state management and caching
- **Form Handling**: React Hook Form with Zod validation for robust form management

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules for modern JavaScript features
- **API Design**: RESTful API with JSON communication
- **Session Management**: express-session with HTTP-only cookies for security
- **Development**: Hot module replacement via Vite integration
- **Build Process**: esbuild for optimized server bundling

### Authentication & Authorization
- **Authentication Method**: Session-based authentication with secure password hashing
- **Password Security**: bcryptjs for salted password hashing
- **Session Storage**: In-memory session storage with secure HTTP-only cookies
- **Role Management**: Admin and regular user roles with protected routes
- **Middleware**: Authentication and authorization middleware for API protection

## Key Components

### Data Storage
- **Primary Storage**: File-based storage system (FileStorage class) for zero database costs
- **User Management**: JSON file persistence for user accounts and profiles
- **Citation Management**: In-memory storage with file backup capabilities
- **Schema Validation**: Drizzle ORM schemas for type safety without requiring database
- **Data Validation**: Zod schemas shared between client and server for consistency

### Form Management
- **Citation Forms**: Multi-officer citation management with penal code selection
- **Arrest Forms**: Comprehensive arrest documentation with mugshot upload
- **Validation**: Real-time form validation with error messaging
- **Auto-calculation**: Automatic total calculation for fines and jail time
- **Officer Profiles**: Reusable officer information with localStorage persistence

### UI Components
- **Professional Theme**: Dark navy law enforcement color scheme
- **Responsive Design**: Mobile-first responsive layout
- **Component Library**: Complete shadcn/ui component set
- **Command Interface**: Command palette for penal code selection
- **File Upload**: Image upload functionality for arrest documentation

## Data Flow

1. **Authentication Flow**:
   - User login/signup → Session creation → Role-based access control
   - Session persistence across browser sessions
   - Automatic logout on session expiry

2. **Citation Workflow**:
   - Officer information entry → Penal code selection → Violation details → Auto-calculation → Submission
   - Data validation at each step
   - Signature capture for violator acknowledgment

3. **Arrest Workflow**:
   - Officer details → Suspect information → Mugshot upload → Charges and bail → Court information
   - Comprehensive arrest documentation
   - File attachment handling

4. **Admin Functions**:
   - User management → Role assignment → Account termination
   - Administrative oversight of all system users
   - Statistics tracking and reporting

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React 18, React Hook Form, React Query
- **UI Components**: Radix UI primitives, Lucide React icons
- **Styling**: Tailwind CSS, class-variance-authority
- **Validation**: Zod for schema validation
- **Authentication**: bcryptjs for password hashing
- **Server**: Express.js, session management

### Development Tools
- **Build Tools**: Vite, esbuild, TypeScript
- **Code Quality**: ESLint, Prettier configurations
- **Development**: Hot module replacement, source maps

### Optional Integrations
- **Database**: Drizzle ORM with PostgreSQL support (configured but not required)
- **External APIs**: Discord OAuth integration capabilities
- **File Storage**: Local file system with expansion capabilities

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with hot reloading
- **Database**: Optional PostgreSQL via Drizzle ORM
- **File Storage**: Local JSON files for user persistence
- **Session Storage**: In-memory with file backup

### Production Deployment
- **Build Process**: Vite build for client, esbuild for server
- **Static Assets**: Optimized client bundle with tree shaking
- **Server Bundle**: Single JavaScript file with all dependencies
- **Environment Variables**: DATABASE_URL (optional), SESSION_SECRET

### Scaling Considerations
- **Database Migration**: Easy transition from file storage to PostgreSQL
- **Session Storage**: Can be upgraded to Redis or database sessions
- **File Storage**: Can be moved to cloud storage services
- **Load Balancing**: Stateless server design supports horizontal scaling

### Security Features
- **Password Security**: Salted bcrypt hashing
- **Session Security**: HTTP-only cookies, secure flag in production
- **Input Validation**: Client and server-side validation
- **Role-Based Access**: Admin and user role separation
- **File Upload Security**: Base64 encoding with size limits

## Recent Changes: Latest modifications with dates

### January 11, 2025 - Discord Authentication Success
- Successfully configured Discord OAuth integration with all required environment variables
- Fixed blank page issue by correcting index.html configuration
- Discord bot is operational and connected to server
- All authentication systems are fully functional
- User confirmed Discord login system is working perfectly