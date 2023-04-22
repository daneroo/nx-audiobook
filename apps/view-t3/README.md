
# view-t3

My first t3 app, to view audiobook stuff

## TODO

- [ ] [T3 url shortner uses GitHub Auth](https://slug.vercel.app/)

## Setup

```bash
cd apps
pnpm create t3-app@latest

Next steps:
  cd view-t3
  pnpm install
  pnpm prisma db push
  pnpm dev
```

### Auth w/Discord

- Create a new application (view-t3) at: <https://discord.com/developers/applications>
- Populate `.env`
- Add the local callback hook: <http://localhost:3000/api/auth/callback/discord>
- Add the `secret"` to auth.ts: `secret: process.env.NEXTAUTH_SECRET`
- Add the `NEXTAUTH_SECRET` to `.env` (`openssl rand -base64 32`)

### Deployment

Follow our deployment guides

- [Vercel](https://create.t3.gg/en/deployment/vercel)
- [Netlify](https://create.t3.gg/en/deployment/netlify)
- [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## References

- [T3 Stack](https://create.t3.gg/)
- [T3 Tutorial](https://dev.to/nexxeln/build-a-full-stack-app-with-create-t3-app-5e1e)
- [T3 chat video](https://www.youtube.com/watch?v=dXRRY37MPuk)
- [T3 url shortener uses GitHub Auth](https://slug.vercel.app/)
- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
