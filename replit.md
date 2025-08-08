# Bus Management System

## Overview

This is a full-stack bus management system built with React, Express, and TypeScript. The application provides real-time location tracking for buses, schedule management, and driver assignments. It features separate dashboards for administrators and drivers, with WebSocket-based real-time communication for location updates. The system now includes persistent user sessions and integrated Google Maps for real-time location visualization.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 2025)

✓ **Campo "Frecuencia" Eliminado**: Removido campo innecesario de frecuencia del esquema de horarios y todos los componentes relacionados
✓ **Panel "Mi Turno Siguiente" Corregido**: Solucionado problema crítico de zona horaria que causaba mal funcionamiento del panel
✓ **Zona Horaria Guatemala**: Implementado uso correcto de zona horaria "America/Guatemala" para cálculos precisos de turnos
✓ **Lógica de Turnos Depurada**: Corregido algoritmo que incorrectamente devolvía turnos pasados como "próximos"
✓ **Cola de Turnos Corregida**: Backend ahora devuelve correctamente TODOS los turnos del chofer para mostrar cola completa
✓ **Sistema de Múltiples Turnos**: Implementado sistema para asignar múltiples turnos por chofer con restablecimiento diario automático
✓ **Panel Mejorado del Chofer**: Agregadas secciones "Mi Turno Actual" y "Mi Turno Siguiente" para mostrar información de turnos múltiples
✓ **Endpoint de Turnos**: Creado `/api/assignments/driver/:driverId/shifts` para obtener turno actual y siguiente basado en la hora
✓ **Lógica de Turnos Inteligente**: Sistema que determina automáticamente cuál es el turno actual y próximo según la hora del día
✓ **Choferes Siempre Disponibles**: Eliminado filtro restrictivo para permitir asignar múltiples turnos al mismo chofer
✓ **Botón "Cola de Turnos"**: Agregado botón en panel del chofer para mostrar todos los turnos programados del día con estados dinámicos
✓ **Vista Cola Completa**: Interface completa mostrando turnos pendientes, en curso y completados con indicadores visuales
✓ **Sistema de Gestión de Usuarios**: Implementado sistema completo para crear, editar y eliminar usuarios (administradores y choferes)
✓ **Nueva Pestaña "Usuarios"**: Agregada pestaña en el panel administrativo con lista completa de usuarios y formularios de gestión
✓ **Mejoras en Ubicaciones**: Corregidos problemas de transmisión de ubicaciones desde el panel de chofer
✓ **Botón "Localizar"**: Implementado botón para centrar el mapa en ubicaciones específicas de choferes
✓ **Sesiones Persistentes**: Implementado sistema de sesiones basado en localStorage para mantener login activo
✓ **Integración Google Maps**: Agregado componente interactivo de Google Maps mostrando ubicaciones en tiempo real
✓ **Actualizaciones en Tiempo Real**: Mejorado WebSocket con invalidación automática de cache para actualizaciones instantáneas
✓ **Gestión de Sesiones**: Agregado endpoint de verificación de sesión y flujo de autenticación mejorado
✓ **Mejoras de UI**: Agregados estados de carga y mejor manejo de errores en toda la aplicación
✓ **Duplicados en Estado de Choferes Solucionado**: Cada chofer aparece una sola vez agrupando sus múltiples turnos
✓ **Detener Transmisión Automática**: Sistema detiene transmisión cuando chofer cierra sesión o página
✓ **Actualización Visual Automática**: Estado de transmisión se actualiza automáticamente sin recargar página via WebSocket
✓ **Sincronización Estado Real**: Eliminada desconexión entre interfaz visual y estado real en base de datos
✓ **WebSocket Mejorado**: Agregado manejo de mensaje `transmissionStopped` con invalidación automática de cache
✓ **Botón Transmisión Unificado**: Consolidado en un solo botón "Iniciar/Detener Transmisión" que maneja toda la funcionalidad
✓ **Eliminado Botón Duplicado**: Removido "Obtener Ubicación Actual" para evitar confusión y duplicidad de funciones
✓ **Actualización Visual Corregida**: Solucionado problema de actualización visual del estado de choferes con invalidación agresiva de cache
✓ **Estado Local Sincronizado**: Agregado limpieza automática de estado local cuando se detiene transmisión via WebSocket
✓ **Logging Mejorado**: Implementado logging detallado para diagnóstico de problemas de sincronización visual
✓ **Problema Turnos Panel Chofer Resuelto**: Sistema de turnos funcionando correctamente, necesitaba asignaciones para fecha actual
✓ **Zona Horaria Guatemala Verificada**: Confirmado funcionamiento correcto de cálculos de turnos con "America/Guatemala"

