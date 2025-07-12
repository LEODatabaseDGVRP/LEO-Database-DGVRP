# Law Enforcement Database Portal

## Overview

This is a law enforcement database management system built as a full-stack web application. The system provides authenticated access to citation and arrest management tools with role-based permissions for law enforcement professionals.

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
- **Discord Integration**: OAuth2 integration for user verification and signup

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
- **Officer Profiles**: Saved officer data with auto-population from user profiles

### User Interface
- **Professional Theme**: Custom law enforcement color scheme with dark navy primary colors
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Toast Notifications**: User feedback for actions and errors
- **Modal Dialogs**: Confirmation dialogs for destructive actions
- **Command Palette**: Searchable dropdowns for penal codes and officer selection

## Data Flow

### User Authentication Flow
1. User attempts to access protected route
2. Authentication middleware checks session
3. If not authenticated, redirect to login page
4. Login form validates credentials against file storage
5. Session created and user redirected to selection page

### Citation Creation Flow
1. User selects citation form from selection page
2. Form auto-populates with user's officer data
3. User adds additional officers and penal codes
4. System calculates totals automatically
5. Form validation ensures data integrity
6. Citation saved to file storage with unique ID

### Discord Integration Flow
1. User clicks Discord verification on signup
2. System generates OAuth2 URL with state parameter
3. User authorizes on Discord and returns with code
4. Server exchanges code for user information
5. Discord data stored in session for signup completion
6. User completes signup with Discord verification

## External Dependencies

### UI Components
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework for consistent styling
- **Lucide Icons**: Consistent iconography throughout the application

### Authentication & Security
- **bcryptjs**: Password hashing for secure credential storage
- **express-session**: Session management for authentication state
- **Discord OAuth2**: User verification through Discord integration

### Development Tools
- **Vite**: Fast development server with hot module replacement
- **TypeScript**: Type safety across frontend and backend
- **Zod**: Schema validation for form data and API requests
- **TanStack Query**: Server state management and caching

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React application to optimized static files
- **Backend**: esbuild bundles Node.js server into single executable
- **Assets**: Static files served through Express with proper caching headers
- **Environment**: Production builds optimize for performance and security

### File Storage
- **User Data**: JSON files for user accounts and profiles
- **Citation Data**: In-memory storage with file backup capabilities
- **Session Storage**: Memory-based sessions with configurable expiration
- **No Database**: Zero database costs through file-based persistence

### Security Considerations
- **Session Security**: HTTP-only cookies with secure flags in production
- **Input Validation**: Comprehensive validation on both client and server
- **Rate Limiting**: Protection against brute force attacks
- **CORS Configuration**: Proper cross-origin resource sharing setup
- **Environment Variables**: Sensitive configuration through environment variables

### Performance Optimizations
- **Code Splitting**: Lazy loading for non-critical components
- **Asset Optimization**: Minification and compression of static assets
- **Query Caching**: Intelligent caching of server responses
- **Bundle Analysis**: Monitoring and optimization of bundle sizes