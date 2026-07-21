Am decis sa cream frontend-ul folosind react, facand la inceput o simpla aplicatie care afiseaza "Hello, World!" pe care dupa am incadrat-o intr-un container de docker

Dupa ce ne-am decis pentru design-ul site-ului, am folosit elemente de react si am creat un frontend cu mai multe functionalitati(sunt descrise mai bine in fisierul ui-ux-draft.md din folder-ul docs

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