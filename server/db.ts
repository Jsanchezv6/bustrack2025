import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configuración para WebSocket constructor en entorno Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL debe estar configurada. ¿Olvidaste crear la base de datos?",
  );
}

// Pool de conexiones PostgreSQL
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Instancia de Drizzle ORM con el esquema
export const db = drizzle({ client: pool, schema });