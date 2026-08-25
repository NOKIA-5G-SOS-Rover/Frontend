# Nokia 5G SOS Rover - Frontend

Frontend-ul este interfata web pentru sistemul Nokia 5G SOS Rover. Aplicatia este construita cu React si este livrata in productie dintr-un container Docker care compileaza aplicatia si o serveste prin Nginx.

Aplicatia comunica cu backend-ul prin SignalR pentru evenimente live, telemetrie si comenzi catre rover. URL-ul backend-ului este configurabil prin variabila `REACT_APP_API_URL` si are valoarea implicita `http://localhost:5000`.

## Ce am implementat

- Dashboard Home cu statusul conexiunii, alerte live, nivelul bateriei si timpul de raspuns.
- Afisarea alertelor SOS critice si redarea sunetului pentru alertele noi.
- Grafic cu alerte istorice si calendar pentru selectarea intervalului analizat.
- Pagina Cameras cu doua fluxuri video, statusul camerelor si reincercarea automata a conexiunii.
- Control manual al roverului prin SignalR: directie, viteza, oprire si comutare intre modurile manual si autonom.
- Pagina Past Alerts cu lista alertelor, detalii despre locatie, incredere, data si ora, precum si filtre.
- Autentificare pentru operatori, sesiune pastrata in tab si control al accesului pe baza permisiunilor.
- Pagina de administrare pentru utilizatorii care au permisiunile necesare.
- Layout responsive pentru desktop, tableta si mobil, cu suport pentru tema dark si navigare mobila.
- Normalizarea evenimentelor primite de la backend, inclusiv severitate, confidence, status de verificare si imagini.

Mai multe detalii despre structura interfetei si wireframe-uri se gasesc in [documentatia UI/UX](docs/ui-ux-draft.md).

## Cerinte

- Docker Desktop sau Docker Engine cu Docker Compose optional.
- Git, pentru clonarea repository-ului.
- Backend-ul roverului pornit si accesibil, daca se doreste testarea conexiunii live.

Node.js si npm sunt necesare doar pentru rularea aplicatiei direct in modul de dezvoltare sau pentru rularea testelor in afara containerului.

## Rulare cu Docker

### Build si pornire locala

Din directorul proiectului, ruleaza:

```bash
docker build -t rover-frontend .
docker run -d -p 8080:80 --name rover-frontend rover-frontend
```

