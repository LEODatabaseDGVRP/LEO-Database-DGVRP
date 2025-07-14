# Law Enforcement Database Portal

## Overview

This is a law enforcement database management system built as a full-stack web application. The system provides authenticated access to citation and arrest management tools with role-based permissions for law enforcement officers. It features Discord OAuth integration for secure signup and uses a file-based storage system to minimize infrastructure costs.

## User Preferences

Preferred communication style: Simple, everyday language.

## Test Accounts

- **Username**: test
- **Password**: test123  
- **Role**: Regular officer (non-admin)
- **Badge**: 1234

## Recent Changes (July 2025)

### Signup Form Fix (July 14, 2025)
- **Schema Mismatch Resolution**: Fixed critical mismatch between frontend signup form and backend validation schema
- **Frontend Data Structure**: Updated signup form to send `rpName` instead of `fullName`, `department`, `email`, `phoneNumber`
- **Backend Schema Update**: Modified `signUpSchema` to match frontend form fields exactly
- **Production Deployment**: Resolved signup errors on Render deployment with proper field mapping
- **Enhanced Debug Logging**: Added comprehensive debugging for signup process to identify production issues

## Recent Changes (July 2025)

### Admin Panel Enhancements
- **Background Consistency**: Fixed admin panel background to match other pages using var(--law-primary) with p-4 padding
- **User Management UI**: Updated user management section with dark theme styling - changed white backgrounds to slate-800 with proper text colors
- **User Protection**: Implemented complete protection for popfork1 (owner) and current user - cannot be deleted, terminated, or have admin status modified
- **API Fixes**: Fixed username blocking/unblocking and termination functionality - corrected API endpoint URLs and parameter passing
- **Search & Filtering**: Added comprehensive search and date filtering for citations and arrests (This Month, Last Month, Last 3 Months, All Time)
- **Full Detail Views**: Added detailed view dialogs for both citations and arrests with complete information display
- **Bulk Operations**: Added "Delete All" functionality for both citations and arrests with confirmation dialogs
- **Visual Indicators**: Added owner/user badges and improved UI organization with proper dark theme styling
- **Bug Fixes**: Fixed arrest report Discord integration, individual deletion confirmations, and username management API calls

### Critical Bug Fixes (July 13, 2025)
- **Username Blocking System**: Fixed critical bug where username data wasn't being sent properly from frontend to backend - mutations were sending wrapped objects instead of direct data to apiRequest
- **Confirmation Dialog Consistency**: Applied consistent dark theme styling (bg-slate-900, border-slate-700) to all AlertDialog components across the admin panel
- **Test Account**: Created test account (username: test, password: test123) with admin privileges for debugging purposes
- **Data Validation**: Added proper username validation on backend to prevent undefined entries in blocked/terminated username lists

### Discord Authentication Fixes (July 13, 2025)
- **Missing Discord Disconnect Route**: Added missing `/api/auth/discord/disconnect` endpoint that was causing errors when users tried to disconnect Discord verification
- **Callback Error Handling**: Fixed Discord callback error handling to properly redirect to discord-callback page instead of signup page to prevent login redirect issues
- **Enhanced Logging**: Added comprehensive logging to Discord OAuth flow to debug role verification bypass issues
- **Session Management**: Improved session saving and cleanup for Discord verification state
- **Role Verification Fix**: Fixed critical issue where Discord role verification was bypassed - now properly enforces DISCORD_REQUIRED_ROLE (LEO) requirement
- **Improved Error Messages**: Added specific error messages for insufficient role, not being a member, and authentication failures
- **Proper Role Enforcement**: Updated handleDiscordCallback to pass required role parameter to checkUserRole function
- **Missing Route Fix**: Added missing Discord callback route to App.tsx routing to prevent redirect to login page with generic errors
- **Signup Form Improvements**: Fixed signup form schema to match backend expectations and added auto-fill for Discord username with read-only field after verification
- **Authentication State Management**: Added proper cache invalidation for authentication state after successful signup

### Security Improvements
- **Protected Users**: popfork1 and current user cannot be modified by any admin with both client-side UI restrictions and server-side API protection
- **User Identification**: Added visual badges for owner, current user, admin, and terminated status with dark theme compatibility

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
- **Password Security**: bcryptjs for salted password hashing - users create their own secure passwords during signup
- **Session Storage**: In-memory session storage with secure HTTP-only cookies
- **Role Management**: Admin and regular user roles with protected routes
- **Middleware**: Authentication and authorization middleware for API protection
- **Discord Integration**: OAuth2 integration for user verification and secure signup process
- **User Registration**: Self-service account creation where users set their own passwords securely

## Key Components

### Data Storage
- **Primary Storage**: File-based storage system (FileStorage class) for zero database costs
- **User Management**: JSON file persistence for user accounts and profiles (`users.json`)
- **Citation Management**: JSON file storage with in-memory caching (`citations.json`)
- **Arrest Management**: JSON file storage for arrest records (`arrests.json`)
- **Schema Validation**: Drizzle ORM schemas for type safety without requiring database
- **Data Validation**: Zod schemas shared between client and server for consistency

### Form Management
- **Citation Forms**: Multi-officer citation management with penal code selection
- **Arrest Forms**: Comprehensive arrest documentation with mugshot upload capabilities
- **Validation**: Real-time form validation with error messaging
- **Auto-calculation**: Automatic total calculation for fines and jail time
- **Officer Profiles**: Saved officer data for quick form population

### Discord Integration
- **OAuth Service**: Discord OAuth2 for secure user verification
- **Bot Service**: Discord bot integration for automated report notifications
- **Server Verification**: Checks user membership in required Discord servers
- **User Mapping**: Links Discord IDs to law enforcement accounts

## Data Flow

### User Registration Flow
1. User initiates signup process
2. Discord OAuth verification required
3. User completes profile with badge number, rank, and RP name
4. User creates their own secure password (minimum 8 characters)
5. Account created with bcrypt-encrypted password hash
6. Session established with HTTP-only cookies

### Citation/Arrest Creation Flow
1. Officer fills out comprehensive forms
2. Real-time validation and calculation
3. Data saved to JSON files with backup
4. Optional Discord bot notifications
5. Records available in admin panel

### Authentication Flow
1. Login with username/password
2. Session validation middleware
3. Role-based access control
4. Automatic session refresh
5. Secure logout with session cleanup

## External Dependencies

### Required Services
- **Discord Application**: OAuth2 client credentials
- **Discord Bot**: Bot token for automated notifications
- **Session Secret**: Secure key for session encryption

### Optional Integrations
- **Discord Server**: For user verification and role checking
- **File Upload**: Base64 encoding for mugshot storage

## Deployment Strategy

### File-Based Architecture Benefits
- **Zero Database Costs**: Uses JSON files instead of expensive database hosting
- **Simple Deployment**: No database setup or migration requirements
- **Data Persistence**: Files stored alongside application code
- **Backup Strategy**: JSON files can be easily backed up and restored

### Production Considerations
- **Session Security**: Uses secure HTTP-only cookies in production
- **Password Security**: Users create and manage their own passwords - no default or shared passwords
- **File Permissions**: Proper file system permissions for data files
- **Environment Variables**: Discord credentials and session secrets
- **HTTPS**: Required for secure cookie transmission and OAuth callbacks

### Scaling Considerations
- **File Locking**: Implemented for concurrent access safety
- **Memory Usage**: In-memory caching with file persistence
- **Performance**: Suitable for small to medium-sized law enforcement departments
- **Migration Path**: Drizzle schemas ready for database migration if needed