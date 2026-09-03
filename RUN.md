# Football Career Sim — run & deploy

## Local
```bash
npm install
npm start
# open http://localhost:3847
```

## Railway (phone play, no PC)
1. Connect repo `Ewawere/football-career-sim`
2. Builder: Dockerfile (see `Dockerfile` + `railway.toml`)
3. Start: `npx tsx src/ui/server.ts` (or `npm start`)
4. Open the public HTTPS URL on your phone browser

## Hybrid features on hub
- Season objectives + claim SP
- Inbox (mark read)
- Medical centre snapshot
- Matchday squad / depth
- Role + match instructions
- Contract negotiation rounds
- News feed with body text

## API smoke
```bash
curl -X POST $URL/api/start -H 'content-type: application/json' -d '{"firstName":"Alex","lastName":"Player","position":"CM"}'
curl $URL/api/hub
```
