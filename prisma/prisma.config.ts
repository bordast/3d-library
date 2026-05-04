import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
    earlyAccess: true,
    schema: {
        kind: 'single',
        filePath: './prisma/schema.prisma',
    },
    migrate: {
        async adapter() {
            const { PrismaLibSQL } = await import('@prisma/adapter-libsql')
            return new PrismaLibSQL({
                url: 'file:' + path.join(process.cwd(), 'prisma/dev.db'),
            })
        },
    },
})