## System Architecture

The application follows a monorepo structure with clear separation between client and server code:

- **Frontend**: React with TypeScript, using Vite as the build tool
- **Backend**: Express.js with TypeScript, providing REST API endpoints
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Real-time Communication**: WebSockets for live location tracking
- **Styling**: Tailwind CSS with shadcn/ui component library

## Key Components

### Frontend Architecture
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Wouter** for lightweight client-side routing
- **TanStack Query** for server state management and caching
- **React Hook Form** with Zod validation for form handling
- **shadcn/ui** components built on Radix UI primitives
- **Tailwind CSS** for utility-first styling

### Backend Architecture
- **Express.js** server with TypeScript
- **Drizzle ORM** with PostgreSQL dialect for database operations
- **WebSocket Server** for real-time location broadcasting
- **PostgreSQL database** with DatabaseStorage class for persistent data
- **Session-based authentication** (simplified for demo purposes)

### Database Schema
The system uses four main entities:
- **Users**: Stores admin and driver accounts with roles
- **Schedules**: Bus route schedules with timing and frequency information
- **Assignments**: Links drivers to specific schedules for given dates
- **Locations**: Real-time GPS coordinates from drivers

### Authentication System
- Simple username/password authentication
- Role-based access control (admin/driver)
- Client-side auth state management with AuthManager
- Session persistence across page reloads

## Data Flow

1. **Authentication Flow**: Users log in through the login page, which sets the user context and redirects to role-appropriate dashboards
2. **Admin Dashboard**: Administrators can create/manage schedules, assign drivers, and view real-time locations
3. **Driver Dashboard**: Drivers can view their assignments and transmit location data
4. **Real-time Updates**: Location data flows from driver devices through WebSocket connections to update admin dashboards instantly

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL serverless driver
- **drizzle-orm**: Type-safe ORM with PostgreSQL support
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router
- **ws**: WebSocket implementation for Node.js

### UI and Styling
- **@radix-ui/***: Accessible component primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Utility for creating component variants
- **lucide-react**: Icon library

### Form and Validation
- **react-hook-form**: Performant form library
- **@hookform/resolvers**: Form validation resolvers
- **zod**: TypeScript-first schema validation
- **drizzle-zod**: Zod schema generation from Drizzle schemas

### Development Tools
- **vite**: Fast build tool and dev server
- **typescript**: Type safety and tooling
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- **Vite dev server** with HMR for frontend development
- **tsx** for running TypeScript server files directly
- **Drizzle Kit** for database schema management and migrations
- **Replit integration** with custom Cartographer plugin and error overlay

### Production Build Process
1. Frontend assets built with Vite to `dist/public`
2. Server code bundled with esbuild to `dist/index.js`
3. Static file serving handled by Express in production
4. Database migrations applied via `drizzle-kit push`

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **NODE_ENV**: Environment flag for development/production modes
- **REPL_ID**: Replit-specific environment detection

### Key Architectural Decisions

**Database Choice**: PostgreSQL with Drizzle ORM was chosen for its type safety, migration system, and PostgreSQL-specific features like UUID generation.

**State Management**: TanStack Query handles server state with caching and background updates, while React Context manages authentication state.

**Real-time Communication**: WebSockets provide low-latency location updates essential for tracking moving vehicles.

**Component Library**: shadcn/ui provides accessible, customizable components while maintaining design consistency.

**Monorepo Structure**: Shared schema definitions between client and server ensure type consistency across the full stack.

**Build Strategy**: Vite for frontend and esbuild for backend provide fast development cycles and optimized production builds.