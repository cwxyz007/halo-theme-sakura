import axios from 'axios'
import cors from '@koa/cors'
import Koa, { Middleware } from 'koa'
import proxy from 'koa-better-http-proxy'
import { haloAccessKey, haloTarget, isDev } from './config'
import { createHaloApi } from './halo-api'
import { router } from './router'
import path from 'path'
import fs from 'fs'
import c2k from 'koa-connect'
import { serveViteBuild, serveViteDev } from './vite'

const url = new URL(haloTarget)

const proxyConf = {
  target: url.toString(),
  https: url.protocol === 'https:',
  accessKey: haloAccessKey
}

async function main() {
  const app = new Koa()

  const haloProxy = createHaloProxy({
    target: proxyConf.target,
    accessKey: proxyConf.accessKey
  })

  const haloApi = createHaloApi()

  const haloUrl = new URL(haloTarget)
  const haloAdminProxy = proxy(haloUrl.hostname, {
    https: haloUrl.protocol === 'https:',
    preserveReqSession: true,
    port: +haloUrl.port || undefined
  })

  if (isDev) {
    app.use(
      cors({
        origin: '*'
      })
    )
  }

  app
    .use(async (ctx, next) => {
      const { request } = ctx
      console.log('[server] start', request.path)
      await next()
      console.log('[server] end', request.path)
    })
    .use(router.routes())
    .use(router.allowedMethods())
    .use(async (ctx, next) => {
      const reqPath = ctx.request.path

      const haloAdminPrefix = [
        '/admin',
        '/theme',
        '/api/admin',
        '/images',
        '/upload',
        '/rss.xml',
        '/sitemap.xml',
        '/sitemap.html'
      ]

      if (/^\/admin(\/)?$/.test(reqPath)) {
        ctx.redirect('/admin/index.html')
        return
      }

      if (haloAdminPrefix.find((r) => reqPath.startsWith(r))) {
        return haloAdminProxy(ctx, next)
      }

      if (reqPath.startsWith('/api')) {
        await haloProxy(ctx, next)
        await haloApi(ctx, next)
      } else {
        await next()
      }
    })

  if (isDev) {
    const root = process.cwd()
    const vite = await (await import('vite')).createServer({
      root,
      logLevel: 'info',
      server: {
        middlewareMode: true
      }
    })

    // use vite's connect instance as middleware
    app.use(c2k(vite.middlewares))
    app.use(serveViteDev(vite))
  } else {
    app.use(serveViteBuild(path.join(__dirname, 'client')))
  }

  const port = isDev ? 9555 : 9556

  app.listen(port, () => {
    console.log('http://localhost:' + port)
  })

  return app
}

main()

function createHaloProxy(opt: {
  target: string
  accessKey: string
}): Middleware {
  const instance = axios.create({
    baseURL: opt.target
  })

  instance.interceptors.request.use((conf) => {
    if (conf.url?.match('/api/admin')) {
      conf.headers['admin-authorization'] = opt.accessKey
    } else {
      conf.headers['api-authorization'] = opt.accessKey
    }

    return conf
  })

  return async (ctx) => {
    const req = ctx.request
    const res = await instance.request({
      method: req.method as any,
      url: ctx.path,
      params: ctx.query,
      data: ctx.body
    })

    ctx.body = res.data
  }
}