Aplicatia poate fi accesata la [http://localhost:8080](http://localhost:8080).

Dockerfile-ul foloseste doua etape:

1. Imaginea `node:20-alpine` instaleaza dependentele si ruleaza `npm run build`.
2. Imaginea `nginx:alpine` serveste fisierele compilate din directorul `build` pe portul 80.

Pentru a opri si sterge containerul:

```bash
docker stop rover-frontend
docker rm rover-frontend
```

Imaginea Docker foloseste valoarea implicita `http://localhost:5000` pentru backend. Pentru o alta adresa, Dockerfile trebuie mai intai configurat sa primeasca `REACT_APP_API_URL` ca build argument si sa o expuna procesului React in etapa de build. Variabilele `REACT_APP_*` sunt incluse in aplicatie in timpul build-ului, nu la pornirea containerului.

### Folosirea imaginii din GitHub Container Registry

Dupa autentificarea in registry, ultima imagine publicata poate fi pornita astfel:

```bash
docker login ghcr.io -u <github-username>
docker pull ghcr.io/nokia-5g-sos-rover/rover-frontend:latest
docker run -d -p 8080:80 --name rover-frontend ghcr.io/nokia-5g-sos-rover/rover-frontend:latest
```

Deschide [http://localhost:8080](http://localhost:8080) in browser.

## Rulare locala fara Docker

Instaleaza dependentele si porneste serverul React:

```bash
npm install
npm start
```

Serverul de dezvoltare este disponibil la [http://localhost:3000](http://localhost:3000). Pentru un backend local la alta adresa:

```bash
REACT_APP_API_URL=http://localhost:5000 npm start
```

In PowerShell:

```powershell
$env:REACT_APP_API_URL = "http://localhost:5000"
npm start
```

## Cont demo

In configuratia implicita, autentificarea de dezvoltare foloseste:

- Utilizator: `admin`
- Parola: `dansiandrei`

Aceste valori pot fi schimbate prin `REACT_APP_DEMO_ADMIN_USERNAME` si `REACT_APP_DEMO_ADMIN_PASSWORD` inainte de build sau pornire.

## Testare si build

Teste unitare si de componente:

```bash
npm test
```

Build de productie:

```bash
npm run build
```

Testele end-to-end Playwright se pot rula cu:

```bash
npx playwright test
```

## Structura principala

- `src/App.js` - conexiunea SignalR comuna, autentificarea si rutarea intre vizualizari.
- `src/components/` - vizualizarile Home, Cameras, Past Alerts, Login si Admin.
- `src/auth/` - permisiuni si reguli de acces.
- `src/data/` - datele demonstrative si alertele arhivate.
- `src/utils/` - normalizarea evenimentelor venite de la backend.
- `src/styles/` - stilurile pentru componente si layout responsive.
- `Dockerfile` - build-ul React si imaginea Nginx pentru productie.
- `nginx.conf` - configuratia Nginx si fallback-ul pentru navigarea React.

## CI/CD (GitHub Actions)

Acest repository utilizeaza GitHub Actions pentru a automatiza publicarea aplicatiei. Workflow-ul este configurat in fisierul `.github/workflows/docker-deploy.yml`.

### Cand se declanseaza?

Procesul ruleaza **automat** la fiecare `push` sau la acceptarea unui `pull_request` pe branch-ul `main`. Nu este necesara nicio interventie manuala pentru build.

### Cum functioneaza?

1. **Checkout:** Se descarca cea mai recenta versiune a codului.
2. **Autentificare:** Runner-ul GitHub se conecteaza la GitHub Container Registry (GHCR) folosind un token temporar si sigur.
3. **Build:** Se construieste imaginea Docker folosind instructiunile din `Dockerfile` si setarile Nginx.
4. **Publish:** Noua imagine este etichetata cu `latest` si urcata public/privat la nivelul organizatiei.

### Accesarea imaginii generate (Pe Server)

Odata ce workflow-ul apare cu statusul *Success* in tab-ul "Actions", imaginea actualizata poate fi trasa direct pe serverul roverului.

**Nota:** Este necesara autentificarea prealabila pe server cu un *Personal Access Token (PAT)* care are permisiunea `read:packages`.

```bash
# Se descarca ultima versiune generata de Action
docker pull ghcr.io/nokia-5g-sos-rover/rover-frontend:latest

# Se ruleaza containerul 
docker run -d -p 80:80 --name frontend-rover ghcr.io/nokia-5g-sos-rover/rover-frontend:latest

```

---

## Docker Config

Acest ghid contine pasii necesari pentru a putea descarca si testa local ultima versiune a interfetei roverului NOKIA 5G SOS.

### Partea 1: Generarea Token-ului de acces 

Deoarece imaginea Docker este stocata in GitHub Container Registry sub organizatia proiectului, e nevoie de o cheie speciala de acces (Personal Access Token). **Parola normala a contului vostru de GitHub nu va functiona in terminal.**

**Pasii exacti pentru generare:**

1. Deschideti GitHub in browser, dati click pe poza voastra de profil (dreapta-sus) si mergeti la **Settings**.
2. Faceti scroll in meniul din stanga pana jos de tot si selectati **Developer settings**.
3. Mergeti la **Personal access tokens** -> **Tokens (classic)**.
4. Apasati butonul **Generate new token (classic)**.
5. La "Note", scrieti un nume sugestiv (ex: `Rover Frontend Docker Pull`).
6. **FOARTE IMPORTANT:** La sectiunea "Select scopes" (permisiuni), bifati **DOAR casuta `read:packages**`. Aceasta este singura permisiune necesara pentru a trage imaginea in siguranta.
7. Dati scroll jos de tot si apasati **Generate token**.
8. **COPIATI CODUL GENERAT IMEDIAT** (va incepe cu `ghp_`). Dupa ce inchideti sau dati refresh la pagina, GitHub nu vi-l va mai arata niciodata!

### Partea 2: Autentificarea si prima rulare a aplicatiei

Dupa ce ati copiat token-ul, deschideti terminalul si urmati acesti pasi:

**Pasul 1: Logarea in GitHub Registry (Se face O SINGURA DATA pe device)**

```bash
docker login ghcr.io -u <numele-vostru-de-utilizator-pe-github>

```

*Cand va cere parola, dati paste la token-ul copiat mai devreme si apasati Enter. Daca totul este corect, va aparea mesajul **Login Succeeded**.*

**Pasul 2: Descarcarea si pornirea aplicatiei**

```bash
docker pull ghcr.io/nokia-5g-sos-rover/rover-frontend:latest
docker run -d -p 8080:80 --name frontend-rover ghcr.io/nokia-5g-sos-rover/rover-frontend:latest

```

*Gata! Deschideti browserul web si intrati pe `http://localhost:8080` pentru a vedea site-ul.*

---

## Actualizarea aplicatiei locale (Dupa un push pe main)

Containerul local de Docker nu se actualizeaza in timp real. Daca s-a dat push pe branch-ul `main` trebuie sa inlocuiesti containerul vechi cu cel nou.

Ruleaza urmatoarele comenzi in terminal (WSL/Linux/PowerShell):

```bash
# 1. Opreste si sterge vechiul container care ocupa portul 8080
sudo docker stop frontend-rover
sudo docker rm frontend-rover

# 2. Descarca ultima imagine generata de pe GitHub si porneste noul container
sudo docker pull ghcr.io/nokia-5g-sos-rover/rover-frontend:latest
sudo docker run -d -p 8080:80 --name frontend-rover ghcr.io/nokia-5g-sos-rover/rover-frontend:latest

```