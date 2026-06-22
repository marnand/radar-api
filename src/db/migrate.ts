import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db } from './client.js'
import { config } from '../config/env.js'

async function runMigrations() {
  console.log(`Running migrations on ${config.DATABASE_URL.replace(/:\/\/.*@/, '://***@')}`)
  await migrate(db, { migrationsFolder: './migrations' })
  console.log('Migrations applied successfully')
  process.exit(0)
}

runMigrations().catch((err) => {
  console.error('Migration failed', err)
  process.exit(1)
})
