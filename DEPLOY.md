# Despliegue de Hemeron Prospector

Guía para dejar el Prospector en un proyecto nuevo de Dokploy, con dominio propio, y conectar el worker de demos de la Mac.

Reemplaza `prospector.tudominio.com` por el dominio que vayas a usar.

## 1. Lo que hace falta antes de empezar

- [ ] Acceso de Dokploy al repositorio privado `BetazoDev/hemeron-prospector`. En Dokploy, en **Settings → Git → GitHub**, la GitHub App debe tener permiso sobre este repo; si no, agrégalo desde GitHub en **Settings → Applications → Dokploy → Repository access**.
- [ ] El dominio nuevo, con acceso a su DNS.
- [ ] La API key de Apify (la misma que usa la app actual).
- [ ] Decidir la base de datos (paso 3): una nueva y vacía, o la de la app actual.

## 2. Proyecto y aplicación en Dokploy

1. **Projects → Create Project**: nombre `Hemeron Prospector`.
2. Dentro del proyecto, **Create Service → Application**: nombre `prospector`.
3. En **General → Provider**: GitHub, repositorio `BetazoDev/hemeron-prospector`, rama `main`. Activa **Autodeploy** si quieres que cada push a `main` despliegue.
4. **Build Type**: Dockerfile (ruta `Dockerfile`). La imagen expone el puerto **3000**.

Al arrancar, el contenedor revisa la base, aplica las migraciones (`prisma migrate deploy`, que nunca borra datos) y luego levanta Next.js. No hace falta correr migraciones a mano.

## 3. Base de datos

**Opción A: base nueva (recomendada para el proyecto nuevo)**

1. En el mismo proyecto, **Create Service → Database → PostgreSQL**: nombre `prospector-db`.
2. Cuando esté corriendo, copia su **Internal Connection URL** (la que usa el host interno de Dokploy) para `DATABASE_URL`.
3. Las bases, los negocios y los usuarios empiezan vacíos. El administrador se crea con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.

**Opción B: la base de la app actual**

Usa la misma `DATABASE_URL` que tiene la app de `neo-prospector`. Las migraciones nuevas solo agregan columnas y tablas, así que los datos se conservan. No dejes las dos apps corriendo contra la misma base: apaga la anterior antes de desplegar esta.

## 4. Variables de entorno

En la aplicación, **Environment**:

```env
DATABASE_URL=postgresql://usuario:contraseña@host-interno:5432/base
# El host de DATABASE_URL; la app se niega a arrancar si no coincide
DATABASE_EXPECTED_HOST=host-interno
JWT_SECRET=           # genera uno: openssl rand -hex 32
ADMIN_EMAIL=          # el correo con el que vas a entrar
ADMIN_PASSWORD=       # contraseña del administrador
APIFY_API_KEY=
APP_URL=https://prospector.tudominio.com

# Worker de demos de la Mac
WORKER_TOKEN=         # genera uno: openssl rand -hex 24 (el mismo va en worker/.env)
DEMOS_BASE_URL=https://demos.diabolicalservices.tech/
# DEMO_AUTO_QUEUE=false   # opcional: los candidatos ya no entran solos a la cola de demos
```

Sin `WORKER_TOKEN` la app funciona normal, pero el worker no puede conectarse.

## 5. Dominio

1. En tu proveedor de DNS, crea un registro **A** para `prospector.tudominio.com` apuntando a la IP del servidor de Dokploy (la ves en **Settings → Server**).
2. En la aplicación, **Domains → Add Domain**: host `prospector.tudominio.com`, puerto `3000`, HTTPS activado con **Let's Encrypt**.
3. Espera a que el DNS propague y el certificado se emita (unos minutos).

## 6. Desplegar y comprobar

1. **Deploy**. En **Logs** debe verse `[startup]` revisando la base, aplicando migraciones y arrancando el servidor.
2. Abre `https://prospector.tudominio.com/login` y entra con `ADMIN_EMAIL` y `ADMIN_PASSWORD`.
3. Comprueba la API del worker (debe responder 401, no 503):

   ```bash
   curl -s -X POST https://prospector.tudominio.com/api/worker/claim -w " %{http_code}\n"
   ```

   Un 503 significa que falta `WORKER_TOKEN` en las variables.
4. Lanza una búsqueda pequeña para confirmar que Apify responde.

## 7. Conectar el worker de la Mac

Detalles completos en [`worker/README.md`](worker/README.md). Resumen:

```bash
cd worker
npm install
cp .env.example .env
```

En `worker/.env`:

- `PROSPECTOR_URL=https://prospector.tudominio.com`
- `WORKER_TOKEN=` el mismo valor que en Dokploy.
- `CLAUDE_CODE_OAUTH_TOKEN=` el token del plan, generado con:

  ```bash
  npx @anthropic-ai/claude-code setup-token
  ```

- `PUBLISH=false` para la primera prueba.

Después:

```bash
npm run probe        # Claude responde
npm run once         # una demo supervisada, sin push
```

Revisa el sitio que deja en `~/Claude/lista-2/_work/prospector-<slug>`. Si está bien, cambia a `PUBLISH=true`, reinicia el worker y déjalo corriendo:

```bash
caffeinate -i npm start
```

La primera publicación agrega la pestaña «Prospector» al sitio de demos (`src/data/sites3.ts` y pequeños cambios en `next.config.ts` y `src/app/page.tsx`). Ese repositorio es público y se despliega con cada push.

## 8. Retirar la app anterior

Cuando la nueva funcione:

- [ ] Detén la app de `neo-prospector` en Dokploy (o bórrala si ya no la necesitas).
- [ ] Si el dominio anterior debe apuntar a la nueva app, muévelo en **Domains** de la app nueva.
- [ ] Desactiva el Autodeploy de la app anterior para que un push a `neo-prospector` no la vuelva a levantar.
