import { buildApp } from './app.js'
import { config } from './config/env.js'
import { seedAdminUser } from './modules/auth/auth.repository.js'
import { seedDefaultConfig } from './modules/cnpj/cnpj.repository.js'
import { setJobLogger } from './jobs/fetch-cnpjs.job.js'
import { iniciarAgendador, setSchedulerLogger } from './jobs/scheduler.js'

const app = buildApp()

async function start() {
  try {
    await seedAdminUser()
    await seedDefaultConfig()
    setJobLogger(app.log)
    setSchedulerLogger(app.log)
    await iniciarAgendador()

    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    app.log.info(`Server listening on port ${config.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
